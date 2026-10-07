// SPDX-License-Identifier: AGPL-3.0-or-later
// User-facing strings for the engine (errors, warnings, step explanations).
// Written originally for StepSlate. Placeholders use {name}. Every key must exist in
// both languages (enforced by i18n.test.ts).

export type Lang = 'en' | 'zh-HK';

export const en = {
  // ---- parse errors ----
  'parse.empty': 'Type a problem first, for example 2(x+3)=5x-4.',
  'parse.too-long': 'That input is too long (maximum {max} characters).',
  'parse.too-complex': 'That problem is too complex for StepSlate (maximum {max} parts).',
  'parse.unexpected-char': 'StepSlate does not understand the character "{char}".',
  'parse.unexpected-token': 'Unexpected "{text}" here.',
  'parse.unexpected-end': 'The input ends too early: something is missing after the last operator.',
  'parse.unclosed-paren': 'A bracket "(" is never closed.',
  'parse.unmatched-paren': 'There is a ")" without a matching "(".',
  'parse.number-too-long': 'Numbers may have at most {max} digits.',
  'parse.bad-number': 'This is not a valid number: "{text}".',
  'parse.number-after-operand':
    'A number cannot follow directly here. Use * for multiplication or ^ for powers (for example x*2 or x^2).',
  'parse.too-many-equals': 'An equation can only have one "=".',
  'parse.too-many-equations': 'At most {max} equations are supported.',
  'parse.empty-side': 'One side of the equation is empty.',
  'parse.mixed-separators': 'Every part separated by ";" must be an equation with "=".',
  // ---- warnings ----
  'warn.ambiguous-division':
    'Read as (a/b)·x: the division happens first. If you meant x in the denominator, write a/(bx).',
  // ---- T1 arithmetic ----
  'arith.decimals': 'Write each decimal as a fraction so that the arithmetic stays exact.',
  'arith.reduce': 'Simplify {before}: divide the top and bottom by {g} to get {after}.',
  'arith.reduce-to-integer': 'This fraction is a whole number: {before} = {after}.',
  'arith.double-negative': 'Two minus signs cancel out: {before} = {after}.',
  'arith.power': 'Work out the power: {before} = {after}.',
  'arith.multiply': 'Multiply: {before} = {after}.',
  'arith.multiply-fractions':
    'Multiply the numerators together and the denominators together: {before} = {after}.',
  'arith.divide-as-fraction': 'Write the division as a fraction: {before} = {after}.',
  'arith.divide-by-fraction':
    'Dividing by {divisor} is the same as multiplying by its reciprocal, {reciprocal}.',
  'arith.add-negative': 'Adding a negative number is the same as subtracting: {before} = {after}.',
  'arith.subtract-negative':
    'Subtracting a negative number is the same as adding: {before} = {after}.',
  'arith.add': 'Add: {before} = {after}.',
  'arith.subtract': 'Subtract: {before} = {after}.',
  'arith.common-denominator': 'Write both numbers as fractions with the common denominator {lcd}.',
  'arith.add-fractions':
    'The denominators are both {d}, so add the numerators: {before} = {after}.',
  'arith.subtract-fractions':
    'The denominators are both {d}, so subtract the numerators: {before} = {after}.',
  'arith.to-decimal': 'Write the answer as a decimal: {before} = {after}.',
  // ---- problem checks ----
  'unsupported.root':
    'Square roots in the question are not supported yet (planned for a later version).',
  'unsupported.pm': 'The ± sign can only be used in answers.',
  'unsupported.var-denominator':
    'An unknown in a denominator (a fractional equation) is not supported yet.',
  'unsupported.exponent': 'Exponents must be whole numbers from 0 to {max}.',
  'unsupported.degree':
    'The degree is too high. StepSlate simplifies up to degree {max} and solves equations up to degree 2.',
  'unsupported.equation-vars':
    'One equation with {n} unknowns cannot be solved on its own. Separate two equations with ";".',
  'unsupported.system': 'StepSlate solves systems of two linear equations in two unknowns.',
  'unsupported.no-unknown':
    'This equation has no unknown to solve for. To work out a calculation, type it without "=".',
  'unsupported.too-many-vars': 'Simplifying is supported for at most two unknowns.',
  'error.div-zero': 'The question divides by zero, which is undefined.',
  'error.too-large': 'The numbers grow too large for StepSlate. Please try a smaller problem.',
  'error.unverified':
    'StepSlate could not verify the next step, so it stops here instead of showing an unchecked step. Please report this problem.',
  // ---- T2 polynomials ----
  'poly.power-to-product': 'Write the power as a repeated product: {before} = {after}.',
  'poly.distribute': 'Multiply each term in the bracket by {factor}.',
  'poly.expand-brackets': 'Multiply every term in the first bracket by every term in the second.',
  'poly.expand-brackets-negative':
    'Multiply every term in the first bracket by every term in the second, then change every sign because of the minus in front.',
  'poly.divide-terms': 'Divide each term in the bracket by {d}.',
  'poly.remove-brackets':
    'Remove the brackets. A minus sign in front of a bracket changes the sign of every term inside it.',
  'poly.simplify-terms':
    'Simplify each term: multiply the numbers, and add the powers of the same letter.',
  'poly.order': 'Write the terms in descending powers of {x}.',
  'poly.order-degree': 'Write the terms in descending order of degree.',
  'poly.group': 'Put like terms next to each other, in descending powers.',
  'poly.combine': 'Combine like terms by adding their coefficients.',
  // ---- equations ----
  'eq.multiply-lcd': 'Multiply both sides by {lcd} to clear the fractions.',
  'eq.swap': 'Swap the two sides so that the unknown is on the left.',
  'eq.move-terms':
    'Move the terms with {x} to the left and the numbers to the right. A term changes its sign when it moves to the other side.',
  'eq.divide': 'Divide both sides by {a}.',
  'eq.negate': 'Multiply both sides by -1.',
  'eq.no-solution':
    'This statement is false for every value of {x}, so the equation has no solution.',
  'eq.all-solutions':
    'This statement is true for every value of {x}, so every real number is a solution.',
  'eq.check': 'Check: substitute {value} into the original equation. Both sides are equal.',
  'eq.check-pair':
    'Check: substitute {value} and {value2} into both original equations. Both sides of each are equal.',
  // ---- states and answers ----
  'state.or': 'or',
  'state.and': 'and',
  'state.none': 'There is no real solution.',
  'state.all': 'Every real number is a solution.',
  'state.infinite': 'Infinitely many solutions: every pair satisfying {eq}.',
  'answer.label': 'Answer',
} as const;

export type MessageKey = keyof typeof en;

export const zhHK: Record<MessageKey, string> = {
  'parse.empty': '請先輸入題目，例如 2(x+3)=5x-4。',
  'parse.too-long': '輸入太長（最多 {max} 個字元）。',
  'parse.too-complex': '題目太複雜，步步解暫時未能處理（最多 {max} 個部分）。',
  'parse.unexpected-char': '步步解不明白「{char}」這個字元。',
  'parse.unexpected-token': '這裏不應出現「{text}」。',
  'parse.unexpected-end': '輸入未完：最後一個運算符號後面缺少內容。',
  'parse.unclosed-paren': '有一個「(」沒有對應的「)」。',
  'parse.unmatched-paren': '有一個「)」找不到對應的「(」。',
  'parse.number-too-long': '每個數字最多 {max} 位。',
  'parse.bad-number': '「{text}」不是有效的數字。',
  'parse.number-after-operand':
    '數字不可以直接跟在這裏。乘法請用 *，乘方請用 ^（例如 x*2 或 x^2）。',
  'parse.too-many-equals': '一條方程只可以有一個「=」。',
  'parse.too-many-equations': '最多支援 {max} 條方程。',
  'parse.empty-side': '方程其中一邊是空的。',
  'parse.mixed-separators': '用「;」分隔的每一部分都必須是含「=」的方程。',
  'warn.ambiguous-division': '理解為 (a/b)·x：先做除法。如果想 x 在分母，請寫成 a/(bx)。',
  'arith.decimals': '先把每個小數寫成分數，令計算保持準確。',
  'arith.reduce': '約簡 {before}：分子和分母同時除以 {g}，得 {after}。',
  'arith.reduce-to-integer': '這個分數是整數：{before} = {after}。',
  'arith.double-negative': '兩個負號互相抵消：{before} = {after}。',
  'arith.power': '計算乘方：{before} = {after}。',
  'arith.multiply': '相乘：{before} = {after}。',
  'arith.multiply-fractions': '分子乘分子，分母乘分母：{before} = {after}。',
  'arith.divide-as-fraction': '把除法寫成分數：{before} = {after}。',
  'arith.divide-by-fraction': '除以 {divisor} 等於乘以它的倒數 {reciprocal}。',
  'arith.add-negative': '加一個負數等於減去它：{before} = {after}。',
  'arith.subtract-negative': '減一個負數等於加上它：{before} = {after}。',
  'arith.add': '相加：{before} = {after}。',
  'arith.subtract': '相減：{before} = {after}。',
  'arith.common-denominator': '把兩個數通分，寫成分母為 {lcd} 的分數。',
  'arith.add-fractions': '分母都是 {d}，所以分子相加：{before} = {after}。',
  'arith.subtract-fractions': '分母都是 {d}，所以分子相減：{before} = {after}。',
  'arith.to-decimal': '把答案寫成小數：{before} = {after}。',
  'unsupported.root': '暫時未支援題目中出現開方（計劃於之後版本加入）。',
  'unsupported.pm': '「±」只可以在答案中使用。',
  'unsupported.var-denominator': '暫時未支援分母含未知數的題目（分式方程）。',
  'unsupported.exponent': '指數必須是 0 至 {max} 的整數。',
  'unsupported.degree': '次數太高。步步解可化簡最高 {max} 次的多項式，並解最高二次的方程。',
  'unsupported.equation-vars': '一條含 {n} 個未知數的方程不能單獨求解。請用「;」分隔兩條方程。',
  'unsupported.system': '步步解可解兩個未知數的二元一次聯立方程。',
  'unsupported.no-unknown': '這條方程沒有未知數可解。如要計算數值，請輸入不含「=」的算式。',
  'unsupported.too-many-vars': '化簡最多支援兩個未知數。',
  'error.div-zero': '題目出現除以零，這是沒有定義的。',
  'error.too-large': '數字變得太大，步步解未能處理。請試較小的題目。',
  'error.unverified':
    '步步解未能驗證下一步，因此在這裏停止，而不會顯示未經檢查的步驟。請報告這個問題。',
  'poly.power-to-product': '把乘方寫成連乘：{before} = {after}。',
  'poly.distribute': '把括號內每一項都乘以 {factor}。',
  'poly.expand-brackets': '把第一個括號的每一項，乘以第二個括號的每一項。',
  'poly.expand-brackets-negative':
    '把第一個括號的每一項乘以第二個括號的每一項；因前面有負號，所有項都要變號。',
  'poly.divide-terms': '把括號內每一項都除以 {d}。',
  'poly.remove-brackets': '去括號。括號前面是負號時，括號內每一項都要變號。',
  'poly.simplify-terms': '化簡每一項：數字相乘，相同字母的指數相加。',
  'poly.order': '按 {x} 的降冪排列各項。',
  'poly.order-degree': '按次數由高至低排列各項。',
  'poly.group': '把同類項排在一起，並按降冪排列。',
  'poly.combine': '合併同類項：把係數相加。',
  'eq.multiply-lcd': '兩邊同時乘以 {lcd}，消去分母。',
  'eq.swap': '把左右兩邊對調，令未知數在左邊。',
  'eq.move-terms': '把含 {x} 的項移到左邊，數字移到右邊。項移到另一邊時要變號。',
  'eq.divide': '兩邊同時除以 {a}。',
  'eq.negate': '兩邊同時乘以 -1。',
  'eq.no-solution': '無論 {x} 是甚麼值，這個式子都不成立，所以方程無解。',
  'eq.all-solutions': '無論 {x} 是甚麼值，這個式子都成立，所以所有實數都是解。',
  'eq.check': '驗算：把 {value} 代入原方程，左右兩邊相等。',
  'eq.check-pair': '驗算：把 {value} 及 {value2} 代入兩條原方程，每條的左右兩邊都相等。',
  'state.or': '或',
  'state.and': '及',
  'state.none': '沒有實數解。',
  'state.all': '所有實數都是解。',
  'state.infinite': '有無限多組解：所有滿足 {eq} 的數對。',
  'answer.label': '答案',
};

export const MESSAGES: Record<Lang, Record<MessageKey, string>> = { en, 'zh-HK': zhHK };

export function t(
  lang: Lang,
  key: MessageKey,
  params: Record<string, string | number> = {},
): string {
  const template = MESSAGES[lang][key] ?? MESSAGES.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (m, name: string) =>
    params[name] !== undefined ? String(params[name]) : m,
  );
}
