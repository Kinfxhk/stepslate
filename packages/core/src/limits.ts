// SPDX-License-Identifier: AGPL-3.0-or-later
// Input and computation limits. Keeping numbers small keeps every step readable and
// guarantees the browser never stalls on huge BigInt arithmetic.
// Benchmarked at M1 (2026-10-08, 8-core box): parsing a 200-character input takes
// well under 1 ms; see parse.test.ts "performance budget".

export const LIMITS = {
  /** Maximum characters in one input. */
  maxInputLength: 200,
  /** Maximum digits in one number literal (integer + fractional part). */
  maxNumberDigits: 9,
  /** Maximum decimal places in one literal. */
  maxDecimalPlaces: 6,
  /** Maximum expression-tree nodes in one input. */
  maxNodes: 150,
  /** Largest allowed exponent (exponents must be whole numbers 0..maxExponent). */
  maxExponent: 4,
  /** Largest polynomial degree after expansion. */
  maxDegree: 4,
  /** Maximum equations in a system. */
  maxEquations: 2,
  /** Any intermediate integer larger than this (in bits) aborts the solution politely. */
  maxBits: 160,
  /** Maximum steps in one solution. */
  maxSteps: 120,
} as const;
