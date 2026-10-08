// SPDX-License-Identifier: AGPL-3.0-or-later
// T6 strategy: simplify, then factorise. Every rewrite is an identity, so the existing
// verifier accepts it without any weaker check.

import type { Expr, Problem } from '../ast';
import { readCanonical } from '../rules/poly';
import { factorisationSteps } from '../rules/factor';
import type { Run } from './run';
import { simplifySteps } from './t2';

export function solveFactorise(run: Run, problem: Problem, vars: readonly string[]): void {
  if (problem.kind !== 'expr') return;
  simplifySteps(problem.expr, vars, (next, d) =>
    run.push({
      after: { kind: 'expr', expr: next },
      rule: d.rule,
      explain: d.params
        ? { key: d.key as never, params: d.params as never }
        : { key: d.key as never },
      highlight: d.paths,
    }),
  );
  const cur: Expr = run.state.kind === 'expr' ? run.state.expr : problem.expr;
  const monos = readCanonical(cur);
  if (!monos) return;
  for (const step of factorisationSteps(monos, vars)) {
    run.push({
      after: { kind: 'expr', expr: step.expr },
      rule: step.rule,
      explain: step.params ? { key: step.key, params: step.params } : { key: step.key },
    });
  }
}
