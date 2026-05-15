import axios from "axios";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

/** Scrape + CSV can take several minutes; must exceed backend SCRAPE_REQUEST_TIMEOUT_MS. */
const SCRAPE_CLIENT_TIMEOUT_MS = Number(
  import.meta.env.VITE_SCRAPE_TIMEOUT_MS || 900000
);

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
});

const scrapeClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: SCRAPE_CLIENT_TIMEOUT_MS,
});

/**
 * Step 1: scrape category and write `products.csv` (response has meta only, no product array).
 */
export async function scrapeCategoryToCsv(categoryUrl) {
  const response = await scrapeClient.get("/api/products/scrape", {
    params: { url: categoryUrl },
  });
  return response.data;
}

export async function startScrapeJob(categoryUrl) {
  const response = await apiClient.post("/api/products/scrape/job", {
    url: categoryUrl,
  });
  return response.data;
}

export async function getScrapeJobStatus(jobId) {
  const response = await apiClient.get(`/api/products/scrape/job/${jobId}`);
  return response.data;
}

/**
 * Step 2: load products from latest `products.csv` for the grid.
 */
export async function loadProductsFromCsv() {
  const response = await apiClient.get("/api/products/from-csv");
  return response.data;
}

/** @deprecated Prefer scrapeCategoryToCsv + loadProductsFromCsv */
export async function fetchProductsByUrl(categoryUrl) {
  const response = await scrapeClient.get("/api/products", {
    params: { url: categoryUrl },
  });
  return response.data;
}

export function getCsvDownloadUrl() {
  return `${API_BASE_URL}/api/products/csv/latest`;
}
