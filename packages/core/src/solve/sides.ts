// SPDX-License-Identifier: AGPL-3.0-or-later
// Simplify both sides of an equation with the T2 rules (each step verified).

import type { Equation } from '../ast';
import type { MessageKey } from '../i18n/messages';
import { nextPolyStep } from '../rules/poly';
import { diffPaths } from '../rules/tree';
import type { Explanation } from '../state';
import type { Run } from './run';

export function explanationOf(key: MessageKey, params?: object): Explanation {
  return params ? { key, params: params as Explanation['params'] & object } : { key };
}

/** Simplify the left side fully, then the right side. */
export function simplifyEquationSides(run: Run, vars: readonly string[]): void {
  for (const side of ['lhs', 'rhs'] as const) {
    for (let guard = 0; guard < 200; guard++) {
      const s = run.state;
      if (s.kind !== 'equation') return;
      const cur = s.eq[side];
      const d = nextPolyStep(cur, vars);
      if (!d) break;
      const paths = d.paths ?? diffPaths(cur, d.expr);
      const eq: Equation =
        side === 'lhs' ? { lhs: d.expr, rhs: s.eq.rhs } : { lhs: s.eq.lhs, rhs: d.expr };
      run.push({
        after: { kind: 'equation', eq },
        rule: d.rule,
        explain: explanationOf(d.key, d.params),
        highlight: paths.map((p) => [side, ...p]),
      });
    }
  }
}
