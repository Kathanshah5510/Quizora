/**
 * Pure exam-access logic — no DB access.
 * Server is authoritative: check access server-side before serving any exam data.
 */

export type ExamAccessStatus =
  | "ACCESSIBLE"
  | "DRAFT"
  | "NOT_FOUND"
  | "NOT_YET_AVAILABLE"
  | "AVAILABILITY_ENDED"
  | "CLOSED";

export interface ExamAccessInput {
  status: string; // ExamStatus
  availabilityStart: Date | null;
  availabilityEnd: Date | null;
  continueAfterAvailability: boolean;
}

export function checkExamAccess(exam: ExamAccessInput, now: Date): ExamAccessStatus {
  if (exam.status === "DRAFT") return "DRAFT";
  if (exam.status === "CLOSED") return "CLOSED";
  // PUBLISHED or ACTIVE
  if (exam.availabilityStart && now < exam.availabilityStart) return "NOT_YET_AVAILABLE";
  if (
    exam.availabilityEnd &&
    now > exam.availabilityEnd &&
    !exam.continueAfterAvailability
  ) {
    return "AVAILABILITY_ENDED";
  }
  return "ACCESSIBLE";
}

/** True when a student can start a NEW attempt (exam must be PUBLISHED or ACTIVE, not CLOSED) */
export function canStartAttempt(accessStatus: ExamAccessStatus): boolean {
  return accessStatus === "ACCESSIBLE";
}
