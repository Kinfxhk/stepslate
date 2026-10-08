// SPDX-License-Identifier: AGPL-3.0-or-later
// Input handling: reserved words, optional commands, full-width and superscript
// characters, and adversarial edge cases. The parser must never crash and must give a
// specific, honest message.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  equationText,
  inequalityText,
  normaliseInput,
  ParseError,
  parseProblem,
  solutionText,
  solve,
  toText,
  type Problem,
} from '../src/index';
import { T1_GOLDEN, T2_GOLDEN, T3_GOLDEN, T4_GOLDEN, T5_GOLDEN } from './goldens';

function problemText(p: Problem): string {
  if (p.kind === 'expr') return toText(p.expr);
  if (p.kind === 'equation') return equationText(p.eq);
  if (p.kind === 'inequality') return inequalityText(p);
  return p.eqs.map(equationText).join('; ');
}

function parseError(input: string): ParseError {
  try {
    parseProblem(input);
  } catch (e) {
    if (e instanceof ParseError) return e;
    throw e;
  }
  throw new Error(`expected a parse error for ${JSON.stringify(input)}`);
}

describe('reserved words: functions that are not supported yet', () => {
  const CASES: [string, string, string, number][] = [
    // input, error code, name, position
    ['sin(30)', 'unsupported-trig', 'sin', 0],
    ['cos x', 'unsupported-trig', 'cos', 0],
    ['2tan(45)', 'unsupported-trig', 'tan', 1],
    ['Sin(x)=1', 'unsupported-trig', 'sin', 0],
    ['arcsin(1)', 'unsupported-trig', 'arcsin', 0],
    ['x + cot(x)', 'unsupported-trig', 'cot', 4],
    ['log(100)', 'unsupported-log', 'log', 0],
    ['ln(2)', 'unsupported-log', 'ln', 0],
    ['2ln x', 'unsupported-log', 'ln', 1],
    ['exp(1)', 'unsupported-log', 'exp', 0],
    ['abs(x-1)=3', 'unsupported-abs', 'abs', 0],
    ['ｓｉｎ（３０）', 'unsupported-trig', 'sin', 0],
  ];
  it.each(CASES)('%s', (input, code, name, pos) => {
    const e = parseError(input);
    expect(e.code).toBe(code);
    expect(e.params.name).toBe(name);
    expect(e.pos).toBe(pos);
    const sol = solve(input);
    expect(sol.status).toBe('unsupported');
    expect(sol.message?.key).toBe(`parse.${code}`);
    // never the misleading "too many unknowns" or "degree too high"
    for (const lang of ['en', 'zh-HK'] as const) {
      const text = solutionText(sol, lang);
      expect(text).not.toMatch(/unknowns|degree|未知數|次數/);
      expect(text).toContain(name);
    }
  });
  it('spaced letters are still ordinary unknowns', () => {
    const p = parseProblem('s i n').problem;
    expect(p.kind === 'expr' && p.expr.k === 'mul').toBe(true);
    expect(solve('s i n').message?.key).toBe('unsupported.too-many-vars');
  });
  it('square roots keep their own specific message', () => {
    expect(solve('sqrt(8)').message?.key).toBe('unsupported.root');
    expect(solve('√8').message?.key).toBe('unsupported.root');
  });
});

describe('optional commands: factor, simplify, solve', () => {
  it('"solve" and "simplify" give exactly the same steps as typing the problem alone', () => {
    const equations = [...T3_GOLDEN, ...T4_GOLDEN, ...T5_GOLDEN];
    const expressions = [...T1_GOLDEN, ...T2_GOLDEN];
    for (const [prefix, list] of [
      ['solve ', equations],
      ['Solve: ', equations],
      ['simplify ', expressions],
      ['SIMPLIFY:', expressions],
    ] as const) {
      for (const q of list) {
        const plain = solve(q);
        const withCmd = solve(prefix + q);
        expect(withCmd.status, prefix + q).toBe(plain.status);
        expect(withCmd.steps.map((s) => s.after)).toEqual(plain.steps.map((s) => s.after));
        expect(withCmd.answer).toEqual(plain.answer);
      }
    }
  });
  it('"factor" on an equation solves it (factorising where possible)', () => {
    for (const cmd of ['factor', 'factorise', 'factorize']) {
      const sol = solve(`${cmd} x^2-5x+6=0`);
      expect(sol.status).toBe('solved');
      expect(sol.steps.some((s) => s.rule === 'eq.factorise')).toBe(true);
    }
  });
  it('"factor" on an expression factorises it', () => {
    const sol = solve('factor x^2-5x+6');
    expect(sol.status, sol.reason).toBe('solved');
    expect(sol.type).toBe('T6');
    expect(sol.answer?.kind === 'expression' && sol.answer.expr).toBeTruthy();
  });
  it('a command that does not fit the problem gets a specific message', () => {
    expect(solve('solve 2x+3').message?.key).toBe('command.solve-needs-equation');
    expect(solve('solve 2x+3').status).toBe('error');
    expect(solve('simplify x=2').message?.key).toBe('command.simplify-needs-expression');
    expect(solve('simplify x+y=1; x-y=1').message?.key).toBe('command.simplify-needs-expression');
  });
  it('commands must come first and must be followed by a problem', () => {
    expect(parseError('x + solve').code).toBe('command-position');
    expect(parseError('x + solve').pos).toBe(4);
    expect(parseError('solve solve x=1').code).toBe('command-position');
    expect(parseError('solve').code).toBe('command-empty');
    expect(parseError('  simplify :  ').code).toBe('command-empty');
    expect(parseError('factor').params.word).toBe('factor');
  });
  it('reports the command in the parse result', () => {
    expect(parseProblem('solve 2x=4').command).toBe('solve');
    expect(parseProblem('factorise x^2=1').command).toBe('factor');
    expect(parseProblem('2x=4').command).toBeUndefined();
  });
});

describe('full-width and Unicode input (Chinese input methods)', () => {
  const toFullWidth = (s: string) =>
    s
      .replace(/[!-~]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0))
      .replace(/ /g, '\u3000');
  it('normalises one character to one character', () => {
    expect(normaliseInput('（１＋２）×３＝ｘ\u3000')).toBe('(1+2)×3=x ');
    const s = '２ｘ＋３＝７；ｘ－ｙ＝１';
    expect(normaliseInput(s).length).toBe(s.length);
  });
  it('every golden problem typed in full width parses to the same problem', () => {
    for (const q of [...T1_GOLDEN, ...T2_GOLDEN, ...T3_GOLDEN, ...T4_GOLDEN, ...T5_GOLDEN]) {
      const fw = toFullWidth(q);
      expect(problemText(parseProblem(fw).problem), fw).toBe(problemText(parseProblem(q).problem));
    }
  });
  it('accepts × ÷ − · and full-width operators', () => {
    expect(solve('3×4÷2−1').answer).toEqual(solve('3*4/2-1').answer);
    expect(solve('3·4').answer).toEqual(solve('3*4').answer);
    expect(solve('６÷（１－３）').answer).toEqual(solve('6/(1-3)').answer);
  });
  it('error messages quote the character as typed', () => {
    const e = parseError('3，4');
    expect(e.code).toBe('unexpected-char');
    expect(e.params.char).toBe('，');
    expect(e.pos).toBe(1);
  });
  it('reads a run of superscript characters as one exponent', () => {
    expect(problemText(parseProblem('x²+2x+1=0').problem)).toBe('x^2 + 2x + 1 = 0');
    expect(problemText(parseProblem('2¹⁰').problem)).toBe('2^10');
    expect(problemText(parseProblem('2⁻¹').problem)).toBe('2^(-1)');
    expect(problemText(parseProblem('x³').problem)).toBe('x^3');
    expect(parseError('2⁻').code).toBe('unexpected-char');
    expect(parseError('2⁻').params.char).toBe('⁻');
  });
});

describe('adversarial parser edge cases', () => {
  const ERRORS: [string, string][] = [
    ['', 'empty'],
    ['   ', 'empty'],
    ['\u3000\u3000', 'empty'],
    [';', 'empty-side'],
    [';;', 'empty-side'],
    ['=', 'empty-side'],
    ['=;', 'empty-side'],
    ['x==2', 'empty-side'],
    ['x=2=3', 'too-many-equals'],
    ['x=1;y=2;x+y=3', 'too-many-equations'],
    ['x=1; 2', 'mixed-separators'],
    ['1..2', 'bad-number'],
    ['.', 'bad-number'],
    ['2^^3', 'unexpected-token'],
    ['x^', 'unexpected-end'],
    ['2+', 'unexpected-end'],
    ['()', 'unexpected-token'],
    ['(x', 'unclosed-paren'],
    ['x)', 'unmatched-paren'],
    ['((((x)))', 'unclosed-paren'],
    ['1e5', 'number-after-operand'],
    ['x2', 'number-after-operand'],
    ['2\u200bx', 'unexpected-char'], // zero-width space
    ['x\u202e=1', 'unexpected-char'], // right-to-left override
    ['x\u0000', 'unexpected-char'],
    ['∞', 'unexpected-char'],
    ['2😀', 'unexpected-char'],
    ['x : 2', 'unexpected-char'],
    ['９９９９９９９９９９', 'number-too-long'],
    ['2' + '⁹'.repeat(10), 'number-too-long'],
    ['('.repeat(100) + 'x' + ')'.repeat(100), 'too-long'],
  ];
  it.each(ERRORS)('%j → %s', (input, code) => {
    const e = parseError(input);
    expect(e.code).toBe(code);
    expect(e.pos).toBeGreaterThanOrEqual(0);
    expect(e.pos).toBeLessThanOrEqual(input.length);
    const sol = solve(input);
    expect(sol.status).toBe('error');
    expect(solutionText(sol, 'en').length).toBeGreaterThan(0);
  });
  const OK: [string, string][] = [
    ['((((((((((x))))))))))', 'x'],
    ['-----x', '-(-(-(-(-x))))'],
    ['+x', 'x'],
    ['.5x', '0.5x'],
    ['5.x', '5x'],
    ['(x]', 'x'],
    ['x=2;', 'x = 2'],
    ['2\t+\n3', '2 + 3'],
  ];
  it.each(OK)('%j parses as %s', (input, text) => {
    expect(problemText(parseProblem(input).problem)).toBe(text);
  });
  it('deep nesting within the length limit does not overflow the stack', () => {
    const deep = '('.repeat(99) + '1' + ')'.repeat(99);
    expect(problemText(parseProblem(deep).problem)).toBe('1');
    const negs = '-'.repeat(140) + '1';
    expect(() => parseProblem(negs)).not.toThrow();
    expect(solve(negs).status).toBe('solved');
    expect(parseError('-'.repeat(199) + '1').code).toBe('too-complex');
  });
  it('fuzz: mixed ASCII, full-width, superscript and word input never crashes', () => {
    const pieces = [
      ...'0123456789.xy+-*/^()=; ±√[]×÷:'.split(''),
      ...'０１２３＋－＊／＝（）；ｘ：'.split(''),
      ...'²³⁻¹⁰'.split(''),
      'sin',
      'ln',
      'solve ',
      'simplify',
      'factor ',
      'sqrt',
      '\u3000',
    ];
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...pieces), { maxLength: 40 }), (parts) => {
        const s = parts.join('');
        const sol = solve(s); // never throws
        expect(['solved', 'unsupported', 'error', 'unverified']).toContain(sol.status);
        expect(sol.status).not.toBe('unverified');
        try {
          const r = parseProblem(s);
          const t1 = problemText(r.problem);
          expect(problemText(parseProblem(t1).problem)).toBe(t1);
        } catch (e) {
          if (!(e instanceof ParseError)) throw e;
        }
      }),
      { numRuns: 3000 },
    );
  });
});
