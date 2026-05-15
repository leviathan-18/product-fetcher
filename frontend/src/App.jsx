import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import HomePage from "./pages/HomePage";
import {
  loadProductsFromCsv,
  getCsvDownloadUrl,
  startScrapeJob,
  getScrapeJobStatus,
} from "./api/productsApi";

function getApiErrorMessage(error) {
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  if (error.code === "ECONNABORTED") {
    return "Request timed out. Please try another URL.";
  }
  return "Failed to fetch products. Please check backend server status.";
}

function App() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusText, setStatusText] = useState("Preparing scraper...");
  const [meta, setMeta] = useState(null);
  const [products, setProducts] = useState([]);
  const [jobId, setJobId] = useState("");
  const [progress, setProgress] = useState(null);
  const pollRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const syncStatusFromJob = useCallback((job) => {
    if (!job) return;
    setProgress(job);
    setStatusText(job.message || job.phase || "Working...");
  }, []);

  const finishJob = useCallback(async (job) => {
    stopPolling();
    syncStatusFromJob(job);
    setStatusText(job?.message || "Loading results...");
    const csvData = await loadProductsFromCsv();
    setProducts(csvData.products || []);
    setMeta({
      ...(job || {}),
      ...(csvData.meta || {}),
      loadedFromCsv: true,
      jobId,
    });
    setLoading(false);
  }, [jobId, stopPolling, syncStatusFromJob]);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  useEffect(() => {
    if (!jobId) return undefined;

    pollRef.current = setInterval(async () => {
      try {
        const response = await getScrapeJobStatus(jobId);
        const job = response.job;
        syncStatusFromJob(job);

        if (job?.status === "completed") {
          await finishJob(job);
        }

        if (job?.status === "failed") {
          stopPolling();
          setError(job.errorMessage || job.message || "Failed to fetch products.");
          setLoading(false);
        }
      } catch (pollError) {
        stopPolling();
        setError(getApiErrorMessage(pollError));
        setStatusText("Failed");
        setLoading(false);
      }
    }, 2000);

    return () => stopPolling();
  }, [finishJob, jobId, stopPolling, syncStatusFromJob]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError("");
    setMeta(null);
    setProducts([]);
    setProgress(null);
    setStatusText(
      "Starting infinite-scroll scrape job..."
    );

    try {
      const response = await startScrapeJob(url);
      setJobId(response.jobId);
      setStatusText("Job queued. Waiting for first batch...");
    } catch (apiError) {
      setError(getApiErrorMessage(apiError));
      setStatusText("Failed");
      setLoading(false);
    } finally {
      // keep loading true while the job is running; polling will stop it on completion/failure
    }
  }, [url]);

  async function handleFetchProducts(event) {
    event.preventDefault();
    if (!url) return;
    await fetchProducts();
  }

  const handleRetryFetch = useCallback(async () => {
    if (!url || loading) return;
    await fetchProducts();
  }, [fetchProducts, loading, url]);

  const handleClearProducts = useCallback(() => {
    setProducts([]);
    setMeta(null);
    setError("");
    setProgress(null);
    setStatusText("Preparing scraper...");
    setJobId("");
  }, []);

  const handleDownloadCsv = useCallback(() => {
    window.open(getCsvDownloadUrl(), "_blank", "noopener,noreferrer");
  }, []);

  const isSuccess = useMemo(
    () => Boolean(meta && !loading && !error),
    [meta, loading, error]
  );

  return (
    <HomePage
      url={url}
      onUrlChange={setUrl}
      onFetchProducts={handleFetchProducts}
      onRetryFetch={handleRetryFetch}
      onClearProducts={handleClearProducts}
      onDownloadCsv={handleDownloadCsv}
      loading={loading}
      error={error}
      statusText={statusText}
      progress={progress}
      meta={meta}
      products={products}
      isSuccess={isSuccess}
    />
  );
}

export default App;
