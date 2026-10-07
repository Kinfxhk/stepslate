// SPDX-License-Identifier: AGPL-3.0-or-later
// Small exact integer helpers on BigInt.

export function abs(a: bigint): bigint {
  return a < 0n ? -a : a;
}

export function gcd(a: bigint, b: bigint): bigint {
  a = abs(a);
  b = abs(b);
  while (b !== 0n) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

export function lcm(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 0n;
  return abs((a / gcd(a, b)) * b);
}

/** Integer square root: largest s with s*s <= n (n >= 0). */
export function isqrt(n: bigint): bigint {
  if (n < 0n) throw new RangeError('isqrt of a negative number');
  if (n < 2n) return n;
  let x = BigInt(Math.floor(Math.sqrt(Number(n))));
  // Newton correction (Number precision is not enough for large n).
  for (;;) {
    const y = (x + n / x) >> 1n;
    if (y >= x) break;
    x = y;
  }
  while (x * x > n) x -= 1n;
  while ((x + 1n) * (x + 1n) <= n) x += 1n;
  return x;
}

export function isPerfectSquare(n: bigint): boolean {
  if (n < 0n) return false;
  const s = isqrt(n);
  return s * s === n;
}

/** Largest value accepted by squareFreeParts (trial division stays fast below this). */
export const SQUAREFREE_LIMIT = 10n ** 14n;

/**
 * Write n (> 0) as k^2 * m with m square-free. Returns { k, m }.
 * Throws RangeError for n above SQUAREFREE_LIMIT (callers enforce input limits).
 */
export function squareFreeParts(n: bigint): { k: bigint; m: bigint } {
  if (n <= 0n) throw new RangeError('squareFreeParts needs n > 0');
  if (n > SQUAREFREE_LIMIT) throw new RangeError('number too large to simplify a root');
  let k = 1n;
  let m = 1n;
  let rest = n;
  for (let p = 2n; p * p <= rest; p += p === 2n ? 1n : 2n) {
    let e = 0;
    while (rest % p === 0n) {
      rest /= p;
      e++;
    }
    for (let i = 0; i + 1 < e; i += 2) k *= p;
    if (e % 2 === 1) m *= p;
  }
  m *= rest; // remaining factor is 1 or a prime
  return { k, m };
}

export function bitLength(n: bigint): number {
  return abs(n).toString(2).length;
}
