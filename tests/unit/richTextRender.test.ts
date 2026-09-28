import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import RichText from "@/components/RichText";

// renderToStaticMarkup runs RichText's real markdown/sanitize pipeline and
// returns actual HTML, so these assertions are on genuine output — not on
// what the implementation claims to do. No jsdom needed for server rendering.
function render(text: string): string {
  return renderToStaticMarkup(RichText({ text }));
}

describe("RichText — formatting", () => {
  it("renders bold", () => {
    expect(render("**bold**")).toContain("<strong>bold</strong>");
  });

  it("renders italic", () => {
    expect(render("*italic*")).toContain("<em>italic</em>");
  });

  it("renders underline via the <u> allowlist entry", () => {
    expect(render("<u>underlined</u>")).toContain("<u>underlined</u>");
  });

  it("renders inline code", () => {
    expect(render("call `f(x)`")).toContain("<code>f(x)</code>");
  });

  it("renders a fenced code block preserving every line — the original bug", () => {
    const html = render("```\ndef f(x):\n    return x * 2\n\nprint(f(3))\n```");
    expect(html).toContain("<pre>");
    expect(html).toContain("def f(x):");
    expect(html).toContain("return x * 2");
    expect(html).toContain("print(f(3))");
    // All four code lines present and in order inside one <code> block.
    const codeMatch = html.match(/<code>([\s\S]*?)<\/code>/);
    expect(codeMatch).not.toBeNull();
    const lines = codeMatch![1].split("\n").filter(Boolean);
    expect(lines).toEqual(["def f(x):", "    return x * 2", "print(f(3))"]);
  });

  it("renders a bullet list", () => {
    const html = render("- one\n- two\n- three");
    expect(html).toContain("<ul>");
    expect((html.match(/<li>/g) ?? []).length).toBe(3);
  });

  it("renders a numbered list", () => {
    const html = render("1. one\n2. two");
    expect(html).toContain("<ol>");
  });

  it("plain multi-paragraph text keeps paragraph breaks", () => {
    const html = render("First line.\n\nSecond line.");
    expect((html.match(/<p>/g) ?? []).length).toBe(2);
  });
});

describe("RichText — sanitization (must not regress into an XSS hole)", () => {
  it("strips <script> tags entirely", () => {
    const html = render('before<script>alert(1)</script>after');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(1)");
  });

  it("strips inline event handlers", () => {
    const html = render('<u onmouseover="alert(1)">hover me</u>');
    expect(html).not.toContain("onmouseover");
    expect(html).not.toContain("alert(1)");
    // The tag itself is still allowed — only the dangerous attribute is dropped.
    expect(html).toContain("<u>hover me</u>");
  });

  it("blocks javascript: URIs on links", () => {
    const html = render("[click me](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
  });

  it("strips <style> and <iframe>", () => {
    const html = render('<style>body{display:none}</style><iframe src="https://evil.example"></iframe>text');
    expect(html).not.toContain("<style");
    expect(html).not.toContain("<iframe");
    expect(html).toContain("text");
  });

  it("drops class/style attributes so CSS cannot be smuggled in", () => {
    const html = render('<u style="position:fixed;inset:0">text</u>');
    expect(html).not.toContain("position:fixed");
    expect(html).not.toContain("style=");
  });

  it("renders empty input as nothing rather than throwing", () => {
    expect(render("")).toBe("");
  });
});
