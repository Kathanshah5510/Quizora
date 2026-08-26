"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleCourseActiveAction } from "../actions";

export default function CourseToggleButton({
  courseId,
  isActive,
}: {
  courseId: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleToggle() {
    startTransition(async () => {
      await toggleCourseActiveAction(courseId, !isActive);
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={pending}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 border ${
        isActive
          ? "border-destructive/30 text-destructive hover:bg-destructive/10"
          : "border-border text-foreground hover:bg-muted"
      }`}
    >
      {pending ? "Updating…" : isActive ? "Archive Course" : "Restore Course"}
    </button>
  );
}
