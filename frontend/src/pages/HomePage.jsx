import UrlInputForm from "../components/UrlInputForm";
import LoadingState from "../components/LoadingState";
import ErrorState from "../components/ErrorState";
import ProductGrid from "../components/ProductGrid";
import ProductGridSkeleton from "../components/ProductGridSkeleton";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { FiDownload, FiRotateCw } from "react-icons/fi";

function HomePage({
  url,
  onUrlChange,
  onFetchProducts,
  onRetryFetch,
  onClearProducts,
  onDownloadCsv,
  loading,
  error,
  statusText,
  progress,
  meta,
  products,
  isSuccess,
}) {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <section className="rounded-2xl border border-slate-800 bg-panel/70 p-6 shadow-2xl shadow-black/20 backdrop-blur-sm sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 text-xs uppercase tracking-widest text-indigo-300">
                Ecommerce Product Fetcher
              </p>
              <h2 className="text-2xl font-semibold text-white sm:text-3xl">
                Scrape, export and review category products
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Flow: scrape writes <span className="font-mono text-slate-300">products.csv</span>{" "}
                first, then the app loads rows from that file for the grid (avoids long-request
                timeouts).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-200">
                Products: {products.length}
              </span>
              <span
                className={`rounded-full border px-3 py-1 text-xs ${
                  loading
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                    : isSuccess
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                    : "border-slate-700 bg-slate-800/40 text-slate-300"
                }`}
              >
                {loading ? "Scraping in progress" : isSuccess ? "Completed" : "Idle"}
              </span>
            </div>
          </div>

          <div className="mt-8">
            <UrlInputForm
              url={url}
              onChange={onUrlChange}
              onSubmit={onFetchProducts}
              loading={loading}
              onClear={onClearProducts}
              hasProducts={products.length > 0}
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onRetryFetch}
              disabled={loading || !url}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-100 transition hover:border-indigo-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiRotateCw />
              Retry Fetch
            </button>
            <button
              type="button"
              onClick={onDownloadCsv}
              disabled={loading || !meta?.csvDownloadPath}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiDownload />
              Download CSV
            </button>
          </div>

          {loading ? <LoadingState statusText={statusText} progress={progress} /> : null}
          <ErrorState message={error} />

          {isSuccess && !loading ? (
            <div className="mt-6 animate-fadeIn rounded-xl border border-emerald-700/40 bg-emerald-900/20 p-4 text-sm text-emerald-200">
              Fetch complete. CSV ready at <span className="font-mono">{meta?.csvPath}</span>.
              {meta?.summary ? (
                <div className="mt-3 grid gap-2 text-emerald-100 sm:grid-cols-2">
                  <div>Total scraped: {meta.summary.totalScraped ?? products.length}</div>
                  <div>CSV files created: {meta.summary.csvFilesCreated ?? 0}</div>
                  <div>Failed: {meta.summary.failed ?? 0}</div>
                  <div>Time taken: {meta.summary.timeTakenMs ? `${Math.round(meta.summary.timeTakenMs / 60000)} min` : "n/a"}</div>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        {loading ? <ProductGridSkeleton /> : null}
        {!loading && isSuccess && products.length > 0 ? (
          <ProductGrid products={products} />
        ) : null}
        {!loading && isSuccess && products.length === 0 ? (
          <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/70 p-6 text-slate-300">
            No products were returned for this URL.
          </div>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}

export default HomePage;
