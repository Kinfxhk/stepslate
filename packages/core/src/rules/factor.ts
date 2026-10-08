// SPDX-License-Identifier: AGPL-3.0-or-later
// T6 proposals: factor a simplified polynomial (common factor, difference of squares,
// perfect square, cross method, grouping, and one rational-root step at a time).
// Proposals only. The verifier accepts a step only when the two expressions are identical.

import { add as addExpr, mul, neg, sub as subExpr, type Expr } from '../ast';
import { abs, gcd } from '../numbers/bigint';
import { Rational } from '../numbers/rational';
import type { MessageKey } from '../i18n/messages';
import type { ParamValue } from '../state';
import { comparePowers, monoAbsExpr, monosToExpr, powersKey, type Mono, type Powers } from './poly';

export interface FactorDraft {
  readonly expr: Expr;
  readonly rule: string;
  readonly key: MessageKey;
  readonly params?: Record<string, ParamValue>;
}

const intOf = (m: Mono): bigint | undefined => (m.c.isInteger() ? m.c.n : undefined);

function divisors(n: bigint): bigint[] {
  const a = abs(n);
  const out: bigint[] = [];
  for (let d = 1n; d * d <= a; d++) {
    if (a % d === 0n) out.push(d, a / d);
  }
  return [...new Set(out)].sort((p, q) => (p < q ? -1 : 1));
}

function exprOf(ms: readonly Mono[]): Expr {
  return monosToExpr(ms);
}

function times(factor: Expr, body: Expr): Expr {
  if (factor.k === 'num' && factor.v.isOne()) return body;
  if (factor.k === 'neg' && factor.a.k === 'num' && factor.a.v.isOne()) return neg(body);
  // Left-associate so (x − 1)((x − 2)(x − 3)) prints as (x − 1)(x − 2)(x − 3).
  if (body.k === 'mul') return mul(times(factor, body.a), body.b, true);
  return mul(factor, body, true);
}

function commonFactor(
  ms: readonly Mono[],
  vars: readonly string[],
): {
  factor: Expr;
  rest: Mono[];
} | null {
  const coeffs = ms.map(intOf);
  if (coeffs.some((c) => c === undefined)) return null;
  const lead = [...ms].sort((a, b) => comparePowers(a.p, b.p, vars))[0]!;
  let g = 0n;
  for (const c of coeffs) g = gcd(g, abs(c!));
  const sign: bigint = lead.c.sign() < 0 ? -1n : 1n;
  const pulled = g * sign;
  const exp = new Map<string, number>();
  for (const name of vars) {
    let m = Infinity;
    for (const t of ms) m = Math.min(m, t.p.get(name) ?? 0);
    if (m > 0 && m < Infinity) exp.set(name, m);
  }
  if (pulled === 1n && exp.size === 0) return null;
  const rest = ms.map((t) => {
    const p = new Map(t.p);
    for (const [name, k] of exp) p.set(name, (p.get(name) ?? 0) - k);
    for (const [name, k] of [...p]) if (k === 0) p.delete(name);
    return { c: Rational.of(t.c.n / pulled), p };
  });
  const factor =
    pulled < 0n
      ? neg(monoAbsExpr(Rational.of(-pulled), exp))
      : monoAbsExpr(Rational.of(pulled), exp);
  return { factor, rest };
}

function isSquare(n: bigint): bigint | null {
  if (n < 0n) return null;
  const s = bigintSqrt(n);
  return s * s === n ? s : null;
}
function bigintSqrt(n: bigint): bigint {
  if (n < 2n) return n;
  let x = 1n << BigInt(n.toString(2).length >> 1);
  for (;;) {
    const y = (x + n / x) >> 1n;
    if (y >= x) return x;
    x = y;
  }
}

function sqrtMono(m: Mono): Mono | null {
  const c = intOf(m);
  if (c === undefined || c < 0n) return null;
  const s = isSquare(c);
  if (s === null) return null;
  const p = new Map<string, number>();
  for (const [name, e] of m.p) {
    if (e % 2 !== 0) return null;
    if (e / 2 > 0) p.set(name, e / 2);
  }
  return { c: Rational.of(s), p };
}

function diffOfSquares(ms: readonly Mono[]): Expr | null {
  if (ms.length !== 2) return null;
  const [pos, negt] = ms[0]!.c.sign() > 0 ? [ms[0]!, ms[1]!] : [ms[1]!, ms[0]!];
  if (pos.c.sign() <= 0 || negt.c.sign() >= 0) return null;
  const a = sqrtMono(pos);
  const b = sqrtMono({ c: negt.c.neg(), p: negt.p });
  if (!a || !b) return null;
  const A = exprOf([a]);
  const B = exprOf([b]);
  return mul(addSub(A, B, -1), addSub(A, B, 1), true);
}

function addSub(a: Expr, b: Expr, sign: 1 | -1): Expr {
  // a + b or a − b, imported lazily to keep this file's imports obvious
  return sign < 0 ? subExpr(a, b) : addExpr(a, b);
}

function perfectSquare(ms: readonly Mono[]): Expr | null {
  if (ms.length !== 3) return null;
  const squares = ms.map((m) => ({ m, s: m.c.sign() > 0 ? sqrtMono(m) : null }));
  const sq = squares.filter((x) => x.s);
  if (sq.length < 2) return null;
  const [A, B] = sq as [{ m: Mono; s: Mono }, { m: Mono; s: Mono }];
  const mid = ms.find((m) => m !== A.m && m !== B.m);
  if (!mid) return null;
  const cross = A.s.c.mul(B.s.c).mul(Rational.of(2));
  if (!mid.c.abs().eq(cross)) return null;
  // middle term's variables must be the product of the two square roots
  const expect = new Map<string, number>();
  for (const s of [A.s, B.s]) for (const [n, e] of s.p) expect.set(n, (expect.get(n) ?? 0) + e);
  if (powersKey(expect) !== powersKey(mid.p)) return null;
  const sign: 1 | -1 = mid.c.sign() < 0 ? -1 : 1;
  const inside = addSub(exprOf([A.s]), exprOf([B.s]), sign);
  return { k: 'pow', a: inside, b: { k: 'num', v: Rational.of(2) } };
}

function crossQuadratic(ms: readonly Mono[], x: string): Expr | null {
  if (ms.some((m) => [...m.p.keys()].some((n) => n !== x))) return null;
  const coef = (k: number) =>
    ms.find((m) => (m.p.get(x) ?? 0) === k && (k === 0 || m.p.size === 1))?.c.n ?? 0n;
  const deg = Math.max(...ms.map((m) => m.p.get(x) ?? 0));
  if (deg !== 2) return null;
  const a = coef(2);
  const b = coef(1);
  const c = coef(0);
  if (a <= 0n) return null;
  for (const p of divisors(a)) {
    const r = a / p;
    for (const qAbs of divisors(abs(c === 0n ? 1n : c))) {
      for (const q of c === 0n ? [0n] : [qAbs, -qAbs]) {
        if (q === 0n && c !== 0n) continue;
        if (c !== 0n && (q === 0n || c % q !== 0n)) continue;
        const s = c === 0n ? 0n : c / q;
        if (p * s + q * r !== b) continue;
        if (p > r || (p === r && q > s)) continue;
        const f1 = linear(p, q, x);
        const f2 = linear(r, s, x);
        return mul(f1, f2, true);
      }
    }
  }
  return null;
}

function linear(a: bigint, b: bigint, x: string): Expr {
  const ms: Mono[] = [];
  if (a !== 0n) ms.push({ c: Rational.of(a), p: new Map([[x, 1]]) });
  if (b !== 0n) ms.push({ c: Rational.of(b), p: new Map() });
  return exprOf(ms.length ? ms : [{ c: Rational.ZERO, p: new Map() }]);
}

/** Polynomial division by qx − p. Coefficients are low to high. */
function divideByLinear(coeff: readonly bigint[], q: bigint, p: bigint): bigint[] | null {
  // (q x − p)(u_n x^n + … + u_0) = original. Solve from the top.
  const n = coeff.length - 1;
  const u: bigint[] = new Array(n).fill(0n);
  let rem = 0n;
  for (let k = n; k >= 1; k--) {
    const top = coeff[k]! - rem;
    if (q === 0n || top % q !== 0n) return null;
    u[k - 1] = top / q;
    rem = -p * u[k - 1]!;
  }
  if (coeff[0]! - rem !== 0n) return null;
  return u;
}

function peelRoot(ms: readonly Mono[], x: string): { factor: Expr; rest: Mono[] } | null {
  if (ms.some((m) => [...m.p.keys()].some((n) => n !== x))) return null;
  const deg = Math.max(...ms.map((m) => m.p.get(x) ?? 0));
  if (deg < 3) return null;
  const coeff: bigint[] = [];
  for (let k = 0; k <= deg; k++) {
    const c = intOf(
      ms.find((m) => (m.p.get(x) ?? 0) === k && (k === 0 ? m.p.size === 0 : m.p.size === 1)) ?? {
        c: Rational.ZERO,
        p: new Map(),
      },
    );
    if (c === undefined) return null;
    coeff[k] = c;
  }
  const lead = coeff[deg]!;
  const constant = coeff[0]!;
  if (constant === 0n) return null; // a common factor of x should already have been taken
  for (const q of divisors(abs(lead))) {
    for (const pAbs of divisors(abs(constant))) {
      for (const p of [pAbs, -pAbs]) {
        if (gcd(p, q) !== 1n) continue;
        const quot = divideByLinear(coeff, q, p);
        if (!quot) continue;
        const rest: Mono[] = quot
          .map((c, k) => ({
            c: Rational.of(c),
            p: (k === 0 ? new Map() : new Map([[x, k]])) as Powers,
          }))
          .filter((m) => !m.c.isZero());
        return { factor: linear(q, -p, x), rest };
      }
    }
  }
  return null;
}

function group(ms: readonly Mono[]): Expr | null {
  if (ms.length !== 4) return null;
  const partitions: [number, number, number, number][] = [
    [0, 1, 2, 3],
    [0, 2, 1, 3],
    [0, 3, 1, 2],
  ];
  for (const [a, b, c, d] of partitions) {
    const p1 = pair(ms[a]!, ms[b]!);
    const p2 = pair(ms[c]!, ms[d]!);
    if (!p1 || !p2) continue;
    if (
      powersKey(p1.left.p) + '|' + p1.left.c.toString() !==
      powersKey(p2.left.p) + '|' + p2.left.c.toString()
    )
      continue;
    if (
      powersKey(p1.right.p) + '|' + p1.right.c.toString() !==
      powersKey(p2.right.p) + '|' + p2.right.c.toString()
    )
      continue;
    const inside = exprOf([p1.left, p1.right]);
    const outside = exprOf([p1.common, p2.common]);
    return mul(outside, inside, true);
  }
  return null;
}

function pair(u: Mono, v: Mono): { common: Mono; left: Mono; right: Mono } | null {
  const cu = intOf(u);
  const cv = intOf(v);
  if (cu === undefined || cv === undefined) return null;
  const g = gcd(abs(cu), abs(cv));
  const exp = new Map<string, number>();
  for (const name of new Set([...u.p.keys(), ...v.p.keys()])) {
    const k = Math.min(u.p.get(name) ?? 0, v.p.get(name) ?? 0);
    if (k > 0) exp.set(name, k);
  }
  if (g === 1n && exp.size === 0) return null;
  const div = (m: Mono): Mono => {
    const p = new Map(m.p);
    for (const [name, k] of exp) p.set(name, (p.get(name) ?? 0) - k);
    for (const [name, k] of [...p]) if (k === 0) p.delete(name);
    return { c: Rational.of(m.c.n / g), p };
  };
  return { common: { c: Rational.of(g), p: exp }, left: div(u), right: div(v) };
}

function ordered(ms: readonly Mono[], vars: readonly string[]): Mono[] {
  return [...ms].sort((a, b) => comparePowers(a.p, b.p, vars));
}

function bodySteps(ms: readonly Mono[], vars: readonly string[]): FactorDraft[] {
  ms = ordered(ms, vars);
  const x = vars[0] ?? 'x';
  const squares = diffOfSquares(ms);
  if (squares) return [{ expr: squares, rule: 'factor.diff-squares', key: 'factor.diff-squares' }];
  const square = perfectSquare(ms);
  if (square)
    return [{ expr: square, rule: 'factor.perfect-square', key: 'factor.perfect-square' }];
  const quad = vars.length === 1 ? crossQuadratic(ms, x) : null;
  if (quad) return [{ expr: quad, rule: 'factor.cross', key: 'factor.cross' }];
  const peeled = vars.length === 1 ? peelRoot(ms, x) : null;
  if (peeled) {
    const out: FactorDraft[] = [
      {
        expr: times(peeled.factor, exprOf(peeled.rest)),
        rule: 'factor.root',
        key: 'factor.root',
        params: { factor: peeled.factor },
      },
    ];
    const inner = factorisationSteps(peeled.rest, vars);
    for (const s of inner) out.push({ ...s, expr: times(peeled.factor, s.expr) });
    return out;
  }
  const grouped = group(ms);
  if (grouped) return [{ expr: grouped, rule: 'factor.group', key: 'factor.group' }];
  const deg = Math.max(0, ...ms.map((m) => [...m.p.values()].reduce((a, b) => a + b, 0)));
  if (deg >= 2 && ms.length > 1)
    return [{ expr: exprOf(ms), rule: 'factor.none', key: 'factor.none' }];
  return [];
}

/** Steps that turn a simplified polynomial into factors. `ms` must already be canonical. */
export function factorisationSteps(ms: readonly Mono[], vars: readonly string[]): FactorDraft[] {
  if (ms.length === 0) return [];
  const live = ordered(
    ms.filter((m) => !m.c.isZero()),
    vars,
  );
  if (live.length <= 1) return [];
  const common = commonFactor(live, vars);
  if (!common) return bodySteps(live, vars);
  const first: FactorDraft = {
    expr: times(common.factor, exprOf(common.rest)),
    rule: 'factor.common',
    key: 'factor.common',
    params: { factor: common.factor },
  };
  const inner = bodySteps(common.rest, vars).filter((s) => s.rule !== 'factor.none');
  return [first, ...inner.map((s) => ({ ...s, expr: times(common.factor, s.expr) }))];
}
