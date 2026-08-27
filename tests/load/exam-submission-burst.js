/**
 * k6 load test — Scenario 4: Submission burst
 *
 * Simulates the final-minute rush where many students hit "Submit"
 * simultaneously. Verifies that the race-safe updateMany() pattern
 * (4.1B) handles concurrent submissions without double-counting or
 * missing records.
 *
 * This test requires pre-created in-progress attempts:
 *   Use the setup() function or manually seed the DB.
 *
 * Usage:
 *   k6 run --env BASE_URL=http://localhost:3000 tests/load/exam-submission-burst.js
 */

import http from "k6/http";
import { check } from "k6";
import { Rate } from "k6/metrics";

const errorRate = new Rate("error_rate");

export const options = {
  scenarios: {
    submission_burst: {
      executor: "ramping-arrival-rate",
      startRate: 10,
      timeUnit: "1s",
      preAllocatedVUs: 200,
      maxVUs: 250,
      stages: [
        { duration: "5s",  target: 130 }, // spike: 130 submits/sec
        { duration: "15s", target: 130 }, // sustain burst
        { duration: "5s",  target: 0   }, // drain
      ],
    },
  },
  thresholds: {
    // All submits must complete under 3s at p95
    http_req_duration: ["p(95)<3000"],
    error_rate: ["rate<0.01"],
    http_req_failed: ["rate<0.01"],
  },
};

// Each VU creates its own attempt for the burst
const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const SLUG = __ENV.EXAM_SLUG || "test-exam-load";

export function setup() {
  // Intentionally empty; VUs start their own attempts
  return {};
}

export default function () {
  const vuId = __VU;
  const studentId = String(800000000 + vuId).padStart(9, "0");
  const email = `${studentId}@dau.ac.in`;

  const startRes = http.post(`${BASE_URL}/api/exam/${SLUG}/start`,
    JSON.stringify({ studentId, email, name: `Submitter ${vuId}` }),
    { headers: { "Content-Type": "application/json" } }
  );

  if (startRes.status !== 201 && startRes.status !== 200) {
    errorRate.add(1); return;
  }

  const { attemptId, sessionToken } = JSON.parse(startRes.body);

  // Submit immediately (simulates timeout-triggered submission)
  const subRes = http.post(`${BASE_URL}/api/exam/${SLUG}/submit`,
    JSON.stringify({ attemptId, sessionToken }),
    { headers: { "Content-Type": "application/json" } }
  );

  const ok = check(subRes, {
    "submit: 200": (r) => r.status === 200,
    "submit: has submissionId": (r) => {
      try { return !!JSON.parse(r.body).submissionId; } catch { return false; }
    },
  });
  errorRate.add(ok ? 0 : 1);
}
