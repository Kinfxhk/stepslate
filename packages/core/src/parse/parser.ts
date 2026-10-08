// SPDX-License-Identifier: AGPL-3.0-or-later
// Pratt (precedence-climbing) parser.
//
// Precedence (low -> high): + − ±  <  unary −  <  × ÷ and implicit multiplication  <  ^
// Implicit multiplication ("2x", "3(x+1)", "(x+1)(x-1)", "xy") has the same precedence
// as × and ÷ and is left-associative, so "1/2x" means (1/2)·x. Because that reading is
// a common source of confusion, the parser reports an "ambiguous-division" warning.

import type { Equation, Expr, Problem } from '../ast';
import { countNodes } from '../ast';
import { LIMITS } from '../limits';
import { Rational } from '../numbers/rational';
import { ParseError, type ParseWarning } from './errors';
import { tokenize, type Command, type Token } from './lexer';

const BP_ADD = 10;
const BP_NEG = 15;
const BP_MUL = 20;
const BP_POW = 30;

export interface ParseResult {
  readonly problem: Problem;
  readonly warnings: readonly ParseWarning[];
  /** Optional command typed before the problem ("factor", "simplify" or "solve"). */
  readonly command?: Command;
}

class Parser {
  i = 0;
  readonly warnings: ParseWarning[] = [];
  /** Nodes that were written inside brackets by the user. */
  private readonly bracketed = new WeakSet<Expr>();
  /** Division nodes whose denominator was written without brackets. */
  private readonly bareDiv = new WeakMap<Expr, number>();

  constructor(private readonly toks: Token[]) {}

  peek(): Token {
    return this.toks[this.i]!;
  }
  next(): Token {
    return this.toks[this.i++]!;
  }

  expr(minBp: number): Expr {
    let left = this.nud();
    for (;;) {
      const t = this.peek();
      let bp: number;
      let kind: 'add' | 'sub' | 'pm' | 'mul' | 'div' | 'pow' | 'implicit';
      switch (t.type) {
        case '+':
          [bp, kind] = [BP_ADD, 'add'];
          break;
        case '-':
          [bp, kind] = [BP_ADD, 'sub'];
          break;
        case '±':
          [bp, kind] = [BP_ADD, 'pm'];
          break;
        case '*':
          [bp, kind] = [BP_MUL, 'mul'];
          break;
        case '/':
          [bp, kind] = [BP_MUL, 'div'];
          break;
        case '^':
          [bp, kind] = [BP_POW, 'pow'];
          break;
        case 'var':
        case '(':
        case 'sqrt':
          [bp, kind] = [BP_MUL, 'implicit'];
          break;
        case 'num':
          throw new ParseError('number-after-operand', t.pos, { text: t.text });
        default:
          return left;
      }
      if (bp <= minBp) return left;
      if (kind === 'implicit') {
        const right = this.expr(BP_MUL);
        const divPos = this.bareDiv.get(left);
        if (divPos !== undefined && !this.bracketed.has(left))
          this.warnings.push({ code: 'ambiguous-division', pos: divPos, params: {} });
        left = { k: 'mul', a: left, b: right, implicit: true };
        continue;
      }
      this.next();
      if (kind === 'pow') {
        const right = this.expr(BP_POW - 1); // right-associative
        left = { k: 'pow', a: left, b: right };
        continue;
      }
      const right = this.expr(bp);
      if (kind === 'div') {
        const node: Expr = { k: 'div', a: left, b: right };
        if (!this.bracketed.has(right)) this.bareDiv.set(node, t.pos);
        left = node;
      } else {
        left = { k: kind, a: left, b: right };
      }
    }
  }

  nud(): Expr {
    const t = this.next();
    switch (t.type) {
      case 'num':
        return t.text.includes('.')
          ? { k: 'num', v: Rational.parseDecimal(t.text), text: t.text }
          : { k: 'num', v: Rational.parseDecimal(t.text) };
      case 'var':
        return { k: 'var', name: t.text };
      case '-':
        return { k: 'neg', a: this.expr(BP_NEG) };
      case '+':
        return this.expr(BP_NEG);
      case '±':
        return { k: 'pm', a: { k: 'num', v: Rational.ZERO }, b: this.expr(BP_NEG) };
      case '(': {
        if (this.peek().type === ')')
          throw new ParseError('unexpected-token', this.peek().pos, { text: ')' });
        const inner = this.expr(0);
        const close = this.next();
        if (close.type !== ')') {
          if (close.type === 'end') throw new ParseError('unclosed-paren', t.pos);
          throw new ParseError('unexpected-token', close.pos, { text: close.text });
        }
        this.bracketed.add(inner);
        return inner;
      }
      case 'sqrt': {
        const open = this.peek();
        if (open.type === '(') {
          const inner = this.nud();
          return { k: 'sqrt', a: inner };
        }
        // "√9", "√x": a single atom
        return { k: 'sqrt', a: this.atomForRoot() };
      }
      case 'end':
        throw new ParseError('unexpected-end', t.pos);
      case ')':
        throw new ParseError('unmatched-paren', t.pos);
      default:
        throw new ParseError('unexpected-token', t.pos, { text: t.text });
    }
  }

  private atomForRoot(): Expr {
    const t = this.next();
    if (t.type === 'num') return { k: 'num', v: Rational.parseDecimal(t.text) };
    if (t.type === 'var') return { k: 'var', name: t.text };
    if (t.type === 'end') throw new ParseError('unexpected-end', t.pos);
    throw new ParseError('unexpected-token', t.pos, { text: t.text });
  }

  /** Parse one side of an equation (or a whole expression) up to a separator. */
  side(): Expr {
    const t = this.peek();
    if (t.type === '=' || t.type === ';' || t.type === 'end')
      throw new ParseError('empty-side', t.pos);
    const e = this.expr(0);
    const after = this.peek();
    if (after.type === ')') throw new ParseError('unmatched-paren', after.pos);
    if (after.type !== '=' && after.type !== ';' && after.type !== 'end')
      throw new ParseError('unexpected-token', after.pos, { text: after.text });
    return e;
  }
}

/** Parse a problem: an expression, an equation `a = b`, or a system `eq1; eq2`. */
export function parseProblem(input: string): ParseResult {
  if (input.trim() === '') throw new ParseError('empty', 0);
  const toks = tokenize(input);
  const p = new Parser(toks);
  let command: Command | undefined;
  const first = toks[0]!;
  if (first.type === 'cmd') {
    command = first.text as Command;
    p.i = 1;
    if (p.peek().type === 'end')
      throw new ParseError('command-empty', first.pos, { word: command });
  }
  const parts: { lhs: Expr; rhs?: Expr }[] = [];
  for (;;) {
    const lhs = p.side();
    let rhs: Expr | undefined;
    if (p.peek().type === '=') {
      p.next();
      rhs = p.side();
      if (p.peek().type === '=') throw new ParseError('too-many-equals', p.peek().pos);
    }
    parts.push(rhs ? { lhs, rhs } : { lhs });
    const sep = p.next();
    if (sep.type === 'end') break;
    // sep is ';'
    if (p.peek().type === 'end') break; // trailing separator is fine
    if (parts.length >= LIMITS.maxEquations)
      throw new ParseError('too-many-equations', sep.pos, { max: String(LIMITS.maxEquations) });
  }
  let nodes = 0;
  for (const part of parts) nodes += countNodes(part.lhs) + (part.rhs ? countNodes(part.rhs) : 0);
  if (nodes > LIMITS.maxNodes)
    throw new ParseError('too-complex', 0, { max: String(LIMITS.maxNodes) });

  let problem: Problem;
  if (parts.length === 1 && !parts[0]!.rhs) problem = { kind: 'expr', expr: parts[0]!.lhs };
  else if (parts.some((q) => !q.rhs)) throw new ParseError('mixed-separators', 0);
  else if (parts.length === 1) problem = { kind: 'equation', eq: parts[0] as Equation };
  else problem = { kind: 'system', eqs: parts as Equation[] };
  return command ? { problem, warnings: p.warnings, command } : { problem, warnings: p.warnings };
}

/** Parse a single expression (no "=" or ";"). */
export function parseExpr(input: string): Expr {
  const { problem } = parseProblem(input);
  if (problem.kind !== 'expr')
    throw new ParseError('unexpected-token', input.indexOf('='), { text: '=' });
  return problem.expr;
}
