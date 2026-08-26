/**
 * Pure timer logic — no DB access.
 * Server is the authority on time; never trust client-supplied timestamps.
 */

export interface TimerState {
  remainingSeconds: number;
  isExpired: boolean;
  expiresAt: Date;
}

/** Compute remaining time from server-stored expiresAt. */
export function computeRemainingSeconds(expiresAt: Date, now: Date): number {
  const ms = expiresAt.getTime() - now.getTime();
  return Math.max(0, Math.floor(ms / 1000));
}

export function computeTimerState(expiresAt: Date, now: Date): TimerState {
  const remainingSeconds = computeRemainingSeconds(expiresAt, now);
  return {
    remainingSeconds,
    isExpired: remainingSeconds === 0,
    expiresAt,
  };
}
