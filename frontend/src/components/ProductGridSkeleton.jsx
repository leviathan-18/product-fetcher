function ProductGridSkeleton() {
  return (
    <section className="mt-8">
      <div className="mb-4 h-6 w-52 animate-pulse rounded bg-slate-800" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={`skeleton-${index}`}
            className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70"
          >
            <div className="aspect-[4/5] animate-pulse bg-slate-800" />
            <div className="space-y-2 p-4">
              <div className="h-3 w-1/3 animate-pulse rounded bg-slate-700" />
              <div className="h-3 w-4/5 animate-pulse rounded bg-slate-700" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-slate-700" />
              <div className="h-8 w-full animate-pulse rounded bg-slate-800" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default ProductGridSkeleton;
