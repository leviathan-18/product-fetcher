import { memo } from "react";
import ProductCard from "./ProductCard";

function ProductGrid({ products }) {
  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Fetched Products</h2>
        <span className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-200">
          {products.length} items
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product, index) => (
          <ProductCard
            key={`${product.productUrl || "url"}-${index}`}
            product={product}
          />
        ))}
      </div>
    </section>
  );
}

export default memo(ProductGrid);
