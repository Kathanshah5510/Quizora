"use client";

import { useEffect, useCallback } from "react";

interface ExamGuardOptions {
  fullScreenRequired: boolean;
  onTabSwitch?: () => void;
  onFullscreenExit?: () => void;
  onViolation?: (type: string) => void;
  disabled?: boolean;
}

/**
 * Attaches client-side exam deterrents.
 * IMPORTANT: These are deterrents only — the server is the security boundary.
 * Determined students can bypass these; server-side validation is what counts.
 */
export function useExamGuard({
  fullScreenRequired,
  onTabSwitch,
  onFullscreenExit,
  onViolation,
  disabled = false,
}: ExamGuardOptions) {
  const handleViolation = useCallback(
    (type: string) => {
      onViolation?.(type);
    },
    [onViolation]
  );

  // Disable copy/cut/paste
  useEffect(() => {
    if (disabled) return;
    const prevent = (e: Event) => {
      e.preventDefault();
    };
    document.addEventListener("copy", prevent);
    document.addEventListener("cut", prevent);
    document.addEventListener("paste", prevent);
    return () => {
      document.removeEventListener("copy", prevent);
      document.removeEventListener("cut", prevent);
      document.removeEventListener("paste", prevent);
    };
  }, [disabled]);

  // Disable right-click context menu
  useEffect(() => {
    if (disabled) return;
    const prevent = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener("contextmenu", prevent);
    return () => {
      document.removeEventListener("contextmenu", prevent);
    };
  }, [disabled]);

  // Block common keyboard shortcuts (F12, Ctrl+C, Ctrl+V, Ctrl+A, Ctrl+U, Ctrl+S)
  useEffect(() => {
    if (disabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12 (DevTools)
      if (e.key === "F12") {
        e.preventDefault();
        return;
      }
      // Ctrl/Meta combos
      if (e.ctrlKey || e.metaKey) {
        const blocked = ["c", "v", "a", "u", "s", "p", "f"];
        if (blocked.includes(e.key.toLowerCase())) {
          e.preventDefault();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [disabled]);

  // Tab switch / visibility monitoring
  useEffect(() => {
    if (disabled) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        handleViolation("TAB_SWITCHED");
        onTabSwitch?.();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [disabled, handleViolation, onTabSwitch]);

  // Fullscreen management
  useEffect(() => {
    if (disabled || !fullScreenRequired) return;

    const requestFs = () => {
      document.documentElement.requestFullscreen?.().catch(() => {
        // Silently ignore: user may have denied permission
      });
    };

    const handleFsChange = () => {
      if (!document.fullscreenElement) {
        handleViolation("FULLSCREEN_EXITED");
        onFullscreenExit?.();
        // Re-request fullscreen after a short delay
        setTimeout(requestFs, 500);
      }
    };

    requestFs();
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
    };
  }, [disabled, fullScreenRequired, handleViolation, onFullscreenExit]);
}
