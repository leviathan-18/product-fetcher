function parseNextDataFromHtml(html) {
  if (typeof html !== "string") {
    return null;
  }
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
  );
  if (!match) {
    return null;
  }
  try {
    return JSON.parse(match[1]);
  } catch (_error) {
    return null;
  }
}

function looksLikeProductRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const hasId =
    value.styleid != null ||
    value.styleId != null ||
    value.productId != null ||
    value.id != null;
  const hasName =
    value.productName != null ||
    value.name != null ||
    value.title != null;
  const hasCommerceSignals =
    value.searchImage != null ||
    value.landingUrl != null ||
    value.brand != null ||
    value.price != null ||
    value.discountedPrice != null ||
    value.mrp != null ||
    (Array.isArray(value.images) && value.images.length > 0);
  return (hasId || hasCommerceSignals) && hasName;
}

function findBestProductArray(node, depth = 0, best = { length: 0, items: null }) {
  if (!node || depth > 14) {
    return best;
  }
  if (Array.isArray(node)) {
    if (node.length > best.length && node.length > 0 && looksLikeProductRecord(node[0])) {
      best = { length: node.length, items: node };
    }
    for (const child of node) {
      best = findBestProductArray(child, depth + 1, best);
    }
    return best;
  }
  if (typeof node === "object") {
    for (const value of Object.values(node)) {
      best = findBestProductArray(value, depth + 1, best);
    }
  }
  return best;
}

function extractFromKnownPaths(payload) {
  const paths = [
    payload?.products,
    payload?.data?.products,
    payload?.items,
    payload?.data?.items,
    payload?.searchData?.results?.products,
    payload?.results?.products,
    payload?.props?.pageProps?.catalogSSR?.products,
    payload?.props?.pageProps?.catalogResponse?.products,
    payload?.props?.pageProps?.searchData?.products,
    payload?.props?.pageProps?.categoryData?.products,
    payload?.props?.pageProps?.products,
    payload?.catalogSSR?.products,
    payload?.catalogResponse?.products,
  ];

  for (const candidate of paths) {
    if (Array.isArray(candidate) && candidate.length) {
      return candidate;
    }
  }
  return null;
}

function readPaginationHint(payload) {
  const blocks = [
    payload?.props?.pageProps?.catalogSSR?.pagination,
    payload?.props?.pageProps?.catalogResponse?.pagination,
    payload?.props?.pageProps?.categoryData?.pagination,
    payload?.catalogSSR?.pagination,
    payload?.pagination,
  ].filter(Boolean);

  for (const block of blocks) {
    if (block && typeof block === "object") {
      return block;
    }
  }
  return null;
}

function normalizePayloadInput(data) {
  if (data == null) {
    return null;
  }
  if (typeof data === "string") {
    const lower = data.toLowerCase();
    if (lower.includes("<html")) {
      const next = parseNextDataFromHtml(data);
      return next || null;
    }
    return null;
  }
  return data;
}

module.exports = {
  parseNextDataFromHtml,
  extractFromKnownPaths,
  findBestProductArray,
  readPaginationHint,
  normalizePayloadInput,
};
