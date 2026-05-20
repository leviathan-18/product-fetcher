const fs = require("fs/promises");
const path = require("path");
const { parse } = require("csv-parse/sync");

const CSV_FIELDS = ["name", "price", "rating", "description", "imageUrl", "productUrl"];

async function readLatestProductsCsv() {
  const filePath = path.join(__dirname, "..", "products.csv");
  let raw;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") {
      return { filePath, products: [], error: "missing" };
    }
    throw err;
  }

  if (!raw.trim()) {
    return { filePath, products: [], error: "empty" };
  }

  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  const products = rows.map((row) => ({
    name: row.name || "",
    brand: row.brand || "",
    price: row.price || "",
    originalPrice: row.originalPrice || "",
    discount: row.discount || "",
    rating: row.rating || "",
    description: row.description || "",
    imageUrl: row.imageUrl || "",
    productUrl: row.productUrl || "",
  }));

  return { filePath, products, fields: CSV_FIELDS };
}

module.exports = {
  readLatestProductsCsv,
};
