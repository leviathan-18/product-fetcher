import { FiLoader } from "react-icons/fi";

function LoadingState({ statusText, progress }) {
  const percent = Math.max(0, Math.min(100, progress?.progressPercent ?? 0));
  const phaseLabel =
    progress?.phase === "scrolling"
      ? `Scrolling... ${progress?.loadedCount || 0} products loaded so far`
      : progress?.phase === "scroll_complete"
      ? `Scroll complete! Total ${progress?.totalLinks || 0} products found.`
      : progress?.phase === "scraping"
      ? `Scraping product ${progress?.current || 0} of ${progress?.total || 0}: ${progress?.currentProductName || ""}`
      : progress?.phase === "completed"
      ? `Total scraped: ${progress?.totalScraped || 0}`
      : statusText;

  return (
    <div className="mt-8 rounded-xl border border-indigo-800/40 bg-slate-900/70 p-6">
      <div className="flex items-center gap-3">
        <FiLoader className="animate-spin text-xl text-indigo-300" />
        <p className="text-slate-100">{phaseLabel}</p>
      </div>
      <p className="mt-2 text-sm text-slate-400">
        Live progress comes from the backend job while products scroll, scrape, and save in
        batches.
      </p>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-indigo-400 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
        <div>
          <span className="text-slate-500">Products loaded:</span> {progress?.loadedCount ?? 0}
        </div>
        <div>
          <span className="text-slate-500">CSV files saved:</span> {progress?.csvFilesCreated ?? 0}
        </div>
        <div>
          <span className="text-slate-500">Failed:</span> {progress?.failedCount ?? 0}
        </div>
        <div>
          <span className="text-slate-500">Skipped:</span> {progress?.skippedCount ?? 0}
        </div>
      </div>
      {progress?.lastCsvFile ? (
        <p className="mt-4 text-sm text-emerald-300">
          CSV saved so far: <span className="font-mono">{progress.lastCsvFile}</span>
        </p>
      ) : null}
      {progress?.message ? (
        <p className="mt-2 text-sm text-slate-400">{progress.message}</p>
      ) : null}
      {progress?.phase === "completed" ? (
        <div className="mt-4 rounded-lg border border-emerald-700/40 bg-emerald-900/20 p-3 text-emerald-200">
          Final summary: Total scraped {progress.totalScraped || 0}, CSV files created {progress.csvFilesCreated || 0}, Failed {progress.failedCount || 0}.
        </div>
      ) : null}
    </div>
  );
}

export default LoadingState;
