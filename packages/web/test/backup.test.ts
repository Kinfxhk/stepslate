// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { shouldRemind, type BackupRecord } from '../src/backup';

const day = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 9, 8);

function rec(partial: Partial<BackupRecord>): BackupRecord {
  return { changes: 0, dismissedAt: null, savedAt: null, ...partial };
}

describe('backup reminder', () => {
  it('stays quiet until a few local changes', () => {
    expect(shouldRemind(rec({ changes: 2 }), now)).toBe(false);
    expect(shouldRemind(rec({ changes: 3 }), now)).toBe(true);
  });
  it('hides for 14 days after a dismissal or a backup, and ignores future timestamps', () => {
    expect(shouldRemind(rec({ changes: 5, dismissedAt: now - day }), now)).toBe(false);
    expect(shouldRemind(rec({ changes: 5, dismissedAt: now - 15 * day }), now)).toBe(true);
    expect(shouldRemind(rec({ changes: 5, savedAt: now - day }), now)).toBe(false);
    expect(shouldRemind(rec({ changes: 5, dismissedAt: now + day }), now)).toBe(true);
    expect(shouldRemind(rec({ changes: 5, savedAt: now + day }), now)).toBe(true);
  });
});
