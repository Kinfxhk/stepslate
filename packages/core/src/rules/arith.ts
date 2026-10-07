// SPDX-License-Identifier: AGPL-3.0-or-later
// T1 rules: arithmetic with whole numbers, fractions, decimals, signs, brackets and
// whole-number powers. Each call proposes the next step(s); nothing here is trusted:
// the verifier checks every step.

import type { Expr } from '../ast';
import { add, div, mul, neg, num, ratExpr, sub } from '../ast';
import type { MessageKey } from '../i18n/messages';
import { gcd, lcm } from '../numbers/bigint';
import { needsParens } from '../print/print';
import type { ParamValue } from '../state';
import {
  atomParts,
  atomValue,
  fracExpr,
  isAtom,
  isDecimal,
  isFrac,
  isInt,
  isPosAtom,
  isSignedInt,
  replaceAt,
  walk,
  type Side,
} from './tree';

export interface Draft {
  readonly expr: Expr;
  readonly rule: string;
  readonly key: MessageKey;
  readonly params?: Record<string, ParamValue>;
  readonly paths: readonly (readonly Side[])[];
}

export function hasDecimal(e: Expr): boolean {
  let found = false;
  walk(e, (n) => {
    if (isDecimal(n)) found = true;
  });
  return found;
}

/** Replace every decimal literal by an exact fraction. */
export function decimalsToFractions(e: Expr): Draft | null {
  const paths: Side[][] = [];
  let out = e;
  walk(e, (n, p) => {
    if (isDecimal(n) && n.k === 'num') {
      paths.push(p);
      out = replaceAt(out, p, ratExpr(n.v));
    }
  });
  if (paths.length === 0) return null;
  return { expr: out, rule: 'arith.decimals', key: 'arith.decimals', paths };
}

type Candidate = {
  path: Side[];
  node: Expr;
  group: number;
  depth: number;
  rank: number;
  order: number;
};

function reducible(e: Expr): boolean {
  if (!isFrac(e) || e.k !== 'div' || e.a.k !== 'num' || e.b.k !== 'num') return false;
  return e.b.v.n === 1n || gcd(e.a.v.n, e.b.v.n) > 1n;
}

/** Find the next operation in the usual order: brackets, powers, × ÷, + −, left to right. */
function candidates(root: Expr): Candidate[] {
  const out: Candidate[] = [];
  let order = 0;
  const visit = (e: Expr, path: Side[], depth: number) => {
    order++;
    if (reducible(e)) {
      out.push({ path, node: e, group: 0, depth, rank: 0, order });
      return;
    }
    if (e.k === 'neg' && (e.a.k === 'neg' || (isInt(e.a) && e.a.k === 'num' && e.a.v.isZero()))) {
      out.push({ path, node: e, group: 0, depth, rank: 0, order });
      return;
    }
    if (e.k === 'num' || e.k === 'var') return;
    if (isAtom(e)) return;
    const kids: Side[] = 'b' in e ? ['a', 'b'] : ['a'];
    if (kids.every((s) => isAtom((e as { a: Expr; b: Expr })[s]))) {
      const rank = e.k === 'pow' ? 1 : e.k === 'mul' || e.k === 'div' ? 2 : 3;
      out.push({ path, node: e, group: 1, depth, rank, order });
    }
    for (const s of kids) {
      const child = (e as { a: Expr; b: Expr })[s];
      visit(child, [...path, s], depth + (needsParens(e, child, s) ? 1 : 0));
    }
  };
  visit(root, [], 0);
  return out;
}

function pick(cs: Candidate[]): Candidate | undefined {
  return [...cs].sort(
    (p, q) => p.group - q.group || q.depth - p.depth || p.rank - q.rank || p.order - q.order,
  )[0];
}

function reciprocal(e: Expr): Expr {
  if (e.k === 'neg') return neg(reciprocal(e.a));
  const { n, d } = atomParts(e);
  return fracExpr(d, n);
}

function opDrafts(root: Expr, c: Candidate): Draft[] {
  const e = c.node;
  const at = (
    node: Expr,
    rule: string,
    key: MessageKey,
    params: Record<string, ParamValue> = {},
  ) => ({
    expr: replaceAt(root, c.path, node),
    rule,
    key,
    params,
    paths: [c.path],
  });
  if (c.group === 0) {
    if (e.k === 'neg') {
      const inner = e.a.k === 'neg' ? e.a.a : num(0);
      return [
        at(inner, 'arith.double-negative', 'arith.double-negative', { before: e, after: inner }),
      ];
    }
    const { n, d } = atomParts(e);
    const g = gcd(n, d);
    const result = fracExpr(n / g, d / g);
    return [
      at(result, 'arith.reduce', d / g === 1n ? 'arith.reduce-to-integer' : 'arith.reduce', {
        before: e,
        after: result,
        g: g.toString(),
      }),
    ];
  }
  if (e.k === 'pow') {
    const k = Number((e.b as { v: { n: bigint } }).v.n);
    const value = ratExpr(atomValue(e.a).pow(k));
    return [at(value, 'arith.power', 'arith.power', { before: e, after: value })];
  }
  if (e.k !== 'add' && e.k !== 'sub' && e.k !== 'mul' && e.k !== 'div') return [];
  const a = e.a;
  const b = e.b;
  if (e.k === 'mul') {
    if (isSignedInt(a) && isSignedInt(b)) {
      const value = ratExpr(atomValue(a).mul(atomValue(b)));
      return [at(value, 'arith.multiply', 'arith.multiply', { before: e, after: value })];
    }
    const pa = atomParts(a);
    const pb = atomParts(b);
    const result = fracExpr(pa.n * pb.n, pa.d * pb.d);
    return [
      at(result, 'arith.multiply-fractions', 'arith.multiply-fractions', {
        before: e,
        after: result,
      }),
    ];
  }
  if (e.k === 'div') {
    if (isSignedInt(a) && isSignedInt(b)) {
      const pa = atomParts(a);
      const pb = atomParts(b);
      const result = fracExpr(pa.n, pb.n);
      return [
        at(result, 'arith.divide-as-fraction', 'arith.divide-as-fraction', {
          before: e,
          after: result,
        }),
      ];
    }
    const r = reciprocal(b);
    const result = mul(a, r);
    return [
      at(result, 'arith.divide-by-fraction', 'arith.divide-by-fraction', {
        divisor: b,
        reciprocal: r,
      }),
    ];
  }
  // add / sub
  if (b.k === 'neg') {
    const result = e.k === 'add' ? sub(a, b.a) : add(a, b.a);
    const key = e.k === 'add' ? 'arith.add-negative' : 'arith.subtract-negative';
    return [at(result, key, key, { before: e, after: result })];
  }
  const sign = e.k === 'add' ? 1n : -1n;
  if (isSignedInt(a) && isSignedInt(b)) {
    const value = ratExpr(
      e.k === 'add' ? atomValue(a).add(atomValue(b)) : atomValue(a).sub(atomValue(b)),
    );
    const key = e.k === 'add' ? 'arith.add' : 'arith.subtract';
    return [at(value, key, key, { before: e, after: value })];
  }
  const pa = atomParts(a);
  const pb = atomParts(b);
  const combine = (na: bigint, nb: bigint, d: bigint) => fracExpr(na + sign * nb, d);
  const combineKey: MessageKey = e.k === 'add' ? 'arith.add-fractions' : 'arith.subtract-fractions';
  if (pa.d === pb.d) {
    const result = combine(pa.n, pb.n, pa.d);
    return [
      at(result, 'arith.combine-fractions', combineKey, {
        before: e,
        after: result,
        d: pa.d.toString(),
      }),
    ];
  }
  const L = lcm(pa.d, pb.d);
  const ea = fracExpr(pa.n * (L / pa.d), L);
  const eb = fracExpr(pb.n * (L / pb.d), L);
  // Keep the right operand positive under subtraction ("a − b"), as written.
  const rebuilt: Expr = e.k === 'add' ? add(ea, eb) : sub(ea, eb);
  const step1: Draft = {
    expr: replaceAt(root, c.path, rebuilt),
    rule: 'arith.common-denominator',
    key: 'arith.common-denominator',
    params: { lcd: L.toString() },
    paths: [
      [...c.path, 'a'],
      [...c.path, 'b'],
    ],
  };
  const result = combine(pa.n * (L / pa.d), pb.n * (L / pb.d), L);
  const step2: Draft = {
    expr: replaceAt(root, c.path, result),
    rule: 'arith.combine-fractions',
    key: combineKey,
    params: { before: rebuilt, after: result, d: L.toString() },
    paths: [c.path],
  };
  return [step1, step2];
}

/** The next arithmetic step(s) for a number-only expression, or [] when finished. */
export function nextArithmetic(e: Expr): Draft[] {
  const dec = decimalsToFractions(e);
  if (dec) return [dec];
  const c = pick(candidates(e));
  if (!c) return [];
  return opDrafts(e, c);
}

/** True when e is a single number in lowest terms. */
export function isFinalNumber(e: Expr): boolean {
  return isAtom(e) && !(e.k === 'div' && reducible(e)) && !(e.k === 'neg' && reducible(e.a));
}

export { isPosAtom, div };
