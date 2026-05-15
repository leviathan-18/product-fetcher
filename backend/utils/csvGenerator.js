const fs = require("fs/promises");
const path = require("path");
const { Parser } = require("json2csv");

function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function createProductsCsv(products, options = {}) {
  const fields = [
    "name",
    "price",
    "rating",
    "description",
    "imageUrl",
    "productUrl",
  ];
  const parser = new Parser({ fields });
  const csv = parser.parse(products);

  const fileName = options.fileName || `products-${getTimestamp()}.csv`;
  const writeLatest = options.writeLatest !== false;
  // Write CSVs into the backend folder so paths are consistent regardless
  // of the process working directory used to start the server.
  const filePath = path.join(__dirname, "..", fileName);
  const latestPath = path.join(__dirname, "..", "products.csv");
  await fs.writeFile(filePath, csv, "utf8");
  if (writeLatest) {
    // Keep a stable latest file for easy download button integration.
    await fs.writeFile(latestPath, csv, "utf8");
  }

  return {
    fileName,
    filePath,
    latestPath,
    totalRows: products.length,
  };
}

module.exports = {
  createProductsCsv,
};
