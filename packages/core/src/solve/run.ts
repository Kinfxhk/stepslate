// SPDX-License-Identifier: AGPL-3.0-or-later
// Step recorder: every proposed step is verified before it is kept.

import { LIMITS } from '../limits';
import { maxBits } from '../rules/tree';
import type { Path, State, Step } from '../state';
import { verifyStep, type VerifyContext } from '../verify/verify';
import type { Expr } from '../ast';

export class StopUnverified extends Error {
  constructor(
    readonly step: Step,
    readonly reason: string,
  ) {
    super(`unverified step (${step.rule}): ${reason}`);
  }
}
export class StopTooLarge extends Error {}

export type StepTamper = (step: Step) => Step;

export type NewStep = Omit<Step, 'before'>;

function stateExprs(s: State): Expr[] {
  switch (s.kind) {
    case 'expr':
      return [s.expr];
    case 'equation':
    case 'infinite':
      return [s.eq.lhs, s.eq.rhs];
    case 'or':
    case 'system':
      return s.eqs.flatMap((q) => [q.lhs, q.rhs]);
    default:
      return [];
  }
}

export class Run {
  readonly steps: Step[] = [];
  state: State;

  constructor(
    readonly ctx: VerifyContext,
    initial: State,
    private readonly tamper?: StepTamper,
  ) {
    this.state = initial;
  }

  /** Verify and record a step; throws StopUnverified if the verifier rejects it. */
  push(s: NewStep): void {
    let step: Step = { ...s, before: this.state };
    if (this.tamper) step = this.tamper(step);
    for (const e of stateExprs(step.after))
      if (maxBits(e) > LIMITS.maxBits) throw new StopTooLarge('numbers too large');
    if (this.steps.length >= LIMITS.maxSteps) throw new StopTooLarge('too many steps');
    const r = verifyStep(step, this.ctx);
    if (!r.ok) throw new StopUnverified(step, r.reason);
    this.steps.push(step);
    this.state = step.after;
  }
}

/** Prefix relative paths with a state location (e.g. 'lhs'). */
export function prefixed(
  prefix: readonly (string | number)[],
  paths: readonly (readonly string[])[],
): Path[] {
  return paths.map((p) => [...prefix, ...p]);
}
