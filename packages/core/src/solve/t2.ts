// SPDX-License-Identifier: AGPL-3.0-or-later
// T2 strategy: simplify a polynomial expression step by step.

import type { Expr } from '../ast';
import { nextPolyStep } from '../rules/poly';
import { diffPaths } from '../rules/tree';
import type { Path } from '../state';
import type { Run } from './run';

/** Simplify `e` (located at `prefix` inside the state) and report each step via `emit`. */
export function simplifySteps(
  e: Expr,
  vars: readonly string[],
  emit: (next: Expr, d: { rule: string; key: string; params?: object; paths: Path[] }) => void,
): Expr {
  let cur = e;
  for (let guard = 0; guard < 200; guard++) {
    const d = nextPolyStep(cur, vars);
    if (!d) return cur;
    const paths = (d.paths ?? diffPaths(cur, d.expr)) as Path[];
    emit(d.expr, { rule: d.rule, key: d.key, ...(d.params ? { params: d.params } : {}), paths });
    cur = d.expr;
  }
  return cur;
}

export function solvePolynomial(run: Run, e: Expr, vars: readonly string[]): void {
  simplifySteps(e, vars, (next, d) =>
    run.push({
      after: { kind: 'expr', expr: next },
      rule: d.rule,
      explain: d.params
        ? { key: d.key as never, params: d.params as never }
        : { key: d.key as never },
      highlight: d.paths,
    }),
  );
}
