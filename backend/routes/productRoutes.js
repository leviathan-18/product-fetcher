const express = require("express");
const {
  getProducts,
  scrapeToCsv,
  getProductsFromCsv,
  startScrapeJob,
  getScrapeJobStatus,
  downloadLatestCsv,
} = require("../controllers/productController");

const router = express.Router();

// Step 1: scrape → write products.csv (no product array in response; use long timeout).
router.get("/scrape", scrapeToCsv);
router.post("/scrape/job", startScrapeJob);
router.get("/scrape/job/:jobId", getScrapeJobStatus);
// Step 2: read products.csv → JSON for the UI.
router.get("/from-csv", getProductsFromCsv);
router.get("/csv/latest", downloadLatestCsv);
// Legacy: scrape + CSV + products in one response.
router.get("/", getProducts);

module.exports = router;
