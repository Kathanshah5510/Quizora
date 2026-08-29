import { test, expect, Page } from "@playwright/test";

const ADMIN_EMAIL = "admin@quizora.local";
const ADMIN_PASSWORD = "Admin@123456";
const EXAM_TITLE = "E2E Lifecycle Exam";

async function adminLogin(page: Page) {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[name="password"]').fill(ADMIN_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/admin\/dashboard/, { timeout: 20_000 });
}

test("scenario 1: admin login", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator('input[name="email"]')).toBeVisible({ timeout: 15_000 });

  await page.locator('input[name="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[name="password"]').fill(ADMIN_PASSWORD);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL(/\/admin\/dashboard/, { timeout: 20_000 });
  await expect(page.locator("h1")).toContainText("Dashboard");
});

test("scenario 1: admin creates exam, publishes, closes (full lifecycle)", async ({ page }) => {
  await adminLogin(page);

  // ── Step 1: Create exam ────────────────────────────────────────────────────
  await page.goto("/admin/exams/new");
  await expect(page.locator("h1")).toContainText("New Exam", { timeout: 15_000 });

  await page.locator('select[name="courseId"]').selectOption({ index: 1 });
  await page.locator('input[name="title"]').fill(EXAM_TITLE);
  await page.locator('input[name="instructorName"]').fill("E2E Test Instructor");

  const durationInput = page.locator('input[name="durationMinutes"]');
  await durationInput.click({ clickCount: 3 });
  await durationInput.fill("30");

  await page.locator('button[type="submit"]').click();

  // The exam ID is a CUID2 (starts with letters+digits), so exclude "new" explicitly
  await page.waitForURL(/\/admin\/exams\/(?!new)[a-z0-9]+$/, { timeout: 20_000 });
  const examUrl = page.url();

  // Status badge in the page header (server component) shows "Draft"
  await expect(page.locator("span").filter({ hasText: /^Draft$/ }).first()).toBeVisible({
    timeout: 10_000,
  });

  // ── Step 2: Publish ────────────────────────────────────────────────────────
  // Use exact name matching so "Publish" doesn't match the "Unpublish" button
  const publishBtn = page.getByRole("button", { name: "Publish", exact: true });
  await publishBtn.waitFor({ state: "visible", timeout: 10_000 });
  await publishBtn.click();

  // Wait for the exact "Publish" button to disappear (status changed away from DRAFT)
  await publishBtn.waitFor({ state: "hidden", timeout: 30_000 });

  // "Close Exam" button is shown when status===PUBLISHED or ACTIVE
  const closeBtn = page.getByRole("button", { name: "Close Exam", exact: true });
  await closeBtn.waitFor({ state: "visible", timeout: 10_000 });

  // ── Step 3: Close ──────────────────────────────────────────────────────────
  await closeBtn.click();

  // Wait for Close Exam to disappear (status===CLOSED shows Reopen instead)
  await closeBtn.waitFor({ state: "hidden", timeout: 30_000 });

  // Reopen button appears for CLOSED exams
  await expect(page.getByRole("button", { name: "Reopen", exact: true })).toBeVisible({
    timeout: 10_000,
  });

  expect(page.url()).toBe(examUrl);
});
