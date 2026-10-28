import path from "node:path";
import { chromium } from "playwright";

async function waitForEnter() {
  return new Promise<void>((resolve) => {
    process.stdout.write("Press Enter after you finish LinkedIn login...\n");
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", () => resolve());
  });
}

async function main() {
  const outputPath =
    process.env.LINKEDIN_STORAGE_STATE_PATH?.trim() ||
    path.join(process.cwd(), "linkedin-session.json");

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("https://www.linkedin.com/login", {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });

  console.log("Complete login in the opened browser window.");
  await waitForEnter();

  await context.storageState({ path: outputPath });
  await browser.close();

  console.log(`saved LinkedIn session to ${outputPath}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
