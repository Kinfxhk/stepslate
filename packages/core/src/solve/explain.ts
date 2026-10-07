// SPDX-License-Identifier: AGPL-3.0-or-later
// Turn an Explanation into text/maths segments in one language.

import type { Equation, Expr } from '../ast';
import { MESSAGES, type Lang, type MessageKey } from '../i18n/messages';
import { equationText, toText } from '../print/print';
import type { Explanation } from '../state';

export type Segment =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'math'; readonly expr: Expr }
  | { readonly type: 'equation'; readonly eq: Equation };

function isExpr(v: unknown): v is Expr {
  return typeof v === 'object' && v !== null && 'k' in v;
}
function isEquation(v: unknown): v is Equation {
  return typeof v === 'object' && v !== null && 'lhs' in v && 'rhs' in v;
}

export function explainSegments(ex: Explanation, lang: Lang): Segment[] {
  const key = ex.key as MessageKey;
  const template: string = MESSAGES[lang][key] ?? MESSAGES.en[key] ?? key;
  const out: Segment[] = [];
  let last = 0;
  for (const m of template.matchAll(/\{(\w+)\}/g)) {
    if (m.index > last) out.push({ type: 'text', text: template.slice(last, m.index) });
    const v = ex.params?.[m[1]!];
    if (v === undefined) out.push({ type: 'text', text: m[0] });
    else if (isExpr(v)) out.push({ type: 'math', expr: v });
    else if (isEquation(v)) out.push({ type: 'equation', eq: v });
    else out.push({ type: 'text', text: String(v) });
    last = m.index + m[0].length;
  }
  if (last < template.length) out.push({ type: 'text', text: template.slice(last) });
  return out;
}

export function explainText(ex: Explanation, lang: Lang): string {
  return explainSegments(ex, lang)
    .map((s) =>
      s.type === 'text' ? s.text : s.type === 'math' ? toText(s.expr) : equationText(s.eq),
    )
    .join('');
}
