// SPDX-License-Identifier: AGPL-3.0-or-later
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  equationText,
  inequalityText,
  exprEqual,
  LIMITS,
  ParseError,
  parseExpr,
  parseProblem,
  Rational,
  toLatex,
  toText,
  type Expr,
  type Problem,
} from '../src/index';

function problemText(p: Problem): string {
  if (p.kind === 'expr') return toText(p.expr);
  if (p.kind === 'equation') return equationText(p.eq);
  if (p.kind === 'inequality') return inequalityText(p);
  return p.eqs.map(equationText).join('; ');
}

/** [input, expected canonical text] or [input, { error: code }] */
const GOLDEN: [string, string | { error: string }][] = [
  // T1 arithmetic
  ['1+2', '1 + 2'],
  ['1/2+3/4', '1/2 + 3/4'],
  ['2*3+4', '2*3 + 4'],
  ['2*(3+4)', '2(3 + 4)'],
  ['(2+3)*4', '(2 + 3)*4'],
  ['3 ÷ 4 × 2', '3/4*2'],
  ['3−2', '3 - 2'],
  ['10-4-3', '10 - 4 - 3'],
  ['10-(4-3)', '10 - (4 - 3)'],
  ['4/2/2', '4/2/2'],
  ['4/(2/2)', '4/(2/2)'],
  ['2^3', '2^3'],
  ['(-2)^3', '(-2)^3'],
  ['-2^2', '-2^2'],
  ['2*-3', '2(-3)'],
  ['--3', '-(-3)'],
  ['+3', '3'],
  ['-1/2', '-1/2'],
  ['0.5+0.25', '0.5 + 0.25'],
  ['.5', '0.5'],
  ['5.', '5'],
  ['1.20', '1.20'],
  ['(1/2)^2', '(1/2)^2'],
  ['[1+2]*3', '(1 + 2)*3'],
  ['2(3)', '2*3'],
  ['(2)(3)', '2*3'],
  ['2·3', '2*3'],
  ['2⋅3', '2*3'],
  ['6 / 3', '6/3'],
  ['0', '0'],
  // T2 polynomials
  ['2(x+3)', '2(x + 3)'],
  ['x(x+1)', 'x(x + 1)'],
  ['(x+1)(x-1)', '(x + 1)(x - 1)'],
  ['(x+1)^2', '(x + 1)^2'],
  ['x²+2x', 'x^2 + 2x'],
  ['3x²', '3x^2'],
  ['x^3-x', 'x^3 - x'],
  ['-x^2', '-x^2'],
  ['-(x-3)', '-(x - 3)'],
  ['2x/3', '2x/3'],
  ['x/2+x/3', 'x/2 + x/3'],
  ['0.5x', '0.5x'],
  ['x y', 'xy'],
  ['2(x)(y)', '2xy'],
  ['3x^2y', '3x^2y'],
  ['3x²y', '3x^2y'],
  ['x^2x', 'x^2x'],
  ['a-(b-c)', 'a - (b - c)'],
  ['2^3^2', '2^(3^2)'],
  ['x^-2', 'x^(-2)'],
  ['1/(2x)', '1/(2x)'],
  ['1/2x', '(1/2)x'],
  ['(1/2)x', '(1/2)x'],
  ['x/2y', '(x/2)y'],
  // equations and systems
  ['2(x+3)=5x-4', '2(x + 3) = 5x - 4'],
  ['x^2-5x+6=0', 'x^2 - 5x + 6 = 0'],
  ['x=3', 'x = 3'],
  ['3=x', '3 = x'],
  ['(x+1)/2 = x/3', '(x + 1)/2 = x/3'],
  ['2x+y=5; x-y=1', '2x + y = 5; x - y = 1'],
  ['2x+y=5；x-y=1', '2x + y = 5; x - y = 1'],
  ['x+y=1;', 'x + y = 1'],
  ['x − 2 = 0', 'x - 2 = 0'],
  // roots and ± (answers)
  ['√9+sqrt(16)', 'sqrt(9) + sqrt(16)'],
  ['√x', 'sqrt(x)'],
  ['2±sqrt(3)', '2 ± sqrt(3)'],
  ['2+-sqrt(3)', '2 ± sqrt(3)'],
  ['(5+/-sqrt(13))/2', '(5 ± sqrt(13))/2'],
  ['2sqrt(3)', '2*sqrt(3)'],
  // errors
  ['', { error: 'empty' }],
  ['   ', { error: 'empty' }],
  ['x2', { error: 'number-after-operand' }],
  ['2 3', { error: 'number-after-operand' }],
  ['(x+1)2', { error: 'number-after-operand' }],
  ['(x+1', { error: 'unclosed-paren' }],
  ['x+1)', { error: 'unmatched-paren' }],
  [')', { error: 'unmatched-paren' }],
  ['()', { error: 'unexpected-token' }],
  ['x==2', { error: 'empty-side' }],
  ['=3', { error: 'empty-side' }],
  ['x=', { error: 'empty-side' }],
  ['x=1=2', { error: 'too-many-equals' }],
  ['2.5.1', { error: 'bad-number' }],
  ['.', { error: 'bad-number' }],
  ['x+', { error: 'unexpected-end' }],
  ['2*', { error: 'unexpected-end' }],
  ['x;y', { error: 'mixed-separators' }],
  ['1;2=3', { error: 'mixed-separators' }],
  ['x=1;y=2;z=3', { error: 'too-many-equations' }],
  ['1234567890', { error: 'number-too-long' }],
  ['0.1234567', { error: 'number-too-long' }],
  ['@', { error: 'unexpected-char' }],
  ['x & y', { error: 'unexpected-char' }],
  ['*2', { error: 'unexpected-token' }],
  ['x'.repeat(201), { error: 'too-long' }],
  ['x' + '+x'.repeat(80), { error: 'too-complex' }],
];

describe('parser golden table', () => {
  it(`has at least 80 cases (${GOLDEN.length})`, () =>
    expect(GOLDEN.length).toBeGreaterThanOrEqual(80));
  it.each(GOLDEN)('%j', (input, expected) => {
    if (typeof expected === 'string') {
      expect(problemText(parseProblem(input).problem)).toBe(expected);
    } else {
      let err: unknown;
      try {
        parseProblem(input);
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(ParseError);
      expect((err as ParseError).code).toBe(expected.error);
      expect((err as ParseError).pos).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('parser semantics', () => {
  it('implicit multiplication binds like × and ÷, left to right', () => {
    expect(exprEqual(parseExpr('1/2x'), parseExpr('(1/2)*x'))).toBe(true);
    expect(exprEqual(parseExpr('2x^2'), parseExpr('2*(x^2)'))).toBe(true);
    expect(exprEqual(parseExpr('-2x'), parseExpr('-(2*x)'))).toBe(true);
    expect(exprEqual(parseExpr('-x^2'), parseExpr('-(x^2)'))).toBe(true);
  });
  it('warns about a/bx and not about (a/b)x or a/(bx)', () => {
    expect(parseProblem('1/2x').warnings.map((w) => w.code)).toEqual(['ambiguous-division']);
    expect(parseProblem('1/2x').warnings[0]!.pos).toBe(1);
    expect(parseProblem('(1/2)x').warnings).toEqual([]);
    expect(parseProblem('1/(2x)').warnings).toEqual([]);
    expect(parseProblem('x/2 + 1').warnings).toEqual([]);
  });
  it('keeps decimal spelling and exact value', () => {
    const e = parseExpr('0.75');
    expect(e.k === 'num' && e.v.eq(Rational.of(3, 4)) && e.text === '0.75').toBe(true);
  });
  it('error positions point at the offending character', () => {
    try {
      parseProblem('2x + 3 @ 4');
    } catch (e) {
      expect((e as ParseError).pos).toBe(7);
    }
  });
  it('LaTeX output (golden)', () => {
    const tex = (s: string) => toLatex(parseExpr(s));
    expect(tex('1/2+3/4')).toBe('\\frac{1}{2} + \\frac{3}{4}');
    expect(tex('2*-3')).toBe('2 \\times \\left(-3\\right)');
    expect(tex('(x+1)(x-1)')).toBe('\\left(x + 1\\right)\\left(x - 1\\right)');
    expect(tex('3x^2')).toBe('3{x}^{2}');
    expect(tex('(2/3)^2')).toBe('{\\left(\\frac{2}{3}\\right)}^{2}');
    expect(tex('(5+-sqrt(13))/2')).toBe('\\frac{5 \\pm \\sqrt{13}}{2}');
    expect(tex('x*2')).toBe('x \\times 2');
  });
});

// ---- property: random AST -> text -> parse == AST ----------------------------------------

const leaf: fc.Arbitrary<Expr> = fc.oneof(
  fc.integer({ min: 0, max: 9999 }).map((n) => ({ k: 'num', v: Rational.of(n) }) as Expr),
  fc.tuple(fc.integer({ min: 0, max: 999 }), fc.integer({ min: 1, max: 999 })).map(([w, f]) => {
    const text = `${w}.${f}`;
    return { k: 'num', v: Rational.parseDecimal(text), text } as Expr;
  }),
  fc.constantFrom('x', 'y', 'a').map((name) => ({ k: 'var', name }) as Expr),
);

const exprArb: fc.Arbitrary<Expr> = fc.letrec<{ e: Expr }>((tie) => ({
  e: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    leaf,
    tie('e').map((a) => ({ k: 'neg', a }) as Expr),
    tie('e').map((a) => ({ k: 'sqrt', a }) as Expr),
    fc
      .tuple(fc.constantFrom('add', 'sub', 'mul', 'div', 'pow', 'pm'), tie('e'), tie('e'))
      .map(([k, a, b]) => ({ k, a, b }) as Expr),
  ),
})).e;

describe('parser properties', () => {
  it('print then parse returns the same tree (round trip)', () => {
    fc.assert(
      fc.property(exprArb, (e) => {
        const text = toText(e);
        if (text.length > LIMITS.maxInputLength) return; // limits are tested separately
        let back: Expr;
        try {
          back = parseExpr(text);
        } catch (err) {
          if (err instanceof ParseError && err.code === 'too-complex') return;
          throw new Error(`could not re-parse ${text}`, { cause: err });
        }
        if (!exprEqual(back, e))
          throw new Error(`round trip changed tree: ${text} -> ${toText(back)}`);
      }),
      { numRuns: 3000 },
    );
  });

  it('fuzz: random strings only ever throw ParseError (never crash)', () => {
    const alphabet = '0123456789.xy+-*/^()=; ±√[]a×÷'.split('');
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...alphabet), { maxLength: 60 }), (chars) => {
        const s = chars.join('');
        try {
          const r = parseProblem(s);
          // whatever parses must print to something that parses to the same text again
          const t1 = problemText(r.problem);
          expect(problemText(parseProblem(t1).problem)).toBe(t1);
        } catch (e) {
          if (!(e instanceof ParseError)) throw e;
        }
      }),
      { numRuns: 5000 },
    );
  });

  it('fuzz: arbitrary unicode strings only ever throw ParseError', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 80, unit: 'grapheme' }), (s) => {
        try {
          parseProblem(s);
        } catch (e) {
          if (!(e instanceof ParseError)) throw e;
        }
      }),
      { numRuns: 2000 },
    );
  });
});

describe('performance budget', () => {
  it('parses a long (161-character, ~140-node) input quickly', () => {
    const input = '(2x+3)(x-1)+'.repeat(13) + 'x^2=0';
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) parseProblem(input);
    const perParse = (performance.now() - t0) / 200;
    // Measured 2026-10-08 on the build box: about 0.05 ms per parse. The budget leaves
    // wide headroom for slow CI machines.
    expect(perParse).toBeLessThan(5);
  });
});
