// SPDX-License-Identifier: AGPL-3.0-or-later
// KaTeX rendering (HTML for sight, MathML for screen readers). Everything is local.

import katex from 'katex';
import 'katex/dist/katex.min.css';
import {
  equationLatex,
  explainSegments,
  toLatex,
  toText,
  equationText,
  type Explanation,
  type Lang,
} from '@sumstair/core';

const OPTIONS = {
  output: 'htmlAndMathml',
  throwOnError: false,
  strict: 'ignore',
  // Only our own highlight class may be used; input never reaches KaTeX as raw LaTeX.
  trust: (ctx: { command: string }) => ctx.command === '\\htmlClass',
} as const;

export function renderMath(el: HTMLElement, latex: string, display = false): void {
  katex.render(latex, el, { ...OPTIONS, displayMode: display });
}

export function mathElement(latex: string, display = false, tag = 'span'): HTMLElement {
  const el = document.createElement(tag);
  el.className = display ? 'math display' : 'math';
  renderMath(el, latex, display);
  return el;
}

/** An explanation sentence with inline maths, in the given language. */
export function explanationElement(ex: Explanation, lang: Lang): HTMLElement {
  const p = document.createElement('p');
  p.className = 'explain';
  for (const s of explainSegments(ex, lang)) {
    if (s.type === 'text') p.append(document.createTextNode(s.text));
    else if (s.type === 'math') p.append(mathElement(toLatex(s.expr)));
    else p.append(mathElement(equationLatex(s.eq)));
  }
  return p;
}

export function explanationPlain(ex: Explanation, lang: Lang): string {
  return explainSegments(ex, lang)
    .map((s) =>
      s.type === 'text' ? s.text : s.type === 'math' ? toText(s.expr) : equationText(s.eq),
    )
    .join('');
}
