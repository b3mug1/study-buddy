import { expect, test } from "@playwright/test";

test("landing page exposes the main Study Buddy actions", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: /find your people/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /get started/i }).first(),
  ).toHaveAttribute("href", "/register");
  await expect(
    page.getByRole("link", { name: /sign in/i }).first(),
  ).toHaveAttribute("href", "/login");
});

test("landing page fits a narrow mobile viewport without horizontal scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));

  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  await expect(
    page.getByRole("link", { name: /find your study buddy/i }),
  ).toBeVisible();
});

test("registration validates short passwords before contacting the API", async ({
  page,
}) => {
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Alex Student");
  await page.getByLabel("University email").fill("alex@example.edu");
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByRole("button", { name: /create account/i }).click();

  await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
});

test("protected API endpoints reject requests without a bearer token", async ({
  request,
}) => {
  const response = await request.get(
    "http://127.0.0.1:8000/api/v1/conversations",
  );
  expect(response.status()).toBe(401);
});
