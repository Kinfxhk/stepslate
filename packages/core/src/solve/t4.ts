// SPDX-License-Identifier: AGPL-3.0-or-later
// T4 strategy: quadratic equations in one unknown. Factorise when the roots are
// rational, otherwise use the quadratic formula (exact surds). Every step is verified.

import type { Expr, Problem } from '../ast';
import { add, div, eqn, exprEqual, mul, neg, num, pm, pow, ratExpr, sqrt, sub, v } from '../ast';
import { abs, gcd, isqrt, squareFreeParts } from '../numbers/bigint';
import { Rational } from '../numbers/rational';
import { Surd } from '../numbers/surd';
import {
  lcmOfDenominators,
  monosExpr,
  scaleMonos,
  sideMonos,
  surdExpr,
  termsExpr,
} from '../rules/equation';
import type { Mono } from '../rules/poly';
import type { State } from '../state';
import { pushCheck } from './check';
import type { Run } from './run';
import { simplifyEquationSides } from './sides';
import { clearFractionsAndCollect, convertDecimals, finishLinear } from './t3';

const ZERO = num(0);

function sides(run: Run): { L: Mono[]; R: Mono[] } | undefined {
  const s = run.state;
  if (s.kind !== 'equation') return undefined;
  const L = sideMonos(s.eq.lhs);
  const R = sideMonos(s.eq.rhs);
  return L && R
    ? { L: L.filter((m) => !m.c.isZero()), R: R.filter((m) => !m.c.isZero()) }
    : undefined;
}

function coefficient(ms: readonly Mono[], x: string, k: number): Rational {
  let c = Rational.ZERO;
  for (const m of ms) if ((m.p.get(x) ?? 0) === k) c = c.add(m.c);
  return c;
}

/** "w·x − u" for the root u/w (w > 0), e.g. 2x − 1, x + 3, x. */
function linearFactor(x: string, r: Rational): Expr {
  const ms: Mono[] = [{ c: Rational.of(r.d), p: new Map([[x, 1]]) }];
  if (!r.isZero()) ms.push({ c: Rational.of(-r.n), p: new Map() });
  return monosExpr(ms);
}

function scaleState(run: Run, k: Rational): State {
  const cur = sides(run)!;
  return { kind: 'equation', eq: eqn(monosExpr(scaleMonos(cur.L, k)), ZERO) };
}

/** A factor that is linear in x, in tidy form (e.g. 2x − 1): its root, else undefined. */
function linearRoot(f: Expr, x: string): Rational | undefined {
  const ms = sideMonos(f)?.filter((m) => !m.c.isZero());
  if (!ms || ms.length === 0) return undefined;
  const a = coefficient(ms, x, 1);
  if (a.isZero() || ms.some((m) => (m.p.get(x) ?? 0) > 1 || m.p.size > (m.p.has(x) ? 1 : 0)))
    return undefined;
  return coefficient(ms, x, 0).neg().div(a);
}

/** "(x − 2)(x + 3) = 0" as typed: use the zero-product rule straight away. */
function tryFactorised(
  run: Run,
  problem: Extract<Problem, { kind: 'equation' }>,
  x: string,
): boolean {
  const { lhs, rhs } = problem.eq;
  if (!(rhs.k === 'num' && rhs.v.isZero() && rhs.text === undefined)) return false;
  if (lhs.k === 'pow' && lhs.b.k === 'num' && lhs.b.v.eq(Rational.of(2))) {
    const r = linearRoot(lhs.a, x);
    if (!r) return false;
    run.push({
      after: { kind: 'equation', eq: eqn(lhs.a, ZERO) },
      rule: lhs.a.k === 'var' ? 'eq.square-zero' : 'eq.zero-product-square',
      explain: { key: lhs.a.k === 'var' ? 'eq.square-zero' : 'eq.zero-product-square' },
      check: 'solution-set',
      highlight: [['lhs']],
    });
    finishFactor(run, problem, x, lhs.a, r);
    return true;
  }
  if (lhs.k !== 'mul') return false;
  const r1 = linearRoot(lhs.a, x);
  const r2 = linearRoot(lhs.b, x);
  if (!r1 || !r2) return false;
  zeroProduct(run, problem, x, [lhs.a, r1], [lhs.b, r2]);
  return true;
}

export function solveQuadratic(run: Run, problem: Problem, vars: readonly string[]): void {
  if (problem.kind !== 'equation') return;
  const x = vars[0]!;
  // Completing the square is an alternative to factorising, so do not take the
  // zero-product shortcut when that method was asked for.
  if (run.quadratic !== 'square' && tryFactorised(run, problem, x)) return;
  convertDecimals(run);
  simplifyEquationSides(run, vars);
  let cur = sides(run);
  if (!cur) return;
  const A2 = coefficient(cur.L, x, 2).sub(coefficient(cur.R, x, 2));
  const A1 = coefficient(cur.L, x, 1).sub(coefficient(cur.R, x, 1));
  if (A2.isZero()) {
    // The x² terms cancel: finish as a linear equation.
    clearFractionsAndCollect(run, vars);
    finishLinear(run, problem, x);
    return;
  }
  if (A1.isZero()) {
    squareRootPath(run, problem, vars);
    return;
  }

  // Everything to the left: ... = 0.
  if (cur.R.length > 0) {
    run.push({
      after: {
        kind: 'equation',
        eq: eqn(termsExpr([...cur.L, ...scaleMonos(cur.R, Rational.ONE.neg())]), ZERO),
      },
      rule: 'eq.move-all-left',
      explain: { key: 'eq.move-all-left' },
      highlight: [['lhs'], ['rhs']],
    });
    simplifyEquationSides(run, vars);
    cur = sides(run)!;
  }

  // Integer coefficients, positive leading coefficient, no common factor.
  const lcd = Rational.of(lcmOfDenominators(cur.L));
  if (!lcd.isOne()) {
    run.push({
      after: scaleState(run, lcd),
      rule: 'eq.multiply-lcd',
      explain: { key: 'eq.multiply-lcd', params: { lcd: lcd.toString() } },
      highlight: [['lhs']],
    });
    cur = sides(run)!;
  }
  if (coefficient(cur.L, x, 2).sign() < 0) {
    run.push({
      after: scaleState(run, Rational.ONE.neg()),
      rule: 'eq.negate-all',
      explain: { key: 'eq.negate-all', params: { x: v(x) } },
      highlight: [['lhs']],
    });
    cur = sides(run)!;
  }
  let a = coefficient(cur.L, x, 2).n;
  let b = coefficient(cur.L, x, 1).n;
  let c = coefficient(cur.L, x, 0).n;
  const g = gcd(gcd(abs(a), abs(b)), abs(c));
  if (g > 1n) {
    run.push({
      after: scaleState(run, Rational.of(1n, g)),
      rule: 'eq.divide-common',
      explain: { key: 'eq.divide-common', params: { g: g.toString() } },
      highlight: [['lhs']],
    });
    a /= g;
    b /= g;
    c /= g;
  }

  const D = b * b - 4n * a * c;
  if (run.quadratic === 'square') {
    completeSquarePath(run, problem, x, a, b, c);
    return;
  }
  const s = D >= 0n ? isqrt(D) : -1n;
  if (s >= 0n && s * s === D) factorPath(run, problem, x, a, b, D, s);
  else formulaPath(run, problem, x, a, b, c, D);
}

function finishFactor(
  run: Run,
  problem: Extract<Problem, { kind: 'equation' }>,
  x: string,
  f: Expr,
  r: Rational,
): void {
  if (!exprEqual(f, v(x)))
    run.push({
      after: { kind: 'equation', eq: eqn(v(x), ratExpr(r)) },
      rule: 'eq.solve-factor',
      explain: { key: 'eq.solve-factor' },
      highlight: [['rhs']],
    });
  pushCheck(run, [problem.eq], { [x]: Surd.rational(r) });
}

function zeroProduct(
  run: Run,
  problem: Extract<Problem, { kind: 'equation' }>,
  x: string,
  [f1, p]: [Expr, Rational],
  [f2, q]: [Expr, Rational],
): void {
  run.push({
    after: { kind: 'or', eqs: [eqn(f1, ZERO), eqn(f2, ZERO)] },
    rule: 'eq.zero-product',
    explain: { key: 'eq.zero-product' },
    check: 'solution-set',
  });
  if (p.eq(q)) {
    // Both factors give the same root.
    run.push({
      after: { kind: 'equation', eq: eqn(v(x), ratExpr(p)) },
      rule: 'eq.solve-each',
      explain: { key: 'eq.solve-each' },
      highlight: [['rhs']],
    });
    pushCheck(run, [problem.eq], { [x]: Surd.rational(p) });
    return;
  }
  run.push({
    after: { kind: 'or', eqs: [eqn(v(x), ratExpr(p)), eqn(v(x), ratExpr(q))] },
    rule: 'eq.solve-each',
    explain: { key: 'eq.solve-each' },
    highlight: [
      ['eqs', 0, 'rhs'],
      ['eqs', 1, 'rhs'],
    ],
  });
  for (const r of [p, q].sort((u, w) => u.cmp(w)))
    pushCheck(run, [problem.eq], { [x]: Surd.rational(r) });
}

function factorPath(
  run: Run,
  problem: Extract<Problem, { kind: 'equation' }>,
  x: string,
  a: bigint,
  b: bigint,
  D: bigint,
  s: bigint,
): void {
  const two = Rational.of(2n * a);
  const r1 = Rational.of(-b + s).div(two);
  const r2 = Rational.of(-b - s).div(two);
  // Roots in increasing order, but a factor "x" first (x(x − 3) reads better).
  const [p, q] = r2.isZero() ? [r2, r1] : r1.isZero() ? [r1, r2] : [r2, r1];
  const f1 = linearFactor(x, p);
  const f2 = linearFactor(x, q);
  const k = Rational.of(a).div(Rational.of(p.d * q.d));
  let lhs: Expr = D === 0n ? pow(f1, num(2)) : mul(f1, f2, true);
  if (!k.isOne()) lhs = mul(ratExpr(k), lhs, true);
  run.push({
    after: { kind: 'equation', eq: eqn(lhs, ZERO) },
    rule: 'eq.factorise',
    explain: { key: 'eq.factorise' },
    highlight: [['lhs']],
  });
  if (D === 0n) {
    run.push({
      after: { kind: 'equation', eq: eqn(f1, ZERO) },
      rule: 'eq.zero-product-square',
      explain: { key: 'eq.zero-product-square' },
      check: 'solution-set',
      highlight: [['lhs']],
    });
    finishFactor(run, problem, x, f1, p);
    return;
  }
  zeroProduct(run, problem, x, [f1, p], [f2, q]);
}

/** No x term: get x² on its own, then take square roots. */
function squareRootPath(
  run: Run,
  problem: Extract<Problem, { kind: 'equation' }>,
  vars: readonly string[],
): void {
  const x = vars[0]!;
  // Same moves as for a linear equation: x² terms to the left, numbers to the right.
  clearFractionsAndCollect(run, vars);
  const cur = sides(run)!;
  const a = coefficient(cur.L, x, 2);
  const q = coefficient(cur.R, x, 0).div(a);
  if (!a.isOne())
    run.push({
      after: { kind: 'equation', eq: eqn(pow(v(x), num(2)), ratExpr(q)) },
      rule: 'eq.divide',
      explain: { key: 'eq.divide', params: { a: ratExpr(a) } },
      highlight: [['lhs'], ['rhs']],
    });
  if (q.sign() < 0) {
    run.push({
      after: { kind: 'none' },
      rule: 'eq.square-negative',
      explain: { key: 'eq.square-negative' },
    });
    return;
  }
  if (q.isZero()) {
    run.push({
      after: { kind: 'equation', eq: eqn(v(x), ZERO) },
      rule: 'eq.square-zero',
      explain: { key: 'eq.square-zero' },
      check: 'solution-set',
      highlight: [['rhs']],
    });
    pushCheck(run, [problem.eq], { [x]: Surd.rational(Rational.ZERO) });
    return;
  }
  const root = sqrt(ratExpr(q));
  run.push({
    after: { kind: 'equation', eq: eqn(v(x), pm(ZERO, root)) },
    rule: 'eq.square-root-both',
    explain: { key: 'eq.square-root-both' },
    check: 'solution-set',
    highlight: [['rhs']],
  });
  const value = Surd.sqrt(q);
  const simple = surdExpr(value);
  if (!exprEqual(simple, root))
    run.push({
      after: { kind: 'equation', eq: eqn(v(x), pm(ZERO, simple)) },
      rule: 'eq.simplify-root',
      explain: { key: 'eq.simplify-root', params: { from: root, to: simple } },
      check: 'solution-set',
      highlight: [['rhs']],
    });
  pushCheck(run, [problem.eq], { [x]: value.neg() });
  pushCheck(run, [problem.eq], { [x]: value });
}

function formulaPath(
  run: Run,
  problem: Extract<Problem, { kind: 'equation' }>,
  x: string,
  a: bigint,
  b: bigint,
  c: bigint,
  D: bigint,
): void {
  const [A, B, C] = [ratExpr(Rational.of(a)), ratExpr(Rational.of(b)), ratExpr(Rational.of(c))];
  const working = sub(pow(B, num(2)), mul(mul(num(4), A), C));
  run.push({
    after: run.state,
    rule: 'eq.discriminant',
    explain: { key: 'eq.discriminant', params: { a: A, b: B, c: C, D: ratExpr(Rational.of(D)) } },
    info: { kind: 'discriminant', a: A, b: B, c: C, working, value: ratExpr(Rational.of(D)) },
  });
  if (D < 0n) {
    run.push({
      after: { kind: 'none' },
      rule: 'eq.no-real-roots',
      explain: { key: 'eq.no-real-roots' },
    });
    return;
  }
  const xe = v(x);
  run.push({
    after: {
      kind: 'equation',
      eq: eqn(xe, div(pm(neg(B), sqrt(num(D))), mul(num(2), A))),
    },
    rule: 'eq.quadratic-formula',
    explain: { key: 'eq.quadratic-formula', params: { x: xe } },
    check: 'solution-set',
    highlight: [['rhs']],
  });
  const minusB = ratExpr(Rational.of(-b));
  run.push({
    after: { kind: 'equation', eq: eqn(xe, div(pm(minusB, sqrt(num(D))), num(2n * a))) },
    rule: 'eq.evaluate-formula',
    check: 'solution-set',
    explain: { key: 'eq.evaluate-formula' },
    highlight: [['rhs']],
  });
  const { k, m } = squareFreeParts(D);
  const rootTerm = (kk: bigint): Expr =>
    kk === 1n ? sqrt(num(m)) : mul(num(kk), sqrt(num(m)), true);
  if (k > 1n)
    run.push({
      after: { kind: 'equation', eq: eqn(xe, div(pm(minusB, rootTerm(k)), num(2n * a))) },
      rule: 'eq.simplify-root',
      explain: { key: 'eq.simplify-root', params: { from: sqrt(num(D)), to: rootTerm(k) } },
      check: 'solution-set',
      highlight: [['rhs']],
    });
  const g = gcd(gcd(abs(b), k), 2n * a);
  if (g > 1n) {
    const top = pm(ratExpr(Rational.of(-b / g)), rootTerm(k / g));
    const d = (2n * a) / g;
    run.push({
      after: { kind: 'equation', eq: eqn(xe, d === 1n ? top : div(top, num(d))) },
      rule: 'eq.reduce-formula',
      check: 'solution-set',
      explain: { key: 'eq.reduce-formula', params: { g: g.toString() } },
      highlight: [['rhs']],
    });
  }
  const base = Rational.of(-b, 2n * a);
  const coef = Rational.of(k, 2n * a);
  pushCheck(run, [problem.eq], { [x]: Surd.of(base, coef.neg(), m) });
  pushCheck(run, [problem.eq], { [x]: Surd.of(base, coef, m) });
}

function shifted(x: string, h: Rational): Expr {
  if (h.isZero()) return v(x);
  if (h.sign() < 0) return sub(v(x), ratExpr(h.neg()));
  return add(v(x), ratExpr(h));
}

function polyOf(x: string, terms: readonly (readonly [Rational, number])[]): Expr {
  const ms: Mono[] = [];
  for (const [c, k] of terms) {
    if (c.isZero()) continue;
    ms.push({ c, p: k === 0 ? new Map() : new Map([[x, k]]) });
  }
  return ms.length === 0 ? ZERO : monosExpr(ms);
}

/**
 * ax^2 + bx + c = 0 by completing the square. Steps before the square root are
 * polynomial identities (constant multiples). The square-root step uses the same
 * solution-set check as the existing "take square roots" path.
 */
function completeSquarePath(
  run: Run,
  problem: Extract<Problem, { kind: 'equation' }>,
  x: string,
  a: bigint,
  b: bigint,
  c: bigint,
): void {
  const A = Rational.of(a);
  const B = Rational.of(b).div(A);
  const C = Rational.of(c).div(A);
  const xe = v(x);
  if (!A.isOne()) {
    run.push({
      after: scaleState(run, Rational.of(1n, a)),
      rule: 'eq.divide',
      explain: { key: 'eq.divide', params: { a: ratExpr(A) } },
      highlight: [['lhs']],
    });
  }
  if (!C.isZero()) {
    run.push({
      after: {
        kind: 'equation',
        eq: eqn(
          polyOf(x, [
            [B, 1],
            [Rational.ONE, 2],
          ]),
          ratExpr(C.neg()),
        ),
      },
      rule: 'eq.move-terms',
      explain: { key: 'eq.move-terms', params: { x: xe } },
      highlight: [['lhs'], ['rhs']],
    });
  }
  const h = B.div(Rational.of(2));
  const k = h.mul(h);
  const rhs = k.sub(C);
  run.push({
    after: {
      kind: 'equation',
      eq: eqn(
        polyOf(x, [
          [k, 0],
          [B, 1],
          [Rational.ONE, 2],
        ]),
        ratExpr(rhs),
      ),
    },
    rule: 'eq.complete-add',
    explain: { key: 'eq.complete-add', params: { k: ratExpr(k), x: xe } },
    highlight: [['lhs'], ['rhs']],
  });
  run.push({
    after: { kind: 'equation', eq: eqn(pow(shifted(x, h), num(2)), ratExpr(rhs)) },
    rule: 'eq.complete-square',
    explain: { key: 'eq.complete-square', params: { h: ratExpr(h) } },
    highlight: [['lhs']],
  });
  if (rhs.sign() < 0) {
    run.push({
      after: { kind: 'none' },
      rule: 'eq.square-negative',
      explain: { key: 'eq.square-negative' },
    });
    return;
  }
  if (rhs.isZero()) {
    run.push({
      after: { kind: 'equation', eq: eqn(shifted(x, h), ZERO) },
      rule: 'eq.square-zero',
      explain: { key: 'eq.square-zero' },
      check: 'solution-set',
      highlight: [['rhs']],
    });
    if (!h.isZero()) {
      run.push({
        after: { kind: 'equation', eq: eqn(xe, ratExpr(h.neg())) },
        rule: 'eq.solve-factor',
        explain: { key: 'eq.solve-factor' },
        highlight: [['rhs']],
      });
    }
    pushCheck(run, [problem.eq], { [x]: Surd.rational(h.neg()) });
    return;
  }
  const rootExpr = sqrt(ratExpr(rhs));
  run.push({
    after: { kind: 'equation', eq: eqn(shifted(x, h), pm(ZERO, rootExpr)) },
    rule: 'eq.square-root-both',
    explain: { key: 'eq.square-root-both' },
    check: 'solution-set',
    highlight: [['rhs']],
  });
  const value = Surd.sqrt(rhs);
  const simple = surdExpr(value);
  const shown = exprEqual(simple, rootExpr) ? rootExpr : simple;
  if (!exprEqual(simple, rootExpr)) {
    run.push({
      after: { kind: 'equation', eq: eqn(shifted(x, h), pm(ZERO, simple)) },
      rule: 'eq.simplify-root',
      explain: { key: 'eq.simplify-root', params: { from: rootExpr, to: simple } },
      check: 'solution-set',
      highlight: [['rhs']],
    });
  }
  run.push({
    after: { kind: 'equation', eq: eqn(xe, pm(ratExpr(h.neg()), shown)) },
    rule: 'eq.complete-isolate',
    explain: { key: 'eq.complete-isolate', params: { h: ratExpr(h), x: xe } },
    check: 'solution-set',
    highlight: [['lhs'], ['rhs']],
  });
  const base = Surd.rational(h.neg());
  pushCheck(run, [problem.eq], { [x]: base.sub(value) });
  pushCheck(run, [problem.eq], { [x]: base.add(value) });
}
