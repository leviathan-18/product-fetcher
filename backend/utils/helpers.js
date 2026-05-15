function createAppError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(callback, retries = 2, retryDelayMs = 400) {
  let attempts = 0;
  let lastError;

  while (attempts <= retries) {
    try {
      return await callback();
    } catch (error) {
      lastError = error;
      attempts += 1;
      if (attempts > retries) {
        break;
      }
      await delay(retryDelayMs);
    }
  }

  throw lastError;
}

function extractStyleIdFromProductUrl(url) {
  const match = String(url || "").match(/\/(\d{5,})\/buy(?:\?|$)/);
  return match ? match[1] : null;
}

function deduplicateProducts(products) {
  const seen = new Set();
  return products.filter((product) => {
    const styleId = extractStyleIdFromProductUrl(product.productUrl);
    const key = styleId
      ? `style:${styleId}`
      : `${product.productUrl}|${product.name}|${product.price}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

module.exports = {
  createAppError,
  delay,
  withRetry,
  deduplicateProducts,
  extractStyleIdFromProductUrl,
};
