// SPDX-License-Identifier: AGPL-3.0-or-later
// Problems are shared in the URL fragment (#q=...), which browsers never send to servers.

export function problemFromHash(hash: string): string | undefined {
  const m = /^#q=(.*)$/.exec(hash);
  if (!m) return undefined;
  try {
    const text = decodeURIComponent(m[1]!);
    return text.length > 0 && text.length <= 200 ? text : undefined;
  } catch {
    return undefined;
  }
}

export function hashForProblem(text: string): string {
  return `#q=${encodeURIComponent(text)}`;
}
