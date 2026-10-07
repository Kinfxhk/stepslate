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
} as const;

export type MessageKey = keyof typeof en;

export const zhHK: Record<MessageKey, string> = {
  'parse.empty': '請先輸入題目，例如 2(x+3)=5x-4。',
  'parse.too-long': '輸入太長（最多 {max} 個字元）。',
  'parse.too-complex': '題目太複雜，步步解暫時處理唔到（最多 {max} 個部分）。',
  'parse.unexpected-char': '步步解唔明白「{char}」呢個字元。',
  'parse.unexpected-token': '呢度唔應該出現「{text}」。',
  'parse.unexpected-end': '輸入未完：最後一個運算符號後面欠咗嘢。',
  'parse.unclosed-paren': '有一個「(」冇閂括號。',
  'parse.unmatched-paren': '有一個「)」搵唔到對應嘅「(」。',
  'parse.number-too-long': '每個數字最多 {max} 位。',
  'parse.bad-number': '「{text}」唔係有效數字。',
  'parse.number-after-operand':
    '數字唔可以直接跟喺呢度。乘法請用 *，次方請用 ^（例如 x*2 或 x^2）。',
  'parse.too-many-equals': '一條方程只可以有一個「=」。',
  'parse.too-many-equations': '最多支援 {max} 條方程。',
  'parse.empty-side': '方程其中一邊係空嘅。',
  'parse.mixed-separators': '用「;」分隔嘅每一部分都必須係有「=」嘅方程。',
  'warn.ambiguous-division': '理解為 (a/b)·x：先做除法。如果你想 x 喺分母，請寫成 a/(bx)。',
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
