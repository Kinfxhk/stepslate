// SPDX-License-Identifier: AGPL-3.0-or-later

export type ParseErrorCode =
  | 'empty'
  | 'too-long'
  | 'too-complex'
  | 'unexpected-char'
  | 'unexpected-token'
  | 'unexpected-end'
  | 'unclosed-paren'
  | 'unmatched-paren'
  | 'number-too-long'
  | 'bad-number'
  | 'number-after-operand'
  | 'too-many-equals'
  | 'too-many-relations'
  | 'too-many-equations'
  | 'empty-side'
  | 'mixed-separators'
  | 'unsupported-trig'
  | 'unsupported-log'
  | 'unsupported-abs'
  | 'command-position'
  | 'command-empty';

/** A user-facing parse error with a character position (0-based) for highlighting. */
export class ParseError extends Error {
  readonly code: ParseErrorCode;
  readonly pos: number;
  readonly params: Record<string, string>;
  constructor(code: ParseErrorCode, pos: number, params: Record<string, string> = {}) {
    super(`${code} at ${pos}`);
    this.name = 'ParseError';
    this.code = code;
    this.pos = pos;
    this.params = params;
  }
}

/** Non-fatal note about how an input was interpreted. */
export interface ParseWarning {
  readonly code: 'ambiguous-division';
  readonly pos: number;
  readonly params: Record<string, string>;
}
