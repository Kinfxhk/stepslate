// SPDX-License-Identifier: AGPL-3.0-or-later
// Plain-text rendering of states and solutions (CLI, tests, accessibility fallbacks).

import { t, type Lang } from '../i18n/messages';
import { equationText, inequalityText, toText } from '../print/print';
import type { State } from '../state';
import type { Solution } from './engine';
import { explainText } from './explain';

export function stateText(s: State, lang: Lang = 'en'): string {
  switch (s.kind) {
    case 'expr':
      return toText(s.expr);
    case 'equation':
      return equationText(s.eq);
    case 'inequality':
      return inequalityText(s);
    case 'or':
      return s.eqs.map(equationText).join(` ${t(lang, 'state.or')} `);
    case 'system':
      return s.eqs.map(equationText).join('; ');
    case 'none':
      return t(lang, 'state.none');
    case 'all':
      return t(lang, 'state.all');
    case 'infinite':
      return t(lang, 'state.infinite', { eq: equationText(s.eq) });
  }
}

/** Multi-line plain-text transcript of a solution. */
export function solutionText(sol: Solution, lang: Lang = 'en'): string {
  const lines: string[] = [];
  if (sol.message && sol.status !== 'solved') {
    if (sol.steps.length === 0) return explainText(sol.message, lang);
  }
  if (sol.problem) {
    const p = sol.problem;
    lines.push(
      p.kind === 'expr'
        ? toText(p.expr)
        : p.kind === 'equation'
          ? equationText(p.eq)
          : p.kind === 'inequality'
            ? inequalityText(p)
            : p.eqs.map(equationText).join('; '),
    );
  }
  sol.steps.forEach((st, i) => {
    lines.push(`${i + 1}. ${explainText(st.explain, lang)}`);
    if (st.info?.kind === 'substitute') {
      for (const r of st.info.rows)
        lines.push(
          `   ${toText(r.lhs)} = ${toText(r.lhsValue)};  ${toText(r.rhs)} = ${toText(r.rhsValue)}`,
        );
    } else if (st.info?.kind === 'discriminant') {
      lines.push(`   Δ = ${toText(st.info.working)} = ${toText(st.info.value)}`);
    } else {
      lines.push(`   ${stateText(st.after, lang)}`);
    }
  });
  if (sol.status !== 'solved' && sol.message) lines.push(explainText(sol.message, lang));
  return lines.join('\n');
}
