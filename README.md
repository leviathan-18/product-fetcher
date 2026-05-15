# Product Fetcher (Part 1 + Part 2 Complete)

Full-stack ecommerce scraping application:
- Backend: Node.js + Express + axios + Puppeteer + json2csv
- Frontend: React + Tailwind + Axios
- Scope: scrape up to 150 products, generate CSV, render all products in responsive ecommerce UI

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

## Install

From project root:

```bash
cd backend
npm install
cd ../frontend
npm install
```

## Environment Variables

Backend:
1. Copy `backend/.env.example` to `backend/.env`
2. Update values if needed
3. Available keys:
   - `PORT`
   - `REQUEST_TIMEOUT_MS`
   - `PAGE_DELAY_MS`
   - `MAX_PAGES`
   - `SCRAPE_REQUEST_TIMEOUT_MS` (default 300000 — scrape can take minutes; align with `VITE_SCRAPE_TIMEOUT_MS` on the frontend)

Frontend:
1. Copy `frontend/.env.example` to `frontend/.env`
2. Ensure backend URL is correct (`VITE_API_BASE_URL`)
3. `VITE_SCRAPE_TIMEOUT_MS` should be **greater than or equal to** backend `SCRAPE_REQUEST_TIMEOUT_MS` (default 360000 ms on frontend vs 300000 ms backend scrape guard).

## Run

Terminal 1:

```bash
cd backend
npm run dev
```

Terminal 2:

```bash
cd frontend
npm run dev
```

## API

**Recommended flow (used by the web app):**

1. `GET /api/products/scrape?url=<categoryUrl>`
   - Scrapes up to 150 products, writes timestamped CSV and `products.csv`.
   - Returns **metadata only** (no large `products` array) so the browser does not time out on long scrapes.
   - Server-side scrape guard: `SCRAPE_REQUEST_TIMEOUT_MS` (default 5 minutes).

2. `GET /api/products/from-csv`
   - Reads the latest `products.csv` from disk and returns `{ products, meta }` for the UI grid.

`GET /api/products?url=<categoryUrl>` (legacy)
- Same as scrape + CSV + returns `products` in one JSON response (can be heavy / long).

`GET /api/products/csv/latest`
- Downloads latest generated CSV file.

## How Scraping Works

1. Validate incoming category URL.
2. Try hidden API strategy first:
   - paginate with `p` query param
   - async requests with timeout
   - retry failed requests
   - delay between page requests
   - normalize and deduplicate product items
   - stop at 150 products
3. If hidden API yields no products, fallback to Puppeteer:
   - open category page
   - parse schema.org product markup or common ecommerce card selectors
   - normalize + deduplicate
   - stop at 150 products
4. Request-level timeout protection wraps scraping flow.
5. Generate timestamped CSV (`products-<timestamp>.csv`) and refresh stable `products.csv`.
6. Return clean API payload with metadata used by dashboard UI.

## Frontend Features

- Responsive navbar/footer and branded app shell
- URL input with fetch, retry, and clear actions
- Loading states, animated progress text, and skeleton grid
- Product dashboard: total products, status, duration, CSV message
- Product count and scrape status badges
- Beautiful ecommerce product cards with hover animation and shadows
- CSV download button integrated with backend endpoint
- Error, success, and empty states

## Run Complete Project

Terminal 1 (Backend):
```bash
cd backend
npm run dev
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

Open frontend:
- [http://localhost:5173](http://localhost:5173)

## Best Practices Used

- **Backend reliability:** retry logic, timeout handling, deduplication, and structured status responses
- **Performance:** memoized product card/grid components and clean state updates for 150-item rendering
- **UX quality:** clear loading/success/error/empty states and immediate action buttons
- **Maintainability:** reusable components, separated API layer, and simple utility-driven architecture
