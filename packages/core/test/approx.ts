// SPDX-License-Identifier: AGPL-3.0-or-later
// Independent floating-point evaluator used only by mutation tests to judge whether a
// deliberately broken step is really wrong (so equivalent mutants are not counted).
import type { Expr } from '../src/index';

export function approx(e: Expr, env: Record<string, number> = {}): number {
  switch (e.k) {
    case 'num':
      return Number(e.v.n) / Number(e.v.d);
    case 'var':
      return env[e.name] ?? NaN;
    case 'neg':
      return -approx(e.a, env);
    case 'add':
      return approx(e.a, env) + approx(e.b, env);
    case 'sub':
      return approx(e.a, env) - approx(e.b, env);
    case 'mul':
      return approx(e.a, env) * approx(e.b, env);
    case 'div':
      return approx(e.a, env) / approx(e.b, env);
    case 'pow':
      return approx(e.a, env) ** approx(e.b, env);
    case 'sqrt':
      return Math.sqrt(approx(e.a, env));
    case 'pm':
      throw new Error('± not supported in approx');
  }
}

/** Do two expressions differ numerically at a few irrational-ish sample points? */
export function differ(a: Expr, b: Expr): boolean {
  const samples = [
    { x: 1.37, y: 2.11, a: 0.73 },
    { x: -2.29, y: 0.61, a: 1.9 },
    { x: 3.17, y: -1.43, a: -0.4 },
  ];
  return samples.some((env) => {
    const p = approx(a, env);
    const q = approx(b, env);
    return Math.abs(p - q) > 1e-7 * Math.max(1, Math.abs(p), Math.abs(q));
  });
}
