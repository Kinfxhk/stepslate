// SPDX-License-Identifier: AGPL-3.0-or-later
// T1 strategy: evaluate a number-only expression one operation at a time.

import type { Expr } from '../ast';
import { neg, num } from '../ast';
import { hasDecimal, isFinalNumber, nextArithmetic } from '../rules/arith';
import { atomValue } from '../rules/tree';
import type { Run } from './run';

export function solveArithmetic(run: Run, original: Expr): void {
  const hadDecimal = hasDecimal(original);
  for (;;) {
    const s = run.state;
    if (s.kind !== 'expr') return;
    const drafts = nextArithmetic(s.expr);
    if (drafts.length === 0) break;
    for (const d of drafts)
      run.push({
        after: { kind: 'expr', expr: d.expr },
        rule: d.rule,
        explain: d.params ? { key: d.key, params: d.params } : { key: d.key },
        highlight: d.paths,
      });
  }
  const s = run.state;
  if (s.kind !== 'expr' || !isFinalNumber(s.expr)) return;
  const v = atomValue(s.expr);
  const dec = v.toDecimalString();
  if (hadDecimal && !v.isInteger() && dec !== undefined) {
    const abs = dec.replace(/^-/, '');
    const out = num(v.abs(), abs);
    const after: Expr = v.sign() < 0 ? neg(out) : out;
    run.push({
      after: { kind: 'expr', expr: after },
      rule: 'arith.to-decimal',
      explain: { key: 'arith.to-decimal', params: { before: s.expr, after } },
      highlight: [[]],
    });
  }
}
