// SPDX-License-Identifier: AGPL-3.0-or-later
// Exact rational numbers on BigInt, always in lowest terms with a positive denominator.

import { abs, gcd } from './bigint';

export class Rational {
  /** Numerator (sign carrier). */
  readonly n: bigint;
  /** Denominator, always > 0. */
  readonly d: bigint;

  private constructor(n: bigint, d: bigint) {
    this.n = n;
    this.d = d;
  }

  static of(n: bigint | number, d: bigint | number = 1n): Rational {
    let nn = typeof n === 'number' ? toBigInt(n) : n;
    let dd = typeof d === 'number' ? toBigInt(d) : d;
    if (dd === 0n) throw new RangeError('division by zero');
    if (dd < 0n) {
      nn = -nn;
      dd = -dd;
    }
    const g = gcd(nn, dd);
    if (g > 1n) {
      nn /= g;
      dd /= g;
    }
    return new Rational(nn, dd);
  }

  static readonly ZERO = new Rational(0n, 1n);
  static readonly ONE = new Rational(1n, 1n);

  /** Parse an unsigned decimal literal such as "12", "0.75" or ".5". */
  static parseDecimal(text: string): Rational {
    const m = /^(\d*)(?:\.(\d*))?$/.exec(text);
    if (!m || (m[1] === '' && (m[2] ?? '') === '')) throw new SyntaxError(`not a number: ${text}`);
    const whole = m[1] || '0';
    const frac = m[2] ?? '';
    return Rational.of(BigInt(whole + frac), 10n ** BigInt(frac.length));
  }

  add(o: Rational): Rational {
    return Rational.of(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  sub(o: Rational): Rational {
    return Rational.of(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  mul(o: Rational): Rational {
    return Rational.of(this.n * o.n, this.d * o.d);
  }
  div(o: Rational): Rational {
    if (o.n === 0n) throw new RangeError('division by zero');
    return Rational.of(this.n * o.d, this.d * o.n);
  }
  neg(): Rational {
    return new Rational(-this.n, this.d);
  }
  inv(): Rational {
    return Rational.ONE.div(this);
  }
  abs(): Rational {
    return new Rational(abs(this.n), this.d);
  }
  /** Integer power (negative exponents allowed for non-zero bases). */
  pow(k: number): Rational {
    if (!Number.isInteger(k)) throw new RangeError('non-integer exponent');
    if (k < 0) return this.inv().pow(-k);
    const e = BigInt(k);
    return Rational.of(this.n ** e, this.d ** e);
  }
  sign(): -1 | 0 | 1 {
    return this.n < 0n ? -1 : this.n > 0n ? 1 : 0;
  }
  cmp(o: Rational): -1 | 0 | 1 {
    return this.sub(o).sign();
  }
  eq(o: Rational): boolean {
    return this.n === o.n && this.d === o.d;
  }
  isZero(): boolean {
    return this.n === 0n;
  }
  isInteger(): boolean {
    return this.d === 1n;
  }
  isOne(): boolean {
    return this.n === 1n && this.d === 1n;
  }
  toString(): string {
    return this.d === 1n ? this.n.toString() : `${this.n}/${this.d}`;
  }
  /** Decimal form if the expansion terminates (denominator 2^a 5^b), else undefined. */
  toDecimalString(): string | undefined {
    let d = this.d;
    let twos = 0;
    let fives = 0;
    while (d % 2n === 0n) {
      d /= 2n;
      twos++;
    }
    while (d % 5n === 0n) {
      d /= 5n;
      fives++;
    }
    if (d !== 1n) return undefined;
    const places = Math.max(twos, fives);
    if (places === 0) return this.n.toString();
    const scaled = (abs(this.n) * 10n ** BigInt(places)) / this.d;
    const s = scaled.toString().padStart(places + 1, '0');
    const out = `${s.slice(0, -places)}.${s.slice(-places)}`;
    return this.n < 0n ? `-${out}` : out;
  }
}

function toBigInt(x: number): bigint {
  if (!Number.isSafeInteger(x)) throw new RangeError(`not a safe integer: ${x}`);
  return BigInt(x);
}

export const Q = (n: bigint | number, d: bigint | number = 1n): Rational => Rational.of(n, d);
