import { _electron as electron, test, expect } from "@playwright/test";

const electronPath = require("electron");

test("add agent and test Gemini connection", async () => {
  const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
  if (!GEMINI_KEY) {
    test.skip(true, "GEMINI_API_KEY not set");
  }

  const rand = Math.floor(Math.random() * 90000) + 10000;
  const agentName = `Test agent #${rand}`;

  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: ["."],
    env: { ...process.env, GEMINI_API_KEY: GEMINI_KEY },
  });

  const page = await electronApp.firstWindow();
  await page.waitForLoadState("domcontentloaded");

  // Open sidebar if closed
  const sidebarToggle = page.locator("button.absolute.top-4.left-4").first();
  if (await sidebarToggle.count()) await sidebarToggle.click();

  // Navigate to Settings/Configuration
  await page.locator('button:has-text("Configuration")').click();

  // Click Add Agent
  await page.locator('button:has-text("Add Agent")').click();

  // Wait for the new agent panel to render (Agent Name input)
  const nameInput = page.locator('label:has-text("Agent Name") input').first();
  await nameInput.waitFor({ timeout: 5000 });

  // Set agent name
  await nameInput.fill(agentName);

  // Select provider -> Google Gemini (value 'gemini')
  const providerSelect = page
    .locator('label:has-text("Provider") select')
    .first();
  await providerSelect.selectOption("gemini");

  // Set API Key from environment
  const apiInput = page.locator('label:has-text("API Key") input').first();
  await apiInput.fill(GEMINI_KEY);

  // Click Test Connection
  const testBtn = page.locator('button:has-text("Test Connection")').first();
  await testBtn.click();

  // Wait ~3s then look for success message
  await page.waitForTimeout(3000);
  await expect(
    page.locator("text=Connection established successfully!"),
  ).toBeVisible({ timeout: 10000 });

  await electronApp.close();
});
