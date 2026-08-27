/**
 * k6 load test — Scenario 1: 130-student burst
 *
 * Simulates the most common production case: a cohort of ~130 students
 * all clicking "Start Exam" within the same 60-second window.
 *
 * Prerequisites:
 *   - Server running locally: BASE_URL=http://localhost:3000
 *   - PostgreSQL running and migrated
 *   - An exam with slug=test-exam-load created and status=ACTIVE
 *   - allowExternalStudents=true on that exam
 *
 * Usage:
 *   k6 run --env BASE_URL=http://localhost:3000 tests/load/exam-burst.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

const startLatency = new Trend("start_latency_ms", true);
const answerLatency = new Trend("answer_latency_ms", true);
const errorRate = new Rate("error_rate");

export const options = {
  scenarios: {
    burst_130: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "20s", target: 130 }, // ramp up to 130 students
        { duration: "3m",  target: 130 }, // sustain (exam session)
        { duration: "10s", target: 0   }, // ramp down
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    // 95th-percentile start must be under 2s
    start_latency_ms: ["p(95)<2000"],
    // 95th-percentile answer save must be under 1s
    answer_latency_ms: ["p(95)<1000"],
    // Less than 1% error rate
    error_rate: ["rate<0.01"],
    // Overall HTTP error rate
    http_req_failed: ["rate<0.01"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const SLUG = __ENV.EXAM_SLUG || "test-exam-load";

export default function () {
  const vuId = __VU; // unique per virtual user (1-indexed)
  const studentId = String(900000000 + vuId).padStart(9, "0");
  const email = `${studentId}@dau.ac.in`;
  const name = `Student ${vuId}`;

  // ── Start exam ──────────────────────────────────────────────────────────────
  const startRes = http.post(
    `${BASE_URL}/api/exam/${SLUG}/start`,
    JSON.stringify({ studentId, email, name }),
    { headers: { "Content-Type": "application/json" } }
  );
  startLatency.add(startRes.timings.duration);

  const startOk = check(startRes, {
    "start: status 201 or 200": (r) => r.status === 201 || r.status === 200,
    "start: has sessionToken": (r) => {
      try { return !!JSON.parse(r.body).sessionToken; } catch { return false; }
    },
  });

  if (!startOk) {
    errorRate.add(1);
    return;
  }
  errorRate.add(0);

  const { attemptId, sessionToken } = JSON.parse(startRes.body);
  const headers = {
    "Content-Type": "application/json",
    "X-Session-Token": sessionToken,
  };

  // ── Simulate answering 5 questions, 30s apart ───────────────────────────────
  for (let i = 0; i < 5; i++) {
    sleep(1); // slight stagger so requests don't all land at tick 0

    // Fetch question
    const qRes = http.get(
      `${BASE_URL}/api/exam/${SLUG}/question?attemptId=${attemptId}&index=${i}`,
      { headers }
    );
    const qOk = check(qRes, { "question: status 200": (r) => r.status === 200 });
    if (!qOk) { errorRate.add(1); continue; }

    const { question } = JSON.parse(qRes.body);
    const firstOptionId = question?.options?.[0]?.id;

    // Save answer
    const aRes = http.post(
      `${BASE_URL}/api/exam/${SLUG}/answer`,
      JSON.stringify({
        attemptId,
        sessionToken,
        questionId: question.id,
        selectedOptionIds: firstOptionId ? [firstOptionId] : [],
      }),
      { headers }
    );
    answerLatency.add(aRes.timings.duration);
    check(aRes, { "answer: status 200": (r) => r.status === 200 });

    sleep(25); // ~30s per question
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  const subRes = http.post(
    `${BASE_URL}/api/exam/${SLUG}/submit`,
    JSON.stringify({ attemptId, sessionToken }),
    { headers }
  );
  check(subRes, { "submit: status 200": (r) => r.status === 200 });
}
