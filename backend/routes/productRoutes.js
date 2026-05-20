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

router.get("/scrape", scrapeToCsv);
router.post("/scrape/job", startScrapeJob);
router.get("/scrape/job/:jobId", getScrapeJobStatus);
router.get("/from-csv", getProductsFromCsv);
router.get("/csv/latest", downloadLatestCsv);
router.get("/", getProducts);

module.exports = router;
