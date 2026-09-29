"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeCourseStudentAction } from "./actions";
import { Pending } from "@/components/Spinner";

export default function RemoveCourseStudentButton({
  courseId,
  studentId,
}: {
  courseId: string;
  studentId: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleRemove() {
    startTransition(async () => {
      await removeCourseStudentAction(courseId, studentId);
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleRemove}
      disabled={pending}
      className="text-xs text-destructive hover:underline disabled:opacity-50 transition-opacity"
    >
      {pending ? <Pending>Removing…</Pending> : "Remove"}
    </button>
  );
}
