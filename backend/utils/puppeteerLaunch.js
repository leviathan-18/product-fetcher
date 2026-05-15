const puppeteer = require("puppeteer");

/**
 * Shared Chrome/Chromium launch settings for headless scraping.
 * Extra flags help on Windows / constrained environments.
 * protocolTimeout increased to 10 minutes for slow page interactions.
 */
const BASE_LAUNCH = {
  headless: true,
  protocolTimeout: 600000, // 10 minutes for slow page operations
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
  ],
};

function isMissingChromeError(error) {
  const msg = String(error?.message || error || "");
  return (
    msg.includes("Could not find Chrome") ||
    msg.includes("browser fetcher") ||
    msg.includes("cache path") ||
    msg.includes("Executable doesn't exist")
  );
}

/**
 * Launches a browser for Puppeteer.
 *
 * Resolution order:
 * 1. PUPPETEER_EXECUTABLE_PATH — full path to chrome.exe / chromium
 * 2. PUPPETEER_CHANNEL — e.g. "chrome" (uses installed Google Chrome)
 * 3. Default Puppeteer-managed Chrome (requires `npx puppeteer browsers install chrome`)
 * 4. Retry with channel "chrome" if managed browser is missing (common on Windows)
 */
async function launchPuppeteerBrowser() {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  const channelEnv = process.env.PUPPETEER_CHANNEL?.trim();

  if (executablePath) {
    console.log("[puppeteer] using PUPPETEER_EXECUTABLE_PATH");
    return puppeteer.launch({
      ...BASE_LAUNCH,
      executablePath,
    });
  }

  if (channelEnv) {
    console.log(`[puppeteer] using PUPPETEER_CHANNEL=${channelEnv}`);
    return puppeteer.launch({
      ...BASE_LAUNCH,
      channel: channelEnv,
    });
  }

  try {
    console.log("[puppeteer] launching managed Chrome (Puppeteer cache)");
    return await puppeteer.launch({ ...BASE_LAUNCH });
  } catch (firstError) {
    if (!isMissingChromeError(firstError)) {
      throw firstError;
    }
    console.warn(
      "[puppeteer] managed Chrome not found; retrying with system Google Chrome (channel=chrome). " +
        "If this fails, run: cd backend && npx puppeteer browsers install chrome"
    );
    try {
      return await puppeteer.launch({
        ...BASE_LAUNCH,
        channel: "chrome",
      });
    } catch (secondError) {
      const hint =
        "Install Puppeteer's Chrome: cd backend && npx puppeteer browsers install chrome\n" +
        "Or install Google Chrome, or set PUPPETEER_EXECUTABLE_PATH to chrome.exe";
      throw new Error(`${secondError.message}\n\n${hint}`);
    }
  }
}

module.exports = {
  launchPuppeteerBrowser,
};
