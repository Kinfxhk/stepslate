// SPDX-License-Identifier: AGPL-3.0-or-later
// The solver page: live "I read this as" preview, step-by-step reveal, answer, sharing.

import {
  classify,
  equationLatex,
  equationText,
  parseProblem,
  ParseError,
  problemLatex,
  solve,
  t,
  type Lang,
  type Solution,
  type State,
} from '@stepslate/core';
import { ui } from './i18n';
import { explanationElement, mathElement, renderMath } from './math';
import { hashForProblem, problemFromHash } from './share';
import { stateElement, stepElement } from './steps-render';

export const EXAMPLES = [
  '1/2 + 3/4 * 2',
  '3(2x - 1) - (x + 4)',
  '2(x+3) = 5x - 4',
  'x^2 - 5x + 6 = 0',
  'x^2 - 4x + 1 = 0',
  '2x + y = 7; x - y = 2',
];

const KEYS: readonly { label: string; insert: string; aria?: string }[] = [
  { label: 'x', insert: 'x' },
  { label: 'y', insert: 'y' },
  { label: '(', insert: '(' },
  { label: ')', insert: ')' },
  { label: 'x²', insert: '^2', aria: '^2' },
  { label: 'xⁿ', insert: '^', aria: '^' },
  { label: 'a/b', insert: '/', aria: '/' },
  { label: '+', insert: '+' },
  { label: '−', insert: '-', aria: '-' },
  { label: '×', insert: '*', aria: '*' },
  { label: '=', insert: '=' },
  { label: ';', insert: '; ' },
];

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export class SolveView {
  private lang: Lang = 'en';
  private solution: Solution | undefined;
  private shown = 0;
  private previewTimer: number | undefined;
  private readonly input = $<HTMLInputElement>('problem');

  constructor() {
    $('solve-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.solveNow();
    });
    $('clear-btn').addEventListener('click', () => {
      this.input.value = '';
      this.solution = undefined;
      this.updatePreview();
      this.renderSteps();
      history.replaceState(null, '', location.pathname + location.search);
      this.input.focus();
    });
    this.input.addEventListener('input', () => {
      window.clearTimeout(this.previewTimer);
      this.previewTimer = window.setTimeout(() => this.updatePreview(), 120);
    });
    $('next-btn').addEventListener('click', () => this.reveal(this.shown + 1));
    $('all-btn').addEventListener('click', () => this.reveal(Number.MAX_SAFE_INTEGER));
    $('share-btn').addEventListener('click', () => void this.share());
    $('print-btn').addEventListener('click', () => {
      this.reveal(Number.MAX_SAFE_INTEGER);
      window.print();
    });
    this.buildKeyboard();
    this.buildExamples();
    window.addEventListener('hashchange', () => this.loadFromHash());
  }

  setLang(lang: Lang): void {
    this.lang = lang;
    this.updatePreview();
    this.renderSteps(true);
  }

  loadFromHash(): boolean {
    const q = problemFromHash(location.hash);
    if (q === undefined) return false;
    this.input.value = q;
    this.solveNow(false);
    return true;
  }

  /** Re-render the preview immediately (used when the view first appears). */
  refresh(): void {
    this.updatePreview();
  }

  private buildKeyboard(): void {
    const box = document.querySelector('.keyboard')!;
    for (const k of KEYS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'key';
      b.textContent = k.label;
      b.setAttribute('aria-label', k.aria ?? k.label);
      b.addEventListener('click', () => this.insert(k.insert));
      box.append(b);
    }
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'key wide';
    del.id = 'key-backspace';
    del.textContent = '⌫';
    del.addEventListener('click', () => this.backspace());
    box.append(del);
  }

  private buildExamples(): void {
    const list = $('example-list');
    for (const ex of EXAMPLES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = ex;
      b.addEventListener('click', () => {
        this.input.value = ex;
        this.solveNow();
      });
      list.append(b);
    }
  }

  private insert(text: string): void {
    const el = this.input;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    el.setRangeText(text, start, end, 'end');
    el.focus();
    this.updatePreview();
  }

  private backspace(): void {
    const el = this.input;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    if (start === end && start > 0) el.setRangeText('', start - 1, end, 'end');
    else el.setRangeText('', start, end, 'end');
    el.focus();
    this.updatePreview();
  }

  updatePreview(): void {
    const box = $('preview-math');
    const status = $('preview-status');
    box.replaceChildren();
    status.replaceChildren();
    status.className = 'status';
    const text = this.input.value;
    if (text.trim() === '') {
      status.textContent = ui(this.lang, 'preview.empty');
      return;
    }
    try {
      const { problem, warnings, command } = parseProblem(text);
      box.append(mathElement(problemLatex(problem), true, 'div'));
      const c = classify(problem, command);
      if (c.ok) status.append(ui(this.lang, `preview.type.${c.type}`));
      else {
        status.className = 'status warn';
        status.append(explanationElement(c.message, this.lang));
      }
      for (const w of warnings) {
        const p = explanationElement(
          { key: 'warn.ambiguous-division', params: w.params },
          this.lang,
        );
        p.classList.add('warn');
        p.dataset.warning = w.code;
        status.append(p);
      }
    } catch (e) {
      if (!(e instanceof ParseError)) throw e;
      // A recognised but unsupported topic (sin, log, ...) is a notice, not a mistake.
      status.className = e.code.startsWith('unsupported-') ? 'status warn' : 'status error';
      const head = document.createElement('strong');
      head.textContent = ui(this.lang, 'preview.error') + ' ';
      status.append(head, t(this.lang, `parse.${e.code}` as never, e.params));
      // Show where the problem is.
      const at = Math.min(e.pos, text.length);
      const pre = document.createElement('code');
      pre.className = 'caret';
      pre.append(text.slice(0, at));
      const mark = document.createElement('mark');
      mark.textContent = text.slice(at, at + 1) || '\u00a0';
      pre.append(mark, text.slice(at + 1));
      box.append(pre);
    }
  }

  solveNow(updateHash = true): void {
    const text = this.input.value;
    this.updatePreview();
    if (text.trim() === '') return;
    this.solution = solve(text);
    this.shown = 0;
    if (updateHash) history.replaceState(null, '', hashForProblem(text));
    this.renderSteps();
    $('steps-card').scrollIntoView?.({ block: 'nearest' });
  }

  private reveal(n: number): void {
    if (!this.solution) return;
    this.shown = Math.min(n, this.solution.steps.length);
    this.renderSteps(true);
    const items = document.querySelectorAll<HTMLElement>('#step-list > li');
    items[this.shown - 1]?.focus?.({ preventScroll: false });
  }

  private renderSteps(keepScroll = false): void {
    const card = $('steps-card');
    const sol = this.solution;
    if (!sol) {
      card.hidden = true;
      return;
    }
    card.hidden = false;
    const list = $('step-list');
    list.replaceChildren();
    const msg = $('result-message');
    msg.replaceChildren();
    msg.className = 'status';
    if (sol.status !== 'solved' && sol.message) {
      msg.className = sol.status === 'unsupported' ? 'status warn' : 'status error';
      msg.append(explanationElement(sol.message, this.lang));
    }
    const total = sol.steps.length;
    const solved = sol.status === 'solved';
    // When solving stopped early, show what was verified so far all at once.
    if (!solved) this.shown = total;
    sol.steps.slice(0, this.shown).forEach((st, i) => list.append(stepElement(st, i, this.lang)));
    const count = $('step-count');
    count.textContent =
      total === 0
        ? ''
        : this.shown >= total
          ? ui(this.lang, 'steps.done', { total })
          : ui(this.lang, 'steps.count', { n: this.shown, total });
    const more = solved && this.shown < total;
    $('next-btn').hidden = !more;
    $('all-btn').hidden = !more;
    const answer = $('answer');
    answer.hidden = !(solved && this.shown >= total);
    if (!answer.hidden) {
      if (total === 0) {
        msg.textContent = ui(this.lang, 'steps.none');
      }
      this.renderAnswer(sol);
    }
    if (!keepScroll) $('share-status').textContent = '';
  }

  private renderAnswer(sol: Solution): void {
    const box = $('answer-math');
    box.replaceChildren();
    const last: State | undefined = sol.steps.at(-1)?.after;
    const final: State | undefined =
      last ??
      (sol.problem?.kind === 'expr'
        ? { kind: 'expr', expr: sol.problem.expr }
        : sol.problem?.kind === 'equation'
          ? { kind: 'equation', eq: sol.problem.eq }
          : undefined);
    if (!final) return;
    if (final.kind === 'infinite') {
      const p = document.createElement('p');
      p.textContent = t(this.lang, 'state.infinite', { eq: equationText(final.eq) });
      box.append(p, mathElement(equationLatex(final.eq), true, 'div'));
      return;
    }
    box.append(stateElement(final, this.lang));
  }

  private async share(): Promise<void> {
    const text = this.input.value;
    if (!text.trim()) return;
    const url = `${location.origin}${location.pathname}${hashForProblem(text)}`;
    history.replaceState(null, '', hashForProblem(text));
    const out = $('share-status');
    try {
      await navigator.clipboard.writeText(url);
      out.textContent = ui(this.lang, 'share.copied');
    } catch {
      out.textContent = ui(this.lang, 'share.manual');
    }
  }
}

export function renderInto(el: HTMLElement, latex: string): void {
  renderMath(el, latex, true);
}
