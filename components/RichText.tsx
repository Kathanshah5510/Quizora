import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

/**
 * Question/explanation text is stored as Markdown. rehype-raw lets inline HTML
 * through (needed for <u>, which Markdown has no syntax for); rehype-sanitize
 * then strips anything not on this allowlist before it reaches a student's
 * browser — no <script>/<style>/<iframe>, no event handlers, and (via the
 * inherited default schema) no javascript: URIs on the few tags that keep
 * href/src. class/style are dropped globally so an admin can't smuggle CSS
 * like position:fixed into a question.
 */
const schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "u"],
  attributes: {
    ...defaultSchema.attributes,
    "*": [],
  },
};

interface RichTextProps {
  text: string;
  className?: string;
}

/** Renders admin-authored Markdown (question text, explanations) safely. */
export default function RichText({ text, className }: RichTextProps) {
  if (!text) return null;
  return (
    <div className={`rich-text ${className ?? ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
