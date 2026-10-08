// SPDX-License-Identifier: AGPL-3.0-or-later
// Rendering of verified steps and states (shared by the solver and practice pages).

import { stateLatex, t, toLatex, type Lang, type State, type Step } from '@sumstair/core';
import { ruleKey, ui } from './i18n';
import { explanationElement, mathElement } from './math';

export function stepElement(st: Step, i: number, lang: Lang): HTMLElement {
  const li = document.createElement('li');
  li.className = 'step';
  li.tabIndex = -1;
  li.dataset.rule = st.rule;
  const head = document.createElement('div');
  head.className = 'step-head';
  const num = document.createElement('span');
  num.className = 'num';
  num.textContent = String(i + 1);
  const rule = document.createElement('span');
  rule.className = 'rule';
  rule.textContent = ui(lang, ruleKey(st.rule));
  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = `✓ ${ui(lang, 'steps.verified')}`;
  badge.title = ui(lang, 'steps.verifiedTitle');
  head.append(num, rule, badge);
  li.append(head, explanationElement(st.explain, lang));
  const body = document.createElement('div');
  body.className = 'step-math';
  if (st.info?.kind === 'substitute') {
    const table = document.createElement('div');
    table.className = 'check-rows';
    for (const r of st.info.rows) {
      const row = document.createElement('div');
      row.className = 'check-row';
      const l = mathElement(`${toLatex(r.lhs)} = ${toLatex(r.lhsValue)}`);
      const rr = mathElement(`${toLatex(r.rhs)} = ${toLatex(r.rhsValue)}`);
      const lab1 = document.createElement('span');
      lab1.className = 'muted';
      lab1.textContent = ui(lang, 'check.lhs');
      const lab2 = document.createElement('span');
      lab2.className = 'muted';
      lab2.textContent = ui(lang, 'check.rhs');
      row.append(lab1, l, lab2, rr);
      table.append(row);
    }
    body.append(table);
  } else if (st.info?.kind === 'discriminant') {
    body.append(
      mathElement(`\\Delta = ${toLatex(st.info.working)} = ${toLatex(st.info.value)}`, true, 'div'),
    );
  } else {
    body.append(stateElement(st.after, lang, st.highlight));
  }
  li.append(body);
  return li;
}

export function stateElement(s: State, lang: Lang, highlight?: Step['highlight']): HTMLElement {
  const latex = stateLatex(s, {
    ...(highlight ? { highlight } : {}),
    orWord: ui(lang, 'answer.or'),
  });
  if (latex !== undefined) return mathElement(latex, true, 'div');
  const p = document.createElement('p');
  p.className = 'state-text';
  p.textContent = s.kind === 'none' ? t(lang, 'state.none') : t(lang, 'state.all');
  return p;
}
