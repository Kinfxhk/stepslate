// SPDX-License-Identifier: AGPL-3.0-or-later
// T2 rules: simplify polynomial expressions (expand powers and products, remove
// brackets, simplify each term, order and combine like terms). Proposals only: the
// verifier checks every step by exact polynomial identity.

import type { Expr } from '../ast';
import { add, div, exprEqual, hasVar, mul, neg, num, pow, sub, v } from '../ast';
import type { MessageKey } from '../i18n/messages';
import { Rational } from '../numbers/rational';
import type { ParamValue } from '../state';
import { decimalsToFractions, isFinalNumber, nextArithmetic } from './arith';
import { getAt, replaceAt, type Side } from './tree';

export interface PolyDraft {
  readonly expr: Expr;
  readonly rule: string;
  readonly key: MessageKey;
  readonly params?: Record<string, ParamValue>;
  readonly paths?: readonly (readonly Side[])[];
}

// ---- signed terms ----------------------------------------------------------------------

export interface SignedTerm {
  readonly sign: 1 | -1;
  readonly term: Expr;
}

const isSum = (e: Expr): boolean => e.k === 'add' || e.k === 'sub';
/** A sum, possibly behind minus signs: (a+b), -(a-b), -(-(a+b)). */
export const isSumLike = (e: Expr): boolean => isSum(e) || (e.k === 'neg' && isSumLike(e.a));

/** Flatten a sum into signed terms, removing brackets (a − (b − c) → a, −b, +c). */
export function flatten(e: Expr, sign: 1 | -1 = 1): SignedTerm[] {
  if (e.k === 'add') return [...flatten(e.a, sign), ...flatten(e.b, sign)];
  if (e.k === 'sub') return [...flatten(e.a, sign), ...flatten(e.b, -sign as 1 | -1)];
  if (e.k === 'neg') return flatten(e.a, -sign as 1 | -1);
  return [{ sign, term: e }];
}

/** Top-level terms without opening brackets: only the left-leaning add/sub chain. */
export function spine(e: Expr, sign: 1 | -1 = 1): SignedTerm[] {
  if (e.k === 'add') return [...spine(e.a, sign), { sign, term: e.b }];
  if (e.k === 'sub') return [...spine(e.a, sign), { sign: -sign as 1 | -1, term: e.b }];
  return [{ sign, term: e }];
}

export function buildSum(terms: readonly SignedTerm[]): Expr {
  if (terms.length === 0) return num(0);
  const [first, ...rest] = terms as [SignedTerm, ...SignedTerm[]];
  let out = first.sign < 0 ? neg(first.term) : first.term;
  for (const t of rest) out = t.sign < 0 ? sub(out, t.term) : add(out, t.term);
  return out;
}

// ---- monomials ---------------------------------------------------------------------------

/** Variable → exponent, kept sorted by variable name. */
export type Powers = ReadonlyMap<string, number>;
export interface Mono {
  readonly c: Rational;
  readonly p: Powers;
}

const sortPowers = (m: Map<string, number>): Powers =>
  new Map([...m].filter(([, e]) => e !== 0).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

export function powersKey(p: Powers): string {
  return [...p].map(([x, e]) => `${x}^${e}`).join('*');
}
export function degree(p: Powers): number {
  let d = 0;
  for (const e of p.values()) d += e;
  return d;
}
/** Order: higher total degree first, then higher power of the earlier variable. */
export function comparePowers(a: Powers, b: Powers, vars: readonly string[]): number {
  const da = degree(a);
  const db = degree(b);
  if (da !== db) return db - da;
  for (const x of vars) {
    const ea = a.get(x) ?? 0;
    const eb = b.get(x) ?? 0;
    if (ea !== eb) return eb - ea;
  }
  return 0;
}

/** Read a product-like term as c·x^a·y^b, or undefined if it still contains a sum. */
export function termToMono(e: Expr): Mono | undefined {
  switch (e.k) {
    case 'num':
      return { c: e.v, p: new Map() };
    case 'var':
      return { c: Rational.ONE, p: new Map([[e.name, 1]]) };
    case 'neg': {
      const m = termToMono(e.a);
      return m && { c: m.c.neg(), p: m.p };
    }
    case 'mul': {
      const a = termToMono(e.a);
      const b = termToMono(e.b);
      if (!a || !b) return undefined;
      const p = new Map(a.p);
      for (const [x, k] of b.p) p.set(x, (p.get(x) ?? 0) + k);
      return { c: a.c.mul(b.c), p: sortPowers(p) };
    }
    case 'div': {
      const a = termToMono(e.a);
      const b = termToMono(e.b);
      if (!a || !b || b.p.size > 0 || b.c.isZero()) return undefined;
      return { c: a.c.div(b.c), p: a.p };
    }
    case 'pow': {
      const a = termToMono(e.a);
      if (!a || e.b.k !== 'num' || !e.b.v.isInteger()) return undefined;
      const k = Number(e.b.v.n);
      const p = new Map<string, number>();
      for (const [x, j] of a.p) p.set(x, j * k);
      return { c: a.c.pow(k), p: sortPowers(p) };
    }
    default:
      return undefined;
  }
}

/** Positive-coefficient monomial |c|·x^a·y^b as an expression. */
export function monoAbsExpr(c: Rational, p: Powers): Expr {
  const a = c.abs();
  const factors: Expr[] = [];
  for (const [x, e] of p) factors.push(e === 1 ? v(x) : pow(v(x), num(e)));
  const coef = a.isInteger() ? num(a) : div(num(a.n), num(a.d));
  if (factors.length === 0) return coef;
  let out: Expr = a.isOne() ? factors[0]! : mul(coef, factors[0]!, true);
  for (const f of factors.slice(1)) out = mul(out, f, true);
  return out;
}

export function monoTerm(m: Mono): SignedTerm {
  return { sign: m.c.sign() < 0 ? -1 : 1, term: monoAbsExpr(m.c, m.p) };
}

export function monosToExpr(ms: readonly Mono[]): Expr {
  return buildSum(ms.filter((m) => !m.c.isZero()).map(monoTerm));
}

// ---- rule search -------------------------------------------------------------------------

/** Number-only parts worth working out on their own: sums like (3+4), double negatives. */
function needsArithmetic(e: Expr): boolean {
  if (e.k === 'add' || e.k === 'sub') return true;
  if (e.k === 'neg' && e.a.k === 'neg') return true;
  if (e.k === 'num' || e.k === 'var') return false;
  return needsArithmetic(e.a) || ('b' in e && needsArithmetic(e.b));
}

function varFreeTarget(root: Expr): Side[] | undefined {
  let found: Side[] | undefined;
  const visit = (e: Expr, path: Side[]) => {
    if (found) return;
    if (!hasVar(e)) {
      // Products and powers of plain numbers are handled by "simplify each term".
      if (!isFinalNumber(e) && needsArithmetic(e)) found = path;
      return;
    }
    if (e.k === 'pow') return visit(e.a, [...path, 'a']); // exponents are plain numbers
    if (e.k === 'num' || e.k === 'var') return;
    visit(e.a, [...path, 'a']);
    if ('b' in e) visit(e.b, [...path, 'b']);
  };
  visit(root, []);
  return found;
}

/** Deepest, leftmost node that can be expanded (power or product of a sum). */
function expandTarget(root: Expr): { path: Side[]; node: Expr } | undefined {
  let best: { path: Side[]; node: Expr; depth: number } | undefined;
  const visit = (e: Expr, path: Side[], parent?: { node: Expr; path: Side[] }) => {
    if (e.k === 'num' || e.k === 'var') return;
    visit(e.a, [...path, 'a'], { node: e, path });
    if ('b' in e) visit(e.b, [...path, 'b'], { node: e, path });
    let ok = false;
    if (e.k === 'pow' && isSumLike(e.a) && hasVar(e.a)) ok = true;
    if (e.k === 'mul' && (isSumLike(e.a) || isSumLike(e.b))) ok = true;
    if (e.k === 'div' && isSumLike(e.a) && !hasVar(e.b)) ok = true;
    if (ok && (!best || path.length > best.depth)) {
      // -3(x - 4): multiply by -3 directly rather than by 3 and then negate.
      const useParent = e.k === 'mul' && parent?.node.k === 'neg';
      best = useParent
        ? { path: parent!.path, node: parent!.node, depth: path.length }
        : { path, node: e, depth: path.length };
    }
  };
  visit(root, []);
  return best;
}

function expandNode(e: Expr): { node: Expr; key: MessageKey; params: Record<string, ParamValue> } {
  if (e.k === 'pow') {
    const k = Number((e.b as { v: Rational }).v.n);
    let node: Expr = k === 0 ? num(1) : e.a;
    for (let i = 1; i < k; i++) node = mul(node, e.a, true);
    return { node, key: 'poly.power-to-product', params: { before: e, after: node } };
  }
  if (e.k === 'div') {
    const terms = flatten(e.a).map((t) => ({ sign: t.sign, term: div(t.term, e.b) }));
    return { node: buildSum(terms), key: 'poly.divide-terms', params: { d: e.b } };
  }
  if (e.k === 'neg' && e.a.k === 'mul') {
    const inner = expandNode(e.a);
    const terms = flatten(inner.node, -1);
    const factor = inner.params.factor as Expr | undefined;
    return factor
      ? { node: buildSum(terms), key: 'poly.distribute', params: { factor: negFactor(factor) } }
      : { node: buildSum(terms), key: 'poly.expand-brackets-negative', params: {} };
  }
  if (e.k === 'mul') {
    const left = isSumLike(e.a) ? flatten(e.a) : [{ sign: 1 as const, term: e.a }];
    const right = isSumLike(e.b) ? flatten(e.b) : [{ sign: 1 as const, term: e.b }];
    const terms: SignedTerm[] = [];
    for (const l of left)
      for (const r of right)
        terms.push({ sign: (l.sign * r.sign) as 1 | -1, term: mul(l.term, r.term) });
    const both = isSumLike(e.a) && isSumLike(e.b);
    return both
      ? { node: buildSum(terms), key: 'poly.expand-brackets', params: {} }
      : {
          node: buildSum(terms),
          key: 'poly.distribute',
          params: { factor: isSumLike(e.a) ? e.b : e.a },
        };
  }
  throw new Error('not expandable');
}

function negFactor(f: Expr): Expr {
  return f.k === 'neg' ? f.a : neg(f);
}

function needsBracketRemoval(e: Expr): boolean {
  // A leading minus on a single term is fine; any bracketed sum or other minus is not.
  return spine(e).some(
    (t, i) => isSumLike(t.term) || (t.term.k === 'neg' && (i > 0 || isSumLike(t.term.a))),
  );
}

/** Find the next simplification step for an expression with unknowns, or null when done. */
export function nextPolyStep(e: Expr, vars: readonly string[]): PolyDraft | null {
  // 0. Decimals become exact fractions first.
  const dec = decimalsToFractions(e);
  if (dec) return { expr: dec.expr, rule: dec.rule, key: dec.key, paths: dec.paths };
  // 1. Plain arithmetic inside the expression.
  const vf = varFreeTarget(e);
  if (vf) {
    const sub0 = getAt(e, vf);
    const drafts = nextArithmetic(sub0);
    const d = drafts[0];
    if (d) {
      return {
        expr: replaceAt(e, vf, d.expr),
        rule: d.rule,
        key: d.key,
        ...(d.params ? { params: d.params } : {}),
        paths: d.paths.map((p) => [...vf, ...p]),
      };
    }
  }
  // 2. Expand powers and products of brackets (innermost first).
  const ex = expandTarget(e);
  if (ex) {
    // Tidy a bracket's contents before multiplying it out (e.g. after a first expansion).
    if (ex.node.k === 'mul') {
      for (const side of ['a', 'b'] as const) {
        const child = ex.node[side];
        if (!isSum(child)) continue;
        const inner = nextPolyStep(child, vars);
        if (inner) {
          const at = [...ex.path, side];
          return {
            ...inner,
            expr: replaceAt(e, at, inner.expr),
            paths: (inner.paths ?? [[]]).map((p) => [...at, ...p]),
          };
        }
      }
    }
    const r = expandNode(ex.node);
    return {
      expr: replaceAt(e, ex.path, r.node),
      rule: r.key,
      key: r.key,
      params: r.params,
      paths: [ex.path],
    };
  }
  // 3. Remove brackets from the sum.
  if (needsBracketRemoval(e)) {
    return {
      expr: buildSum(flatten(e)),
      rule: 'poly.remove-brackets',
      key: 'poly.remove-brackets',
    };
  }
  // 4. Simplify each term to c·x^n.
  const terms = spine(e);
  const monos: Mono[] = [];
  for (const t of terms) {
    const m = termToMono(t.term);
    if (!m) return null; // cannot happen after expansion; leave unverified rather than guess
    monos.push(t.sign < 0 ? { c: m.c.neg(), p: m.p } : m);
  }
  const canonical = buildSum(monos.map(monoTerm));
  if (!exprEqual(canonical, e)) {
    return { expr: canonical, rule: 'poly.simplify-terms', key: 'poly.simplify-terms' };
  }
  // 5. Order and combine like terms.
  const keys = monos.map((m) => powersKey(m.p));
  const hasLike = new Set(keys).size !== keys.length;
  const hasZero = monos.some((m) => m.c.isZero()) && (monos.length > 1 || monos[0]!.p.size > 0);
  const order = monos
    .map((m, i) => ({ m, i }))
    .sort((a, b) => comparePowers(a.m.p, b.m.p, vars) || a.i - b.i);
  const sorted = order.every((o, i) => o.i === i);
  if (!sorted) {
    const reordered = buildSum(order.map((o) => monoTerm(o.m)));
    return hasLike
      ? { expr: reordered, rule: 'poly.group', key: 'poly.group' }
      : {
          expr: reordered,
          rule: 'poly.order',
          key: vars.length === 1 ? 'poly.order' : 'poly.order-degree',
          params: { x: v(vars[0] ?? 'x') },
        };
  }
  if (hasLike || hasZero) {
    const sums = new Map<string, Mono>();
    for (const m of monos) {
      const k = powersKey(m.p);
      const prev = sums.get(k);
      sums.set(k, prev ? { c: prev.c.add(m.c), p: m.p } : m);
    }
    return { expr: monosToExpr([...sums.values()]), rule: 'poly.combine', key: 'poly.combine' };
  }
  return null;
}

/** Monomials of an expression that is already fully simplified (canonical form). */
export function readCanonical(e: Expr): Mono[] | undefined {
  const out: Mono[] = [];
  for (const t of spine(e)) {
    const m = termToMono(t.term);
    if (!m) return undefined;
    out.push(t.sign < 0 ? { c: m.c.neg(), p: m.p } : m);
  }
  return out;
}
