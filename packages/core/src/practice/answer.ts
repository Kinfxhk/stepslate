// SPDX-License-Identifier: AGPL-3.0-or-later
// Answer checking by mathematical equivalence (0.5 = 1/2, "x = 2" = "2", roots in any order).

import type { Expr, Rel } from '../ast';
import { hasVar, variables } from '../ast';
import type { Rational } from '../numbers/rational';
import type { Surd } from '../numbers/surd';
import { ParseError } from '../parse/errors';
import { parseExpr } from '../parse/parser';
import { toText } from '../print/print';
import { surdExpr } from '../rules/equation';
import { isSumLike, flatten } from '../rules/poly';
import type { Solution } from '../solve/engine';
import { evalRational, evalSurd, expandPm, Unverifiable } from '../verify/evaluate';
import { identical } from '../verify/poly';

export type Verdict = 'correct' | 'wrong' | 'unreadable';

const NONE = /^(none|no( real)? (solution|roots?)|no real|無解|沒有實數根|沒有實數解|無實根|無)$/i;
const ALL = /^(all|all real numbers|every real number|any|所有實數)$/i;
const INFINITE = /^(infinite|infinitely many|無限多組解|無限多)$/i;

function parse(text: string): Expr | undefined {
  try {
    return parseExpr(text);
  } catch (e) {
    if (e instanceof ParseError) return undefined;
    throw e;
  }
}

/** Values in "x = 2, 3", "x=2 or x=3", "(5±√13)/2" … ; undefined if unreadable. */
function readValues(text: string, name: string): Surd[] | undefined {
  const parts = text
    .split(/,|;|\bor\b|或|\band\b|及/i)
    .map((p) => p.trim())
    .filter((p) => p !== '');
  if (parts.length === 0) return undefined;
  const out: Surd[] = [];
  for (let part of parts) {
    const m = new RegExp(`^${name}\\s*=\\s*(.*)$`).exec(part);
    if (m) part = m[1]!;
    const e = parse(part);
    if (!e || hasVar(e)) return undefined;
    try {
      for (const branch of expandPm(e)) out.push(evalSurd(branch, new Map()));
    } catch (err) {
      if (err instanceof Unverifiable || err instanceof RangeError) return undefined;
      throw err;
    }
  }
  return out;
}

function sameSet(a: readonly Surd[], b: readonly Surd[]): boolean {
  const key = (xs: readonly Surd[]) => [...new Set(xs.map((x) => x.key()))].sort().join('|');
  return key(a) === key(b);
}

/**
 * No more bracketed sums, and no more terms, than the target answer.
 * A factored answer keeps sums inside the brackets; an expanded answer does not,
 * so typing the unexpanded form back is still wrong.
 */
function countBracketed(e: Expr): number {
  let n = 0;
  const visit = (node: Expr, top: boolean): void => {
    if (node.k === 'num' || node.k === 'var') return;
    if (!top && isSumLike(node)) n++;
    if (node.k === 'add' || node.k === 'sub') {
      visit(node.a, top);
      visit(node.b, false);
      return;
    }
    if (node.k === 'neg') return visit(node.a, top);
    visit(node.a, false);
    if ('b' in node) visit(node.b, false);
  };
  visit(e, true);
  return n;
}

function looksSimplified(e: Expr, target: Expr): boolean {
  return countBracketed(e) <= countBracketed(target) && flatten(e).length <= flatten(target).length;
}

export function checkAnswer(sol: Solution, text: string): Verdict {
  const answer = sol.answer;
  const input = text.trim();
  if (!answer || input === '') return 'unreadable';
  switch (answer.kind) {
    case 'value': {
      const e = parse(input);
      if (!e || hasVar(e)) return 'unreadable';
      try {
        return evalRational(e, new Map()).eq(answer.value) ? 'correct' : 'wrong';
      } catch {
        return 'unreadable';
      }
    }
    case 'expression': {
      const e = parse(input);
      if (!e) return 'unreadable';
      const vars = [...new Set([...variables(e), ...variables(answer.expr)])].sort();
      try {
        return identical(e, answer.expr, vars) && looksSimplified(e, answer.expr)
          ? 'correct'
          : 'wrong';
      } catch {
        return 'unreadable';
      }
    }
    case 'roots': {
      if (NONE.test(input) || ALL.test(input)) return 'wrong';
      const vals = readValues(input, answer.variable);
      if (!vals) return 'unreadable';
      return sameSet(vals, answer.values) ? 'correct' : 'wrong';
    }
    case 'no-solution':
      return NONE.test(input) ? 'correct' : 'wrong';
    case 'all-real':
      return ALL.test(input) ? 'correct' : 'wrong';
    case 'infinitely-many':
      return INFINITE.test(input) ? 'correct' : 'wrong';
    case 'interval': {
      const got = readInterval(input, answer.variable);
      if (!got) return 'unreadable';
      return got.rel === answer.rel && got.bound.eq(answer.bound) ? 'correct' : 'wrong';
    }
    case 'pair': {
      const [x, y] = answer.vars;
      const parts = input.split(/,|;|\band\b|及/i).map((p) => p.trim());
      if (parts.length !== 2) return 'unreadable';
      const got: Partial<Record<string, Rational>> = {};
      for (let i = 0; i < 2; i++) {
        let part = parts[i]!;
        let name = i === 0 ? x : y;
        const m = /^([a-zA-Z])\s*=\s*(.*)$/.exec(part);
        if (m) {
          name = m[1]!;
          part = m[2]!;
        }
        const e = parse(part);
        if (!e || hasVar(e) || (name !== x && name !== y)) return 'unreadable';
        try {
          got[name] = evalRational(e, new Map());
        } catch {
          return 'unreadable';
        }
      }
      const gx = got[x];
      const gy = got[y];
      if (!gx || !gy) return 'unreadable';
      return gx.eq(answer.values[0]) && gy.eq(answer.values[1]) ? 'correct' : 'wrong';
    }
  }
}

/** A canonical typed answer (what a student could type), for tests and "show answer". */
export function answerText(sol: Solution): string {
  const a = sol.answer;
  if (!a) return '';
  switch (a.kind) {
    case 'value':
      return toText(a.expr);
    case 'expression':
      return toText(a.expr);
    case 'roots':
      return `${a.variable} = ${a.values.map((v) => toText(surdExpr(v))).join(', ')}`;
    case 'no-solution':
      return 'none';
    case 'all-real':
      return 'all real numbers';
    case 'infinitely-many':
      return 'infinitely many';
    case 'pair':
      return `${a.vars[0]} = ${a.values[0].toString()}, ${a.vars[1]} = ${a.values[1].toString()}`;
    case 'interval':
      return `${a.variable} ${a.rel} ${a.bound.toString()}`;
  }
}

function readInterval(text: string, name: string): { rel: Rel; bound: Rational } | undefined {
  const norm = text
    .trim()
    .replace(/\u2264/g, '<=')
    .replace(/\u2265/g, '>=');
  const m = /^(?:([a-zA-Z])\s*)?(<=|>=|<|>)\s*(.+)$/.exec(norm);
  if (!m) return undefined;
  if (m[1] && m[1] !== name) return undefined;
  const e = parse(m[3]!);
  if (!e || hasVar(e)) return undefined;
  try {
    return { rel: m[2] as Rel, bound: evalRational(e, new Map()) };
  } catch {
    return undefined;
  }
}
