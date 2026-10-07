// SPDX-License-Identifier: AGPL-3.0-or-later
// Solution states and steps shared by the rule engine and the verifier.

import type { Equation, Expr } from './ast';
import type { MessageKey } from './i18n/messages';
import type { Rational } from './numbers/rational';

export type State =
  /** An expression being simplified or evaluated. */
  | { readonly kind: 'expr'; readonly expr: Expr }
  /** One equation in one unknown. */
  | { readonly kind: 'equation'; readonly eq: Equation }
  /** Equations joined by "or" (for example after factorising). */
  | { readonly kind: 'or'; readonly eqs: readonly Equation[] }
  /** Simultaneous equations (joined by "and"). */
  | { readonly kind: 'system'; readonly eqs: readonly Equation[] }
  /** No (real) solution. */
  | { readonly kind: 'none' }
  /** Every real number is a solution (one unknown). */
  | { readonly kind: 'all' }
  /** Infinitely many solutions: every (x, y) satisfying `eq`. */
  | { readonly kind: 'infinite'; readonly eq: Equation };

/** A path from a state to a highlighted subtree, e.g. ['lhs', 'a', 'b']. */
export type Path = readonly (string | number)[];

export type ParamValue = Expr | Equation | string | number;

export interface Explanation {
  readonly key: MessageKey;
  readonly params?: Readonly<Record<string, ParamValue>>;
}

export type Matrix2 = readonly [readonly [Rational, Rational], readonly [Rational, Rational]];

/** Extra data for steps that do not transform the state. */
export type StepInfo =
  | {
      readonly kind: 'substitute';
      /** Values substituted for each unknown (one solution). */
      readonly values: Readonly<Record<string, Expr>>;
      /** For each original equation: substituted sides and their exact values. */
      readonly rows: readonly {
        readonly lhs: Expr;
        readonly lhsValue: Expr;
        readonly rhs: Expr;
        readonly rhsValue: Expr;
      }[];
    }
  | {
      readonly kind: 'discriminant';
      readonly a: Expr;
      readonly b: Expr;
      readonly c: Expr;
      /** b² − 4ac written out with the numbers substituted. */
      readonly working: Expr;
      readonly value: Expr;
    };

export interface Step {
  readonly before: State;
  readonly after: State;
  readonly rule: string;
  readonly explain: Explanation;
  /** Subtrees of `after` that changed. */
  readonly highlight?: readonly Path[];
  /**
   * Declares a weaker check for equation steps that are not constant multiples
   * (e.g. splitting a product into "or"); the solution set is always compared anyway.
   */
  readonly check?: 'solution-set';
  /** Row-operation matrix for system steps: new_i = Σ m_ij · old_j. */
  readonly matrix?: Matrix2;
  readonly info?: StepInfo;
}
