// SPDX-License-Identifier: AGPL-3.0-or-later
// Verifier-side polynomial tools: degree bounds, identity testing by exact evaluation
// at enough points, and coefficient extraction. Independent of the rule engine.

import type { Expr } from '../ast';
import { Rational } from '../numbers/rational';
import { evalRational, Unverifiable } from './evaluate';

/**
 * Upper bound on the total degree of e as a polynomial in `vars`.
 * Throws Unverifiable if e is not a polynomial (variable in a denominator, root, ±).
 */
export function degreeBound(e: Expr): number {
  switch (e.k) {
    case 'num':
      return 0;
    case 'var':
      return 1;
    case 'neg':
      return degreeBound(e.a);
    case 'add':
    case 'sub':
      return Math.max(degreeBound(e.a), degreeBound(e.b));
    case 'mul':
      return degreeBound(e.a) + degreeBound(e.b);
    case 'div':
      if (degreeBound(e.b) !== 0) throw new Unverifiable('variable in a denominator');
      return degreeBound(e.a);
    case 'pow': {
      if (degreeBound(e.b) !== 0) throw new Unverifiable('variable exponent');
      const k = evalRational(e.b, new Map());
      if (!k.isInteger()) throw new Unverifiable('bad exponent');
      const base = degreeBound(e.a);
      // a power of a constant is a constant (its size is checked when it is evaluated)
      if (base === 0) return 0;
      if (k.n < 0n || k.n > 8n) throw new Unverifiable('bad exponent');
      return base * Number(k.n);
    }
    case 'sqrt':
      if (degreeBound(e.a) !== 0) throw new Unverifiable('variable under a root');
      return 0;
    case 'pm':
      throw new Unverifiable('± is not a polynomial');
  }
}

/** Grid of evaluation points: {0..d}^vars. Enough to decide identity for degree <= d. */
function* grid(vars: readonly string[], d: number): Generator<Map<string, Rational>> {
  const idx = vars.map(() => 0);
  for (;;) {
    yield new Map(vars.map((v, i) => [v, Rational.of(idx[i]!)]));
    let i = 0;
    while (i < vars.length && idx[i] === d) idx[i++] = 0;
    if (i === vars.length) return;
    idx[i]!++;
  }
}

export const MAX_VERIFY_DEGREE = 8;

/**
 * Decide f ≡ c·g exactly (as polynomials in `vars`), by the polynomial identity
 * theorem: a polynomial of degree <= d in each variable that vanishes on the grid
 * {0..d}^n is the zero polynomial. Points where a constant denominator vanishes cannot
 * occur (denominators contain no variables).
 */
export function identical(
  f: Expr,
  g: Expr,
  vars: readonly string[],
  c: Rational = Rational.ONE,
): boolean {
  const d = Math.max(degreeBound(f), degreeBound(g));
  if (d > MAX_VERIFY_DEGREE) throw new Unverifiable('degree too high to verify');
  for (const env of grid(vars, d)) {
    if (!evalRational(f, env).eq(c.mul(evalRational(g, env)))) return false;
  }
  return true;
}

/**
 * Find c ≠ 0 with f ≡ c·g, or return undefined. If g ≡ 0 then f must be ≡ 0 (c = 1).
 */
export function constantMultiple(f: Expr, g: Expr, vars: readonly string[]): Rational | undefined {
  const d = Math.max(degreeBound(f), degreeBound(g));
  if (d > MAX_VERIFY_DEGREE) throw new Unverifiable('degree too high to verify');
  let c: Rational | undefined;
  for (const env of grid(vars, d)) {
    const gv = evalRational(g, env);
    if (!gv.isZero()) {
      c = evalRational(f, env).div(gv);
      break;
    }
  }
  if (c === undefined)
    return identical(f, { k: 'num', v: Rational.ZERO }, vars) ? Rational.ONE : undefined;
  if (c.isZero()) return undefined;
  return identical(f, g, vars, c) ? c : undefined;
}

/** Coefficients [c0, c1, ..., cd] of a polynomial in one variable (by interpolation-free expansion). */
export function univariateCoefficients(e: Expr, x: string): Rational[] {
  const d = degreeBound(e);
  if (d > MAX_VERIFY_DEGREE) throw new Unverifiable('degree too high');
  // Evaluate at 0..d and solve the Vandermonde system exactly (Newton divided differences).
  const xs = Array.from({ length: d + 1 }, (_, i) => Rational.of(i));
  const ys = xs.map((p) => evalRational(e, new Map([[x, p]])));
  const coef = ys.slice();
  for (let j = 1; j <= d; j++)
    for (let i = d; i >= j; i--) coef[i] = coef[i]!.sub(coef[i - 1]!).div(xs[i]!.sub(xs[i - j]!));
  // Convert Newton form to monomial coefficients.
  let poly: Rational[] = [coef[d]!];
  for (let i = d - 1; i >= 0; i--) {
    // poly = poly * (x - xs[i]) + coef[i]
    const next: Rational[] = Array.from({ length: poly.length + 1 }, () => Rational.ZERO);
    for (let k = 0; k < poly.length; k++) {
      next[k + 1] = next[k + 1]!.add(poly[k]!);
      next[k] = next[k]!.sub(poly[k]!.mul(xs[i]!));
    }
    next[0] = next[0]!.add(coef[i]!);
    poly = next;
  }
  while (poly.length > 1 && poly[poly.length - 1]!.isZero()) poly.pop();
  return poly;
}

/** a·x + b·y + c for an expression of total degree <= 1 in (x, y); throws otherwise. */
export function linearForm(
  e: Expr,
  x: string,
  y: string,
): { a: Rational; b: Rational; c: Rational } {
  const d = Math.max(degreeBound(e), 1);
  if (d > MAX_VERIFY_DEGREE) throw new Unverifiable('degree too high');
  const at = (px: number, py: number) =>
    evalRational(
      e,
      new Map([
        [x, Rational.of(px)],
        [y, Rational.of(py)],
      ]),
    );
  const c = at(0, 0);
  const a = at(1, 0).sub(c);
  const b = at(0, 1).sub(c);
  // Confirm e ≡ a x + b y + c on the grid {0..d}², which decides the identity.
  for (let i = 0; i <= d; i++)
    for (let j = 0; j <= d; j++) {
      const expected = a
        .mul(Rational.of(i))
        .add(b.mul(Rational.of(j)))
        .add(c);
      if (!at(i, j).eq(expected)) throw new Unverifiable('equation is not linear');
    }
  return { a, b, c };
}
