function safeString(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function brandToString(brand) {
  if (!brand) return "";
  if (typeof brand === "string") return safeString(brand);
  return safeString(brand.name || brand.brandName || brand.title);
}

function priceToString(price) {
  if (price == null) return "";
  if (typeof price === "string" || typeof price === "number") {
    return safeString(price);
  }
  if (typeof price === "object") {
    return safeString(
      price.discounted ||
        price.selling ||
        price.sellingPrice ||
        price.discountedPrice ||
        price.price ||
        price.mrp
    );
  }
  return "";
}

function originalPriceToString(rawProduct, priceObj) {
  const direct = safeString(
    rawProduct?.originalPrice || rawProduct?.mrp || rawProduct?.listPrice
  );
  if (direct) return direct;
  if (priceObj && typeof priceObj === "object") {
    return safeString(priceObj.mrp || priceObj.original || priceObj.regular);
  }
  return "";
}

function isBadImageCandidate(url) {
  const u = safeString(url).toLowerCase();
  if (!u) return true;
  if (u.startsWith("data:")) return true;
  if (u.includes("placeholder")) return true;
  if (u.includes("pixel.gif") || u.includes("1x1")) return true;
  if (u.includes("blank")) return true;
  return false;
}

function firstImageFromImages(images) {
  if (!Array.isArray(images) || !images.length) {
    return "";
  }
  for (const entry of images) {
    if (!entry) continue;
    if (typeof entry === "string" && !isBadImageCandidate(entry)) {
      return entry;
    }
    if (typeof entry === "object") {
      const url =
        entry.src ||
        entry.imageUrl ||
        entry.url ||
        entry.imageURL ||
        entry.image;
      if (!isBadImageCandidate(url)) {
        return safeString(url);
      }
    }
  }
  return "";
}

function pickImageUrl(rawProduct) {
  const directCandidates = [
    rawProduct?.searchImage,
    rawProduct?.imageUrl,
    rawProduct?.image,
    rawProduct?.displayImage,
    rawProduct?.thumbnail,
    rawProduct?.productImage,
    rawProduct?.primaryImage,
    rawProduct?.assets?.[0]?.path,
    rawProduct?.assets?.[0]?.url,
    rawProduct?.media?.[0]?.url,
    rawProduct?.productImages?.[0],
  ];
  for (const candidate of directCandidates) {
    const s = safeString(candidate);
    if (s && !isBadImageCandidate(s)) {
      return s;
    }
  }
  const fromImages = firstImageFromImages(rawProduct?.images);
  if (fromImages) {
    return fromImages;
  }
  return "";
}

function toAbsoluteUrl(url, baseUrl) {
  const candidate = safeString(url);
  if (!candidate) {
    return "";
  }
  const normalized =
    candidate.startsWith("//") ? `https:${candidate}` : candidate;
  try {
    return new URL(normalized, baseUrl || "https://www.myntra.com").toString();
  } catch (_error) {
    return "";
  }
}

function normalizeProduct(rawProduct, baseUrl = "") {
  const priceObj = rawProduct?.price;
  const brandStr = brandToString(rawProduct?.brand) || safeString(rawProduct?.brandName);
  const priceStr =
    priceToString(priceObj) ||
    safeString(rawProduct?.discountedPrice || rawProduct?.sellingPrice);
  const imageRaw = pickImageUrl(rawProduct);

  return {
    name: safeString(
      rawProduct?.name || rawProduct?.productName || rawProduct?.title
    ),
    brand: brandStr,
    price: priceStr,
    originalPrice: originalPriceToString(rawProduct, priceObj),
    discount: safeString(
      rawProduct?.discount || rawProduct?.discountLabel || rawProduct?.offer
    ),
    rating: safeString(
      rawProduct?.rating ||
        rawProduct?.averageRating ||
        rawProduct?.ratings?.averageRating
    ),
    imageUrl: toAbsoluteUrl(imageRaw, baseUrl),
    productUrl: toAbsoluteUrl(
      rawProduct?.productUrl ||
        rawProduct?.url ||
        rawProduct?.landingUrl ||
        rawProduct?.landingPageUrl,
      baseUrl || "https://www.myntra.com"
    ),
  };
}

module.exports = {
  normalizeProduct,
};
