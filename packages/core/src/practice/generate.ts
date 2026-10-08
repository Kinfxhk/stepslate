// SPDX-License-Identifier: AGPL-3.0-or-later
// Seeded practice-question generators for the five problem types. Every question is
// solved by the verified engine before it is offered; unsuitable draws are re-rolled.

import type { ProblemType } from '../solve/classify';
import { solve, type Solution } from '../solve/engine';
import { Rng } from './rng';

export type Level = 1 | 2 | 3;

export interface Question {
  readonly type: ProblemType;
  readonly level: Level;
  readonly seed: number;
  readonly input: string;
  readonly solution: Solution;
}

/** "3x^2 - x + 4" from [coefficient, monomial] pairs; zero terms are skipped. */
export function polyText(terms: readonly (readonly [number, string])[]): string {
  let out = '';
  for (const [c, m] of terms) {
    if (c === 0) continue;
    const mag = Math.abs(c);
    const body = m === '' ? String(mag) : `${mag === 1 ? '' : mag}${m}`;
    if (out === '') out = c < 0 ? `-${body}` : body;
    else out += c < 0 ? ` - ${body}` : ` + ${body}`;
  }
  return out === '' ? '0' : out;
}

const signed = (n: number) => (n < 0 ? `- ${-n}` : `+ ${n}`);
const frac = (n: number, d: number) => `${Math.min(n, d - 1)}/${d}`;

function t1(r: Rng, level: Level): string {
  if (level === 1)
    return r.pick([
      () => `${r.int(2, 20)} + ${r.int(2, 9)} * ${r.int(2, 9)}`,
      () => `${frac(r.int(1, 5), r.int(2, 6))} + ${frac(r.int(1, 5), r.int(2, 6))}`,
      () => `${r.int(10, 40)} - ${r.int(2, 9)} * ${r.int(2, 5)}`,
    ])();
  if (level === 2)
    return r.pick([
      () => `(${r.int(2, 9)} - ${r.int(10, 20)}) * ${r.int(2, 6)} + ${r.int(1, 9)}`,
      () =>
        `${frac(r.int(1, 7), r.int(2, 9))} - ${frac(r.int(1, 7), r.int(2, 9))} * ${r.int(2, 4)}`,
      () =>
        `${frac(r.int(1, 5), r.int(2, 6))} / ${frac(r.int(1, 5), r.int(2, 6))} - ${r.int(1, 3)}`,
    ])();
  return r.pick([
    () => `(${frac(r.int(1, 4), r.int(2, 5))})^2 - ${frac(r.int(1, 5), r.int(2, 6))}`,
    () => `${r.int(2, 4)}^3 - (${r.int(1, 9)} - ${r.int(10, 15)})^2`,
    () => `0.${r.int(1, 9)} * ${r.int(2, 9)} + ${frac(r.int(1, 3), r.int(4, 8))}`,
  ])();
}

function t2(r: Rng, level: Level): string {
  const a = r.nz(5);
  const b = r.nz(6);
  const c = r.nz(5);
  const d = r.nz(6);
  if (level === 1)
    return r.pick([
      () => `${a}(x ${signed(b)}) ${signed(c)}x`,
      () => `${r.int(2, 6)}x ${signed(b)} ${signed(c)}x ${signed(d)}`,
      () => `${r.int(2, 5)}(${r.int(2, 4)}x ${signed(b)}) - (x ${signed(d)})`,
    ])();
  if (level === 2)
    return r.pick([
      () => `(x ${signed(b)})(x ${signed(d)})`,
      () => `(${r.int(2, 3)}x ${signed(b)})(x ${signed(d)})`,
      () => `${a}x(x ${signed(b)}) ${signed(c)}x^2`,
    ])();
  return r.pick([
    () => `(x ${signed(b)})^2 - (x ${signed(d)})(x ${signed(c)})`,
    () => `(x + y)^2 - ${r.int(1, 3)}xy`,
    () => `(${r.int(2, 3)}x ${signed(b)})^2 ${signed(a)}x`,
  ])();
}

function t3(r: Rng, level: Level): string {
  // Build backwards from a known solution s (an integer, or a fraction at level 3).
  const s = level === 3 && r.next() < 0.5 ? r.nz(9) / r.pick([2, 3, 4]) : r.nz(9);
  const a = r.pick([2, 3, 4, 5, 6, 7]);
  const k = r.int(1, 9);
  if (level === 1) {
    return `${a}x + ${k} = ${a * s + k}`;
  }
  if (level === 2) {
    // a(x + k) = bx + e with b ≠ a
    const b = r.pick([1, 2, 3].filter((n) => n !== a));
    const e = a * (s + k) - b * s;
    return `${a}(x + ${k}) = ${polyText([
      [b, 'x'],
      [e, ''],
    ])}`;
  }
  // (x + k)/m - x/n = c, with c worked out so that x = s
  const m = r.pick([2, 3, 4]);
  const n = r.pick([2, 3, 5, 6].filter((q) => q !== m));
  const s3 = Math.round(s * 12) / 12;
  const num = (s3 + k) * n - s3 * m; // c = num / (m·n)
  const den = m * n;
  const g = gcdInt(Math.abs(Math.round(num * 12)), den * 12);
  const cn = Math.round(num * 12) / g;
  const cd = (den * 12) / g;
  const c = cd === 1 ? String(cn) : cn < 0 ? `-${-cn}/${cd}` : `${cn}/${cd}`;
  return `(x + ${k})/${m} - x/${n} = ${c}`;
}

function gcdInt(a: number, b: number): number {
  return b === 0 ? a || 1 : gcdInt(b, a % b);
}

function t4(r: Rng, level: Level): string {
  if (level === 1) {
    const p = r.nz(7);
    const q = r.nz(7);
    return `${polyText([
      [1, 'x^2'],
      [-(p + q), 'x'],
      [p * q, ''],
    ])} = 0`;
  }
  if (level === 2) {
    // (ax − p)(x − q) with a ∈ {2, 3}, written with terms on both sides
    const a = r.pick([2, 3]);
    const p = r.nz(5);
    const q = r.nz(5);
    const A = a;
    const B = -(a * q + p);
    const C = p * q;
    return `${polyText([
      [A, 'x^2'],
      [B, 'x'],
    ])} = ${-C}`;
  }
  // irrational roots: x^2 + bx + c with D > 0 not a square
  for (;;) {
    const b = r.nz(8);
    const c = r.nz(9);
    const D = b * b - 4 * c;
    const s = Math.round(Math.sqrt(Math.max(D, 0)));
    if (D > 0 && s * s !== D)
      return `${polyText([
        [1, 'x^2'],
        [b, 'x'],
        [c, ''],
      ])} = 0`;
  }
}

function t6(r: Rng, level: Level): string {
  const a = r.int(1, level === 1 ? 1 : 4);
  const p = r.nz(level === 3 ? 6 : 5);
  const q = r.nz(level === 3 ? 6 : 5);
  if (level === 1)
    return `factor ${polyText([
      [1, 'x^2'],
      [-(p + q), 'x'],
      [p * q, ''],
    ])}`;
  if (level === 2)
    return `factor ${polyText([
      [a, 'x^2'],
      [-(a * q + p), 'x'],
      [p * q, ''],
    ])}`;
  return r.pick([
    () =>
      `factor ${polyText([
        [1, 'x^2'],
        [-(p * p), ''],
      ])}`,
    () =>
      `factor ${polyText([
        [1, 'x^2'],
        [2 * p, 'x'],
        [p * p, ''],
      ])}`,
    () => `factor ${p}x^2 + ${p * q}x`,
  ])();
}
function t5(r: Rng, level: Level): string {
  const x = r.nz(6);
  const y = r.nz(6);
  for (;;) {
    const a = level === 1 ? 1 : r.nz(level === 2 ? 4 : 7);
    const b = r.nz(level === 1 ? 3 : 5);
    const c = level === 1 ? 1 : r.nz(level === 2 ? 5 : 7);
    const d = level === 1 ? -1 : r.nz(5);
    if (a * d - b * c === 0) continue;
    const eq = (p: number, q: number) =>
      `${polyText([
        [p, 'x'],
        [q, 'y'],
      ])} = ${p * x + q * y}`;
    return `${eq(a, b)}; ${eq(c, d)}`;
  }
}

function t7(r: Rng, level: Level): string {
  const rel = r.pick(['<', '<=', '>', '>='] as const);
  const a = r.nz(level === 1 ? 4 : level === 2 ? 7 : 9);
  const bound = r.int(-5, 5);
  const extra = level === 1 ? r.int(0, 4) : r.int(-6, 6);
  // a x + extra rel (a*bound + extra)  has solution x rel bound when a > 0, flipped when a < 0.
  const rhs = a * bound + extra;
  const left = polyText([
    [a, 'x'],
    [extra, ''],
  ]);
  return `${left} ${rel} ${rhs}`;
}

const GENERATORS: Record<ProblemType, (r: Rng, level: Level) => string> = {
  T1: t1,
  T2: t2,
  T3: t3,
  T4: t4,
  T5: t5,
  T6: t6,
  T7: t7,
};

function acceptable(type: ProblemType, sol: Solution): boolean {
  if (sol.status !== 'solved' || sol.type !== type) return false;
  if (sol.steps.length === 0) return false;
  const a = sol.answer;
  if (type === 'T3') return a?.kind === 'roots' && a.values.length === 1;
  if (type === 'T4') return a?.kind === 'roots';
  if (type === 'T5') return a?.kind === 'pair';
  if (type === 'T7') return a?.kind === 'interval';
  if (type === 'T6')
    return (
      a?.kind === 'expression' &&
      sol.steps.some((st) => st.rule.startsWith('factor.') && st.rule !== 'factor.none')
    );
  return true;
}

/** Deterministic: the same (type, level, seed) always gives the same question. */
export function generateQuestion(type: ProblemType, level: Level, seed: number): Question {
  const r = new Rng(seed ^ (type.charCodeAt(1) * 0x9e3779b1) ^ (level * 0x85ebca6b));
  for (let attempt = 0; attempt < 50; attempt++) {
    const input = GENERATORS[type](r, level);
    const solution = solve(input);
    if (acceptable(type, solution)) return { type, level, seed, input, solution };
  }
  // Fallbacks that are known to work (never reached in tests, kept for safety).
  const input = {
    T1: '1/2 + 1/3',
    T2: '2(x + 3) - x',
    T3: '2x + 3 = 7',
    T4: 'x^2 - 5x + 6 = 0',
    T5: 'x + y = 5; x - y = 1',
    T6: 'factor x^2 - 5x + 6',
    T7: '2x + 3 < 11',
  }[type];
  return { type, level, seed, input, solution: solve(input) };
}
