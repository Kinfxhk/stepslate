// SPDX-License-Identifier: AGPL-3.0-or-later
// A number line drawn from an already-verified bound. It is a picture of the
// answer, not a solving step, and it does not compute anything.

import type { Rel } from '@sumstair/core';

const NS = 'http://www.w3.org/2000/svg';

function el(name: string, attrs: Record<string, string>): SVGElement {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}

/** Open circle for < and >, filled circle for ≤ and ≥, ray on the solution side. */
export function numberLine(rel: Rel, bound: string): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 280 56');
  svg.setAttribute('class', 'number-line');
  svg.setAttribute('role', 'img');
  const word =
    rel === '<'
      ? 'less than'
      : rel === '<='
        ? 'less than or equal to'
        : rel === '>'
          ? 'greater than'
          : 'greater than or equal to';
  svg.setAttribute('aria-label', `${word} ${bound}`);
  const left = rel === '<' || rel === '<=';
  const closed = rel === '<=' || rel === '>=';
  svg.append(
    el('line', { x1: '16', y1: '28', x2: '264', y2: '28', class: 'axis' }),
    el('line', {
      x1: left ? '16' : '140',
      y1: '28',
      x2: left ? '140' : '264',
      y2: '28',
      class: 'ray',
    }),
    el('circle', {
      cx: '140',
      cy: '28',
      r: '5',
      class: closed ? 'dot filled' : 'dot open',
    }),
  );
  const label = el('text', { x: '140', y: '48', class: 'bound' });
  label.textContent = bound;
  svg.append(label);
  return svg as SVGSVGElement;
}
