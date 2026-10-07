// SPDX-License-Identifier: AGPL-3.0-or-later
// Printers: plain text (re-parsable), LaTeX (for KaTeX) and a canonical key.

import type { Equation, Expr } from '../ast';
import { hasVar } from '../ast';

/** Binding strength used to decide where brackets are needed. */
function prec(e: Expr): number {
  switch (e.k) {
    case 'pm':
      return 0;
    case 'add':
    case 'sub':
      return 1;
    case 'neg':
      return 2;
    case 'mul':
    case 'div':
      return 3;
    case 'pow':
      return 4;
    default:
      return 5;
  }
}

/** Does child `c` need brackets as operand `side` of parent `p`? */
export function needsParens(p: Expr, c: Expr, side: 'a' | 'b'): boolean {
  const pc = prec(c);
  switch (p.k) {
    case 'add':
    case 'sub':
    case 'pm':
      return side === 'a' ? pc < 1 : pc <= 2; // right side: add/sub/neg need brackets
    case 'neg':
      return pc <= 2;
    case 'mul':
    case 'div':
      return side === 'a' ? pc < 3 : pc <= 3;
    case 'pow':
      return side === 'a' ? pc <= 4 : pc < 5;
    default:
      return false;
  }
}

// ---- plain text ---------------------------------------------------------------------

export function toText(e: Expr): string {
  const wrap = (p: Expr, c: Expr, side: 'a' | 'b') =>
    needsParens(p, c, side) ? `(${toText(c)})` : toText(c);
  switch (e.k) {
    case 'num':
      return e.text ?? e.v.toString();
    case 'var':
      return e.name;
    case 'neg':
      return `-${wrap(e, e.a, 'a')}`;
    case 'add':
      return `${wrap(e, e.a, 'a')} + ${wrap(e, e.b, 'b')}`;
    case 'sub':
      return `${wrap(e, e.a, 'a')} - ${wrap(e, e.b, 'b')}`;
    case 'pm':
      return `${wrap(e, e.a, 'a')} ± ${wrap(e, e.b, 'b')}`;
    case 'mul': {
      const l = wrap(e, e.a, 'a');
      const r = wrap(e, e.b, 'b');
      // Juxtapose when unambiguous: 2x, 3(x+1), (x+1)(x-1), xy. A fraction on the left
      // gets brackets so "(1/2)x" is not misread.
      const leftFraction = e.a.k === 'div';
      const rightStartsWithLetterOrBracket = /^[a-zA-Z(]/.test(r) && !r.startsWith('sqrt');
      if (rightStartsWithLetterOrBracket && !/\d\.$/.test(l)) {
        return leftFraction && !l.startsWith('(') ? `(${l})${r}` : `${l}${r}`;
      }
      return `${l}*${r}`;
    }
    case 'div':
      return `${wrap(e, e.a, 'a')}/${wrap(e, e.b, 'b')}`;
    case 'pow':
      return `${wrap(e, e.a, 'a')}^${wrap(e, e.b, 'b')}`;
    case 'sqrt':
      return `sqrt(${toText(e.a)})`;
  }
}

export function equationText(q: Equation): string {
  return `${toText(q.lhs)} = ${toText(q.rhs)}`;
}

// ---- canonical key ------------------------------------------------------------------

/** Fully bracketed canonical form, equal for structurally equal trees. */
export function toKey(e: Expr): string {
  switch (e.k) {
    case 'num':
      return e.v.toString();
    case 'var':
      return e.name;
    case 'neg':
      return `(-${toKey(e.a)})`;
    case 'sqrt':
      return `sqrt(${toKey(e.a)})`;
    default: {
      const op = { add: '+', sub: '-', mul: '*', div: '/', pow: '^', pm: '±' }[e.k];
      return `(${toKey(e.a)}${op}${toKey(e.b)})`;
    }
  }
}

// ---- LaTeX --------------------------------------------------------------------------

export interface LatexOptions {
  /** Subtrees (by identity) to wrap in \htmlClass{ss-hl}{...}. */
  readonly highlight?: ReadonlySet<Expr>;
}

function startsWithDigit(e: Expr): boolean {
  switch (e.k) {
    case 'num':
      return true;
    case 'pow':
    case 'mul':
      return startsWithDigit(e.a);
    case 'div':
      return true; // \frac would read like a mixed number after a digit
    default:
      return false;
  }
}

export function toLatex(e: Expr, opts: LatexOptions = {}): string {
  const inner = latexInner(e, opts);
  return opts.highlight?.has(e) ? `\\htmlClass{ss-hl}{${inner}}` : inner;
}

function paren(s: string): string {
  return `\\left(${s}\\right)`;
}

function latexInner(e: Expr, opts: LatexOptions): string {
  const L = (c: Expr) => toLatex(c, opts);
  const wrap = (p: Expr, c: Expr, side: 'a' | 'b') =>
    needsParens(p, c, side) ? paren(L(c)) : L(c);
  switch (e.k) {
    case 'num':
      return e.text ?? e.v.toString();
    case 'var':
      return e.name;
    case 'neg':
      return `-${wrap(e, e.a, 'a')}`;
    case 'add':
      return `${wrap(e, e.a, 'a')} + ${wrap(e, e.b, 'b')}`;
    case 'sub':
      return `${wrap(e, e.a, 'a')} - ${wrap(e, e.b, 'b')}`;
    case 'pm':
      return `${wrap(e, e.a, 'a')} \\pm ${wrap(e, e.b, 'b')}`;
    case 'mul': {
      const l = wrap(e, e.a, 'a');
      const rNeedsParens = needsParens(e, e.b, 'b');
      const r = rNeedsParens ? paren(L(e.b)) : L(e.b);
      if ((!rNeedsParens && startsWithDigit(e.b)) || (!hasVar(e.a) && !hasVar(e.b)))
        return `${l} \\times ${r}`;
      if (e.b.k === 'sqrt' && e.a.k !== 'num') return `${l} \\cdot ${r}`;
      return `${l}${r}`;
    }
    case 'div': {
      // Nested fractions are hard to read; use ÷ when either side is itself a division.
      if (e.a.k === 'div' || e.b.k === 'div' || (e.b.k === 'neg' && e.b.a.k === 'div'))
        return `${wrap(e, e.a, 'a')} \\div ${needsParens(e, e.b, 'b') ? paren(L(e.b)) : L(e.b)}`;
      return `\\frac{${L(e.a)}}{${L(e.b)}}`;
    }
    case 'pow': {
      const base = needsParens(e, e.a, 'a') || e.a.k === 'div' ? paren(L(e.a)) : L(e.a);
      return `{${base}}^{${L(e.b)}}`;
    }
    case 'sqrt':
      return `\\sqrt{${L(e.a)}}`;
  }
}

export function equationLatex(q: Equation, opts: LatexOptions = {}): string {
  return `${toLatex(q.lhs, opts)} = ${toLatex(q.rhs, opts)}`;
}
