// SPDX-License-Identifier: AGPL-3.0-or-later
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  answerText,
  checkAnswer,
  generateQuestion,
  Rng,
  solve,
  verifyStep,
  type Level,
  type ProblemType,
} from '../src/index';

const TYPES: ProblemType[] = ['T1', 'T2', 'T3', 'T4', 'T5'];
const LEVELS: Level[] = [1, 2, 3];

describe('seeded generators', () => {
  it('the RNG is deterministic and in range', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) {
      const x = a.int(-5, 5);
      expect(x).toBe(b.int(-5, 5));
      expect(x).toBeGreaterThanOrEqual(-5);
      expect(x).toBeLessThanOrEqual(5);
    }
  });
  it('same seed → same question (golden list)', () => {
    const list = TYPES.flatMap((t) =>
      LEVELS.flatMap((l) =>
        [1, 2, 3].map((seed) => `${t}/${l}/${seed}: ${generateQuestion(t, l, seed).input}`),
      ),
    );
    expect(list).toMatchSnapshot();
    for (const t of TYPES)
      expect(generateQuestion(t, 2, 7).input).toBe(generateQuestion(t, 2, 7).input);
  });
  it('generated questions are in range, solved and every step verified', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TYPES),
        fc.constantFrom(...LEVELS),
        fc.integer({ min: 0, max: 2 ** 31 - 1 }),
        (type, level, seed) => {
          const q = generateQuestion(type, level, seed);
          const sol = q.solution;
          expect(sol.status, q.input).toBe('solved');
          expect(sol.type, q.input).toBe(type);
          expect(q.input.length).toBeLessThanOrEqual(200);
          expect(sol.steps.length).toBeGreaterThan(0);
          const ctx = { problem: sol.problem!, vars: sol.vars };
          for (const st of sol.steps) expect(verifyStep(st, ctx).ok).toBe(true);
          // the canonical answer is accepted
          expect(checkAnswer(sol, answerText(sol)), `${q.input} → ${answerText(sol)}`).toBe(
            'correct',
          );
        },
      ),
      { numRuns: 400 },
    );
  });
});

describe('answer equivalence', () => {
  const cases: [string, string, 'correct' | 'wrong' | 'unreadable'][] = [
    ['1/4 + 1/4', '0.5', 'correct'],
    ['1/4 + 1/4', '1/2', 'correct'],
    ['1/4 + 1/4', '2/4', 'correct'],
    ['1/4 + 1/4', '1/3', 'wrong'],
    ['1/4 + 1/4', '1/2 +', 'unreadable'],
    ['2(x+3) - x', 'x + 6', 'correct'],
    ['2(x+3) - x', '6 + x', 'correct'],
    ['2(x+3) - x', '2(x+3) - x', 'wrong'], // not simplified
    ['2(x+3) - x', 'x + 5', 'wrong'],
    ['(x+1)(x+2)', 'x^2 + 3x + 2', 'correct'],
    ['(x+1)(x+2)', '(x+1)(x+2)', 'wrong'],
    ['2x+3=7', 'x = 2', 'correct'],
    ['2x+3=7', '2', 'correct'],
    ['2x+3=7', '4/2', 'correct'],
    ['2x+3=7', 'x = 3', 'wrong'],
    ['2x+3=7', 'none', 'wrong'],
    ['x+1=x+2', 'none', 'correct'],
    ['x+1=x+2', '無解', 'correct'],
    ['2(x+1)=2x+2', 'all real numbers', 'correct'],
    ['x^2-5x+6=0', 'x = 2 or x = 3', 'correct'],
    ['x^2-5x+6=0', '3, 2', 'correct'],
    ['x^2-5x+6=0', '2', 'wrong'],
    ['x^2-5x+6=0', 'x = 2, 4', 'wrong'],
    ['x^2-4x+1=0', '2 ± sqrt(3)', 'correct'],
    ['x^2-4x+1=0', '2+√3, 2-√3', 'correct'],
    ['x^2-4x+1=0', '(4 ± sqrt(12))/2', 'correct'],
    ['x^2-4x+1=0', '2 + sqrt(3)', 'wrong'],
    ['x^2+x+1=0', 'none', 'correct'],
    ['x^2+x+1=0', '0', 'wrong'],
    ['x+y=5; x-y=1', 'x = 3, y = 2', 'correct'],
    ['x+y=5; x-y=1', 'y = 2, x = 3', 'correct'],
    ['x+y=5; x-y=1', '3, 2', 'correct'],
    ['x+y=5; x-y=1', '2, 3', 'wrong'],
    ['x+y=5; x-y=1', '3', 'unreadable'],
    ['x+y=2; 2x+2y=4', 'infinitely many', 'correct'],
  ];
  it.each(cases)('%s : %s → %s', (problem, answer, verdict) => {
    expect(checkAnswer(solve(problem), answer)).toBe(verdict);
  });
  it('perturbed answers are judged wrong', () => {
    fc.assert(
      fc.property(fc.constantFrom(...TYPES), fc.integer({ min: 0, max: 100000 }), (type, seed) => {
        const sol = generateQuestion(type, 1, seed).solution;
        const a = sol.answer!;
        let wrong: string;
        if (a.kind === 'value') wrong = `${a.value.toString()} + 1`;
        else if (a.kind === 'expression') wrong = `${answerText(sol)} + 1`;
        else if (a.kind === 'roots')
          wrong = `${a.variable} = ${a.values.map((v) => `(${v.toString()}) + 1`).join(', ')}`;
        else if (a.kind === 'pair')
          wrong = `${a.vars[0]} = ${a.values[0].toString()}, ${a.vars[1]} = ${a.values[1].toString()} + 1`;
        else return;
        expect(checkAnswer(sol, wrong), wrong).not.toBe('correct');
      }),
      { numRuns: 300 },
    );
  });
});
