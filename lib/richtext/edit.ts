/**
 * Pure text-splicing logic for the question editor's formatting toolbar —
 * no DOM access, so it's unit-testable without a browser. RichTextEditor.tsx
 * wraps these with the actual textarea ref and focus/selection restore.
 */

export interface EditResult {
  next: string;
  selectionStart: number;
  selectionEnd: number;
}

/** Wraps the selection (or a placeholder, if nothing is selected) in `before`/`after`. */
export function wrapSelection(
  value: string,
  start: number,
  end: number,
  before: string,
  after: string,
  placeholder: string
): EditResult {
  const selected = value.slice(start, end) || placeholder;
  const next = value.slice(0, start) + before + selected + after + value.slice(end);
  return {
    next,
    selectionStart: start + before.length,
    selectionEnd: start + before.length + selected.length,
  };
}

/** Wraps the selection in a fenced block, adding surrounding newlines only where missing. */
export function wrapBlock(
  value: string,
  start: number,
  end: number,
  fence: string,
  placeholder: string
): EditResult {
  const selected = value.slice(start, end) || placeholder;
  const needsLeadingNewline = start > 0 && value[start - 1] !== "\n";
  const needsTrailingNewline = end < value.length && value[end] !== "\n";
  const inner = `${fence}\n${selected}\n${fence}`;
  const next =
    value.slice(0, start) +
    (needsLeadingNewline ? "\n" : "") +
    inner +
    (needsTrailingNewline ? "\n" : "") +
    value.slice(end);
  const innerStart = start + (needsLeadingNewline ? 1 : 0) + fence.length + 1;
  return { next, selectionStart: innerStart, selectionEnd: innerStart + selected.length };
}

/**
 * Prefixes every non-blank line touching the selection with `prefix` (e.g. "- ").
 * If every touched line already has the prefix, it is removed instead (toggle).
 */
export function toggleLinePrefix(value: string, start: number, end: number, prefix: string): EditResult {
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const nextBreak = value.indexOf("\n", end);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  const block = value.slice(lineStart, lineEnd);
  const lines = block.split("\n");
  const alreadyPrefixed = lines.every((l) => l.startsWith(prefix) || l.trim() === "");
  const newLines = lines.map((l) => {
    if (l.trim() === "") return l;
    return alreadyPrefixed ? l.slice(prefix.length) : prefix + l;
  });
  const newBlock = newLines.join("\n");
  const next = value.slice(0, lineStart) + newBlock + value.slice(lineEnd);
  return { next, selectionStart: lineStart, selectionEnd: lineStart + newBlock.length };
}
