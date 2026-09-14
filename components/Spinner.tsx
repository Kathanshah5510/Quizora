import type { ReactNode } from "react";

/** Inline spinner + label for a pending button or status line. Inherits text colour. */
export function Pending({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5" role="status" aria-live="polite">
      <span className="spinner spinner-inline" aria-hidden="true" />
      {children}
    </span>
  );
}

/** Centred spinner for a page or panel that is still loading. */
export function PageSpinner({ label = "Loading…", className = "" }: { label?: string; className?: string }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-16 ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="spinner" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
