// SPDX-License-Identifier: AGPL-3.0-or-later
// "Check" steps: substitute the answer back into the original equation(s).

import type { Equation, Expr } from '../ast';
import { eqn, substitute, v } from '../ast';
import type { Surd } from '../numbers/surd';
import { surdExpr } from '../rules/equation';
import { evalSurd } from '../verify/evaluate';
import type { Run } from './run';

export function pushCheck(
  run: Run,
  originals: readonly Equation[],
  values: Record<string, Surd>,
): void {
  const valueExprs: Record<string, Expr> = {};
  for (const [name, s] of Object.entries(values)) valueExprs[name] = surdExpr(s);
  const rows = originals.map((q) => {
    let lhs = q.lhs;
    let rhs = q.rhs;
    for (const [name, e] of Object.entries(valueExprs)) {
      lhs = substitute(lhs, name, e);
      rhs = substitute(rhs, name, e);
    }
    return {
      lhs,
      lhsValue: surdExpr(evalSurd(lhs, new Map())),
      rhs,
      rhsValue: surdExpr(evalSurd(rhs, new Map())),
    };
  });
  const names = Object.keys(valueExprs).sort();
  const shown = names.map((n) => eqn(v(n), valueExprs[n]!));
  run.push({
    after: run.state,
    rule: 'check',
    explain:
      shown.length === 1
        ? { key: 'eq.check', params: { value: shown[0]! } }
        : { key: 'eq.check-pair', params: { value: shown[0]!, value2: shown[1]! } },
    info: { kind: 'substitute', values: valueExprs, rows },
  });
}
