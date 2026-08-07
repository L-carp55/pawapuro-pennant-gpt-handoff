import assert from 'node:assert/strict';
import {parseFieldingErrorDescription,bresultErrorPosition,fieldErrorTrainingLabel} from '../src/ratings/fielding_error_labels.mjs';

const cases=[
 ['門脇(遊)のファンブルにより出塁する 一塁','field','遊'],
 ['山川(一):捕球ミス 一塁','field','一'],
 ['浅村(三):ファウルフライを落球','field','三'],
 ['阿部(左):後逸 三塁','field','左'],
 ['太田(二):送球ミス','throw','二'],
 ['水野(遊):悪送球 一三塁','throw','遊'],
 ['村上(三)のエラーにより出塁','unknown','三'],
];
for(const [d,k,p] of cases){const x=parseFieldingErrorDescription(d);assert.equal(x?.kind,k,d);assert.equal(x?.pos,p,d);}
const generic=parseFieldingErrorDescription('1球目:犠打失策 一二塁');assert.equal(generic?.kind,'unknown');assert.equal(generic?.pos,null);
assert.equal(parseFieldingErrorDescription('ショートへの内野安打 一塁'),null);
assert.equal(bresultErrorPosition('100.0'),'投');assert.equal(bresultErrorPosition(105),'遊');assert.equal(bresultErrorPosition(108),'右');assert.equal(bresultErrorPosition(115),null);
assert.deepEqual(fieldErrorTrainingLabel({error:parseFieldingErrorDescription('門脇(遊)のファンブル'),playPos:'遊',bresult:105}),{label:1,status:'FIELD_ERROR',suspected:false});
assert.equal(fieldErrorTrainingLabel({error:parseFieldingErrorDescription('門脇(遊)の悪送球'),playPos:'遊',bresult:105}).label,0);
assert.equal(fieldErrorTrainingLabel({error:parseFieldingErrorDescription('投手(投)の悪送球'),playPos:'一',bresult:100}).label,0);
assert.equal(fieldErrorTrainingLabel({error:null,playPos:'遊',bresult:105}).label,null,'position error code without text is excluded, not negative');
assert.equal(fieldErrorTrainingLabel({error:null,playPos:'遊',bresult:7}).label,0);
assert.equal(fieldErrorTrainingLabel({error:null,playPos:'遊',bresult:7,broadErrorText:true}).label,null);
console.log('fielding error labels: 24 checks passed');
