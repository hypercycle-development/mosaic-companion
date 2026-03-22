import { _electron as electron, test, expect } from "@playwright/test";

// Resolve electron executable from node_modules
const electronPath = require("electron");

test("should render the main window", async () => {
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: ["."],
  });

  const window = await electronApp.firstWindow();
  await window.waitForLoadState("domcontentloaded");

  // Try title assertion (adjust the regex to match your app title)
  await expect(window).toHaveTitle(/Mosaic|mosaic|Mosaic Companion/);

  // Fallback: ensure a top-level header or root element is visible
  const header = window.locator("h1");
  await expect(header.first()).toBeVisible();

  await electronApp.close();
});
