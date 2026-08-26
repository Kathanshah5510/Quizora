"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeStudentAction } from "@/app/admin/exams/[id]/roster/actions";

export default function RemoveStudentButton({
  examId,
  studentId,
}: {
  examId: string;
  studentId: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleRemove() {
    startTransition(async () => {
      await removeStudentAction(examId, studentId);
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleRemove}
      disabled={pending}
      className="text-xs text-destructive hover:underline disabled:opacity-50 transition-opacity"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
