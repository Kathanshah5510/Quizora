"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addCourseTeacherAction, removeCourseTeacherAction, type AddTeacherState } from "../actions";
import { Pending } from "@/components/Spinner";

interface Teacher {
  id: string;
  userId: string;
  user: { name: string; email: string };
}

interface Props {
  courseId: string;
  creatorName: string;
  teachers: Teacher[];
  canManage: boolean;
}

const initial: AddTeacherState = { error: "", success: false };

export default function CourseTeachers({ courseId, creatorName, teachers, canManage }: Props) {
  const boundAdd = addCourseTeacherAction.bind(null, courseId);
  const [state, formAction, pending] = useActionState(boundAdd, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const [removing, startRemoving] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  function handleRemove(teacherId: string) {
    startRemoving(async () => {
      await removeCourseTeacherAction(courseId, teacherId);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="text-base font-semibold text-card-foreground">Teachers</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Admins listed here can manage this course's exams, questions, roster, results, and grading.
        </p>
      </div>

      <div className="px-6 py-4 space-y-3">
        <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
          <span className="font-medium text-foreground">{creatorName}</span>
          <span className="text-xs text-muted-foreground">Owner</span>
        </div>

        {teachers.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
            <div>
              <span className="font-medium text-foreground">{t.user.name}</span>
              <span className="text-xs text-muted-foreground ml-2">{t.user.email}</span>
            </div>
            {canManage && (
              <button
                type="button"
                onClick={() => handleRemove(t.id)}
                disabled={removing}
                className="text-xs text-destructive hover:underline disabled:opacity-50"
              >
                {removing ? <Pending>Removing…</Pending> : "Remove"}
              </button>
            )}
          </div>
        ))}

        {teachers.length === 0 && (
          <p className="text-xs text-muted-foreground">No additional teachers yet.</p>
        )}
      </div>

      {canManage && (
        <form ref={formRef} action={formAction} className="px-6 py-4 border-t border-border space-y-2">
          {state.error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {state.error}
            </div>
          )}
          <label htmlFor="teacher-email" className="block text-sm font-medium text-foreground">
            Add a teacher by email
          </label>
          <div className="flex gap-2">
            <input
              id="teacher-email"
              name="email"
              type="email"
              required
              placeholder="admin@example.com"
              disabled={pending}
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={pending}
              className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 whitespace-nowrap"
            >
              {pending ? <Pending>Adding…</Pending> : "Add"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Must be an existing, active admin account.</p>
        </form>
      )}
    </div>
  );
}
