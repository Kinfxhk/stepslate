// SPDX-License-Identifier: AGPL-3.0-or-later
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { gcd, isqrt, Rational, squareFreeParts, Surd, Q } from '../src/index';

const big = fc.bigInt({ min: -(10n ** 30n), max: 10n ** 30n });
const nonZero = big.filter((x) => x !== 0n);
const rat = fc.tuple(big, nonZero).map(([n, d]) => Rational.of(n, d));
const nzRat = fc.tuple(nonZero, nonZero).map(([n, d]) => Rational.of(n, d));

describe('Rational field axioms (property)', () => {
  it('addition and multiplication are commutative and associative', () => {
    fc.assert(
      fc.property(rat, rat, rat, (a, b, c) => {
        expect(a.add(b).eq(b.add(a))).toBe(true);
        expect(a.mul(b).eq(b.mul(a))).toBe(true);
        expect(
          a
            .add(b)
            .add(c)
            .eq(a.add(b.add(c))),
        ).toBe(true);
        expect(
          a
            .mul(b)
            .mul(c)
            .eq(a.mul(b.mul(c))),
        ).toBe(true);
      }),
    );
  });
  it('multiplication distributes over addition', () => {
    fc.assert(
      fc.property(rat, rat, rat, (a, b, c) => {
        expect(a.mul(b.add(c)).eq(a.mul(b).add(a.mul(c)))).toBe(true);
      }),
    );
  });
  it('identities and inverses', () => {
    fc.assert(
      fc.property(rat, nzRat, (a, b) => {
        expect(a.add(Rational.ZERO).eq(a)).toBe(true);
        expect(a.mul(Rational.ONE).eq(a)).toBe(true);
        expect(a.add(a.neg()).isZero()).toBe(true);
        expect(b.mul(b.inv()).eq(Rational.ONE)).toBe(true);
        expect(a.sub(b).add(b).eq(a)).toBe(true);
        expect(a.div(b).mul(b).eq(a)).toBe(true);
      }),
    );
  });
  it('is always normalised: positive denominator, lowest terms', () => {
    fc.assert(
      fc.property(big, nonZero, (n, d) => {
        const r = Rational.of(n, d);
        expect(r.d > 0n).toBe(true);
        expect(gcd(r.n, r.d)).toBe(r.n === 0n ? r.d : 1n);
        // value is preserved: n/d == r.n/r.d  <=>  n*r.d == r.n*d
        expect(n * r.d).toBe(r.n * d);
      }),
    );
  });
  it('order is total and consistent with subtraction', () => {
    fc.assert(
      fc.property(rat, rat, (a, b) => {
        expect(a.cmp(b)).toBe(-b.cmp(a) as -1 | 0 | 1);
        expect(a.cmp(b) === 0).toBe(a.eq(b));
      }),
    );
  });
  it('integer powers', () => {
    fc.assert(
      fc.property(
        nzRat,
        fc.integer({ min: -4, max: 4 }),
        fc.integer({ min: -4, max: 4 }),
        (a, j, k) => {
          expect(
            a
              .pow(j)
              .mul(a.pow(k))
              .eq(a.pow(j + k)),
          ).toBe(true);
        },
      ),
    );
  });
});

describe('Rational basics (golden)', () => {
  it('parses decimals exactly', () => {
    expect(Rational.parseDecimal('0.75').toString()).toBe('3/4');
    expect(Rational.parseDecimal('.5').toString()).toBe('1/2');
    expect(Rational.parseDecimal('12').toString()).toBe('12');
    expect(Rational.parseDecimal('1.20').toString()).toBe('6/5');
    expect(() => Rational.parseDecimal('.')).toThrow();
    expect(() => Rational.parseDecimal('1.2.3')).toThrow();
  });
  it('formats terminating decimals only', () => {
    expect(Q(5, 4).toDecimalString()).toBe('1.25');
    expect(Q(-1, 8).toDecimalString()).toBe('-0.125');
    expect(Q(1, 3).toDecimalString()).toBeUndefined();
    expect(Q(7).toDecimalString()).toBe('7');
  });
  it('rejects division by zero', () => {
    expect(() => Q(1, 0)).toThrow(RangeError);
    expect(() => Q(1).div(Rational.ZERO)).toThrow(RangeError);
  });
  it('decimal round trip (property)', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: -(10n ** 12n), max: 10n ** 12n }),
        fc.integer({ min: 0, max: 6 }),
        (n, p) => {
          const r = Rational.of(n, 10n ** BigInt(p));
          const s = r.toDecimalString()!;
          const parsed = s.startsWith('-')
            ? Rational.parseDecimal(s.slice(1)).neg()
            : Rational.parseDecimal(s);
          expect(parsed.eq(r)).toBe(true);
        },
      ),
    );
  });
});

describe('integer helpers', () => {
  it('isqrt is exact (property)', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 10n ** 40n }), (n) => {
        const s = isqrt(n);
        expect(s * s <= n && (s + 1n) * (s + 1n) > n).toBe(true);
      }),
    );
  });
  it('squareFreeParts', () => {
    expect(squareFreeParts(12n)).toEqual({ k: 2n, m: 3n });
    expect(squareFreeParts(72n)).toEqual({ k: 6n, m: 2n });
    expect(squareFreeParts(13n)).toEqual({ k: 1n, m: 13n });
    expect(squareFreeParts(1n)).toEqual({ k: 1n, m: 1n });
    expect(squareFreeParts(49n)).toEqual({ k: 7n, m: 1n });
    fc.assert(
      fc.property(fc.bigInt({ min: 1n, max: 10n ** 9n }), (n) => {
        const { k, m } = squareFreeParts(n);
        expect(k * k * m).toBe(n);
        expect(squareFreeParts(m).k).toBe(1n);
      }),
    );
  });
});

describe('Surd Q(√r)', () => {
  const s = (a: number, b: number, r: number) => Surd.of(Q(a), Q(b), BigInt(r));
  it('simplifies radicands (golden)', () => {
    expect(Surd.sqrt(Q(8)).toString()).toBe('2*sqrt(2)');
    expect(Surd.sqrt(Q(49)).toString()).toBe('7');
    expect(Surd.sqrt(Q(1, 2)).toString()).toBe('1/2*sqrt(2)');
    expect(Surd.sqrt(Q(12, 25)).toString()).toBe('2/5*sqrt(3)');
    expect(Surd.sqrt(Q(0)).toString()).toBe('0');
    expect(s(3, 1, 13).toString()).toBe('3 + sqrt(13)');
    expect(s(3, -2, 18).toString()).toBe('3 - 6*sqrt(2)');
    expect(() => Surd.sqrt(Q(-4))).toThrow();
  });
  it('multiplies and divides exactly (golden)', () => {
    // (1 + √2)(1 − √2) = −1
    expect(
      s(1, 1, 2)
        .mul(s(1, -1, 2))
        .toString(),
    ).toBe('-1');
    // (2 + √3)² = 7 + 4√3
    expect(s(2, 1, 3).pow(2).toString()).toBe('7 + 4*sqrt(3)');
    // 1 / (1 + √2) = −1 + √2
    expect(
      Surd.rational(Q(1))
        .div(s(1, 1, 2))
        .toString(),
    ).toBe('-1 + sqrt(2)');
    // (5 + √13)/2 is a root of x² − 5x + 3
    const x = s(5, 1, 13).div(Surd.rational(Q(2)));
    expect(
      x
        .mul(x)
        .sub(x.mul(Surd.rational(Q(5))))
        .add(Surd.rational(Q(3)))
        .isZero(),
    ).toBe(true);
  });
  it('refuses to mix different radicands', () => {
    expect(() => s(0, 1, 2).add(s(0, 1, 3))).toThrow();
  });
  const smallRat = fc
    .tuple(fc.integer({ min: -50, max: 50 }), fc.integer({ min: 1, max: 12 }))
    .map(([n, d]) => Q(n, d));
  const surdIn = (r: bigint) => fc.tuple(smallRat, smallRat).map(([a, b]) => Surd.of(a, b, r));
  it('field axioms within Q(√r) (property)', () => {
    fc.assert(
      fc.property(fc.constantFrom(2n, 3n, 5n, 6n, 7n, 10n, 13n), fc.integer(), (r, seed) => {
        const [x, y, z] = fc.sample(surdIn(r), { seed, numRuns: 3 }) as [Surd, Surd, Surd];
        expect(x.add(y).eq(y.add(x))).toBe(true);
        expect(x.mul(y).eq(y.mul(x))).toBe(true);
        expect(x.mul(y.add(z)).eq(x.mul(y).add(x.mul(z)))).toBe(true);
        if (!y.isZero()) expect(x.div(y).mul(y).eq(x)).toBe(true);
      }),
    );
  });
  it('exact sign agrees with the floating approximation when not close (property)', () => {
    fc.assert(
      fc.property(fc.constantFrom(2n, 3n, 5n, 7n, 11n), smallRat, smallRat, (r, a, b) => {
        const v = Surd.of(a, b, r);
        const ap = v.approx();
        if (Math.abs(ap) > 1e-9) expect(v.sign()).toBe(ap > 0 ? 1 : -1);
        else expect(v.sign()).toBe(0);
      }),
    );
  });
});
