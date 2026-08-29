import { test, expect, BrowserContext, Page } from "@playwright/test";
import { E2E_EXAM_SLUG, STUDENTS } from "./global-setup";

const EXAM_URL = `/exam/${E2E_EXAM_SLUG}`;
const START_URL = `/exam/${E2E_EXAM_SLUG}/start`;

// MCQ options in the attempt page are <button aria-pressed="true|false"> (not radio inputs)
const MCQ_OPTION_SELECTOR = 'ul[aria-label="Answer options"] button[aria-pressed]';

// Trigger React controlled input onChange via the native value setter + input event.
async function setReactInputValue(page: Page, selector: string, value: string) {
  await page.evaluate(
    ({ sel, val }) => {
      const el = document.querySelector(sel) as HTMLInputElement | null;
      if (!el) throw new Error(`Element not found: ${sel}`);
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      if (!setter) throw new Error("Could not get native input value setter");
      setter.call(el, val);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { sel: selector, val: value }
  );
}

async function fillIdentityForm(page: Page, student: { studentId: string; name: string }) {
  await page.waitForSelector("#name", { state: "visible", timeout: 15_000 });

  await setReactInputValue(page, "#name", student.name);
  await setReactInputValue(page, "#studentId", student.studentId);

  // The email may be auto-filled by handleStudentIdChange; wait briefly then set explicitly
  await page.waitForTimeout(300);
  await setReactInputValue(page, "#email", `${student.studentId}@dau.ac.in`);

  // Verify the React state was updated (DOM value should reflect state)
  const name = await page.inputValue("#name");
  const sid = await page.inputValue("#studentId");
  if (!name || !sid) {
    throw new Error(`Form not filled: name="${name}" studentId="${sid}"`);
  }
}

// ─── Scenario 2: Student starts exam → answers → submits → sees "Exam Submitted" ──

test("scenario 2: student starts exam, answers, submits, sees confirmation", async ({ page }) => {
  const student = STUDENTS[0];

  await page.goto(EXAM_URL);
  await expect(page.locator("h1")).toContainText("E2E Test Quiz Alpha", { timeout: 20_000 });

  const startLink = page.locator('a:has-text("Start Exam")');
  await startLink.waitFor({ state: "visible" });
  await startLink.click();
  await page.waitForURL(`**${START_URL}`, { timeout: 15_000 });

  await fillIdentityForm(page, student);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(`**/attempt/**`, { timeout: 30_000 });

  // MCQ options are <button aria-pressed> — click the first one
  await page.waitForSelector(MCQ_OPTION_SELECTOR, { timeout: 20_000 });
  await page.locator(MCQ_OPTION_SELECTOR).first().click();

  // Submit button
  const submitBtn = page.locator('button:has-text("Submit Exam")');
  await submitBtn.waitFor({ state: "visible", timeout: 15_000 });
  await submitBtn.click();

  // After submit, the attempt page shows "Exam Submitted" heading (no navigation)
  await expect(page.locator('h1:has-text("Exam Submitted")')).toBeVisible({ timeout: 20_000 });
});

// ─── Scenario 3: Student reconnects after reload ──────────────────────────────

test("scenario 3: student reconnects after accidental closure — attempt resumes", async ({ page }) => {
  const student = STUDENTS[1];

  await page.goto(START_URL);
  await fillIdentityForm(page, student);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(`**/attempt/**`, { timeout: 30_000 });
  const attemptUrl = page.url();

  // Wait for question to load (MCQ option buttons)
  await page.waitForSelector(MCQ_OPTION_SELECTOR, { timeout: 20_000 });

  // Reload simulates accidental browser closure
  await page.reload();
  await page.waitForURL(attemptUrl, { timeout: 20_000 });

  // MCQ options should still be visible — attempt resumed from sessionStorage token
  await page.waitForSelector(MCQ_OPTION_SELECTOR, { timeout: 20_000 });
  await expect(page.locator(MCQ_OPTION_SELECTOR).first()).toBeVisible();
});

// ─── Scenario 4: Student submits twice → idempotent ──────────────────────────

test("scenario 4: duplicate submit returns the same submission ID", async ({ page }) => {
  const student = STUDENTS[2];

  await page.goto(START_URL);
  await fillIdentityForm(page, student);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(`**/attempt/**`, { timeout: 30_000 });
  const attemptId = page.url().split("/attempt/")[1]?.split("?")[0];

  await page.waitForSelector(MCQ_OPTION_SELECTOR, { timeout: 20_000 });

  // Submit via the correct API endpoint: /api/exam/[slug]/submit
  const submit1 = await page.evaluate(async (aid) => {
    const slug = location.pathname.split("/exam/")[1]?.split("/")[0];
    const sessionKey = `quizora_session_${slug}`;
    const stored = sessionStorage.getItem(sessionKey);
    const { sessionToken } = stored ? JSON.parse(stored) : {};
    const res = await fetch(`/api/exam/${slug}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId: aid, sessionToken }),
    });
    return { status: res.status, body: await res.json() };
  }, attemptId);

  expect(submit1.status).toBe(200);
  const submissionId1 = submit1.body?.submissionId;

  // Submit again — must be idempotent (same submissionId returned)
  const submit2 = await page.evaluate(async (aid) => {
    const slug = location.pathname.split("/exam/")[1]?.split("/")[0];
    const sessionKey = `quizora_session_${slug}`;
    const stored = sessionStorage.getItem(sessionKey);
    const { sessionToken } = stored ? JSON.parse(stored) : {};
    const res = await fetch(`/api/exam/${slug}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId: aid, sessionToken }),
    });
    return { status: res.status, body: await res.json() };
  }, attemptId);

  expect(submit2.status).toBe(200);
  if (submissionId1) {
    expect(submit2.body?.submissionId).toBe(submissionId1);
  }
});

// ─── Scenario 5: Second device gets 409 DEVICE_LOCKED ────────────────────────

test("scenario 5: second device within grace period gets 409 DEVICE_LOCKED", async ({ browser }) => {
  const student = STUDENTS[3];

  // Context 1: student starts exam and has an active attempt
  const ctx1: BrowserContext = await browser.newContext();
  const page1: Page = await ctx1.newPage();
  page1.setDefaultNavigationTimeout(30_000);

  await page1.goto(`http://localhost:3000${START_URL}`);
  await page1.waitForSelector("#name", { state: "visible", timeout: 15_000 });

  await page1.evaluate(
    ({ name, studentId, email }) => {
      const setValue = (sel: string, val: string) => {
        const el = document.querySelector(sel) as HTMLInputElement;
        if (!el) return;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(el, val);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      };
      setValue("#name", name);
      setValue("#studentId", studentId);
      setValue("#email", email);
    },
    { name: student.name, studentId: student.studentId, email: `${student.studentId}@dau.ac.in` }
  );

  await page1.locator('button[type="submit"]').click();
  await page1.waitForURL(`**/attempt/**`, { timeout: 30_000 });

  // Context 2: simulate a second device by navigating to the start page
  // and directly calling the start API without a sessionToken
  const ctx2: BrowserContext = await browser.newContext();
  const page2: Page = await ctx2.newPage();
  page2.setDefaultNavigationTimeout(30_000);

  // Navigate to give page2 a proper origin for fetch requests
  await page2.goto(`http://localhost:3000${START_URL}`);
  await page2.waitForLoadState("domcontentloaded");

  const result = await page2.evaluate(
    async ({ studentId, name, slug }) => {
      // Validate first (this should succeed)
      const valRes = await fetch(`/api/exam/${slug}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, email: `${studentId}@dau.ac.in`, name }),
      });
      if (!valRes.ok) {
        return { status: valRes.status, body: await valRes.json().catch(() => ({})), step: "validate" };
      }

      // Attempt to start without any resumeToken — simulates second device
      const startRes = await fetch(`/api/exam/${slug}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          email: `${studentId}@dau.ac.in`,
          name,
          deviceFingerprint: "second-device-ua",
          // No resumeToken — this device has no prior session
        }),
      });
      return { status: startRes.status, body: await startRes.json().catch(() => ({})), step: "start" };
    },
    { studentId: student.studentId, name: student.name, slug: E2E_EXAM_SLUG }
  );

  // Second device within grace period must be refused with 409 DEVICE_LOCKED
  expect(result.status).toBe(409);
  expect(result.body?.code).toBe("DEVICE_LOCKED");

  await ctx1.close();
  await ctx2.close();
});
