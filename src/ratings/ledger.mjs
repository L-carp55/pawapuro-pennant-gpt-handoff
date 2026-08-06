// 調整台帳（Sol仕様 02 §5.5、03 §4.5/§5.6、05 §8）
//
// 4層分離の第3層「個別査定能力」を作る装置。
// 平均得能込み基準（第2層）から、その選手固有の得能ぶんを足し引きして基礎能力を出す。
//
// 仕様の核:
//   §5.5 二重計上禁止。完全な AVG_vsR_nonRISP を使ったなら、チャンス/対左でさらに引かない
//   05 §8 各得能に already_reflected_in_base フラグ。true なら能力値側で再調整しない
//   03 §4.5 manual_delta != 0 なら理由と根拠を必須。同じ要素を二行に入れない

export class AdjustmentLedger {
  constructor(ability, baseline) {
    this.ability = ability;       // 'meet' | 'power' | ...
    this.baseline = baseline;     // 第2層（平均得能込み基準）の値
    this.entries = [];
  }

  /**
   * @param {string} component 調整の名前（同名の二重追加は例外）
   * @param {number} delta 増減
   * @param {object} opts {reason, source, provisional, informationSource}
   *   informationSource: この調整が使った情報の識別子。同じ情報源を2回使うと二重計上になる
   */
  add(component, delta, opts = {}) {
    if (this.entries.some(e => e.component === component)) {
      throw new Error(`調整台帳の二重登録: ${this.ability}.${component}`);
    }
    if (delta !== 0 && !opts.reason) {
      throw new Error(`調整には理由が必要: ${this.ability}.${component}`);
    }
    this.entries.push({
      component, delta,
      reason: opts.reason ?? null,
      source: opts.source ?? null,
      provisional: opts.provisional ?? false,
      informationSource: opts.informationSource ?? null,
    });
    return this;
  }

  /** 調整しないと決めた項目も記録する（「検討したが不要」と「見落とし」を区別するため） */
  skip(component, reason) {
    return this.add(component, 0, { reason: `[調整不要] ${reason}` });
  }

  /**
   * 二重計上の検査（仕様§5.5）。
   * 同じ informationSource を複数の調整が使っていたら、その情報が二重に効いている。
   */
  checkDoubleCount() {
    const seen = new Map();
    const conflicts = [];
    for (const e of this.entries) {
      if (!e.informationSource || e.delta === 0) continue;
      if (seen.has(e.informationSource)) {
        conflicts.push({ informationSource: e.informationSource, components: [seen.get(e.informationSource), e.component] });
      } else {
        seen.set(e.informationSource, e.component);
      }
    }
    return conflicts;
  }

  finalize() {
    const conflicts = this.checkDoubleCount();
    if (conflicts.length) {
      throw new Error(`二重計上を検出: ${JSON.stringify(conflicts)}`);
    }
    const total = this.entries.reduce((a, e) => a + e.delta, 0);
    return {
      ability: this.ability,
      baseline: this.baseline,
      adjustments: this.entries,
      totalDelta: total,
      final: this.baseline + total,
      hasProvisional: this.entries.some(e => e.provisional && e.delta !== 0),
    };
  }

  /** 人が読む形（仕様§15「途中式を省略しない」） */
  static render(result) {
    const lines = [`${result.ability}: 平均得能込み基準 ${result.baseline.toFixed(1)}`];
    for (const e of result.adjustments) {
      const sign = e.delta > 0 ? '+' : '';
      lines.push(`  ${e.delta === 0 ? ' ' : sign}${e.delta.toFixed(1).padStart(5)}  ${e.component}${e.reason ? '  — ' + e.reason : ''}${e.provisional ? ' [暫定]' : ''}`);
    }
    lines.push(`  = ${result.final.toFixed(1)}`);
    return lines.join('\n');
  }
}
