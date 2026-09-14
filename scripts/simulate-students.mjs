/**
 * Full end-to-end student simulation: start -> question -> answer -> submit.
 *
 * Point this ONLY at a throwaway exam. It creates one real attempt per student.
 *
 *   node scripts/simulate-students.mjs <baseUrl> <slug> [students] [rampSeconds] [thinkMs]
 *
 * Example:
 *   node scripts/simulate-students.mjs https://quizora-inky.vercel.app test-exam-load 200 30 2000
 *
 * The exam must be ACTIVE, within its availability window, and have
 * allowExternalStudents=true (simulated IDs are not on any roster).
 * thinkMs defaults to 2000 to stay under the 30-answers/min per-attempt limit.
 */
import https from "node:https";
import http from "node:http";

const [, , BASE_ARG, SLUG, N_ARG, RAMP_ARG, THINK_ARG] = process.argv;
if (!BASE_ARG || !SLUG) {
  console.error("usage: node scripts/simulate-students.mjs <baseUrl> <slug> [students] [rampSeconds] [thinkMs]");
  process.exit(1);
}
const BASE = new URL(BASE_ARG);
const STUDENTS = Number(N_ARG ?? 200);
const RAMP_S = Number(RAMP_ARG ?? 30);
const THINK_MS = Number(THINK_ARG ?? 2000);

const RUN_BASE = 920000000 + (Math.floor(Date.now() / 1000) % 79000) * 1000;

const isTls = BASE.protocol === "https:";
const mod = isTls ? https : http;
const agent = new mod.Agent({ keepAlive: true, maxSockets: 256, maxFreeSockets: 128 });

// ─── metrics ──────────────────────────────────────────────────────────────────
const phases = {};
function record(phase, ms, status, errCode) {
  const p = (phases[phase] ??= { lat: [], codes: {}, errs: {} });
  p.lat.push(ms);
  if (errCode) p.errs[errCode] = (p.errs[errCode] ?? 0) + 1;
  else p.codes[status] = (p.codes[status] ?? 0) + 1;
}

function request(method, path, { body, token } = {}) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const payload = body ? JSON.stringify(body) : null;
    const headers = { accept: "application/json", "user-agent": "quizora-sim" };
    if (payload) {
      headers["content-type"] = "application/json";
      headers["content-length"] = Buffer.byteLength(payload);
    }
    if (token) headers["x-session-token"] = token;

    const req = mod.request(
      { host: BASE.hostname, port: BASE.port || (isTls ? 443 : 80), path, method, agent, headers },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          let json = null;
          try { json = JSON.parse(raw); } catch { /* non-JSON body */ }
          resolve({ ms: performance.now() - t0, status: res.statusCode, json, raw: raw.slice(0, 160) });
        });
      }
    );
    req.setTimeout(30000, () => req.destroy(new Error("TIMEOUT")));
    req.on("error", (e) =>
      resolve({ ms: performance.now() - t0, status: 0, err: e.code ?? e.message, json: null })
    );
    if (payload) req.write(payload);
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── one simulated student ────────────────────────────────────────────────────
async function runStudent(i) {
  // 9-digit id; email must be exactly <id>@dau.ac.in per studentIdentity rules.
  // A fresh range per run, so leftover attempts from earlier runs are never reused.
  const studentId = String(RUN_BASE + i);
  const email = `${studentId}@dau.ac.in`;

  const started = await request("POST", `/api/exam/${SLUG}/start`, {
    body: { studentId, email, name: `Load Test ${i}`, deviceFingerprint: `sim-${i}` },
  });
  record("start", started.ms, started.status, started.err);
  if (started.status !== 200 && started.status !== 201) {
    return { ok: false, stage: "start", detail: started.json?.error ?? started.err ?? started.raw };
  }

  const { attemptId, sessionToken, isReconnect } = started.json ?? {};
  if (!attemptId || !sessionToken) return { ok: false, stage: "start", detail: "no attemptId/sessionToken" };
  if (isReconnect) return { ok: false, stage: "start", detail: "reconnected to an existing attempt (not a fresh start)" };

  let index = 0;
  let total = null;
  let answered = 0;

  while (total === null || index < total) {
    const q = await request("GET", `/api/exam/${SLUG}/question?attemptId=${attemptId}&index=${index}`, {
      token: sessionToken,
    });
    record("question", q.ms, q.status, q.err);
    if (q.status !== 200) {
      return { ok: false, stage: `question[${index}]`, detail: q.json?.error ?? q.json?.status ?? q.err ?? q.raw };
    }
    total ??= q.json.totalQuestions;

    const question = q.json.question;
    if (question?.options?.length) {
      const pick = question.options[Math.floor(Math.random() * question.options.length)].id;
      const a = await request("POST", `/api/exam/${SLUG}/answer`, {
        body: { attemptId, sessionToken, questionId: question.id, selectedOptionIds: [pick] },
      });
      record("answer", a.ms, a.status, a.err);
      if (a.status === 200) answered++;
      else if (a.status !== 429) {
        return { ok: false, stage: `answer[${index}]`, detail: a.json?.error ?? a.err ?? a.raw };
      }
    }

    index++;
    if (index < (total ?? 0)) await sleep(THINK_MS);
  }

  const sub = await request("POST", `/api/exam/${SLUG}/submit`, { body: { attemptId, sessionToken } });
  record("submit", sub.ms, sub.status, sub.err);
  if (sub.status !== 200) return { ok: false, stage: "submit", detail: sub.json?.error ?? sub.err ?? sub.raw };

  // Only a student who answered every question and received a submission id counts.
  const submissionId = sub.json?.submissionId ?? null;
  if (!submissionId) return { ok: false, stage: "submit", detail: "no submissionId returned" };
  if (answered < (total ?? 0)) return { ok: false, stage: "answer", detail: `answered ${answered}/${total}` };
  return { ok: true, answered, submissionId };
}

// ─── report ───────────────────────────────────────────────────────────────────
const pct = (s, p) => (s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] : 0);

function report(results, wallMs) {
  const ok = results.filter((r) => r.ok);
  const bad = results.filter((r) => !r.ok);

  console.log(`\n${"═".repeat(78)}`);
  console.log(`students ${results.length}  |  completed ${ok.length}  |  failed ${bad.length}  |  wall ${(wallMs / 1000).toFixed(1)}s`);
  console.log(`${"═".repeat(78)}`);
  console.log(`${"phase".padEnd(10)} ${"n".padStart(5)} ${"p50".padStart(8)} ${"p95".padStart(8)} ${"p99".padStart(8)} ${"max".padStart(8)}  codes`);

  let totalReq = 0;
  for (const [name, p] of Object.entries(phases)) {
    const s = [...p.lat].sort((a, b) => a - b);
    totalReq += s.length;
    const errStr = Object.keys(p.errs).length ? `  ERR ${JSON.stringify(p.errs)}` : "";
    console.log(
      `${name.padEnd(10)} ${String(s.length).padStart(5)} ` +
        `${pct(s, 50).toFixed(0).padStart(7)}m ${pct(s, 95).toFixed(0).padStart(7)}m ` +
        `${pct(s, 99).toFixed(0).padStart(7)}m ${(s[s.length - 1] ?? 0).toFixed(0).padStart(7)}m` +
        `  ${JSON.stringify(p.codes)}${errStr}`
    );
  }
  console.log(`\ntotal requests ${totalReq}  |  throughput ${(totalReq / (wallMs / 1000)).toFixed(1)} req/s`);

  if (bad.length) {
    const tally = {};
    for (const b of bad) {
      const k = `${b.stage}: ${String(b.detail).slice(0, 70)}`;
      tally[k] = (tally[k] ?? 0) + 1;
    }
    console.log(`\nfailures:`);
    for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}x  ${k}`);
  }
  const graded = ok.reduce((a, r) => a + r.answered, 0);
  console.log(`\nanswers accepted ${graded}  |  submissions confirmed ${ok.filter((r) => r.submissionId).length}`);
}

// ─── main ─────────────────────────────────────────────────────────────────────
console.log(`\ntarget    ${BASE.origin}/exam/${SLUG}`);
console.log(`students  ${STUDENTS} arriving over ${RAMP_S}s, ${THINK_MS}ms between questions\n`);

const t0 = performance.now();
const running = [];
for (let i = 0; i < STUDENTS; i++) {
  running.push(runStudent(i));
  await sleep((RAMP_S * 1000) / STUDENTS); // stagger arrivals like a real classroom
  if ((i + 1) % 25 === 0) process.stdout.write(`  ...${i + 1} students started\n`);
}
const results = await Promise.all(running);
report(results, performance.now() - t0);
agent.destroy();
