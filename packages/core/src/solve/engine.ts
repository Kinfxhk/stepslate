// SPDX-License-Identifier: AGPL-3.0-or-later
// Entry point: parse → classify → strategy → verified steps → answer.

import type { Expr, Problem } from '../ast';
import type { Rational } from '../numbers/rational';
import type { Surd } from '../numbers/surd';
import { ParseError, type ParseWarning } from '../parse/errors';
import type { Command } from '../parse/lexer';
import { parseProblem } from '../parse/parser';
import type { Explanation, State, Step } from '../state';
import { evalRational } from '../verify/evaluate';
import { solutionSet1, solutionSet2 } from '../verify/oracle';
import { classify, type ProblemType } from './classify';
import { Run, StopTooLarge, StopUnverified, type StepTamper } from './run';
import { solveArithmetic } from './t1';
import { solvePolynomial } from './t2';
import { solveLinear } from './t3';
import { solveQuadratic } from './t4';
import { solveSystem } from './t5';

export type Status = 'solved' | 'unsupported' | 'error' | 'unverified';

export type Answer =
  | { readonly kind: 'value'; readonly value: Rational; readonly expr: Expr }
  | { readonly kind: 'expression'; readonly expr: Expr }
  | { readonly kind: 'roots'; readonly variable: string; readonly values: readonly Surd[] }
  | { readonly kind: 'all-real'; readonly variable: string }
  | { readonly kind: 'no-solution' }
  | {
      readonly kind: 'pair';
      readonly vars: readonly [string, string];
      readonly values: readonly [Rational, Rational];
    }
  | {
      readonly kind: 'infinitely-many';
      readonly vars: readonly [string, string];
      readonly state: State;
    };

export interface Solution {
  readonly input: string;
  readonly status: Status;
  readonly problem?: Problem;
  readonly type?: ProblemType;
  readonly vars: readonly string[];
  readonly warnings: readonly ParseWarning[];
  readonly steps: readonly Step[];
  readonly answer?: Answer;
  readonly message?: Explanation;
  /** Parse error details (position for highlighting). */
  readonly parseError?: ParseError;
  /** Internal reason when status is 'unverified' (for bug reports). */
  readonly reason?: string;
}

export interface SolveOptions {
  /** Test hook: alter each proposed step before verification (mutation testing). */
  readonly tamper?: StepTamper;
  /** Optional command typed before the problem. */
  readonly command?: Command;
}

function initialState(p: Problem): State {
  if (p.kind === 'expr') return { kind: 'expr', expr: p.expr };
  if (p.kind === 'equation') return { kind: 'equation', eq: p.eq };
  return { kind: 'system', eqs: p.eqs };
}

function answerFor(run: Run, type: ProblemType, vars: readonly string[]): Answer | undefined {
  const s = run.state;
  if (type === 'T1' && s.kind === 'expr')
    return { kind: 'value', value: evalRational(s.expr, new Map()), expr: s.expr };
  if (type === 'T2' && s.kind === 'expr') return { kind: 'expression', expr: s.expr };
  if (type === 'T3' || type === 'T4') {
    const x = vars[0]!;
    const set = solutionSet1(s, x);
    if (set.kind === 'all') return { kind: 'all-real', variable: x };
    if (set.values.length === 0) return { kind: 'no-solution' };
    return { kind: 'roots', variable: x, values: set.values };
  }
  if (type === 'T5') {
    const [x, y] = vars as [string, string];
    const set = solutionSet2(s, x, y);
    if (set.kind === 'unique') return { kind: 'pair', vars: [x, y], values: [set.x, set.y] };
    if (set.kind === 'none') return { kind: 'no-solution' };
    return { kind: 'infinitely-many', vars: [x, y], state: s };
  }
  return undefined;
}

type Strategy = (run: Run, problem: Problem, vars: readonly string[]) => void;

const STRATEGIES: Partial<Record<ProblemType, Strategy>> = {
  T1: (run, p) => {
    if (p.kind === 'expr') solveArithmetic(run, p.expr);
  },
  T2: (run, p, vars) => {
    if (p.kind === 'expr') solvePolynomial(run, p.expr, vars);
  },
  T3: solveLinear,
  T4: solveQuadratic,
  T5: solveSystem,
};

/** Register a strategy (used by later modules). */
export function registerStrategy(type: ProblemType, s: Strategy): void {
  STRATEGIES[type] = s;
}

export function solveProblem(problem: Problem, input = '', opts: SolveOptions = {}): Solution {
  const base = { input, problem, warnings: [] as ParseWarning[] };
  const c = classify(problem, opts.command);
  if (!c.ok) return { ...base, status: c.status, vars: [], steps: [], message: c.message };
  const strategy = STRATEGIES[c.type];
  if (!strategy)
    return {
      ...base,
      status: 'unsupported',
      type: c.type,
      vars: c.vars,
      steps: [],
      message: { key: 'unsupported.system' },
    };
  const run = new Run({ problem, vars: c.vars }, initialState(problem), opts.tamper);
  try {
    strategy(run, problem, c.vars);
  } catch (e) {
    if (e instanceof StopUnverified)
      return {
        ...base,
        status: 'unverified',
        type: c.type,
        vars: c.vars,
        steps: run.steps,
        message: { key: 'error.unverified' },
        reason: e.message,
      };
    if (e instanceof StopTooLarge)
      return {
        ...base,
        status: 'error',
        type: c.type,
        vars: c.vars,
        steps: run.steps,
        message: { key: 'error.too-large' },
      };
    if (e instanceof RangeError)
      return {
        ...base,
        status: 'error',
        type: c.type,
        vars: c.vars,
        steps: run.steps,
        message: { key: 'error.too-large' },
      };
    throw e;
  }
  const answer = answerFor(run, c.type, c.vars);
  return answer
    ? { ...base, status: 'solved', type: c.type, vars: c.vars, steps: run.steps, answer }
    : { ...base, status: 'solved', type: c.type, vars: c.vars, steps: run.steps };
}

/** Parse and solve a typed problem. Never throws for user input. */
export function solve(input: string, opts: SolveOptions = {}): Solution {
  let parsed;
  try {
    parsed = parseProblem(input);
  } catch (e) {
    if (e instanceof ParseError)
      return {
        input,
        // a recognised but unsupported topic (sin, log, ...) is not the user's mistake
        status: e.code.startsWith('unsupported-') ? 'unsupported' : 'error',
        vars: [],
        warnings: [],
        steps: [],
        message: { key: `parse.${e.code}`, params: e.params },
        parseError: e,
      };
    throw e;
  }
  const sol = solveProblem(
    parsed.problem,
    input,
    parsed.command ? { ...opts, command: parsed.command } : opts,
  );
  return { ...sol, warnings: parsed.warnings };
}
