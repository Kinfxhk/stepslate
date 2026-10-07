// SPDX-License-Identifier: AGPL-3.0-or-later
// Exact evaluation used only by the verifier. Independent of the rule engine.

import type { Expr } from '../ast';
import type { Rational } from '../numbers/rational';
import { Surd } from '../numbers/surd';

export class Unverifiable extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'Unverifiable';
  }
}

const MAX_EXP = 8;

function exponent(e: Expr): number {
  const k = evalRational(e, new Map());
  if (!k.isInteger() || k.n < 0n || k.n > BigInt(MAX_EXP)) throw new Unverifiable('bad exponent');
  return Number(k.n);
}

/** Evaluate with rational arithmetic. Variables come from env. */
export function evalRational(e: Expr, env: ReadonlyMap<string, Rational>): Rational {
  switch (e.k) {
    case 'num':
      return e.v;
    case 'var': {
      const x = env.get(e.name);
      if (!x) throw new Unverifiable(`no value for ${e.name}`);
      return x;
    }
    case 'neg':
      return evalRational(e.a, env).neg();
    case 'add':
      return evalRational(e.a, env).add(evalRational(e.b, env));
    case 'sub':
      return evalRational(e.a, env).sub(evalRational(e.b, env));
    case 'mul':
      return evalRational(e.a, env).mul(evalRational(e.b, env));
    case 'div': {
      const d = evalRational(e.b, env);
      if (d.isZero()) throw new Unverifiable('division by zero');
      return evalRational(e.a, env).div(d);
    }
    case 'pow':
      return evalRational(e.a, env).pow(exponent(e.b));
    case 'sqrt':
    case 'pm':
      throw new Unverifiable('not a rational expression');
  }
}

/** Evaluate in Q(√r). `pm` must be expanded first (see expandPm). */
export function evalSurd(e: Expr, env: ReadonlyMap<string, Surd>): Surd {
  try {
    switch (e.k) {
      case 'num':
        return Surd.rational(e.v);
      case 'var': {
        const x = env.get(e.name);
        if (!x) throw new Unverifiable(`no value for ${e.name}`);
        return x;
      }
      case 'neg':
        return evalSurd(e.a, env).neg();
      case 'add':
        return evalSurd(e.a, env).add(evalSurd(e.b, env));
      case 'sub':
        return evalSurd(e.a, env).sub(evalSurd(e.b, env));
      case 'mul':
        return evalSurd(e.a, env).mul(evalSurd(e.b, env));
      case 'div': {
        const d = evalSurd(e.b, env);
        if (d.isZero()) throw new Unverifiable('division by zero');
        return evalSurd(e.a, env).div(d);
      }
      case 'pow':
        return evalSurd(e.a, env).pow(exponent(e.b));
      case 'sqrt': {
        const x = evalSurd(e.a, env);
        if (!x.isRational() || x.a.sign() < 0)
          throw new Unverifiable('root of a non-rational or negative');
        return Surd.sqrt(x.a);
      }
      case 'pm':
        throw new Unverifiable('unexpanded ±');
    }
  } catch (err) {
    if (err instanceof Unverifiable) throw err;
    throw new Unverifiable(err instanceof Error ? err.message : String(err));
  }
}

/** All branches of an expression containing ± (2^n for n ± signs). */
export function expandPm(e: Expr): Expr[] {
  switch (e.k) {
    case 'num':
    case 'var':
      return [e];
    case 'neg':
      return expandPm(e.a).map((a) => ({ k: 'neg', a }));
    case 'sqrt':
      return expandPm(e.a).map((a) => ({ k: 'sqrt', a }));
    case 'pm': {
      const out: Expr[] = [];
      for (const a of expandPm(e.a))
        for (const b of expandPm(e.b)) out.push({ k: 'add', a, b }, { k: 'sub', a, b });
      return out;
    }
    default: {
      const out: Expr[] = [];
      for (const a of expandPm(e.a))
        for (const b of expandPm(e.b))
          out.push(e.k === 'mul' ? { k: 'mul', a, b } : ({ k: e.k, a, b } as Expr));
      return out;
    }
  }
}
