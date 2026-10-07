// SPDX-License-Identifier: AGPL-3.0-or-later
// LaTeX for states and problems (rendered by KaTeX in the web UI), with highlights.

import type { Equation, Expr, Problem } from '../ast';
import { equationLatex, toLatex } from '../print/print';
import type { Path, State } from '../state';

function exprAt(e: Expr, path: readonly (string | number)[]): Expr | undefined {
  let cur: Expr = e;
  for (const p of path) {
    if (p !== 'a' && p !== 'b') return undefined;
    const next = (cur as { a?: Expr; b?: Expr })[p];
    if (!next) return undefined;
    cur = next;
  }
  return cur;
}

function eqAt(q: Equation, path: readonly (string | number)[], out: Set<Expr>): void {
  const [side, ...rest] = path;
  if (side === undefined) {
    out.add(q.lhs);
    out.add(q.rhs);
    return;
  }
  if (side !== 'lhs' && side !== 'rhs') return;
  const node = exprAt(q[side], rest);
  if (node) out.add(node);
}

/** The subtrees of `s` named by highlight paths. */
export function highlightNodes(s: State, paths: readonly Path[] = []): Set<Expr> {
  const out = new Set<Expr>();
  for (const p of paths) {
    if (s.kind === 'expr') {
      const node = exprAt(s.expr, p);
      if (node) out.add(node);
    } else if (s.kind === 'equation' || s.kind === 'infinite') eqAt(s.eq, p, out);
    else if ((s.kind === 'or' || s.kind === 'system') && p[0] === 'eqs') {
      const q = s.eqs[Number(p[1])];
      if (q) eqAt(q, p.slice(2), out);
    }
  }
  return out;
}

/** LaTeX for a state, or undefined for word-only states (no solution, all numbers). */
export function stateLatex(
  s: State,
  opts: { readonly highlight?: readonly Path[]; readonly orWord?: string } = {},
): string | undefined {
  const highlight = highlightNodes(s, opts.highlight);
  const L = { highlight };
  switch (s.kind) {
    case 'expr':
      return toLatex(s.expr, L);
    case 'equation':
    case 'infinite':
      return equationLatex(s.eq, L);
    case 'or':
      return s.eqs
        .map((q) => equationLatex(q, L))
        .join(` \\quad\\text{${opts.orWord ?? 'or'}}\\quad `);
    case 'system':
      return `\\begin{cases} ${s.eqs.map((q) => equationLatex(q, L)).join(' \\\\ ')} \\end{cases}`;
    default:
      return undefined;
  }
}

export function problemLatex(p: Problem): string {
  if (p.kind === 'expr') return toLatex(p.expr);
  if (p.kind === 'equation') return equationLatex(p.eq);
  return `\\begin{cases} ${p.eqs.map((q) => equationLatex(q)).join(' \\\\ ')} \\end{cases}`;
}
