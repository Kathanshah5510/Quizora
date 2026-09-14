"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { duplicateExamAction } from "../actions";
import { Pending } from "@/components/Spinner";

export default function DuplicateExamButton({ examId }: { examId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const result = await duplicateExamAction(examId);
      if (result.error) {
        toast.error(result.error);
      } else if (result.newId) {
        toast.success("Exam duplicated");
        router.push(`/admin/exams/${result.newId}`);
      }
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50 whitespace-nowrap"
    >
      {isPending ? <Pending>Duplicating…</Pending> : "Duplicate Exam"}
    </button>
  );
}
