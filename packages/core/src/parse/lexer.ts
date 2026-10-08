// SPDX-License-Identifier: AGPL-3.0-or-later
// Tokenizer for maths input. Accepts ASCII and common Unicode operator spellings.

import { LIMITS } from '../limits';
import { ParseError } from './errors';

export type TokenType =
  | 'num'
  | 'var'
  | 'sqrt'
  | 'cmd'
  | '+'
  | '-'
  | '*'
  | '/'
  | '^'
  | '('
  | ')'
  | '='
  | ';'
  | '±'
  | 'end';

/** Optional command written before a problem, e.g. "solve 2x+3=7". */
export type Command = 'factor' | 'simplify' | 'solve';

export interface Token {
  readonly type: TokenType;
  readonly pos: number;
  readonly text: string;
}

const SINGLE: Record<string, TokenType> = {
  '+': '+',
  '-': '-',
  '\u2212': '-', // minus sign
  '\u2013': '-', // en dash (common when pasting)
  '*': '*',
  '\u00d7': '*', // ×
  '\u00b7': '*', // ·
  '\u22c5': '*', // ⋅
  '/': '/',
  '\u00f7': '/', // ÷
  '^': '^',
  '(': '(',
  '[': '(',
  ')': ')',
  ']': ')',
  '=': '=',
  ';': ';',
  '\uff1b': ';', // full-width semicolon
  '\u00b1': '±',
  '\u221a': 'sqrt', // √
};

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '\u2070': '0',
  '\u00b9': '1',
  '\u00b2': '2',
  '\u00b3': '3',
  '\u2074': '4',
  '\u2075': '5',
  '\u2076': '6',
  '\u2077': '7',
  '\u2078': '8',
  '\u2079': '9',
};
const SUPERSCRIPT_MINUS = '\u207b';

/** Function names that are recognised so that the message can be specific. */
const FUNCTIONS: Record<string, 'trig' | 'log' | 'abs'> = {
  arcsin: 'trig',
  arccos: 'trig',
  arctan: 'trig',
  sin: 'trig',
  cos: 'trig',
  tan: 'trig',
  sec: 'trig',
  csc: 'trig',
  cot: 'trig',
  log: 'log',
  ln: 'log',
  exp: 'log',
  abs: 'abs',
};
const COMMANDS: Record<string, Command> = {
  simplify: 'simplify',
  factorise: 'factor',
  factorize: 'factor',
  factor: 'factor',
  solve: 'solve',
};
const WORD = new RegExp(
  `^(${[...Object.keys(FUNCTIONS), ...Object.keys(COMMANDS)]
    .sort((a, b) => b.length - a.length)
    .join('|')})`,
  'i',
);

/**
 * Map full-width ASCII forms (typed with Chinese input methods) and the ideographic
 * space to plain ASCII. One character becomes one character, so positions are kept.
 */
export function normaliseInput(input: string): string {
  return input
    .replace(/[\uff01-\uff5e]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, ' ');
}

export function tokenize(input: string): Token[] {
  if (input.length > LIMITS.maxInputLength)
    throw new ParseError('too-long', LIMITS.maxInputLength, { max: String(LIMITS.maxInputLength) });
  const original = input;
  input = normaliseInput(input);
  const out: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      const m = /^\d*(?:\.\d*)?/.exec(input.slice(i))!;
      const text = m[0];
      if (text === '.' || /\.\d*\./.test(input.slice(i, i + text.length + 1)))
        throw new ParseError('bad-number', i, { text: input.slice(i, i + text.length + 1) });
      const [whole = '', frac = ''] = text.split('.');
      if (whole.replace(/^0+(?=\d)/, '').length + frac.length > LIMITS.maxNumberDigits)
        throw new ParseError('number-too-long', i, { max: String(LIMITS.maxNumberDigits) });
      if (frac.length > LIMITS.maxDecimalPlaces)
        throw new ParseError('number-too-long', i, { max: String(LIMITS.maxNumberDigits) });
      const clean = text.endsWith('.') ? text.slice(0, -1) : text;
      out.push({ type: 'num', pos: i, text: clean.startsWith('.') ? `0${clean}` : clean });
      i += text.length;
      continue;
    }
    if (input.startsWith('+-', i) || input.startsWith('+/-', i)) {
      out.push({ type: '±', pos: i, text: '±' });
      i += input.startsWith('+/-', i) ? 3 : 2;
      continue;
    }
    if (/^sqrt/i.test(input.slice(i, i + 4))) {
      out.push({ type: 'sqrt', pos: i, text: 'sqrt' });
      i += 4;
      continue;
    }
    const word = /[a-zA-Z]/.test(c) ? WORD.exec(input.slice(i)) : null;
    if (word) {
      const name = word[1]!.toLowerCase();
      const topic = FUNCTIONS[name];
      if (topic) throw new ParseError(`unsupported-${topic}`, i, { name });
      if (out.length > 0) throw new ParseError('command-position', i, { word: name });
      out.push({ type: 'cmd', pos: i, text: COMMANDS[name]! });
      i += name.length;
      while (i < input.length && /\s/.test(input[i]!)) i++;
      if (input[i] === ':') i++;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      out.push({ type: 'var', pos: i, text: c });
      i++;
      continue;
    }
    if (SUPERSCRIPT_DIGITS[c] || c === SUPERSCRIPT_MINUS) {
      // x², 2¹⁰, 2⁻¹: a run of superscript characters is one exponent
      const start = i;
      const minus = c === SUPERSCRIPT_MINUS;
      if (minus) i++;
      let digits = '';
      while (i < input.length && SUPERSCRIPT_DIGITS[input[i]!])
        digits += SUPERSCRIPT_DIGITS[input[i++]!];
      if (digits === '') throw new ParseError('unexpected-char', start, { char: original[start]! });
      if (digits.length > LIMITS.maxNumberDigits)
        throw new ParseError('number-too-long', start, { max: String(LIMITS.maxNumberDigits) });
      out.push({ type: '^', pos: start, text: '^' });
      if (minus) out.push({ type: '-', pos: start, text: '-' });
      out.push({ type: 'num', pos: start, text: digits });
      continue;
    }
    const t = SINGLE[c];
    if (t) {
      out.push({ type: t, pos: i, text: c });
      i++;
      continue;
    }
    throw new ParseError('unexpected-char', i, { char: original[i]! });
  }
  out.push({ type: 'end', pos: input.length, text: '' });
  return out;
}
