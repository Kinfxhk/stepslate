// SPDX-License-Identifier: AGPL-3.0-or-later
// Tokenizer for maths input. Accepts ASCII and common Unicode operator spellings.

import { LIMITS } from '../limits';
import { ParseError } from './errors';

export type TokenType =
  'num' | 'var' | 'sqrt' | '+' | '-' | '*' | '/' | '^' | '(' | ')' | '=' | ';' | '±' | 'end';

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

const SUPERSCRIPTS: Record<string, string> = { '\u00b2': '2', '\u00b3': '3', '\u2074': '4' };

export function tokenize(input: string): Token[] {
  if (input.length > LIMITS.maxInputLength)
    throw new ParseError('too-long', LIMITS.maxInputLength, { max: String(LIMITS.maxInputLength) });
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
    if (/[a-zA-Z]/.test(c)) {
      out.push({ type: 'var', pos: i, text: c });
      i++;
      continue;
    }
    const sup = SUPERSCRIPTS[c];
    if (sup) {
      out.push({ type: '^', pos: i, text: '^' }, { type: 'num', pos: i, text: sup });
      i++;
      continue;
    }
    const t = SINGLE[c];
    if (t) {
      out.push({ type: t, pos: i, text: c });
      i++;
      continue;
    }
    throw new ParseError('unexpected-char', i, { char: c });
  }
  out.push({ type: 'end', pos: input.length, text: '' });
  return out;
}
