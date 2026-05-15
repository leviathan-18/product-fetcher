const { scrapeProducts } = require("../services/scraperService");
const { createProductsCsv } = require("../utils/csvGenerator");
const { readLatestProductsCsv } = require("../utils/csvReader");
const { validateCategoryUrl } = require("../utils/validators");
const { randomUUID } = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  SCRAPE_LIMIT,
  SCRAPE_REQUEST_TIMEOUT_MS,
} = require("../config/constants");
const { createAppError } = require("../utils/helpers");
const { createJob, getJob, updateJob } = require("../utils/scrapeJobStore");

function createJobId() {
  return typeof randomUUID === "function" ? randomUUID() : `job-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function applyProgressToJob(jobId, progress) {
  const total = Number(progress.total || progress.totalLinks || progress.totalScraped || 0);
  const current = Number(progress.current || progress.loadedCount || progress.afterCount || 0);
  const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  updateJob(jobId, {
    phase: progress.phase || "running",
    message: progress.message || "",
    currentProductName: progress.currentProductName || "",
    loadedCount: progress.loadedCount ?? progress.afterCount ?? current,
    totalLinks: progress.totalLinks ?? progress.total ?? total,
    totalScraped: progress.totalScraped ?? null,
    csvFilesCreated: progress.csvFilesCreated ?? 0,
    failedCount: progress.failedCount ?? 0,
    skippedCount: progress.skippedCount ?? 0,
    lastCsvFile: progress.lastCsvFile || null,
    beforeCount: progress.beforeCount ?? null,
    afterCount: progress.afterCount ?? null,
    current: progress.current ?? null,
    total: progress.total ?? total,
    progressPercent: percent,
  });
}

async function runScrapeJob(jobId, url) {
  const startedAt = Date.now();
  updateJob(jobId, {
    status: "running",
    phase: "starting",
    startedAt: new Date(startedAt).toISOString(),
    message: "Starting scrape job...",
  });

  try {
    const products = await scrapeProducts(url, SCRAPE_LIMIT, {
      batchSize: 150,
      onProgress: (progress) => applyProgressToJob(jobId, progress),
    });

    if (!products.length) {
      throw createAppError("No products found for the provided URL.", 404);
    }

    const csvInfo = await createProductsCsv(products);
    const durationMs = Date.now() - startedAt;
    updateJob(jobId, {
      status: "completed",
      phase: "completed",
      message: "Scrape completed successfully.",
      completedAt: new Date().toISOString(),
      durationMs,
      count: products.length,
      csvFileName: csvInfo.fileName,
      csvPath: csvInfo.filePath,
      csvDownloadPath: "/api/products/csv/latest",
      fromCsvPath: "/api/products/from-csv",
      summary: {
        totalScraped: products.length,
        csvFilesCreated: getJob(jobId)?.csvFilesCreated || 0,
        failed: getJob(jobId)?.failedCount || 0,
        skipped: getJob(jobId)?.skippedCount || 0,
        timeTakenMs: durationMs,
      },
    });
  } catch (error) {
    updateJob(jobId, {
      status: "failed",
      phase: "failed",
      message: error.message || "Scrape failed.",
      completedAt: new Date().toISOString(),
      errorMessage: error.message || "Scrape failed.",
    });
  }
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(createAppError("Scrape request timed out.", 504));
      }, timeoutMs);
    }),
  ]);
}

/**
 * Step 1: scrape category, write CSV only (no large JSON body — avoids client timeouts).
 * Client should then call GET /api/products/from-csv to load rows for the UI.
 */
async function scrapeToCsv(req, res, next) {
  const startedAt = Date.now();
  try {
    const { url } = req.query;

    if (!validateCategoryUrl(url)) {
      return res.status(400).json({
        success: false,
        status: "failed",
        message: "Invalid URL. Please provide a valid ecommerce category URL.",
      });
    }

    const products = await withTimeout(
      scrapeProducts(url, SCRAPE_LIMIT),
      SCRAPE_REQUEST_TIMEOUT_MS
    );

    if (!products.length) {
      return res.status(404).json({
        success: false,
        status: "empty",
        message: "No products found for the provided URL.",
      });
    }

    const csvInfo = await createProductsCsv(products);
    const durationMs = Date.now() - startedAt;
    console.log(
      `[scrape:csv-only] count=${products.length} durationMs=${durationMs} csv=${csvInfo.fileName}`
    );

    return res.status(200).json({
      success: true,
      message:
        "CSV generated successfully. Load products with GET /api/products/from-csv",
      status: "csv_ready",
      meta: {
        count: products.length,
        limit: SCRAPE_LIMIT,
        durationMs,
        sourceUrl: url,
        generatedAt: new Date().toISOString(),
        csvFileName: csvInfo.fileName,
        csvPath: csvInfo.filePath,
        csvDownloadPath: "/api/products/csv/latest",
        fromCsvPath: "/api/products/from-csv",
      },
    });
  } catch (error) {
    console.error(`[scrape:csv-only:error] ${error.message}`);
    return next(error);
  }
}

/**
 * Step 2: read latest products.csv and return JSON for the frontend grid.
 */
async function getProductsFromCsv(_req, res, next) {
  try {
    const { filePath, products, error } = await readLatestProductsCsv();

    if (error === "missing") {
      return res.status(404).json({
        success: false,
        status: "failed",
        message:
          "No CSV yet. Run a scrape first (GET /api/products/scrape?url=...).",
      });
    }

    if (error === "empty" || !products.length) {
      return res.status(404).json({
        success: false,
        status: "empty",
        message: "CSV file is empty. Run a scrape first.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Products loaded from CSV.",
      status: "completed",
      meta: {
        count: products.length,
        limit: SCRAPE_LIMIT,
        source: "csv",
        csvPath: filePath,
        csvDownloadPath: "/api/products/csv/latest",
      },
      products,
    });
  } catch (error) {
    console.error(`[csv:read:error] ${error.message}`);
    return next(error);
  }
}

/**
 * Legacy: scrape + CSV + return products in one response (large payload; shorter runs only).
 */
async function getProducts(req, res, next) {
  const startedAt = Date.now();
  try {
    const { url } = req.query;

    if (!validateCategoryUrl(url)) {
      return res.status(400).json({
        success: false,
        status: "failed",
        message: "Invalid URL. Please provide a valid ecommerce category URL.",
      });
    }

    const products = await withTimeout(
      scrapeProducts(url, SCRAPE_LIMIT),
      SCRAPE_REQUEST_TIMEOUT_MS
    );

    if (!products.length) {
      return res.status(404).json({
        success: false,
        status: "empty",
        message: "No products found for the provided URL.",
      });
    }

    const csvInfo = await createProductsCsv(products);
    const durationMs = Date.now() - startedAt;
    console.log(
      `[scrape:success] count=${products.length} durationMs=${durationMs} csv=${csvInfo.fileName}`
    );

    return res.status(200).json({
      success: true,
      message: "Products scraped and CSV generated successfully.",
      status: "completed",
      meta: {
        count: products.length,
        limit: SCRAPE_LIMIT,
        durationMs,
        sourceUrl: url,
        generatedAt: new Date().toISOString(),
        csvFileName: csvInfo.fileName,
        csvPath: csvInfo.filePath,
        csvDownloadPath: "/api/products/csv/latest",
        fromCsvPath: "/api/products/from-csv",
      },
      products,
    });
  } catch (error) {
    console.error(`[scrape:error] ${error.message}`);
    return next(error);
  }
}

async function startScrapeJob(req, res) {
  const { url } = req.body || {};

  if (!validateCategoryUrl(url)) {
    return res.status(400).json({
      success: false,
      status: "failed",
      message: "Invalid URL. Please provide a valid ecommerce category URL.",
    });
  }

  const jobId = createJobId();
  createJob({
    jobId,
    url,
    status: "queued",
    phase: "queued",
    message: "Job queued.",
    progressPercent: 0,
    loadedCount: 0,
    totalLinks: 0,
    csvFilesCreated: 0,
    failedCount: 0,
    skippedCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  setImmediate(() => {
    void runScrapeJob(jobId, url);
  });

  return res.status(202).json({
    success: true,
    message: "Scrape job started.",
    jobId,
    statusUrl: `/api/products/scrape/job/${jobId}`,
  });
}

async function getScrapeJobStatus(req, res) {
  const { jobId } = req.params;
  const job = getJob(jobId);
  if (!job) {
    return res.status(404).json({
      success: false,
      status: "failed",
      message: "Scrape job not found.",
    });
  }
  return res.status(200).json({ success: true, job });
}

function downloadLatestCsv(_req, res, next) {
  // Match the path used by csvGenerator.js: path.join(__dirname, "..", fileName)
  // Since this is in controllers/, __dirname is backend/controllers, so .. is backend
  const backendDir = path.join(__dirname, "..");
  const filePath = path.join(backendDir, "products.csv");
  if (!fs.existsSync(filePath)) {
    console.log(`[csv:download] file not found at ${filePath}`);
    return next(createAppError("CSV file is not available yet. Run a scrape first.", 404));
  }
  return res.download(filePath, "products.csv");
}

module.exports = {
  getProducts,
  scrapeToCsv,
  getProductsFromCsv,
  startScrapeJob,
  getScrapeJobStatus,
  downloadLatestCsv,
};
