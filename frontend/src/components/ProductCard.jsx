import { memo, useEffect, useState } from "react";
import { FiExternalLink, FiStar } from "react-icons/fi";

const PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="400" viewBox="0 0 320 400"><rect fill="#1e293b" width="320" height="400"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-family="system-ui" font-size="14">No image</text></svg>'
  );

function ProductCard({ product }) {
  const [imgSrc, setImgSrc] = useState(product.imageUrl || PLACEHOLDER);

  useEffect(() => {
    setImgSrc(product.imageUrl || PLACEHOLDER);
  }, [product.imageUrl]);

  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 shadow-xl shadow-black/20 transition duration-300 hover:-translate-y-1 hover:border-indigo-500/40 hover:shadow-indigo-900/20">
      <div className="aspect-[4/5] overflow-hidden bg-slate-800">
        <img
          src={imgSrc}
          alt={product.name || "Product image"}
          loading="eager"
          referrerPolicy="no-referrer"
          decoding="async"
          onError={() => setImgSrc(PLACEHOLDER)}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      </div>

      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="truncate text-sm font-semibold uppercase tracking-wide text-indigo-200">
            {product.brand || "Unknown Brand"}
          </h3>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-1 text-xs text-amber-300">
            <FiStar className="text-[11px]" />
            {product.rating || "N/A"}
          </span>
        </div>
        <p className="min-h-10 text-sm text-slate-200">
          <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
            {product.name || "Untitled Product"}
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold text-emerald-300">{product.price || "-"}</span>
          {product.originalPrice ? (
            <span className="text-sm text-slate-500 line-through">{product.originalPrice}</span>
          ) : null}
          {product.discount ? (
            <span className="rounded-full bg-emerald-900/40 px-2 py-0.5 text-xs text-emerald-300">
              {product.discount}
            </span>
          ) : null}
        </div>
        <a
          href={product.productUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-100 transition hover:border-indigo-400 hover:bg-indigo-500/15"
        >
          View Product
          <FiExternalLink />
        </a>
      </div>
    </article>
  );
}

export default memo(ProductCard);
