// SPDX-License-Identifier: AGPL-3.0-or-later
// UI strings (English and Traditional Chinese, Hong Kong written style). Explanations of
// the maths steps live in @stepslate/core (i18n/messages.ts).

import type { Lang } from '@stepslate/core';

const en = {
  'a11y.skip': 'Skip to the problem box',
  'nav.label': 'Main',
  'nav.solve': 'Solve',
  'nav.practice': 'Practice',
  'settings.dark': 'Dark',
  'settings.large': 'Large text',
  'settings.lang': '中文',
  'solve.heading': 'Solve a problem',
  'input.label': 'Type a sum, an expression or an equation',
  'input.placeholder': 'e.g. 2(x+3)=5x-4',
  'input.help': 'Use ^ for powers, / for fractions and ; between two equations.',
  'input.solve': 'Solve',
  'input.clear': 'Clear',
  'kbd.label': 'Maths keyboard',
  'kbd.backspace': 'Delete',
  'examples.label': 'Examples:',
  'preview.label': 'I read this as',
  'preview.empty': 'Type a problem above. StepSlate shows how it reads it before solving.',
  'preview.error': 'StepSlate cannot read this yet.',
  'preview.type.T1': 'Arithmetic',
  'preview.type.T2': 'Simplify an expression',
  'preview.type.T3': 'Linear equation',
  'preview.type.T4': 'Quadratic equation',
  'preview.type.T5': 'Simultaneous linear equations',
  'steps.title': 'Steps',
  'steps.next': 'Next step',
  'steps.all': 'Show all steps',
  'steps.count': 'Step {n} of {total}',
  'steps.done': 'All {total} steps shown',
  'steps.none': 'Nothing to do: this is already in its simplest form.',
  'steps.verified': 'Checked',
  'steps.verifiedTitle': 'This step was checked by the exact verifier before it was shown.',
  'check.lhs': 'Left side',
  'check.rhs': 'Right side',
  'answer.title': 'Answer',
  'answer.or': 'or',
  'share.button': 'Copy share link',
  'share.copied':
    'Link copied. The problem is stored after the # in the address, so it is never sent to a server.',
  'share.manual': 'Copy the address from the address bar to share this problem.',
  'print.button': 'Print',
  'report.link': 'Report a wrong answer',
  'report.note': 'Opens a pre-filled GitHub issue. Nothing is sent until you submit it there.',
  'footer.disclaimer':
    'Educational tool. Always check the answers yourself and ask a teacher if you are unsure.',
  'footer.source': 'Source code (AGPL-3.0-or-later)',
  'footer.licences': 'Licences',
  'footer.coffee': 'Buy me a coffee',
  'footer.independent':
    'StepSlate is an independent open-source project, not affiliated with any other maths app, publisher or exam board.',
  'rule.decimals': 'Decimals to fractions',
  'rule.arithmetic': 'Arithmetic',
  'rule.expand': 'Expand',
  'rule.simplify': 'Simplify',
  'rule.order': 'Reorder',
  'rule.combine': 'Collect like terms',
  'rule.clear': 'Clear fractions',
  'rule.swap': 'Swap sides',
  'rule.move': 'Move terms',
  'rule.divide': 'Divide',
  'rule.multiply': 'Multiply',
  'rule.factorise': 'Factorise',
  'rule.zero': 'Zero product',
  'rule.solve': 'Solve',
  'rule.discriminant': 'Discriminant',
  'rule.formula': 'Quadratic formula',
  'rule.root': 'Square root',
  'rule.eliminate': 'Eliminate',
  'rule.substitute': 'Substitute',
  'rule.result': 'Conclusion',
  'rule.check': 'Check',
  'practice.heading': 'Practice',
  'practice.intro':
    'Practice questions are generated on this device. Your progress stays in this browser only.',
  'practice.type': 'Question type',
  'practice.level': 'Difficulty',
  'practice.level.1': 'Easy',
  'practice.level.2': 'Medium',
  'practice.level.3': 'Hard',
  'practice.new': 'New question',
  'practice.question': 'Question {n}',
  'practice.answer': 'Your answer',
  'practice.answerHelp.T1': 'A number, e.g. 7/12 or 0.5',
  'practice.answerHelp.T2': 'A simplified expression, e.g. 2x^2 - 3x + 1',
  'practice.answerHelp.T3': 'e.g. x = 3 or just 3',
  'practice.answerHelp.T4': 'Roots separated by commas, e.g. 2, 3 (or "none")',
  'practice.answerHelp.T5': 'e.g. x = 3, y = 2',
  'practice.check': 'Check answer',
  'practice.hint': 'Show next step',
  'practice.reveal': 'Show full solution',
  'practice.correct': 'Correct!',
  'practice.wrong': 'Not quite. Try again or look at the next step.',
  'practice.unreadable': 'StepSlate cannot read this answer. Check the format.',
  'practice.noHint': 'No more steps: compare with the full solution.',
  'practice.progress': 'Correct: {correct} of {total} attempted',
  'practice.clear': 'Clear progress',
  'practice.cleared': 'Progress cleared.',
  'practice.seed': 'Question code',
  'practice.none': 'none',
} as const;

export type UiKey = keyof typeof en;

const zhHK: Record<UiKey, string> = {
  'a11y.skip': '跳到題目輸入框',
  'nav.label': '主選單',
  'nav.solve': '解題',
  'nav.practice': '練習',
  'settings.dark': '深色',
  'settings.large': '大字',
  'settings.lang': 'English',
  'solve.heading': '解題',
  'input.label': '輸入算式、代數式或方程',
  'input.placeholder': '例如 2(x+3)=5x-4',
  'input.help': '用 ^ 表示次方，用 / 表示分數，兩條方程之間用 ; 分隔。',
  'input.solve': '解題',
  'input.clear': '清除',
  'kbd.label': '數學鍵盤',
  'kbd.backspace': '刪除',
  'examples.label': '例子：',
  'preview.label': '我理解為',
  'preview.empty': '在上面輸入題目。解題前，步步解會先顯示它如何理解這條題目。',
  'preview.error': '步步解暫時未能理解這條題目。',
  'preview.type.T1': '四則運算',
  'preview.type.T2': '化簡代數式',
  'preview.type.T3': '一元一次方程',
  'preview.type.T4': '一元二次方程',
  'preview.type.T5': '二元一次聯立方程',
  'steps.title': '步驟',
  'steps.next': '下一步',
  'steps.all': '顯示所有步驟',
  'steps.count': '第 {n} 步，共 {total} 步',
  'steps.done': '已顯示全部 {total} 步',
  'steps.none': '毋須計算：這已經是最簡形式。',
  'steps.verified': '已驗證',
  'steps.verifiedTitle': '這一步在顯示前已經由精確驗證器核對。',
  'check.lhs': '左方',
  'check.rhs': '右方',
  'answer.title': '答案',
  'answer.or': '或',
  'share.button': '複製分享連結',
  'share.copied': '已複製連結。題目儲存在網址 # 之後，不會傳送到伺服器。',
  'share.manual': '請從網址列複製網址以分享這條題目。',
  'print.button': '列印',
  'report.link': '回報錯誤答案',
  'report.note': '會開啟一個預先填好的 GitHub issue；你在那裏按提交之前，不會傳送任何資料。',
  'footer.disclaimer': '教育用途工具。請自行核對答案；如有疑問，請請教老師。',
  'footer.source': '原始碼（AGPL-3.0-or-later）',
  'footer.licences': '授權條款',
  'footer.coffee': '請我喝杯咖啡',
  'footer.independent':
    '步步解是獨立的開源項目，與任何其他數學應用程式、出版社或考評機構均無關連。',
  'rule.decimals': '小數化分數',
  'rule.arithmetic': '計算',
  'rule.expand': '展開',
  'rule.simplify': '化簡',
  'rule.order': '排列',
  'rule.combine': '合併同類項',
  'rule.clear': '消去分母',
  'rule.swap': '對調兩邊',
  'rule.move': '移項',
  'rule.divide': '除',
  'rule.multiply': '乘',
  'rule.factorise': '因式分解',
  'rule.zero': '零積性質',
  'rule.solve': '求解',
  'rule.discriminant': '判別式',
  'rule.formula': '二次公式',
  'rule.root': '開平方',
  'rule.eliminate': '消元',
  'rule.substitute': '代入',
  'rule.result': '結論',
  'rule.check': '驗算',
  'practice.heading': '練習',
  'practice.intro': '練習題在這部裝置上生成，進度只會儲存在這個瀏覽器。',
  'practice.type': '題型',
  'practice.level': '程度',
  'practice.level.1': '淺',
  'practice.level.2': '中',
  'practice.level.3': '深',
  'practice.new': '新題目',
  'practice.question': '第 {n} 題',
  'practice.answer': '你的答案',
  'practice.answerHelp.T1': '一個數，例如 7/12 或 0.5',
  'practice.answerHelp.T2': '化簡後的代數式，例如 2x^2 - 3x + 1',
  'practice.answerHelp.T3': '例如 x = 3，或只寫 3',
  'practice.answerHelp.T4': '各根以逗號分隔，例如 2, 3（無實根請輸入「none」）',
  'practice.answerHelp.T5': '例如 x = 3, y = 2',
  'practice.check': '核對答案',
  'practice.hint': '顯示下一步',
  'practice.reveal': '顯示完整解法',
  'practice.correct': '正確！',
  'practice.wrong': '未對。再試一次，或看看下一步。',
  'practice.unreadable': '步步解未能理解這個答案，請檢查格式。',
  'practice.noHint': '已沒有更多步驟，請對照完整解法。',
  'practice.progress': '答對 {correct} 題，共嘗試 {total} 題',
  'practice.clear': '清除進度',
  'practice.cleared': '已清除進度。',
  'practice.seed': '題目編號',
  'practice.none': '無',
};

export const UI: Record<Lang, Record<UiKey, string>> = { en, 'zh-HK': zhHK };

export function ui(lang: Lang, key: UiKey, params: Record<string, string | number> = {}): string {
  return (UI[lang][key] ?? UI.en[key]).replace(/\{(\w+)\}/g, (m, n: string) =>
    params[n] !== undefined ? String(params[n]) : m,
  );
}

/** Short heading for a step, from its rule id. */
export function ruleKey(rule: string): UiKey {
  if (rule === 'check') return 'rule.check';
  if (rule === 'arith.decimals') return 'rule.decimals';
  if (rule.startsWith('arith.')) return 'rule.arithmetic';
  if (/^poly\.(power-to-product|distribute|expand|divide-terms|remove-brackets)/.test(rule))
    return 'rule.expand';
  if (rule === 'poly.simplify-terms') return 'rule.simplify';
  if (rule.startsWith('poly.order') || rule === 'poly.group' || rule === 'sys.order')
    return 'rule.order';
  if (rule === 'poly.combine') return 'rule.combine';
  if (rule.endsWith('multiply-lcd')) return 'rule.clear';
  if (rule === 'eq.swap') return 'rule.swap';
  if (rule.endsWith('move-terms') || rule === 'eq.move-all-left') return 'rule.move';
  if (/divide|negate/.test(rule)) return 'rule.divide';
  if (rule.startsWith('sys.scale')) return 'rule.multiply';
  if (rule === 'eq.factorise') return 'rule.factorise';
  if (rule.startsWith('eq.zero-product') || rule === 'eq.square-zero') return 'rule.zero';
  if (rule === 'eq.discriminant') return 'rule.discriminant';
  if (rule === 'eq.evaluate-formula') return 'rule.arithmetic';
  if (rule === 'eq.reduce-formula' || rule === 'eq.simplify-root') return 'rule.simplify';
  if (/formula/.test(rule)) return 'rule.formula';
  if (/root|square/.test(rule)) return 'rule.root';
  if (rule === 'sys.add' || rule === 'sys.subtract') return 'rule.eliminate';
  if (rule === 'sys.substitute') return 'rule.substitute';
  if (/no-solution|all-solutions|no-real|infinite|sys\.all/.test(rule)) return 'rule.result';
  return 'rule.solve';
}
