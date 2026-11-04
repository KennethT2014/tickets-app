/** Real local administration smoke test. Creates identifiable fixtures; never resets the database. */
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.ADMIN_TEST_URL || "http://localhost:3000";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("This script only supports local test servers");
const output =
  process.env.ADMIN_TEST_OUTPUT ||
  join(tmpdir(), `tickets-admin-${Date.now()}`);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
await context.addInitScript(() => localStorage.setItem("cw_lang", "en"));
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("dialog", (dialog) => dialog.accept());
const run = `UI Test ${Date.now()}`;
const email = `ui-test-${Date.now()}@example.test`;
const initialPassword = "LocalTest123!";
const updatedPassword = "LocalReset123!";
let fixtureUser;
const ownAreas = new Set();
const ownReplies = new Set();
const results = [];
const pass = (message) => {
  results.push(message);
  console.log(`PASS ${message}`);
};
const expectVisible = (locator) =>
  locator.waitFor({ state: "visible", timeout: 15000 });
async function action(path, method, click, expected = 200) {
  const response = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === `/api${path}` &&
      r.request().method() === method,
  );
  const [r] = await Promise.all([response, click()]);
  assert.equal(r.status(), expected, await r.text());
  return r.json();
}
async function login(target, address, password) {
  await target.goto(`${base}/login`);
  await target.locator('[name="email"]').fill(address);
  await target.locator('[name="password"]').fill(password);
  await target.locator('button[type="submit"]').click();
}
async function editUser(body) {
  const row = page.getByRole("row").filter({ hasText: email });
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  const form = page.locator("form");
  await body(form);
  await action(`/users/${fixtureUser.id}`, "PATCH", () =>
    form.getByRole("button", { name: "Save", exact: true }).click(),
  );
  await page.locator('input[name="name"]').waitFor({ state: "hidden" });
}
async function createArea(name, parentId = "") {
  await page.getByRole("button", { name: "Create area", exact: true }).click();
  const form = page.locator("form").last();
  await form.locator('[name="name"]').fill(name);
  await form.locator('[name="parentId"]').selectOption(parentId);
  const area = await action(
    "/org/areas",
    "POST",
    () => form.getByRole("button", { name: "Save", exact: true }).click(),
    201,
  );
  ownAreas.add(area.id);
  await expectVisible(page.getByRole("row").filter({ hasText: name }));
  return area;
}
try {
  await login(
    page,
    process.env.ADMIN_TEST_EMAIL || "admin@ems.net",
    process.env.ADMIN_TEST_PASSWORD || "messi2012",
  );
  await page.waitForURL(base + "/");
  await page.goto(`${base}/admin/users`);
  await page.getByRole("button", { name: "Create user", exact: true }).click();
  const form = page.locator("form");
  assert.equal(
    await form
      .locator('select[name="globalRole"] option[value="ADMIN"]')
      .count(),
    0,
  );
  await form.locator('[name="name"]').fill(run);
  await form.locator('[name="email"]').fill(email);
  await form.locator('[name="password"]').fill(initialPassword);
  fixtureUser = await action(
    "/users",
    "POST",
    () => form.getByRole("button", { name: "Save", exact: true }).click(),
    201,
  );
  await expectVisible(page.getByRole("row").filter({ hasText: email }));
  pass("User creation and assignable role filtering");
  await page.getByRole("button", { name: "Create user", exact: true }).click();
  await form.locator('[name="name"]').fill(run);
  await form.locator('[name="email"]').fill(email);
  await form.locator('[name="password"]').fill(initialPassword);
  await action(
    "/users",
    "POST",
    () => form.getByRole("button", { name: "Save", exact: true }).click(),
    409,
  );
  await expectVisible(
    page.locator('[role="alert"]:not(#__next-route-announcer__)'),
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  pass("Real duplicate user error is displayed");
  await editUser(async (f) => {
    await f.locator('[name="name"]').fill(`${run} edited`);
    await f.locator('[name="globalRole"]').selectOption("AREA_LEAD");
    await f.locator('[name="password"]').fill(updatedPassword);
  });
  pass("User name role and password reset");
  const secondary = await browser.newContext();
  const accountPage = await secondary.newPage();
  await login(accountPage, email, updatedPassword);
  await accountPage.waitForURL(base + "/");
  await accountPage.goto(`${base}/admin/users`);
  await accountPage.waitForURL(base + "/");
  pass("Reset password login and non-admin route restriction");
  await secondary.close();
  await editUser(async (f) => f.locator('[name="isActive"]').uncheck());
  const inactiveContext = await browser.newContext();
  const inactivePage = await inactiveContext.newPage();
  await login(inactivePage, email, updatedPassword);
  await expectVisible(inactivePage.locator("form .text-red-700"));
  await inactiveContext.close();
  await editUser(async (f) => f.locator('[name="isActive"]').check());
  pass("Deactivate deny login and reactivate user");
  await page.goto(`${base}/admin/areas`);
  const parent = await createArea(`${run} parent`);
  const child = await createArea(`${run} child`, parent.id);
  const parentRow = page.getByRole("row").filter({ hasText: `${run} parent` });
  await action(
    `/org/areas/${parent.id}`,
    "DELETE",
    () =>
      parentRow
        .getByRole("button", { name: "Delete area", exact: true })
        .click(),
    400,
  );
  await expectVisible(
    page.locator('[role="alert"]:not(#__next-route-announcer__)'),
  );
  pass("Area deletion rejection is visible for a parent with children");
  await parentRow.getByRole("button", { name: "Edit", exact: true }).click();
  assert.equal(
    await page
      .locator('select[name="parentId"] option')
      .evaluateAll(
        (options, id) => options.some((o) => o.value === id),
        child.id,
      ),
    false,
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  const childRow = page.getByRole("row").filter({ hasText: `${run} child` });
  await childRow.getByRole("button", { name: "Edit", exact: true }).click();
  const areaForm = page.locator("form").last();
  await areaForm.locator('[name="name"]').fill(`${run} moved`);
  await areaForm.locator('[name="parentId"]').selectOption("");
  await areaForm.locator('[name="leadUserId"]').selectOption(fixtureUser.id);
  await action(`/org/areas/${child.id}`, "PATCH", () =>
    areaForm.getByRole("button", { name: "Save", exact: true }).click(),
  );
  await expectVisible(
    page.getByRole("row").filter({ hasText: `${run} moved` }),
  );
  pass("Area rename reparent lead assignment and cycle-safe parent options");
  await page
    .getByRole("row")
    .filter({ hasText: `${run} moved` })
    .getByRole("button", { name: "Manage", exact: true })
    .click();
  const section = page.getByRole("region", { name: "Area management" });
  const memberForm = section.getByRole("form", { name: "Add member" });
  await memberForm.locator('[name="userId"]').selectOption(fixtureUser.id);
  await memberForm.locator('[name="canAssign"]').check();
  await action(
    `/org/areas/${child.id}/members`,
    "POST",
    () =>
      memberForm
        .getByRole("button", { name: "Add member", exact: true })
        .click(),
    201,
  );
  const member = section
    .getByRole("listitem")
    .filter({ hasText: `${run} edited` });
  await action(
    `/org/areas/${child.id}/members/${fixtureUser.id}`,
    "PATCH",
    () =>
      member.getByRole("checkbox", { name: "Can close", exact: true }).click(),
  );
  await action(
    `/org/areas/${child.id}/members/${fixtureUser.id}`,
    "DELETE",
    () =>
      member
        .getByRole("button", { name: "Remove member", exact: true })
        .click(),
  );
  pass("Membership add permission edit and removal");
  const replyForm = section.getByRole("form", { name: "Create quick reply" });
  await replyForm.locator('[name="title"]').fill(`${run} reply`);
  await replyForm.locator('[name="body"]').fill("Local browser test reply");
  const reply = await action(
    `/org/areas/${child.id}/quick-replies`,
    "POST",
    () =>
      replyForm
        .getByRole("button", { name: "Create quick reply", exact: true })
        .click(),
    201,
  );
  ownReplies.add(reply.id);
  const replyItem = section
    .getByRole("listitem")
    .filter({ hasText: `${run} reply` });
  await action(`/org/quick-replies/${reply.id}`, "DELETE", () =>
    replyItem
      .getByRole("button", { name: "Delete reply", exact: true })
      .click(),
  );
  ownReplies.delete(reply.id);
  pass("Quick reply creation listing and deletion");
  await page.screenshot({
    path: join(output, "areas-desktop.png"),
    fullPage: true,
  });
  for (const [id, name] of [
    [child.id, `${run} moved`],
    [parent.id, `${run} parent`],
  ]) {
    await action(`/org/areas/${id}`, "DELETE", () =>
      page
        .getByRole("row")
        .filter({ hasText: name })
        .getByRole("button", { name: "Delete area", exact: true })
        .click(),
    );
    ownAreas.delete(id);
    await page
      .getByRole("row")
      .filter({ hasText: name })
      .waitFor({ state: "hidden" });
  }
  pass("Cleanup own areas through UI");
  await page.goto(`${base}/audit`);
  await expectVisible(
    page.getByRole("button", { name: "Performance", exact: true }),
  );
  await page.getByRole("button", { name: "System Log", exact: true }).click();
  await expectVisible(page.locator("tbody tr").first());
  for (let i = 0; i < 11; i++) {
    const response = page.waitForResponse(
      (r) => r.url().includes("/api/audit/logs?") && r.status() === 200,
    );
    await Promise.all([
      response,
      page.getByRole("button", { name: "Refresh", exact: true }).click(),
    ]);
  }
  await page
    .getByRole("combobox", { name: "Page size", exact: true })
    .selectOption("10");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expectVisible(page.getByText("Offset: 10", { exact: true }));
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expectVisible(page.getByText("Offset: 0", { exact: true }));
  await page.locator("summary").first().click();
  await expectVisible(
    page.locator("details[open]").getByText("prevHash", { exact: true }),
  );
  pass("System audit pagination page size and complete details");
  await page.getByRole("button", { name: "Security", exact: true }).click();
  await expectVisible(page.getByText("No matching events.", { exact: true }));
  await page
    .getByRole("button", { name: "Integrity Verification", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Verify Hash Chain", exact: true })
    .click();
  await expectVisible(page.getByText(/stored cryptographic chain passed/));
  pass("Performance security empty state and live integrity verification");
  await page.getByRole("button", { name: "System Log", exact: true }).click();
  await page.route("**/api/audit/logs?**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Smoke test temporary failure" }),
    }),
  );
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expectVisible(
    page.locator('[role="alert"]:not(#__next-route-announcer__)'),
  );
  await page.unroute("**/api/audit/logs?**");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page
    .locator('[role="alert"]:not(#__next-route-announcer__)')
    .waitFor({ state: "hidden" });
  pass(
    "Injected network failure is displayed and retry recovers against real API",
  );
  await page.screenshot({
    path: join(output, "audit-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("combobox", { name: "Language" }).selectOption("es");
  await expectVisible(
    page.getByText("Tamaño de página", { exact: false }).first(),
  );
  await page.screenshot({
    path: join(output, "audit-mobile-es.png"),
    fullPage: true,
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  assert.equal(overflow, false, "Page should not overflow mobile viewport");
  assert.deepEqual(errors, [], "No browser page errors");
  pass("Mobile Spanish audit and no browser runtime errors");
} catch (error) {
  await page
    .screenshot({ path: join(output, "failure.png"), fullPage: true })
    .catch(() => {});
  throw error;
} finally {
  // Cleanup only identities created by this invocation; backend intentionally has no user DELETE.
  for (const id of ownReplies) {
    const response = await context.request.delete(
      `${base}/api/org/quick-replies/${id}`,
    );
    console.log("cleanup reply", response.status());
  }
  for (const id of [...ownAreas].reverse()) {
    const response = await context.request.delete(
      `${base}/api/org/areas/${id}`,
    );
    console.log("cleanup area", response.status(), await response.text());
  }
  if (fixtureUser) {
    const response = await context.request.patch(
      `${base}/api/users/${fixtureUser.id}`,
      { data: { isActive: false } },
    );
    assert.equal(response.status(), 200, "Fixture deactivation must succeed");
  }
  console.log(
    JSON.stringify(
      {
        fixtureEmail: email,
        fixtureStatus: "deactivation requested",
        passed: results,
        screenshots: output,
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
