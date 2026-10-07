// SPDX-License-Identifier: AGPL-3.0-or-later
// Tree helpers for the rule engine: paths, replacement, number atoms.

import type { Expr } from '../ast';
import { div, neg, num } from '../ast';
import { abs } from '../numbers/bigint';
import { Rational } from '../numbers/rational';

export type Side = 'a' | 'b';

export function getAt(e: Expr, path: readonly Side[]): Expr {
  let cur = e;
  for (const s of path) cur = (cur as { a: Expr; b: Expr })[s];
  return cur;
}

export function replaceAt(e: Expr, path: readonly Side[], node: Expr): Expr {
  if (path.length === 0) return node;
  const [head, ...rest] = path as [Side, ...Side[]];
  const child = (e as { a: Expr; b: Expr })[head];
  return { ...e, [head]: replaceAt(child, rest, node) } as Expr;
}

/** Visit every node with its path (pre-order, left to right). */
export function walk(e: Expr, f: (node: Expr, path: Side[]) => void, path: Side[] = []): void {
  f(e, path);
  if (e.k === 'num' || e.k === 'var') return;
  walk(e.a, f, [...path, 'a']);
  if ('b' in e) walk(e.b, f, [...path, 'b']);
}

export const isInt = (e: Expr): e is Extract<Expr, { k: 'num' }> =>
  e.k === 'num' && e.v.isInteger() && e.text === undefined;
export const isDecimal = (e: Expr): boolean => e.k === 'num' && e.text !== undefined;
/** A written fraction p/q of two whole-number literals. */
export const isFrac = (e: Expr): boolean =>
  e.k === 'div' && isInt(e.a) && isInt(e.b) && !e.b.v.isZero();
export const isPosAtom = (e: Expr): boolean => isInt(e) || isFrac(e);
export const isAtom = (e: Expr): boolean => isPosAtom(e) || (e.k === 'neg' && isPosAtom(e.a));
export const isSignedInt = (e: Expr): boolean => isInt(e) || (e.k === 'neg' && isInt(e.a));

export function atomValue(e: Expr): Rational {
  if (e.k === 'neg') return atomValue(e.a).neg();
  if (e.k === 'num') return e.v;
  if (e.k === 'div' && e.a.k === 'num' && e.b.k === 'num') return e.a.v.div(e.b.v);
  throw new Error('not a number atom');
}

/** Numerator and denominator of an atom as written (not reduced), with sign. */
export function atomParts(e: Expr): { n: bigint; d: bigint } {
  if (e.k === 'neg') {
    const p = atomParts(e.a);
    return { n: -p.n, d: p.d };
  }
  if (e.k === 'num') return { n: e.v.n, d: 1n };
  if (e.k === 'div' && e.a.k === 'num' && e.b.k === 'num') return { n: e.a.v.n, d: e.b.v.n };
  throw new Error('not a number atom');
}

/** Signed fraction n/d written as is (not reduced): 3, 6/4, -(6/4). */
export function fracExpr(n: bigint, d: bigint): Expr {
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const a = abs(n);
  const pos = d === 1n || a === 0n ? num(a) : div(num(a), num(d));
  return n < 0n ? neg(pos) : pos;
}

export function maxBits(e: Expr): number {
  let m = 0;
  walk(e, (n) => {
    if (n.k === 'num') m = Math.max(m, n.v.n.toString(2).length, n.v.d.toString(2).length);
  });
  return m;
}

/** Paths of the smallest subtrees of `after` that differ from `before`. */
export function diffPaths(before: Expr, after: Expr, path: Side[] = []): Side[][] {
  if (exprEqualLoose(before, after)) return [];
  if (before.k !== after.k || before.k === 'num' || before.k === 'var') return [path];
  const kids: Side[] = 'b' in after ? ['a', 'b'] : ['a'];
  const out: Side[][] = [];
  for (const s of kids)
    out.push(
      ...diffPaths((before as { a: Expr; b: Expr })[s], (after as { a: Expr; b: Expr })[s], [
        ...path,
        s,
      ]),
    );
  return out.length > 3 ? [path] : out;
}

function exprEqualLoose(x: Expr, y: Expr): boolean {
  if (x.k !== y.k) return false;
  if (x.k === 'num') return x.v.eq((y as typeof x).v);
  if (x.k === 'var') return x.name === (y as typeof x).name;
  const xa = x as { a: Expr; b?: Expr };
  const ya = y as { a: Expr; b?: Expr };
  if (!exprEqualLoose(xa.a, ya.a)) return false;
  return xa.b === undefined || exprEqualLoose(xa.b, ya.b!);
}

export { Rational };
