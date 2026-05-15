const SCRAPE_LIMIT = 400;
// Scraping + CSV can take several minutes (multi-page + Puppeteer). Frontend should match.
const SCRAPE_REQUEST_TIMEOUT_MS = Number(
  process.env.SCRAPE_REQUEST_TIMEOUT_MS || 900000 // 15 minutes for multi-page scraping
);

module.exports = {
  SCRAPE_LIMIT,
  SCRAPE_REQUEST_TIMEOUT_MS,
};
