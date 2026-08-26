/**
 * Pure navigation validation — no DB access.
 * Server enforces backtracking policy; client cannot override it.
 */

export type NavigationError =
  | "BACKWARD_NOT_ALLOWED"
  | "INDEX_OUT_OF_RANGE"
  | "SAME_INDEX";

export interface NavigationCheck {
  fromIndex: number;
  toIndex: number;
  totalQuestions: number;
  allowBacktracking: boolean;
}

export function validateNavigation(check: NavigationCheck): NavigationError | null {
  const { fromIndex, toIndex, totalQuestions, allowBacktracking } = check;

  if (toIndex < 0 || toIndex >= totalQuestions) return "INDEX_OUT_OF_RANGE";
  if (toIndex === fromIndex) return "SAME_INDEX";
  if (!allowBacktracking && toIndex < fromIndex) return "BACKWARD_NOT_ALLOWED";
  return null;
}
