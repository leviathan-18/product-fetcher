function Navbar() {
  return (
    <nav className="border-b border-slate-800 bg-slate-950/60 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
            <span className="text-lg font-bold text-white">P</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Product Fetcher</h1>
            <p className="text-xs text-slate-400">Scrape & Export</p>
          </div>
        </div>
        <div className="text-right text-sm text-slate-400">
          <p className="text-xs uppercase tracking-widest text-slate-500">v1.0</p>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
