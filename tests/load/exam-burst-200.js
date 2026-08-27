/**
 * k6 load test — Scenario 2: 200-student burst (stress)
 *
 * Same flow as exam-burst.js but with 200 concurrent students.
 * Thresholds are relaxed vs. the 130-student test to reflect that
 * 200 concurrent students may require horizontal scaling or a shared
 * rate-limit store (Redis/Upstash).
 *
 * Usage:
 *   k6 run --env BASE_URL=http://localhost:3000 tests/load/exam-burst-200.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

const startLatency = new Trend("start_latency_ms", true);
const answerLatency = new Trend("answer_latency_ms", true);
const errorRate = new Rate("error_rate");

export const options = {
  scenarios: {
    burst_200: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "20s", target: 200 },
        { duration: "3m",  target: 200 },
        { duration: "10s", target: 0   },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    // Relaxed thresholds for stress test: 95p < 4s start, < 2s answer
    start_latency_ms: ["p(95)<4000"],
    answer_latency_ms: ["p(95)<2000"],
    error_rate: ["rate<0.05"],
    http_req_failed: ["rate<0.05"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const SLUG = __ENV.EXAM_SLUG || "test-exam-load";

export default function () {
  const vuId = __VU;
  const studentId = String(900000000 + vuId).padStart(9, "0");
  const email = `${studentId}@dau.ac.in`;
  const name = `Student ${vuId}`;

  const startRes = http.post(
    `${BASE_URL}/api/exam/${SLUG}/start`,
    JSON.stringify({ studentId, email, name }),
    { headers: { "Content-Type": "application/json" } }
  );
  startLatency.add(startRes.timings.duration);

  const startOk = check(startRes, {
    "start: 2xx": (r) => r.status === 201 || r.status === 200,
    "start: has sessionToken": (r) => {
      try { return !!JSON.parse(r.body).sessionToken; } catch { return false; }
    },
  });

  if (!startOk) { errorRate.add(1); return; }
  errorRate.add(0);

  const { attemptId, sessionToken } = JSON.parse(startRes.body);
  const headers = {
    "Content-Type": "application/json",
    "X-Session-Token": sessionToken,
  };

  for (let i = 0; i < 5; i++) {
    sleep(1);
    const qRes = http.get(
      `${BASE_URL}/api/exam/${SLUG}/question?attemptId=${attemptId}&index=${i}`,
      { headers }
    );
    if (!check(qRes, { "question: 200": (r) => r.status === 200 })) {
      errorRate.add(1); continue;
    }
    const { question } = JSON.parse(qRes.body);
    const firstOptionId = question?.options?.[0]?.id;

    const aRes = http.post(
      `${BASE_URL}/api/exam/${SLUG}/answer`,
      JSON.stringify({
        attemptId, sessionToken, questionId: question.id,
        selectedOptionIds: firstOptionId ? [firstOptionId] : [],
      }),
      { headers }
    );
    answerLatency.add(aRes.timings.duration);
    check(aRes, { "answer: 200": (r) => r.status === 200 });
    sleep(25);
  }

  http.post(
    `${BASE_URL}/api/exam/${SLUG}/submit`,
    JSON.stringify({ attemptId, sessionToken }),
    { headers }
  );
}
