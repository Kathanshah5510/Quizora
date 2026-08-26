export type ExamForLifecycle = {
  status: string;
  title: string;
  instructorName: string;
  durationMinutes: number;
};

export function validatePublish(exam: ExamForLifecycle): string | null {
  if (exam.status !== "DRAFT") return "Only draft exams can be published";
  if (!exam.title || exam.title.trim().length < 2) return "Exam must have a title (at least 2 characters)";
  if (!exam.instructorName || exam.instructorName.trim().length < 2)
    return "Exam must have an instructor name";
  if (exam.durationMinutes < 1) return "Exam must have a valid duration (at least 1 minute)";
  return null;
}

export function validateUnpublish(
  exam: ExamForLifecycle & { attemptCount: number }
): string | null {
  if (exam.status !== "PUBLISHED") return "Only published exams can be unpublished";
  if (exam.attemptCount > 0)
    return "Cannot unpublish: this exam already has student attempts";
  return null;
}

export function validateClose(exam: ExamForLifecycle): string | null {
  if (!["PUBLISHED", "ACTIVE"].includes(exam.status))
    return "Only published or active exams can be closed";
  return null;
}

export function validateReopen(exam: ExamForLifecycle): string | null {
  if (exam.status !== "CLOSED") return "Only closed exams can be reopened";
  return null;
}

export function describeAvailability(
  status: string,
  availabilityStart: Date | null,
  availabilityEnd: Date | null
): { message: string; warning: boolean } {
  const now = new Date();

  if (status === "DRAFT") {
    return { message: "Not yet published. Publish to make it available to students.", warning: false };
  }
  if (status === "CLOSED") {
    return { message: "Exam is closed. No new attempts can be started.", warning: false };
  }
  if (status === "ACTIVE") {
    return { message: "Exam is active — students are currently taking it.", warning: false };
  }

  // PUBLISHED
  if (availabilityEnd && availabilityEnd < now) {
    return {
      message: "Availability window has ended but the exam is still open. Close it to prevent late attempts.",
      warning: true,
    };
  }
  if (availabilityStart && availabilityStart > now) {
    return {
      message: `Published. Opens ${availabilityStart.toLocaleString("en-IN")}.`,
      warning: false,
    };
  }
  if (availabilityStart && availabilityStart <= now) {
    return {
      message: "Published and available — students can start the exam now.",
      warning: false,
    };
  }
  return {
    message: "Published with no availability window set. Students can access it at any time.",
    warning: false,
  };
}
