/**
 * k6 load test — Scenario 3: Steady-state (soak test, 60 concurrent)
 *
 * 60 students cycling through a full exam every ~3 minutes for 15 minutes.
 * Validates that the server does not leak memory or degrade over time.
 *
 * Usage:
 *   k6 run --env BASE_URL=http://localhost:3000 tests/load/exam-steady.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

const endToEndDuration = new Trend("e2e_duration_ms", true);
const errorRate = new Rate("error_rate");

export const options = {
  scenarios: {
    steady_60: {
      executor: "constant-vus",
      vus: 60,
      duration: "15m",
    },
  },
  thresholds: {
    e2e_duration_ms: ["p(95)<60000"], // full attempt under 1 min (5 questions × ~10s)
    error_rate: ["rate<0.01"],
    http_req_failed: ["rate<0.01"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const SLUG = __ENV.EXAM_SLUG || "test-exam-load";

export default function () {
  const t0 = Date.now();
  const vuId = __VU + __ITER * 10000; // unique across iterations
  const studentId = String(Math.abs(vuId % 900000000) + 100000000).slice(0, 9);
  const email = `${studentId}@dau.ac.in`;

  const startRes = http.post(
    `${BASE_URL}/api/exam/${SLUG}/start`,
    JSON.stringify({ studentId, email, name: `Student ${vuId}` }),
    { headers: { "Content-Type": "application/json" } }
  );

  if (!check(startRes, { "start: 2xx": (r) => r.status === 201 || r.status === 200 })) {
    errorRate.add(1); sleep(5); return;
  }
  errorRate.add(0);

  const { attemptId, sessionToken } = JSON.parse(startRes.body);
  const headers = { "Content-Type": "application/json", "X-Session-Token": sessionToken };

  for (let i = 0; i < 3; i++) {
    sleep(1);
    const qRes = http.get(`${BASE_URL}/api/exam/${SLUG}/question?attemptId=${attemptId}&index=${i}`, { headers });
    if (qRes.status !== 200) continue;
    const { question } = JSON.parse(qRes.body);
    http.post(`${BASE_URL}/api/exam/${SLUG}/answer`, JSON.stringify({
      attemptId, sessionToken, questionId: question.id,
      selectedOptionIds: question?.options?.[0]?.id ? [question.options[0].id] : [],
    }), { headers });
    sleep(5);
  }

  http.post(`${BASE_URL}/api/exam/${SLUG}/submit`, JSON.stringify({ attemptId, sessionToken }), { headers });
  endToEndDuration.add(Date.now() - t0);
  sleep(2);
}
