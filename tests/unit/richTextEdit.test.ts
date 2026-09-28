import { describe, it, expect } from "vitest";
import { wrapSelection, wrapBlock, toggleLinePrefix } from "@/lib/richtext/edit";

describe("wrapSelection", () => {
  it("wraps a selection with matching before/after", () => {
    const r = wrapSelection("hello world", 6, 11, "**", "**", "bold text");
    expect(r.next).toBe("hello **world**");
    expect(r.next.slice(r.selectionStart, r.selectionEnd)).toBe("world");
  });

  it("uses the placeholder and selects it when nothing is selected", () => {
    const r = wrapSelection("hello ", 6, 6, "**", "**", "bold text");
    expect(r.next).toBe("hello **bold text**");
    expect(r.next.slice(r.selectionStart, r.selectionEnd)).toBe("bold text");
  });

  it("supports asymmetric before/after (underline)", () => {
    const r = wrapSelection("say hi", 4, 6, "<u>", "</u>", "underlined text");
    expect(r.next).toBe("say <u>hi</u>");
  });

  it("wraps inline code", () => {
    const r = wrapSelection("call f(x)", 5, 9, "`", "`", "code");
    expect(r.next).toBe("call `f(x)`");
  });
});

describe("wrapBlock", () => {
  it("fences a selection and adds newlines when adjacent to other text", () => {
    // No separator around the selection on either side, so both the leading
    // and trailing "needs a newline" branches are exercised in one case.
    const value = "Before:x = 1\ny = 2After";
    const start = value.indexOf("x = 1");
    const end = start + "x = 1\ny = 2".length;
    const r = wrapBlock(value, start, end, "```", "code here");
    expect(r.next).toBe("Before:\n```\nx = 1\ny = 2\n```\nAfter");
    expect(r.next.slice(r.selectionStart, r.selectionEnd)).toBe("x = 1\ny = 2");
  });

  it("does not add a redundant newline when already at a line boundary", () => {
    const value = "line one\n\nline two";
    const start = value.indexOf("line two");
    const end = value.length;
    const r = wrapBlock(value, start, end, "```", "code here");
    expect(r.next).toBe("line one\n\n```\nline two\n```");
  });

  it("inserts a placeholder code fence when nothing is selected", () => {
    const r = wrapBlock("", 0, 0, "```", "code here");
    expect(r.next).toBe("```\ncode here\n```");
  });

  it("preserves every line break inside the fenced block — the original bug", () => {
    const code = "def f(x):\n    return x * 2\n\nprint(f(3))";
    const r = wrapBlock(code, 0, code.length, "```", "code here");
    expect(r.next).toBe("```\n" + code + "\n```");
    expect(r.next.split("\n")).toHaveLength(6); // fence, 4 code lines, fence
  });
});

describe("toggleLinePrefix", () => {
  it("prefixes a single line", () => {
    const r = toggleLinePrefix("item one", 0, 8, "- ");
    expect(r.next).toBe("- item one");
  });

  it("prefixes every non-blank line in a multi-line selection", () => {
    const value = "first\nsecond\nthird";
    const r = toggleLinePrefix(value, 0, value.length, "- ");
    expect(r.next).toBe("- first\n- second\n- third");
  });

  it("skips blank lines inside the selection", () => {
    const value = "first\n\nthird";
    const r = toggleLinePrefix(value, 0, value.length, "- ");
    expect(r.next).toBe("- first\n\n- third");
  });

  it("toggles the prefix off when every touched line already has it", () => {
    const value = "- first\n- second";
    const r = toggleLinePrefix(value, 0, value.length, "- ");
    expect(r.next).toBe("first\nsecond");
  });

  it("expands the selection to full lines even when the cursor is mid-line", () => {
    const value = "alpha\nbeta\ngamma";
    const start = value.indexOf("eta"); // inside "beta", not at line start
    const r = toggleLinePrefix(value, start, start, "- ");
    expect(r.next).toBe("alpha\n- beta\ngamma");
  });

  it("supports numbered-list prefixes independently of bullet prefixes", () => {
    const r = toggleLinePrefix("step one\nstep two", 0, 17, "1. ");
    expect(r.next).toBe("1. step one\n1. step two");
  });
});
