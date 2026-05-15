const axios = require("axios");
const { normalizeProduct } = require("../utils/productMapper");
const { createProductsCsv } = require("../utils/csvGenerator");
const { launchPuppeteerBrowser } = require("../utils/puppeteerLaunch");
const {
  normalizePayloadInput,
  extractFromKnownPaths,
  findBestProductArray,
  parseNextDataFromHtml,
} = require("../utils/payloadExtract");
const {
  createAppError,
  delay,
  withRetry,
  deduplicateProducts,
  extractStyleIdFromProductUrl,
} = require("../utils/helpers");

const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 90000);
const PAGE_DELAY_MS = Number(process.env.PAGE_DELAY_MS || 200);
const MAX_PAGES = Number(process.env.MAX_PAGES || 10);
const LIST_PAGE_SIZE = Number(process.env.LIST_PAGE_SIZE || 50);

function emitProgress(onProgress, payload) {
  if (typeof onProgress === "function") {
    onProgress(payload);
  }
}

/** Listing pages needed for `limit` products at ~LIST_PAGE_SIZE per page, plus one spare. */
function getEffectiveMaxPages(limit) {
  const pagesForTarget = Math.ceil(limit / Math.max(LIST_PAGE_SIZE, 1));
  return Math.max(MAX_PAGES, pagesForTarget + 1);
}

function isMyntraUrl(url) {
  try {
    return new URL(url).hostname.includes("myntra.com");
  } catch (_e) {
    return false;
  }
}

function isWplusUrl(url) {
  try {
    return new URL(url).hostname.includes("wplus.ca");
  } catch (_e) {
    return false;
  }
}

function buildPageUrlVariants(baseUrl, page) {
  const urls = [];
  if (page <= 1) {
    urls.push(baseUrl);
    return urls;
  }

  const myntra = isMyntraUrl(baseUrl);
  // Myntra category listings usually paginate with `p=2`, `p=3`, … (page 1 = default URL).
  if (myntra) {
    const primary = new URL(baseUrl);
    primary.searchParams.set("p", String(page));
    urls.push(primary.toString());
  }

  const patterns = [
    (u) => {
      u.searchParams.set("p", String(page));
    },
    (u) => {
      u.searchParams.set("page", String(page));
    },
    (u) => {
      u.searchParams.set("pageNo", String(page));
    },
    (u) => {
      u.searchParams.set("page", String(page - 1));
    },
    (u) => {
      const offset = (page - 1) * LIST_PAGE_SIZE;
      u.searchParams.set("offset", String(offset));
    },
    (u) => {
      const offset = (page - 1) * LIST_PAGE_SIZE;
      u.searchParams.set("plaOffset", String(offset));
    },
    (u) => {
      u.searchParams.set("rows", String(LIST_PAGE_SIZE));
      u.searchParams.set("page", String(page));
    },
  ];

  for (const apply of patterns) {
    try {
      const u = new URL(baseUrl);
      apply(u);
      urls.push(u.toString());
    } catch (_e) {
      // skip invalid
    }
  }

  return [...new Set(urls)];
}

async function fetchUrl(url) {
  const response = await axios.get(url, {
    timeout: REQUEST_TIMEOUT_MS,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "application/json,text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-IN,en;q=0.9",
    },
  });

  return response.data;
}

function extractProductsFromPayload(payload, baseUrl) {
  const known = extractFromKnownPaths(payload);
  const source =
    known && known.length ? known : findBestProductArray(payload).items || [];

  return source
    .map((item) => normalizeProduct(item, baseUrl || "https://www.myntra.com"))
    .filter((product) => product.name && product.productUrl);
}

function extractProductsFromResponseData(data, baseUrl) {
  const normalizedPayload = normalizePayloadInput(data);
  if (!normalizedPayload) {
    return [];
  }
  return extractProductsFromPayload(normalizedPayload, baseUrl);
}

function catalogKeys(catalog) {
  const keys = new Set();
  for (const p of catalog) {
    const id = extractStyleIdFromProductUrl(p.productUrl);
    keys.add(id ? `id:${id}` : `url:${p.productUrl}`);
  }
  return keys;
}

/** How many rows in `candidate` are not already represented in `catalog` (by style id or URL). */
function countNewVsCatalog(candidate, catalog) {
  const keys = catalogKeys(catalog);
  let n = 0;
  for (const p of candidate) {
    const id = extractStyleIdFromProductUrl(p.productUrl);
    const k = id ? `id:${id}` : `url:${p.productUrl}`;
    if (!keys.has(k)) {
      n += 1;
    }
  }
  return n;
}

async function scrapeViaHiddenApi(categoryUrl, limit) {
  let products = [];
  const myntra = isMyntraUrl(categoryUrl);
  const pageCap = getEffectiveMaxPages(limit);
  let consecutiveEmptyPages = 0;
  const maxConsecutiveEmpty = 3;

  for (let page = 1; page <= pageCap && products.length < limit; page += 1) {
    const pageUrls =
      page === 1 ? [categoryUrl] : buildPageUrlVariants(categoryUrl, page);

    let bestBatch = [];
    let bestNew = -1;

    for (const pageUrl of pageUrls) {
      console.log(`[scrape:hidden-api] listing page=${page}/${pageCap} try url=${pageUrl}`);

      const pageProducts = await withRetry(
        async () => {
          const data = await fetchUrl(pageUrl);
          if (typeof data === "string" && data.toLowerCase().includes("<html")) {
            const next = parseNextDataFromHtml(data);
            if (!next) {
              return [];
            }
            return extractProductsFromPayload(next, categoryUrl);
          }
          return extractProductsFromResponseData(data, categoryUrl);
        },
        2,
        600
      );

      const freshCount = countNewVsCatalog(pageProducts, products);
      // Prefer the URL that yields the most *new* rows (real next listing page), not a duplicate page.
      if (
        freshCount > bestNew ||
        (freshCount === bestNew && pageProducts.length > bestBatch.length)
      ) {
        bestBatch = pageProducts;
        bestNew = freshCount;
      }

      const needMore = limit - products.length;
      if (myntra && freshCount >= Math.min(LIST_PAGE_SIZE, needMore + 10)) {
        break;
      }
    }

    if (!bestBatch.length) {
      consecutiveEmptyPages += 1;
      console.log(
        `[scrape:hidden-api] listing page=${page} no results (${consecutiveEmptyPages}/${maxConsecutiveEmpty} empty)`
      );
      if (consecutiveEmptyPages >= maxConsecutiveEmpty) {
        console.log(
          `[scrape:hidden-api] reached ${maxConsecutiveEmpty} consecutive empty pages, stopping`
        );
        break;
      }
      await delay(PAGE_DELAY_MS);
      continue;
    }

    consecutiveEmptyPages = 0; // Reset counter when we find products

    if (page > 1 && bestNew === 0) {
      console.log(
        `[scrape:hidden-api] listing page=${page} no new rows vs catalog from earlier pages, trying more pages...`
      );
      // Don't break immediately - continue trying other URL variants
    }

    const uniqueBefore = products.length;
    products.push(...bestBatch);
    products = deduplicateProducts(products);
    const newUnique = products.length - uniqueBefore;

    console.log(
      `[scrape:hidden-api] listing page=${page} batch=${bestBatch.length} uniqueTotal=${products.length} newUniqueRows=${newUnique} newRowCandidates=${bestNew}`
    );

    if (page > 1 && newUnique === 0) {
      console.log(
        `[scrape:hidden-api] listing page=${page} merged batch added no unique products, continuing to try more...`
      );
      // Continue to next page instead of breaking - may find duplicates initially but new products later
    }

    await delay(PAGE_DELAY_MS);
  }

  return products.slice(0, limit);
}

async function autoScrollPage(page) {
  await page.evaluate(
    async () => {
      await new Promise((resolve) => {
        let y = 0;
        const step = Math.max(300, Math.floor(window.innerHeight * 0.85));
        const id = setInterval(() => {
          window.scrollBy(0, step);
          y += step;
          if (y > document.body.scrollHeight) {
            clearInterval(id);
            resolve();
          }
        }, 120);
        setTimeout(() => {
          clearInterval(id);
          resolve();
        }, 8000);
      });
    },
    { timeout: 120000 } // 2 minutes for page scroll
  );
}

async function extractProductCardsFromDom(page) {
  return page.evaluate(
    () => {
      function cleanUrl(u) {
      if (!u) return "";
      const t = String(u).trim();
      if (!t) return "";
      const low = t.toLowerCase();
      if (low.includes("1x1") || low.includes("pixel.gif") || low.startsWith("data:")) {
        return "";
      }
      return t;
    }

    function readCardImage(card) {
      const img = card.querySelector("img");
      if (img) {
        const fromData = cleanUrl(
          img.getAttribute("data-src") || img.getAttribute("data-lazy-src")
        );
        if (fromData) return fromData;
        const srcset = img.getAttribute("srcset");
        if (srcset) {
          const first = srcset.split(",")[0]?.trim().split(/\s+/)[0];
          const c = cleanUrl(first);
          if (c) return c;
        }
        const fromSrc = cleanUrl(img.getAttribute("src"));
        if (fromSrc) return fromSrc;
      }
      const styled = card.querySelector("[style*=\"background-image\"]");
      const st = styled?.getAttribute("style") || "";
      const m = st.match(/url\(["']?([^"')]+)["']?\)/i);
      return cleanUrl(m ? m[1] : "");
    }

    const schemaProducts = Array.from(
      document.querySelectorAll('[itemtype*="Product"]')
    );
    if (schemaProducts.length) {
      return schemaProducts.map((node) => ({
        name:
          node.querySelector('[itemprop="name"]')?.textContent?.trim() || "",
        brand:
          node.querySelector('[itemprop="brand"]')?.textContent?.trim() || "",
        price:
          node.querySelector('[itemprop="price"]')?.getAttribute("content") || "",
        originalPrice: "",
        discount: "",
        rating:
          node.querySelector('[itemprop="ratingValue"]')?.textContent?.trim() || "",
        imageUrl:
          readCardImage(node) ||
          cleanUrl(node.querySelector('[itemprop="image"]')?.getAttribute("src")),
        productUrl:
          node.querySelector("a")?.getAttribute("href") || window.location.href,
      }));
    }

    const cards = Array.from(
      document.querySelectorAll(
        "li.product-base, .product-card, .product-item, [data-productid]"
      )
    );
    return cards.map((card) => {
      const name =
        card.querySelector(".product-product, .product-name, .name")?.textContent ||
        "";
      const brand =
        card.querySelector(".product-brand, .brand")?.textContent || "";
      const price =
        card.querySelector(".product-discountedPrice, .price, .selling-price")
          ?.textContent || "";
      const originalPrice =
        card.querySelector(".product-strike, .original-price, .mrp")?.textContent ||
        "";
      const discount =
        card.querySelector(".product-discountPercentage, .discount")?.textContent ||
        "";
      const rating =
        card.querySelector(".product-ratingsContainer, .rating")?.textContent || "";
      const imageUrl = readCardImage(card);
      const productUrl =
        card.querySelector("a")?.getAttribute("href") || window.location.href;

      return {
        name: name.trim(),
        brand: brand.trim(),
        price: price.trim(),
        originalPrice: originalPrice.trim(),
        discount: discount.trim(),
        rating: rating.trim(),
        imageUrl: imageUrl.trim(),
        productUrl: productUrl.trim(),
      };
    });
    },
    { timeout: 120000 } // 2 minutes for DOM extraction
  );
}

async function scrapeViaPuppeteer(categoryUrl, limit) {
  let browser;
  try {
    browser = await launchPuppeteerBrowser();
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );

    const myntra = isMyntraUrl(categoryUrl);
    let merged = [];
    const pageCap = getEffectiveMaxPages(limit);
    let consecutiveEmptyPages = 0;
    const maxConsecutiveEmpty = 3; // Allow up to 3 consecutive pages with no new products before stopping

    for (let pageNum = 1; pageNum <= pageCap && merged.length < limit; pageNum += 1) {
      const urlsToTry =
        pageNum === 1
          ? [categoryUrl]
          : buildPageUrlVariants(categoryUrl, pageNum);

      let roundBest = [];
      let bestFresh = -1;

      for (const visitUrl of urlsToTry) {
        await page.goto(visitUrl, {
          waitUntil: "domcontentloaded",
          timeout: 60000, // 60 seconds for page load
        });
        console.log(
          `[scrape:puppeteer] listing page=${pageNum}/${pageCap} opened url=${visitUrl}`
        );

        if (myntra) {
          await autoScrollPage(page);
          await delay(450);
        }

        const rawProducts = await extractProductCardsFromDom(page);
        const normalized = rawProducts
          .map((item) => normalizeProduct(item, categoryUrl))
          .filter((product) => product.name && product.productUrl);

        const freshCount = countNewVsCatalog(normalized, merged);
        if (
          freshCount > bestFresh ||
          (freshCount === bestFresh && normalized.length > roundBest.length)
        ) {
          roundBest = normalized;
          bestFresh = freshCount;
        }

        const needMore = limit - merged.length;
        if (myntra && freshCount >= Math.min(LIST_PAGE_SIZE, needMore + 10)) {
          break;
        }
      }

      const keys = catalogKeys(merged);
      const roundNew = roundBest.filter((p) => {
        const id = extractStyleIdFromProductUrl(p.productUrl);
        const k = id ? `id:${id}` : `url:${p.productUrl}`;
        return !keys.has(k);
      });

      if (!roundNew.length) {
        consecutiveEmptyPages += 1;
        console.log(
          `[scrape:puppeteer] listing page=${pageNum} no new products (${consecutiveEmptyPages}/${maxConsecutiveEmpty} empty pages)`
        );
        
        // Only stop if we've had too many consecutive empty pages
        if (consecutiveEmptyPages >= maxConsecutiveEmpty) {
          console.log(
            `[scrape:puppeteer] reached ${maxConsecutiveEmpty} consecutive empty pages, stopping`
          );
          break;
        }
        
        // Continue trying if we haven't reached the product limit yet
        await delay(PAGE_DELAY_MS);
        continue;
      }

      consecutiveEmptyPages = 0; // Reset counter when we find new products
      const before = merged.length;
      merged.push(...roundNew);
      merged = deduplicateProducts(merged);
      console.log(
        `[scrape:puppeteer] listing page=${pageNum} new=${roundNew.length} uniqueTotal=${merged.length} (bestFreshAcrossUrls=${bestFresh})`
      );
      if (pageNum > 1 && merged.length === before) {
        console.log("[scrape:puppeteer] merge added no unique rows, stopping");
        break;
      }
      await delay(PAGE_DELAY_MS);
    }

    return merged.slice(0, limit);
  } catch (error) {
    if (error.name === "TimeoutError") {
      throw createAppError("Scraping timeout while loading the category URL.", 504);
    }
    if (error.message && error.message.includes("Could not find Chrome")) {
      console.log("[scrape:puppeteer] Chrome not available, returning empty results");
      return [];
    }
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function waitForWplusContent(page, timeoutMs = 12000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const count = await page.evaluate(() => {
      return document.querySelectorAll('a[href*="/product/"]').length;
    });

    if (count > 0) {
      return true;
    }

    await delay(1000);
  }

  return false;
}

async function extractWplusPageData(page) {
  return page.evaluate(() => {
    function toAbsoluteUrl(value) {
      if (!value) return "";
      try {
        return new URL(value, window.location.href).toString();
      } catch (_error) {
        return "";
      }
    }

    function cleanText(value) {
      return String(value || "").replace(/\s+/g, " ").trim();
    }

    function extractImage(node) {
      if (!node) return "";
      
      // Try multiple image sources within the node
      const allImgs = node.querySelectorAll("img");
      for (const img of allImgs) {
        // Check various image attributes
        let src = img.getAttribute("src") || 
                  img.getAttribute("data-src") || 
                  img.getAttribute("data-lazy-src") ||
                  img.getAttribute("data-image") ||
                  img.currentSrc || "";
        
        if (src && src.trim() && !src.toLowerCase().includes("placeholder")) {
          return src;
        }
      }
      
      // Try background-image style on any element in the card
      const allStyledElements = node.querySelectorAll("[style*='background-image'], [style*='backgroundImage']");
      for (const el of allStyledElements) {
        const style = el.getAttribute("style") || "";
        const match = style.match(/url\(["']?([^"')]+)["']?\)/i);
        if (match && match[1] && !match[1].includes("placeholder")) {
          return match[1];
        }
      }
      
      // Try picture/source elements
      const picture = node.querySelector("picture");
      if (picture) {
        const source = picture.querySelector("source");
        if (source) {
          const srcset = source.getAttribute("srcset");
          if (srcset) {
            const firstUrl = srcset.split(",")[0].trim().split(/\s+/)[0];
            if (firstUrl) return firstUrl;
          }
        }
      }
      
      return "";
    }

    const productAnchors = Array.from(
      document.querySelectorAll(
        'h1 a[href*="/product/"], h2 a[href*="/product/"], h3 a[href*="/product/"], .product-title a[href*="/product/"], .product-name a[href*="/product/"]'
      )
    );
    const seedAnchors = Array.from(document.querySelectorAll('a[href*="/phone/"]'));
    const products = [];
    const seeds = [];
    const seenProducts = new Set();
    const seenSeeds = new Set();

    for (const anchor of seedAnchors) {
      const href = anchor.getAttribute("href") || "";
      const absoluteHref = toAbsoluteUrl(href);
      if (absoluteHref && !seenSeeds.has(absoluteHref)) {
        seenSeeds.add(absoluteHref);
        seeds.push(absoluteHref);
      }
    }

    const anchors = productAnchors.length
      ? productAnchors
      : Array.from(document.querySelectorAll('a[href*="/product/"]'));
    const productMap = new Map();

    for (const anchor of anchors) {
      const href = anchor.getAttribute("href") || "";
      const absoluteHref = toAbsoluteUrl(href);
      if (!absoluteHref) {
        continue;
      }

      const card =
        anchor.closest("li, article, .product, .card, .group, .item") ||
        anchor.parentElement;
      const imageRoot =
        anchor.closest('[class*="product_productContainer"]') || card || anchor;
      const candidateText = cleanText(
        anchor.closest("h1, h2, h3")?.textContent ||
          anchor.getAttribute("aria-label") ||
          anchor.textContent ||
          card?.querySelector("h1, h2, h3, .product-title, .product-name")
            ?.textContent ||
          card?.textContent ||
          ""
      );
      const candidateImage = extractImage(imageRoot);

      const existing = productMap.get(absoluteHref) || {
        name: "",
        imageUrl: "",
        card,
      };

      if (candidateText.length > existing.name.length) {
        existing.name = candidateText;
      }
      if (!existing.imageUrl && candidateImage) {
        existing.imageUrl = candidateImage;
      }
      if (!existing.card && card) {
        existing.card = card;
      }

      productMap.set(absoluteHref, existing);
    }

    for (const [productUrl, product] of productMap.entries()) {
      const text = cleanText(product.name);
      if (!text) {
        continue;
      }

      products.push({
        name: text,
        brand: "",
        price: "",
        originalPrice: "",
        discount: "",
        rating: "",
        imageUrl: cleanText(product.imageUrl),
        productUrl,
      });
    }

    return { products, seeds };
  });
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function readMetaContent(html, attrName, attrValue) {
  const pattern = new RegExp(
    `<meta[^>]+${attrName}=["']${escapeRegex(attrValue)}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const match = html.match(pattern);
  return match ? match[1].trim() : "";
}

function readFirstTagText(html, tagName) {
  const pattern = new RegExp(`<${tagName}[^>]*>([\s\S]*?)<\/${tagName}>`, "i");
  const match = html.match(pattern);
  return match ? stripHtml(match[1]) : "";
}

function parseJsonLdBlocks(html) {
  const blocks = [];
  const scriptRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html))) {
    const raw = match[1].trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        blocks.push(...parsed.filter(Boolean));
      } else {
        blocks.push(parsed);
      }
    } catch (_error) {
      // ignore invalid JSON-LD blocks
    }
  }
  return blocks;
}

function cleanWplusValue(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function getWplusRouteContext(categoryUrl) {
  const url = new URL(categoryUrl, "https://wplus.ca");
  const parts = url.pathname.split("/").filter(Boolean);
  const activeFiltersRaw = url.searchParams.get("activeFilters");
  let activeFilters = null;

  if (activeFiltersRaw) {
    try {
      activeFilters = JSON.parse(decodeURIComponent(activeFiltersRaw));
    } catch (_error) {
      activeFilters = null;
    }
  }

  if (parts[0] === "phone" && parts[1]) {
    return { listBy: "PHONE", value: parts[1], activeFilters };
  }

  if (parts[0] === "products" && parts[1] === "category" && parts[2]) {
    return { listBy: "CATEGORY", value: parts[2], activeFilters };
  }

  if (parts[0] === "category" && parts[1]) {
    return { listBy: "CATEGORY", value: parts[1], activeFilters };
  }

  return { listBy: "CATEGORY", value: parts[parts.length - 1] || "", activeFilters };
}

function getWplusIdentifiers(item) {
  const productId =
    item?.productId ||
    item?.product?._id ||
    item?.product?.id ||
    item?.product?.productId ||
    item?.parentProductId ||
    "";
  const variantId =
    item?.id ||
    item?._id ||
    item?.variantId ||
    item?.variant?._id ||
    item?.variant?.id ||
    "";
  const variantNumber =
    item?.variantNumber || item?.variant?.variantNumber || item?.variant?.number || "";
  const rack = Array.isArray(item?.attributes?.rack)
    ? item.attributes.rack[0]
    : item?.attributes?.rack || item?.variant?.attributes?.rack || "";

  return {
    productId: cleanWplusValue(productId),
    variantId: cleanWplusValue(variantId),
    variantNumber: cleanWplusValue(variantNumber),
    rack: cleanWplusValue(rack),
  };
}

function buildWplusProductUrl(productId, variantId, variantNumber, rack) {
  if (!productId || !variantId) {
    return "";
  }

  const url = new URL(`https://wplus.ca/product/${productId}/variant/${variantId}/`);
  if (variantNumber) {
    url.searchParams.set("variant", variantNumber);
  }
  if (rack) {
    url.searchParams.set("rack", rack);
  }
  return url.toString();
}

async function postWplusJson(pathname, payload) {
  const response = await axios.post(`https://api.wplus.ca${pathname}`, payload, {
    timeout: REQUEST_TIMEOUT_MS,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      "Accept-Language": "en-CA,en;q=0.9",
    },
  });

  return response.data;
}

async function getWplusJson(pathname) {
  const response = await axios.get(`https://api.wplus.ca${pathname}`, {
    timeout: REQUEST_TIMEOUT_MS,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-CA,en;q=0.9",
    },
  });

  return response.data;
}

async function fetchWplusFilters(routeContext) {
  return withRetry(
    async () => {
      const data = await postWplusJson("/api/v1/product/list/filters/", {
        listBy: routeContext.listBy,
        value: routeContext.value,
      });
      return data?.response || data || {};
    },
    4,
    1200
  );
}

function extractWplusProducts(data) {
  const response = data?.response || data || {};
  const products = response.products || response.items || response.data?.products || [];
  return Array.isArray(products) ? products : [];
}

function normalizeWplusListProduct(item, categoryUrl) {
  const { productId, variantId, variantNumber, rack } = getWplusIdentifiers(item);
  const productUrl = buildWplusProductUrl(productId, variantId, variantNumber, rack);

  return {
    ...normalizeProduct(
      {
        productUrl,
      },
      categoryUrl
    ),
    productId,
    variantId,
    variantNumber,
    rack,
    name: "",
    price: "",
    rating: "",
    description: "",
    imageUrl: "",
  };
}

async function fetchWplusListPage(routeContext, filters, page) {
  const categoriesFromFilters = Array.isArray(filters?.categories)
    ? filters.categories
        .map((category) => {
          if (typeof category === "string") {
            return category;
          }
          return category?.id || category?._id || category?.value || "";
        })
        .filter(Boolean)
    : [];
  const categories = categoriesFromFilters.length
    ? categoriesFromFilters
    : [filters?.baseCategory].filter(Boolean);

  const activeFilters = routeContext.activeFilters || {};
  const basePayload = {
    listBy: activeFilters.listBy || routeContext.listBy,
    value: activeFilters.value || routeContext.value,
    baseCategory: activeFilters.baseCategory || filters?.baseCategory || "",
    categories,
    attributes: Array.isArray(activeFilters.attributes) ? activeFilters.attributes : [],
    phoneBrands: Array.isArray(activeFilters.phoneBrands) ? activeFilters.phoneBrands : [],
    products: Array.isArray(activeFilters.products) ? activeFilters.products : [],
    page,
    sortBy: activeFilters.sortBy || "Default",
    searchTerms: Array.isArray(activeFilters.searchTerms) ? activeFilters.searchTerms : [],
    onlyNew: Boolean(activeFilters.onlyNew),
    onlySale: Boolean(activeFilters.onlySale),
    productTags: Array.isArray(activeFilters.productTags) ? activeFilters.productTags : [],
    selCategories: Array.isArray(activeFilters.selCategories) ? activeFilters.selCategories : [],
    selAttrs: Array.isArray(activeFilters.selAttrs) ? activeFilters.selAttrs : [],
    selPhoneBrands: Array.isArray(activeFilters.selPhoneBrands)
      ? activeFilters.selPhoneBrands
      : [],
  };

  const payloadCandidates = [basePayload].filter((candidate) => candidate.categories.length > 0);

  let lastError = null;
  for (const payload of payloadCandidates) {
    try {
      const data = await withRetry(
        async () => postWplusJson("/api/v1/product/list/", payload),
        4,
        1200
      );
      const products = extractWplusProducts(data);
      if (products.length) {
        return products;
      }
    } catch (error) {
      lastError = error;
      console.log(
        `[scrape:wplus] list page=${page} payload failed categories=${payload.categories.join(",")} ${error.response?.data?.message || error.message}`
      );
    }
  }

  if (lastError) {
    throw lastError;
  }

  return [];
}

async function enrichWplusProductsFromDetailPages(products, options = {}) {
  const enriched = [...products];
  const onProgress = options.onProgress;
  const batchSize = options.batchSize || 150;
  const batchFiles = [];
  const batchProducts = [];
  let failedCount = 0;
  let skippedCount = 0;
  let savedCount = 0;

  for (let index = 0; index < enriched.length; index += 1) {
      const product = enriched[index];
      if (!product?.productId || !product?.variantId) {
        skippedCount += 1;
        continue;
      }

      emitProgress(onProgress, {
        phase: "scraping",
        current: index + 1,
        total: enriched.length,
        currentProductName: product.name || product.productUrl || "",
        csvFilesCreated: batchFiles.length,
        failedCount,
        skippedCount,
        progressPercent: Math.min(99, 70 + Math.round(((savedCount + batchProducts.length) / Math.max(enriched.length, 1)) * 30)),
        message: `Scraping product ${index + 1} of ${enriched.length}: ${product.name || product.productUrl || ""}`,
      });

      try {
        const detailData = await withRetry(
          async () => getWplusJson(`/api/v1/product/${product.productId}/variant/${product.variantId}/`),
          4,
          1200
        );
        const response = detailData?.response || detailData || {};
        const apiProduct = response.product || {};
        const apiVariant = response.variant || {};
        let mergedDetail = {
          ...product,
          name: cleanWplusValue(apiVariant.name || apiProduct.name || product.name),
          price: cleanWplusValue(
            apiVariant.specialPrice || apiVariant.price || apiProduct.specialPrice || apiProduct.price || product.price
          ),
          rating: cleanWplusValue(apiVariant.rating || apiProduct.rating || product.rating),
          description: cleanWplusValue(apiVariant.description || apiProduct.description || product.description),
          imageUrl: cleanWplusValue(
            apiVariant.assets?.[0]?.path ||
              apiVariant.assets?.[0]?.url ||
              apiProduct.assets?.[0]?.path ||
              apiProduct.assets?.[0]?.url ||
              product.imageUrl
          ),
          productUrl: buildWplusProductUrl(
            product.productId,
            product.variantId,
            product.variantNumber,
            product.rack
          ),
        };

        enriched[index] = mergedDetail;
        batchProducts.push(mergedDetail);
        savedCount += 1;

        if (batchProducts.length === batchSize || index === enriched.length - 1) {
          const batchStart = savedCount - batchProducts.length + 1;
          const batchEnd = savedCount;
          const fileName = `products_${batchStart}_to_${batchEnd}.csv`;
          await createProductsCsv(batchProducts, { fileName, writeLatest: false });
          batchFiles.push(fileName);
          emitProgress(onProgress, {
            phase: "scraping",
            current: index + 1,
            total: enriched.length,
            currentProductName: product.name || product.productUrl || "",
            csvFilesCreated: batchFiles.length,
            failedCount,
            skippedCount,
            lastCsvFile: fileName,
            progressPercent: Math.min(99, 70 + Math.round((savedCount / Math.max(enriched.length, 1)) * 30)),
            message: `Saved ${fileName}`,
          });
          batchProducts.length = 0;
        }

        if (index < 3) {
          console.log(
            `[scrape:wplus] detail ${index}: name="${enriched[index].name?.substring(0, 50)}" price="${enriched[index].price}" rating="${enriched[index].rating}" imageUrl="${enriched[index].imageUrl?.substring(0, 80)}"`
          );
        }
      } catch (error) {
        failedCount += 1;
        console.log(`[scrape:wplus] detail fetch failed ${product.productId}/${product.variantId} ${error.message}`);
      }

    }

  emitProgress(onProgress, {
    phase: "completed",
    totalScraped: enriched.length,
    csvFilesCreated: batchFiles.length,
    failedCount,
    skippedCount,
    progressPercent: 100,
    message: `Total scraped: ${enriched.length}`,
  });

  return enriched;
}

async function scrapeViaWplus(categoryUrl, limit, options = {}) {
  try {
    const onProgress = options.onProgress;
    const routeContext = getWplusRouteContext(categoryUrl);
    const filters = await fetchWplusFilters(routeContext);
    const pageCap = getEffectiveMaxPages(limit);
    const merged = [];
    const seenKeys = new Set();

    console.log(
      `[scrape:wplus] route=listBy:${routeContext.listBy} value:${routeContext.value} baseCategory:${filters.baseCategory || ""}`
    );

    for (let page = 1; page <= pageCap && merged.length < limit; page += 1) {
      const beforeCount = merged.length;
      const pageItems = await fetchWplusListPage(routeContext, filters, page);
      if (!pageItems.length) {
        console.log(`[scrape:wplus] page=${page} returned no products, stopping`);
        break;
      }

      const normalized = pageItems.map((item) => normalizeWplusListProduct(item, categoryUrl));
      const before = merged.length;
      merged.push(...normalized);
      const deduped = deduplicateProducts(merged);
      merged.length = 0;
      merged.push(...deduped);

      console.log(
        `[scrape:wplus] page=${page} list=${normalized.length} uniqueTotal=${merged.length}`
      );
      emitProgress(onProgress, {
        phase: "scrolling",
        page,
        beforeCount,
        afterCount: merged.length,
        loadedCount: merged.length,
        totalLinks: merged.length,
        progressPercent: Math.min(70, Math.round((merged.length / Math.max(limit, 1)) * 70)),
        message: `Scrolling... ${merged.length} products loaded so far`,
      });

      if (merged.length === before) {
        console.log(`[scrape:wplus] page=${page} produced no new unique rows, stopping`);
        break;
      }

      if (pageItems.length < LIST_PAGE_SIZE) {
        break;
      }

    }

    emitProgress(onProgress, {
      phase: "scroll_complete",
      totalLinks: merged.length,
      loadedCount: merged.length,
      progressPercent: 70,
      message: `Scroll complete! Total ${merged.length} products found.`,
    });

    const enriched = await enrichWplusProductsFromDetailPages(merged.slice(0, limit), {
      onProgress,
      batchSize: options.batchSize || 150,
    });
    console.log(`[scrape:wplus] enrichment complete; using ${enriched.length} api-detail products`);
    return enriched.slice(0, limit);
  } catch (error) {
    if (error.response?.status === 404) {
      throw createAppError("Wplus API returned 404.", 404);
    }
    if (error.code === "ECONNABORTED") {
      throw createAppError("Scraping timeout while loading the wplus API.", 504);
    }
    throw error;
  }
}

function mergeMyntraResults(apiList, domList) {
  const byKey = new Map();
  const order = [];

  for (const p of apiList) {
    const id = extractStyleIdFromProductUrl(p.productUrl);
    const key = id || p.productUrl;
    byKey.set(key, { ...p });
    order.push(key);
  }

  for (const p of domList) {
    const id = extractStyleIdFromProductUrl(p.productUrl);
    const key = id || p.productUrl;
    if (!byKey.has(key)) {
      byKey.set(key, p);
      order.push(key);
    } else {
      const cur = byKey.get(key);
      if (!cur.imageUrl && p.imageUrl) {
        cur.imageUrl = p.imageUrl;
      }
    }
  }

  return order.map((k) => byKey.get(k)).filter(Boolean);
}

function countMissingImages(products) {
  return products.filter((p) => !p.imageUrl).length;
}

async function scrapeProducts(categoryUrl, limit = 400, options = {}) {
  try {
    console.log(`[scrape:start] limit=${limit} url=${categoryUrl}`);

    if (isWplusUrl(categoryUrl)) {
      console.log("[scrape:start] detected wplus.ca, using API crawler");
      const wplusProducts = await scrapeViaWplus(categoryUrl, limit, options);

      if (!wplusProducts.length) {
        throw createAppError(
          "No products found on wplus.ca. The site may have changed its layout.",
          404
        );
      }

      console.log(`[scrape:done] strategy=wplus-browser count=${wplusProducts.length}`);
      return wplusProducts.slice(0, limit);
    }

    // First try hidden API scraping because it is faster and more reliable.
    const apiProducts = await scrapeViaHiddenApi(categoryUrl, limit);

    if (apiProducts.length) {
      const myntra = isMyntraUrl(categoryUrl);
      const missingImg = countMissingImages(apiProducts);
      const shortCount = apiProducts.length < limit;
      const badImages =
        myntra &&
        missingImg > Math.max(5, Math.floor(apiProducts.length * 0.12));

      if (myntra && (shortCount || badImages)) {
        console.log(
          `[scrape:merge] Myntra supplement via Puppeteer (short=${shortCount} missingImages=${missingImg}/${apiProducts.length})`
        );
        const domProducts = await scrapeViaPuppeteer(categoryUrl, limit);
        const merged = mergeMyntraResults(apiProducts, domProducts);
        console.log(`[scrape:done] strategy=merged count=${merged.length}`);
        return merged.slice(0, limit);
      }

      console.log(`[scrape:done] strategy=hidden-api count=${apiProducts.length}`);
      return apiProducts.slice(0, limit);
    }

    // Fallback to browser automation for dynamic websites.
    console.log("[scrape:fallback] switching to puppeteer");
    const browserProducts = await scrapeViaPuppeteer(categoryUrl, limit);
    if (!browserProducts.length) {
      throw createAppError(
        "No products found. The website may have blocked scraping or requires a browser. Try a different category URL.",
        404
      );
    }

    console.log(`[scrape:done] strategy=puppeteer count=${browserProducts.length}`);
    return browserProducts.slice(0, limit);
  } catch (error) {
    if (error.response?.status === 404) {
      throw createAppError("Category URL returned 404.", 404);
    }
    if (error.code === "ECONNABORTED") {
      throw createAppError("Request timeout while scraping products.", 504);
    }
    if (error.statusCode) {
      throw error;
    }
    throw createAppError(`Scraping failed: ${error.message}`, 500);
  }
}

module.exports = {
  scrapeProducts,
};
