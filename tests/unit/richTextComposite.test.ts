import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import RichText from "@/components/RichText";

// Not a real regression test — prints the rendered HTML for a realistic
// composite example (code block + bold + underline + list together) so it
// can be visually reviewed. Assertion just keeps it from silently no-op'ing.
describe("RichText — composite example (visual dump)", () => {
  it("renders a realistic mixed-formatting question", () => {
    const example = `What does this **Python** function print? Read it *carefully*.

\`\`\`
def f(x):
    return x * 2

print(f(3))
\`\`\`

Consider these points before answering:
- The function is <u>pure</u> (no side effects)
- \`f(3)\` is called once
- The result is passed to \`print()\`

1. First check the return type
2. Then compute the value
`;
    const html = renderToStaticMarkup(RichText({ text: example }));
    console.log("\n--- RENDERED HTML ---\n" + html + "\n--- END ---\n");
    expect(html.length).toBeGreaterThan(0);
  });
});
