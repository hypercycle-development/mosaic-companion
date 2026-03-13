import { _electron as electron, test, expect } from "@playwright/test";
import { privateKeyToAccount } from "viem/accounts";

// Extend the Window interface to include electronAPI for type safety
declare global {
  interface Window {
    electronAPI?: {
      web3?: {
        getAddress: () => Promise<any>;
      };
    };
  }
}

const electronPath = require("electron");

test("wallet creation: remove existing, save private key, verify address", async () => {
  const TEST_PRIVATE_KEY =
    "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const expectedAddress = privateKeyToAccount(
    TEST_PRIVATE_KEY as `0x${string}`,
  ).address.toLowerCase();

  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: ["."],
  });
  const page = await electronApp.firstWindow();
  await page.waitForLoadState("domcontentloaded");

  // Open sidebar if closed (the app renders a top-left toggle button when closed)
  const sidebarToggle = await page
    .locator("button.absolute.top-4.left-4")
    .first();
  if (await sidebarToggle.count()) {
    await sidebarToggle.click();
  }

  // Navigate to Web3 via the sidebar
  await page.locator('button:has-text("Web3")').click();

  // Wait for Web3 page to render (either the save form or the stored state)
  await page.waitForFunction(
    () => document.body.innerText.includes("Private Key"),
    null,
    { timeout: 10000 },
  );

  // If a wallet already exists, delete it (confirm dialog)
  const deleteBtn = page.locator('button[title="Delete Wallet"]');
  if (await deleteBtn.count()) {
    page.once("dialog", (dialog) => dialog.accept());
    await deleteBtn.click();
    // wait a short moment for UI to refresh
    await page.waitForTimeout(500);
  }

  // Fill private key and save
  const pkInput = page.locator('input[placeholder="0x..."]');
  await pkInput.fill(TEST_PRIVATE_KEY);
  await page.locator('button:has-text("Save Private Key")').click();

  // Wait for toast notification confirming save
  await page
    .locator("text=Private key saved securely.")
    .first()
    .waitFor({ timeout: 5000 });

  // Read the derived address from the app's web3 API and compare
  const derived = (await page.evaluate(async () => {
    try {
      const res = await window.electronAPI?.web3?.getAddress();
      if (res?.data?.address) return res.data.address;
      if (res?.address) return res.address;
      return null;
    } catch (e) {
      return null;
    }
  })) as string | null;

  // sleep a moment to ensure UI updates with the new address after saving
  await page.waitForTimeout(1000);
  // Additionally get the displayed address from the UI and compare. data-testid="submit-button"
  const displayedAddress = await page
    .getByTestId("user-wallet-address")
    .innerText()
    .catch(() => null);

  expect(derived, "derived address from web3.getAddress()").not.toBeNull();
  expect(derived!.toLowerCase()).toBe(expectedAddress.toLowerCase());
  expect(displayedAddress, "displayed address in UI").not.toBeNull();
  expect(displayedAddress!.toLowerCase()).toBe(expectedAddress.toLowerCase());

  await electronApp.close();
});
