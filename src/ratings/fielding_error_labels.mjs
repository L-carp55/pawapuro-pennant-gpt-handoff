// PBP説明文から、捕球(FE)と送球(TE)を保守的に分離する純粋関数。
// bresult 100-108は2020-2025で失策語に強く集中するが完全専用ではないため、
// FE/TE判定には使わず「失策疑い・負例から除外」の補助フラグにだけ使う。

const POS_JA=['投','捕','一','二','三','遊','左','中','右'];
const POS_CLASS='投捕一二三遊左中右';
const NAME='([^()、。]+?)';
const posPattern=`([${POS_CLASS}])`;
const FIELD_WORD='(落球|後逸|ファンブル|捕球ミス|トンネル|お手玉)';
const THROW_WORD='(悪送球|送球ミス)';

const THROW_RE=new RegExp(`${NAME}\\(${posPattern}\\)[^、。]{0,40}${THROW_WORD}`);
const FIELD_RE=new RegExp(`${NAME}\\(${posPattern}\\)[^、。]{0,50}${FIELD_WORD}`);
const UNKNOWN_RE=new RegExp(`${NAME}\\(${posPattern}\\)[^、。]{0,40}(?:エラー|失策)`);
export const BROAD_ERROR_RE=/エラー|失策|悪送球|後逸|落球|ファンブル|トンネル|お手玉|捕球ミス|送球ミス/;

const norm=s=>String(s??'').normalize('NFKC').replace(/[\s　]/g,'');

export function parseFieldingErrorDescription(description){
  const d=String(description??'').replace(/^\d+球目:/,'');
  let m=d.match(THROW_RE);
  if(m)return {kind:'throw',fielder:norm(m[1]),pos:m[2],description:d};
  m=d.match(FIELD_RE);
  if(m)return {kind:'field',fielder:norm(m[1]),pos:m[2],description:d};
  m=d.match(UNKNOWN_RE);
  if(m)return {kind:'unknown',fielder:norm(m[1]),pos:m[2],description:d};
  if(BROAD_ERROR_RE.test(d))return {kind:'unknown',fielder:null,pos:null,description:d};
  return null;
}

export function bresultErrorPosition(bresult){
  if(bresult===null||bresult===undefined||bresult==='')return null;
  const n=Number(String(bresult).replace(/\.0$/,''));
  return Number.isInteger(n)&&n>=100&&n<=108 ? POS_JA[n-100] : null;
}

// Binary FE model用の安全なラベル契約。
// field=1, known non-FE=0, current-fielder error type不明/suspicious=null（学習除外）。
export function fieldErrorTrainingLabel({error,playPos,bresult,broadErrorText=false}){
  const suspectedPos=bresultErrorPosition(bresult);
  if(error){
    if(error.pos&&error.pos!==playPos)return {label:0,status:'OTHER_FIELDER_ERROR',suspected:false};
    if(error.kind==='field')return {label:1,status:'FIELD_ERROR',suspected:false};
    if(error.kind==='throw')return {label:0,status:'THROW_ERROR',suspected:false};
    return {label:null,status:'UNKNOWN_ERROR',suspected:true};
  }
  if(broadErrorText)return {label:null,status:'UNPARSED_ERROR_TEXT',suspected:true};
  if(suspectedPos===playPos)return {label:null,status:'BRESULT_SUSPECTED_ERROR',suspected:true};
  return {label:0,status:'NO_FIELD_ERROR',suspected:false};
}
