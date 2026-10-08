// SPDX-License-Identifier: AGPL-3.0-or-later
// Dump solved steps as JSON for the independent Python oracle.
// The engine is not trusted here: Python recomputes every solution set with sympy.

import { solve, type Expr, type State, type Surd } from '../../packages/core/src/index.ts';

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function expr(e: Expr): unknown {
  switch (e.k) {
    case 'num':
      return { k: 'num', n: e.v.n.toString(), d: e.v.d.toString() };
    case 'var':
      return { k: 'var', name: e.name };
    case 'neg':
    case 'sqrt':
      return { k: e.k, a: expr(e.a) };
    default:
      return { k: e.k, a: expr(e.a), b: expr(e.b) };
  }
}

function state(s: State): unknown {
  switch (s.kind) {
    case 'expr':
      return { kind: 'expr', expr: expr(s.expr) };
    case 'equation':
    case 'infinite':
      return { kind: 'equation', lhs: expr(s.eq.lhs), rhs: expr(s.eq.rhs) };
    case 'inequality':
      return { kind: 'inequality', rel: s.rel, lhs: expr(s.lhs), rhs: expr(s.rhs) };
    case 'or':
      return { kind: 'or', eqs: s.eqs.map((q) => ({ lhs: expr(q.lhs), rhs: expr(q.rhs) })) };
    case 'none':
      return { kind: 'none' };
    case 'all':
      return { kind: 'all' };
    default:
      return { kind: s.kind };
  }
}

function surd(s: Surd): unknown {
  return {
    an: s.a.n.toString(),
    ad: s.a.d.toString(),
    bn: s.b.n.toString(),
    bd: s.b.d.toString(),
    r: s.r.toString(),
  };
}

interface Case {
  id: string;
  input: string;
  steps: unknown[];
  answer: unknown;
}

function one(id: string, input: string, quadratic?: 'square'): Case {
  const sol = solve(input, quadratic ? { quadratic } : {});
  if (sol.status !== 'solved' || !sol.answer) {
    throw new Error(`${id} ${input} status ${sol.status} ${sol.reason ?? ''}`);
  }
  const a = sol.answer;
  let answer: unknown;
  if (a.kind === 'interval')
    answer = { kind: 'interval', rel: a.rel, n: a.bound.n.toString(), d: a.bound.d.toString() };
  else if (a.kind === 'roots') answer = { kind: 'roots', values: a.values.map(surd) };
  else if (a.kind === 'expression') answer = { kind: 'expr', expr: expr(a.expr) };
  else if (a.kind === 'value')
    answer = { kind: 'value', n: a.value.n.toString(), d: a.value.d.toString() };
  else if (a.kind === 'no-solution') answer = { kind: 'none' };
  else if (a.kind === 'all-real') answer = { kind: 'all' };
  else answer = { kind: a.kind };
  const problem =
    sol.problem?.kind === 'expr'
      ? { kind: 'expr', expr: expr(sol.problem.expr) }
      : sol.problem?.kind === 'equation'
        ? { kind: 'equation', lhs: expr(sol.problem.eq.lhs), rhs: expr(sol.problem.eq.rhs) }
        : sol.problem?.kind === 'inequality'
          ? {
              kind: 'inequality',
              rel: sol.problem.rel,
              lhs: expr(sol.problem.lhs),
              rhs: expr(sol.problem.rhs),
            }
          : { kind: 'other' };
  return {
    id,
    input,
    steps: sol.steps.map((st) => ({
      rule: st.rule,
      check: st.check ?? null,
      before: state(st.before),
      after: state(st.after),
    })),
    answer,
    ...{ problem },
  } as Case & { problem: unknown };
}

const cases: unknown[] = [];
const next = rng(0x5a17);
const irel = ['<', '<=', '>', '>='] as const;
for (let i = 0; i < 120; i++) {
  const a = Math.floor(next() * 15) - 7;
  const A = a === 0 ? 1 : a;
  const b = Math.floor(next() * 21) - 10;
  const c = Math.floor(next() * 21) - 10;
  const rel = irel[Math.floor(next() * 4)]!;
  const bPart = b === 0 ? '' : b > 0 ? `+ ${b}` : `- ${-b}`;
  const ax = A === 1 ? 'x' : A === -1 ? '-x' : `${A}x`;
  cases.push(one(`ineq-${i}`, `${ax} ${bPart} ${rel} ${c}`.replace(/\s+/g, ' ')));
}
for (const fixed of ['2 < 3', '2 < 2', '2 <= 2', 'x < x', 'x <= x', '-2x < 4', 'x/2 + 1/3 < 1']) {
  cases.push(one(`ineq-fixed-${fixed}`, fixed));
}
for (let i = 0; i < 40; i++) {
  const a = 1 + Math.floor(next() * 4);
  const b = Math.floor(next() * 13) - 6;
  const c = Math.floor(next() * 13) - 6;
  const bPart = b === 0 ? '' : b > 0 ? `+ ${b}x` : `- ${-b}x`;
  const cPart = c === 0 ? '' : c > 0 ? `+ ${c}` : `- ${-c}`;
  const ax = a === 1 ? 'x^2' : `${a}x^2`;
  cases.push(one(`square-${i}`, `${ax} ${bPart} ${cPart} = 0`.replace(/\s+/g, ' '), 'square'));
}
for (let i = 0; i < 40; i++) {
  const p = Math.floor(next() * 9) - 4;
  const q = Math.floor(next() * 9) - 4;
  const b = -(p + q);
  const c = p * q;
  const bPart = b === 0 ? '' : b > 0 ? `+ ${b}x` : `- ${-b}x`;
  const cPart = c === 0 ? '' : c > 0 ? `+ ${c}` : `- ${-c}`;
  cases.push(one(`factor-${i}`, `factor x^2 ${bPart} ${cPart}`.replace(/\s+/g, ' ')));
}
for (let i = 0; i < 20; i++) {
  const a = 1 + Math.floor(next() * 6);
  const b = Math.floor(next() * 11) - 5;
  const rhs = Math.floor(next() * 15) - 7;
  const bPart = b === 0 ? '' : b > 0 ? `+ ${b}` : `- ${-b}`;
  cases.push(one(`lin-${i}`, `${a}x ${bPart} = ${rhs}`.replace(/\s+/g, ' ')));
}

process.stdout.write(JSON.stringify({ cases }));
