export interface DiffHunk {
  type: 'same' | 'del' | 'add';
  lines: string[];
}

/**
 * Minimal line-block diff: trims the common prefix/suffix and reports the
 * changed middle as one del/add pair. Large inputs fall back to a single
 * whole-text replace hunk (O(n·m) LCS is not justified for an MVP history view).
 */
export function diffLines(oldText: string, newText: string): DiffHunk[] {
  const a = oldText.split('\n');
  const b = newText.split('\n');
  if (a.length + b.length > 5000) {
    if (oldText === newText) return [{ type: 'same', lines: a }];
    return [
      { type: 'del', lines: a },
      { type: 'add', lines: b },
    ];
  }
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  ) {
    suffix++;
  }
  const hunks: DiffHunk[] = [];
  if (prefix > 0) hunks.push({ type: 'same', lines: a.slice(0, prefix) });
  const oldMid = a.slice(prefix, a.length - suffix);
  const newMid = b.slice(prefix, b.length - suffix);
  if (oldMid.length > 0) hunks.push({ type: 'del', lines: oldMid });
  if (newMid.length > 0) hunks.push({ type: 'add', lines: newMid });
  if (suffix > 0) hunks.push({ type: 'same', lines: a.slice(a.length - suffix) });
  if (hunks.length === 0) hunks.push({ type: 'same', lines: a });
  return hunks;
}
