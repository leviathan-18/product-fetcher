import axios from "axios";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

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

export async function loadProductsFromCsv() {
  const response = await apiClient.get("/api/products/from-csv");
  return response.data;
}

export async function fetchProductsByUrl(categoryUrl) {
  const response = await scrapeClient.get("/api/products", {
    params: { url: categoryUrl },
  });
  return response.data;
}

export function getCsvDownloadUrl() {
  return `${API_BASE_URL}/api/products/csv/latest`;
}
