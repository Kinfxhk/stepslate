// SPDX-License-Identifier: AGPL-3.0-or-later
// Local backup reminder. Nothing leaves the browser: the file is built from
// localStorage and downloaded by the user.

export interface BackupRecord {
  changes: number;
  dismissedAt: number | null;
  savedAt: number | null;
}

const KEY = 'sumstair.backup.v1';
const QUIET_MS = 14 * 24 * 60 * 60 * 1000;
const MIN_CHANGES = 3;

/** Remind after a few local changes, unless a backup or a dismissal is still recent. */
export function shouldRemind(s: BackupRecord, now: number): boolean {
  if (!Number.isFinite(s.changes) || s.changes < MIN_CHANGES) return false;
  const quiet = (t: number | null): boolean =>
    t !== null && Number.isFinite(t) && t <= now && now - t < QUIET_MS;
  if (quiet(s.dismissedAt) || quiet(s.savedAt)) return false;
  return true;
}

export function loadBackup(): BackupRecord {
  const empty: BackupRecord = { changes: 0, dismissedAt: null, savedAt: null };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<BackupRecord>;
    return {
      changes: Number.isInteger(s.changes) && (s.changes as number) > 0 ? (s.changes as number) : 0,
      dismissedAt: typeof s.dismissedAt === 'number' ? s.dismissedAt : null,
      savedAt: typeof s.savedAt === 'number' ? s.savedAt : null,
    };
  } catch {
    return empty;
  }
}

function store(s: BackupRecord): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // storage may be disabled
  }
}

/** Count one local change (a solved practice answer or a settings change). */
export function noteActivity(): void {
  const s = loadBackup();
  s.changes += 1;
  store(s);
  window.dispatchEvent(new Event('sumstair-storage'));
}

export function dismissBackup(now = Date.now()): void {
  const s = loadBackup();
  s.dismissedAt = now;
  store(s);
}

export function markBackupSaved(now = Date.now()): void {
  const s = loadBackup();
  s.savedAt = now;
  s.changes = 0;
  store(s);
}

export function backupJson(): string {
  const read = (k: string): string | null => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  };
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      settings: read('sumstair.settings.v1'),
      practice: read('sumstair.practice.v1'),
    },
    null,
    2,
  );
}

/** Download a JSON copy. No network request. */
export function downloadBackup(): void {
  const blob = new Blob([backupJson()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sumstair-backup.json';
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  markBackupSaved();
}
