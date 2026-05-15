# Product Fetcher (Complete)

Full-stack ecommerce scraping application with **live progress tracking** and **background job support**:
- Backend: Node.js + Express + Axios + Puppeteer + json2csv
- Frontend: React + Tailwind + Axios
- Scope: Scrape up to 400 products, generate batched CSV files, render all products in responsive ecommerce UI
- Live Features: Real-time scroll/scrape progress, batch saves, job polling

## Quick Start

**New here?** See [SETUP.md](SETUP.md) for complete installation and configuration instructions.

**TL;DR:**
```bash
# Terminal 1: Backend
cd backend
npm install
npm start

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173` and enter a Wplus URL like `https://wplus.ca/phone/iphone-17`

## Folder Structure

```text
product-fetcher/
├── backend/
│   ├── config/
│   │   └── constants.js
│   ├── controllers/
│   │   └── productController.js
│   ├── routes/
│   │   └── productRoutes.js
│   ├── services/
│   │   └── scraperService.js
│   ├── utils/
│   │   ├── csvGenerator.js
│   │   ├── csvReader.js
│   │   ├── helpers.js
│   │   ├── productMapper.js
│   │   └── validators.js
│   ├── .env.example
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── productsApi.js
│   │   ├── components/
│   │   │   ├── DashboardStats.jsx
│   │   │   ├── ErrorState.jsx
│   │   │   ├── Footer.jsx
│   │   │   ├── LoadingState.jsx
│   │   │   ├── Navbar.jsx
│   │   │   ├── ProductCard.jsx
│   │   │   ├── ProductGrid.jsx
│   │   │   ├── ProductGridSkeleton.jsx
│   │   │   └── UrlInputForm.jsx
│   │   ├── pages/
│   │   │   └── HomePage.jsx
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   └── vite.config.js
└── README.md
```

## Installation & Dependencies

### System Requirements
- **Node.js:** v16 or higher (check with `node --version`)
- **npm:** 8.0 or higher (comes with Node.js)
- **Disk Space:** ~500MB for all dependencies
- **RAM:** 2GB minimum (4GB recommended)

### Backend Dependencies

Located in `backend/package.json`:

```json
{
  "dependencies": {
    "express": "^4.21.2",      // Web server framework
    "cors": "^2.8.5",           // Cross-origin support
    "axios": "^1.8.4",          // HTTP client
    "puppeteer": "^24.7.1",     // Browser automation (installs Chrome)
    "json2csv": "^6.0.0-alpha.2", // JSON to CSV conversion
    "csv-parse": "^5.6.0",      // CSV parsing
    "dotenv": "^16.4.7"         // Environment variables
  }
}
```

### Frontend Dependencies

Located in `frontend/package.json`:

```json
{
  "dependencies": {
    "react": "^18.3.1",         // UI library
    "react-dom": "^18.3.1",     // DOM rendering
    "axios": "^1.8.4",          // HTTP client
    "react-icons": "^5.5.0"     // Icon library
  },
  "devDependencies": {
    "vite": "^6.2.0",           // Build tool
    "@vitejs/plugin-react": "^4.3.4", // React support
    "tailwindcss": "^3.4.17",   // CSS framework
    "postcss": "^8.5.3",        // CSS processing
    "autoprefixer": "^10.4.21"  // CSS vendor prefixes
  }
}
```

### Install Instructions

From project root:

```bash
# Install backend
cd backend
npm install

# Install frontend
cd ../frontend
npm install
```

✅ **Note:** Puppeteer's postinstall script automatically downloads Chrome during backend installation.

## Environment Variables

### Backend (.env)
1. Copy `backend/.env.example` to `backend/.env` (optional)
2. Available configuration:
   - `PORT` (default: 5000)
   - `REQUEST_TIMEOUT_MS` (default: 90000 ms = 90 sec) — Per-page request timeout
   - `PAGE_DELAY_MS` (default: 200 ms) — Delay between page requests
   - `MAX_PAGES` (default: 10) — Maximum pages to scrape
   - `LIST_PAGE_SIZE` (default: 50) — Products per page
   - `SCRAPE_LIMIT` (default: 400) — Maximum products to fetch
   - `SCRAPE_REQUEST_TIMEOUT_MS` (default: 900000 ms = 15 min) — Total scrape job timeout

### Frontend (.env)
1. Copy `frontend/.env.example` to `frontend/.env` (optional)
2. Available configuration:
   - `VITE_API_BASE_URL` (default: http://localhost:5000) — Backend API URL
   - `VITE_SCRAPE_TIMEOUT_MS` (default: 900000 ms = 15 min) — Frontend request timeout

⚠️ **Important:** `VITE_SCRAPE_TIMEOUT_MS` must be **≥** backend `SCRAPE_REQUEST_TIMEOUT_MS` to prevent early timeout on long scrapes.

## Running the Project

### Start Backend

```bash
cd backend
npm start
# or for development with auto-reload
npm run dev
```

Expected output: `Server running on http://localhost:5000`

### Start Frontend

Open a new terminal:

```bash
cd frontend
npm run dev
```

Expected output: `Local: http://localhost:5173/`

Visit `http://localhost:5173` in your browser.

## API Endpoints

### Background Job Flow (Recommended)

**Start a scrape job:**
```
POST /api/products/scrape/job
Content-Type: application/json
Body: { "url": "https://wplus.ca/phone/iphone-17" }

Response: { "success": true, "jobId": "uuid", "statusUrl": "/api/products/scrape/job/uuid" }
```

**Poll job status (real-time progress):**
```
GET /api/products/scrape/job/:jobId

Response includes:
{
  "job": {
    "status": "running|completed|failed",
    "phase": "starting|scrolling|scroll_complete|scraping|completed",
    "progressPercent": 0-100,
    "loadedCount": 200,
    "totalLinks": 400,
    "csvFilesCreated": 2,
    "failedCount": 0,
    "skippedCount": 0,
    "lastCsvFile": "products_151_to_300.csv",
    "message": "Scraping product 150 of 400..."
  }
}
```

**Load products from CSV:**
```
GET /api/products/from-csv

Response: { "products": [...], "meta": {...} }
```

**Download CSV file:**
```
GET /api/products/csv/latest
```

### Direct Scrape (Legacy)

**Scrape and write CSV (no large response body):**
```
GET /api/products/scrape?url=<categoryUrl>

Returns metadata only (avoids timeout on large datasets)
```

**Combined scrape + CSV + products (for small categories):**
```
GET /api/products?url=<categoryUrl>

⚠️ May timeout on large categories; use job API instead
```

## How Scraping Works

### Architecture
- **Job-based flow** (recommended): Start background job → Poll progress → Load results
- **Request timeout:** 15 minutes default to handle large category scrapes (up to 400 products)
- **Batch saves:** CSV files generated every 150 products to avoid memory issues

### Scraping Strategy

1. **URL Validation** — Ensure category URL is valid ecommerce URL

2. **Scraper Selection** (for Wplus.ca):
   - Detects Wplus domain
   - Uses dedicated Wplus API scraper (most reliable)
   - Paginates through API to fetch all products
   - Continues until limit (400) or no more products

3. **API-based Scraping** (for other sites):
   - Try hidden API endpoints first (paginate with `p`, `page`, `pageNo`)
   - Normalize and deduplicate product items
   - Continue until 400 products or empty pages

4. **Puppeteer Fallback** (for dynamic/JavaScript sites):
   - Launch headless browser
   - Scroll through category page
   - Extract product cards from DOM
   - Normalize and deduplicate
   - Stop at 400 products or no more new products

5. **Enrichment** (Wplus only):
   - Fetch product detail pages via API
   - Merge name, price, rating, image URLs
   - Save in batches of 150

6. **CSV Generation**:
   - Generate timestamped CSV (`products-<timestamp>.csv`)
   - Keep stable copy (`products.csv`) for UI loading
   - Report progress and file locations

### Progress Tracking
- Live job status with phases: `starting` → `scrolling` → `scraping` → `completed`
- Real-time counters: products loaded, batches saved, failures
- Progress bar (0-100%)
- Current product name being processed

### Timeout Protection
- Per-request timeout: 90 seconds
- Total job timeout: 15 minutes (configurable)
- Automatic retry on network errors (up to 4 attempts)

## Frontend Features

- Responsive navbar/footer and branded app shell
- URL input with fetch, retry, and clear actions
- **Live progress panel** showing real-time scroll/scrape/batch status
- **Progress bar** with percentage tracking
- Product count and scrape status badges
- Beautiful responsive product cards with images, prices, ratings
- CSV download button integrated with backend
- Error, success, and empty states
- Skeleton loading UI for better UX

## Best Practices Used

- **Backend reliability:** retry logic, timeout handling, deduplication, and structured status responses
- **Performance:** memoized product card/grid components and clean state updates for 150-item rendering
- **UX quality:** clear loading/success/error/empty states and immediate action buttons
- **Maintainability:** reusable components, separated API layer, and simple utility-driven architecture
