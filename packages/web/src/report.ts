// SPDX-License-Identifier: AGPL-3.0-or-later
// "Report a wrong answer": build a pre-filled GitHub "new issue" link. Sumstair sends
// nothing itself: the link only opens GitHub's form, where the user reads, edits and
// submits (or abandons) the report. No tracking, no automatic sending.

import { solutionText, type Solution } from '@sumstair/core';

/** Issue form in .github/ISSUE_TEMPLATE/; its field ids match the parameters below. */
export const REPORT_TEMPLATE = 'wrong-answer.yml';
/** Keep the link well under the ~8 KB URL limits of browsers and GitHub. */
export const MAX_TRANSCRIPT = 1500;

const truncate = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function reportUrl(repo: string, version: string, sol: Solution): string {
  const transcript = truncate(solutionText(sol, 'en'), MAX_TRANSCRIPT);
  const params = new URLSearchParams({
    template: REPORT_TEMPLATE,
    title: `Wrong answer: ${truncate(sol.input.trim(), 80)}`,
    problem: sol.input,
    shown: transcript,
    version,
  });
  return `${repo.replace(/\/$/, '')}/issues/new?${params.toString()}`;
}
