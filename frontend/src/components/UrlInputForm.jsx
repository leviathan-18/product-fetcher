import { FiLink2 } from "react-icons/fi";

function UrlInputForm({ url, onChange, onSubmit, loading, onClear, hasProducts }) {
  return (
    <form onSubmit={onSubmit} className="w-full space-y-4">
      <label htmlFor="categoryUrl" className="block text-sm text-slate-300">
        Ecommerce category URL
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <FiLink2 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="categoryUrl"
            type="url"
            required
            value={url}
            onChange={(event) => onChange(event.target.value)}
            placeholder="https://www.myntra.com/men-shirts"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 py-3 pl-10 pr-4 text-slate-100 outline-none transition focus:border-indigo-400"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-indigo-500 px-5 py-3 font-medium text-white shadow-lg shadow-indigo-700/30 transition hover:-translate-y-0.5 hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Fetching..." : "Fetch Products"}
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={loading || !hasProducts}
          className="rounded-xl border border-slate-700 px-5 py-3 font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Clear Products
        </button>
      </div>
    </form>
  );
}

export default UrlInputForm;
