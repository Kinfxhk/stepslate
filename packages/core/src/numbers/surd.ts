// SPDX-License-Identifier: AGPL-3.0-or-later
// Exact numbers of the form a + b·√r (a, b rational, r a square-free integer > 1),
// i.e. the quadratic field Q(√r). With b = 0 the value is rational and r is stored as 1.

import { squareFreeParts } from './bigint';
import { Rational } from './rational';

export class IncompatibleSurdError extends Error {
  constructor(r1: bigint, r2: bigint) {
    super(`cannot combine √${r1} and √${r2} exactly`);
  }
}

export class Surd {
  readonly a: Rational;
  readonly b: Rational;
  /** Square-free radicand; 1 when the value is rational (then b is 0). */
  readonly r: bigint;

  private constructor(a: Rational, b: Rational, r: bigint) {
    this.a = a;
    this.b = b;
    this.r = r;
  }

  /** a + b·√r for any integer r >= 0 (r is reduced to square-free form). */
  static of(a: Rational, b: Rational = Rational.ZERO, r: bigint = 1n): Surd {
    if (r < 0n) throw new RangeError('negative radicand');
    if (b.isZero() || r === 0n) return new Surd(a, Rational.ZERO, 1n);
    const { k, m } = squareFreeParts(r);
    const bb = b.mul(Rational.of(k));
    if (m === 1n) return new Surd(a.add(bb), Rational.ZERO, 1n);
    return new Surd(a, bb, m);
  }

  static rational(q: Rational): Surd {
    return new Surd(q, Rational.ZERO, 1n);
  }

  /** Exact √q for a rational q >= 0. */
  static sqrt(q: Rational): Surd {
    if (q.sign() < 0) throw new RangeError('square root of a negative number');
    // √(n/d) = √(n·d) / d
    return Surd.of(Rational.ZERO, Rational.of(1n, q.d), q.n * q.d);
  }

  isRational(): boolean {
    return this.b.isZero();
  }

  private common(o: Surd): bigint {
    if (this.r === 1n) return o.r;
    if (o.r === 1n || o.r === this.r) return this.r;
    throw new IncompatibleSurdError(this.r, o.r);
  }

  add(o: Surd): Surd {
    return Surd.of(this.a.add(o.a), this.b.add(o.b), this.common(o));
  }
  sub(o: Surd): Surd {
    return this.add(o.neg());
  }
  neg(): Surd {
    return new Surd(this.a.neg(), this.b.neg(), this.r);
  }
  mul(o: Surd): Surd {
    const r = this.common(o);
    const R = Rational.of(r);
    return Surd.of(
      this.a.mul(o.a).add(this.b.mul(o.b).mul(R)),
      this.a.mul(o.b).add(this.b.mul(o.a)),
      r,
    );
  }
  /** Conjugate a − b√r. */
  conj(): Surd {
    return new Surd(this.a, this.b.neg(), this.r);
  }
  /** Field norm a² − b²r (rational). */
  norm(): Rational {
    return this.a.mul(this.a).sub(this.b.mul(this.b).mul(Rational.of(this.r)));
  }
  div(o: Surd): Surd {
    const r = this.common(o);
    const nrm = o.norm();
    if (nrm.isZero()) throw new RangeError('division by zero');
    const num = this.mul(o.conj());
    return Surd.of(num.a.div(nrm), num.b.div(nrm), r);
  }
  pow(k: number): Surd {
    if (!Number.isInteger(k) || k < 0)
      throw new RangeError('exponent must be a non-negative integer');
    let out = Surd.rational(Rational.ONE);
    for (let i = 0; i < k; i++) out = out.mul(this);
    return out;
  }
  isZero(): boolean {
    return this.a.isZero() && this.b.isZero();
  }
  eq(o: Surd): boolean {
    return this.r === o.r && this.a.eq(o.a) && this.b.eq(o.b);
  }
  /** Exact sign of a + b√r. */
  sign(): -1 | 0 | 1 {
    const sa = this.a.sign();
    const sb = this.b.sign();
    if (sb === 0) return sa;
    if (sa === 0) return sb;
    if (sa === sb) return sa;
    // Opposite signs: compare a² with b²r.
    const a2 = this.a.mul(this.a);
    const b2r = this.b.mul(this.b).mul(Rational.of(this.r));
    const c = a2.cmp(b2r);
    return c === 0 ? 0 : c > 0 ? sa : sb;
  }
  cmp(o: Surd): -1 | 0 | 1 {
    return this.sub(o).sign();
  }
  /** Approximate value (display / sorting hints only, never for correctness). */
  approx(): number {
    return (
      Number(this.a.n) / Number(this.a.d) +
      (Number(this.b.n) / Number(this.b.d)) * Math.sqrt(Number(this.r))
    );
  }
  /** Canonical key, equal for equal values. */
  key(): string {
    return this.isRational() ? this.a.toString() : `${this.a}+${this.b}r${this.r}`;
  }
  toString(): string {
    if (this.isRational()) return this.a.toString();
    const b = this.b.isOne() ? '' : this.b.eq(Rational.ONE.neg()) ? '-' : `${this.b}*`;
    const root = `${b}sqrt(${this.r})`;
    if (this.a.isZero()) return root;
    return root.startsWith('-') ? `${this.a} - ${root.slice(1)}` : `${this.a} + ${root}`;
  }
}
