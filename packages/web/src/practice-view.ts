// SPDX-License-Identifier: AGPL-3.0-or-later
// Practice mode: generated questions, equivalence-checked answers, step hints, and
// progress kept only in this browser (localStorage), with a button to clear it.

import {
  answerText,
  checkAnswer,
  generateQuestion,
  problemLatex,
  type Lang,
  type Level,
  type ProblemType,
  type Question,
} from '@sumstair/core';
import { ui, type UiKey } from './i18n';
import { mathElement } from './math';
import { stepElement } from './steps-render';

const TYPES: ProblemType[] = ['T1', 'T2', 'T3', 'T4', 'T5'];
const STORE = 'sumstair.practice.v1';

interface Progress {
  attempted: number;
  correct: number;
}

function loadProgress(): Progress {
  try {
    const p = JSON.parse(localStorage.getItem(STORE) ?? '{}') as Partial<Progress>;
    return {
      attempted: Number.isInteger(p.attempted) ? p.attempted! : 0,
      correct: Number.isInteger(p.correct) ? p.correct! : 0,
    };
  } catch {
    return { attempted: 0, correct: 0 };
  }
}

function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(STORE, JSON.stringify(p));
  } catch {
    // storage disabled: progress lasts for this visit only
  }
}

function randomSeed(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0]! & 0x7fffffff;
}

/** "#practice=T3-2-12345" opens a specific question (shareable, used by tests). */
export function questionFromHash(
  hash: string,
): { type: ProblemType; level: Level; seed: number } | undefined {
  const m = /^#practice=(T[1-5])-([123])-(\d{1,10})$/.exec(hash);
  if (!m) return undefined;
  return { type: m[1] as ProblemType, level: Number(m[2]) as Level, seed: Number(m[3]) % 2 ** 31 };
}

export class PracticeView {
  private lang: Lang = 'en';
  private type: ProblemType = 'T3';
  private level: Level = 1;
  private question: Question | undefined;
  private number = 0;
  private hints = 0;
  private counted = false;
  private solvedThis = false;
  private feedback: { key: UiKey; cls: string } | undefined;
  private progress = loadProgress();
  private built = false;

  setLang(lang: Lang): void {
    this.lang = lang;
    if (this.built) this.render();
  }

  show(): void {
    if (!this.question) this.next();
    this.render();
  }

  open(type: ProblemType, level: Level, seed: number): void {
    this.type = type;
    this.level = level;
    this.newQuestion(seed);
    this.render();
  }

  private next(): void {
    this.newQuestion(randomSeed());
  }

  private newQuestion(seed: number): void {
    this.question = generateQuestion(this.type, this.level, seed);
    this.number++;
    this.hints = 0;
    this.counted = false;
    this.solvedThis = false;
    this.feedback = undefined;
  }

  private el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    props: Partial<HTMLElementTagNameMap[K]> & { cls?: string } = {},
    ...children: (Node | string)[]
  ): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag);
    const { cls, ...rest } = props;
    if (cls) e.className = cls;
    Object.assign(e, rest);
    e.append(...children);
    return e;
  }

  private render(): void {
    this.built = true;
    const L = this.lang;
    const root = document.getElementById('practice-root')!;
    root.replaceChildren();
    root.append(this.el('p', { cls: 'muted' }, ui(L, 'practice.intro')));

    // choose type and level
    const typeSel = this.el('select', { id: 'practice-type' });
    for (const t of TYPES)
      typeSel.append(
        this.el('option', { value: t, selected: t === this.type }, ui(L, `preview.type.${t}`)),
      );
    const levelSel = this.el('select', { id: 'practice-level' });
    for (const l of [1, 2, 3] as const)
      levelSel.append(
        this.el(
          'option',
          { value: String(l), selected: l === this.level },
          ui(L, `practice.level.${l}`),
        ),
      );
    const newBtn = this.el(
      'button',
      { type: 'button', id: 'practice-new', cls: 'primary' },
      ui(L, 'practice.new'),
    );
    newBtn.addEventListener('click', () => {
      this.type = typeSel.value as ProblemType;
      this.level = Number(levelSel.value) as Level;
      this.next();
      this.render();
      document.getElementById('practice-answer')?.focus();
    });
    root.append(
      this.el(
        'div',
        { cls: 'practice-grid' },
        this.el('label', {}, ui(L, 'practice.type'), typeSel),
        this.el('label', {}, ui(L, 'practice.level'), levelSel),
        newBtn,
      ),
    );

    const q = this.question;
    if (!q) return;
    const card = this.el('section', { cls: 'card practice-question', id: 'practice-question' });
    card.setAttribute('aria-labelledby', 'practice-q-title');
    card.append(
      this.el('h2', { id: 'practice-q-title' }, ui(L, 'practice.question', { n: this.number })),
      mathElement(problemLatex(q.solution.problem!), true, 'div'),
      this.el(
        'p',
        { cls: 'muted small' },
        `${ui(L, 'practice.seed')}: ${q.type}-${q.level}-${q.seed}`,
      ),
    );
    const input = this.el('input', {
      id: 'practice-answer',
      cls: 'practice-answer',
      type: 'text',
      autocomplete: 'off',
      spellcheck: false,
    });
    input.setAttribute('aria-describedby', 'practice-help practice-feedback');
    const form = this.el('form', { id: 'practice-form' });
    form.append(
      this.el('label', { htmlFor: 'practice-answer' }, ui(L, 'practice.answer')),
      input,
      this.el('p', { id: 'practice-help', cls: 'help' }, ui(L, `practice.answerHelp.${q.type}`)),
    );
    const checkBtn = this.el(
      'button',
      { type: 'submit', id: 'practice-check', cls: 'primary' },
      ui(L, 'practice.check'),
    );
    const hintBtn = this.el(
      'button',
      { type: 'button', id: 'practice-hint', cls: 'ghost' },
      ui(L, 'practice.hint'),
    );
    const revealBtn = this.el(
      'button',
      { type: 'button', id: 'practice-reveal', cls: 'ghost' },
      ui(L, 'practice.reveal'),
    );
    form.append(this.el('div', { cls: 'step-actions' }, checkBtn, hintBtn, revealBtn));
    const fb = this.el('p', {
      id: 'practice-feedback',
      cls: `feedback ${this.feedback?.cls ?? ''}`,
    });
    fb.setAttribute('aria-live', 'polite');
    if (this.feedback) fb.textContent = ui(L, this.feedback.key);
    form.append(fb);
    card.append(form);

    const steps = q.solution.steps;
    const list = this.el('ol', { cls: 'step-list', id: 'practice-steps' });
    steps.slice(0, this.hints).forEach((st, i) => list.append(stepElement(st, i, L)));
    card.append(list);
    if (this.hints >= steps.length && this.hints > 0)
      card.append(
        this.el(
          'p',
          { cls: 'muted', id: 'practice-answer-text' },
          `${ui(L, 'answer.title')}: ${answerText(q.solution)}`,
        ),
      );
    root.append(card);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const verdict = checkAnswer(q.solution, input.value);
      if (verdict === 'unreadable') this.feedback = { key: 'practice.unreadable', cls: 'bad' };
      else {
        if (!this.counted) {
          this.counted = true;
          this.progress.attempted++;
        }
        if (verdict === 'correct') {
          if (!this.solvedThis) this.progress.correct++;
          this.solvedThis = true;
          this.feedback = { key: 'practice.correct', cls: 'ok' };
        } else this.feedback = { key: 'practice.wrong', cls: 'bad' };
        saveProgress(this.progress);
      }
      const keep = input.value;
      this.render();
      const again = document.getElementById('practice-answer') as HTMLInputElement | null;
      if (again) {
        again.value = keep;
        again.focus();
      }
    });
    hintBtn.addEventListener('click', () => {
      if (this.hints >= steps.length) this.feedback = { key: 'practice.noHint', cls: '' };
      else this.hints++;
      this.render();
      document.getElementById('practice-hint')?.focus();
    });
    revealBtn.addEventListener('click', () => {
      this.hints = steps.length;
      this.render();
    });

    // progress
    const clear = this.el(
      'button',
      { type: 'button', id: 'practice-clear', cls: 'ghost' },
      ui(L, 'practice.clear'),
    );
    const progressText = this.el(
      'p',
      { id: 'practice-progress' },
      ui(L, 'practice.progress', {
        correct: this.progress.correct,
        total: this.progress.attempted,
      }),
    );
    clear.addEventListener('click', () => {
      this.progress = { attempted: 0, correct: 0 };
      try {
        localStorage.removeItem(STORE);
      } catch {
        // ignore
      }
      this.render();
      document.getElementById('practice-progress')!.textContent += ` ${ui(L, 'practice.cleared')}`;
    });
    root.append(this.el('div', { cls: 'practice-grid' }, progressText, clear));
  }
}
