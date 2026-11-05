import { test, expect } from "@playwright/test";

test("join screen loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Odaya katılın")).toBeVisible();
  await expect(page.getByRole("button", { name: /Tahtaya gir/i })).toBeVisible();
});
