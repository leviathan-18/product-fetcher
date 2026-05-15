# Setup Guide - Product Fetcher

Complete installation and setup instructions for running the Product Fetcher project on your local machine.

## Prerequisites

Before you start, ensure you have the following installed on your device:

1. **Node.js** (v16 or higher recommended)
   - Download from: https://nodejs.org/
   - Verify installation: `node --version` and `npm --version`

2. **Git** (for cloning the repository)
   - Download from: https://git-scm.com/
   - Verify installation: `git --version`

## Project Structure

```
product-fetcher/
├── backend/          # Node.js Express server + scraper
├── frontend/         # React + Vite web application
└── README.md         # Project overview
```

## Installation Steps

### 1. Clone the Repository

```bash
git clone <repository-url>
cd product-fetcher
```

### 2. Install Backend Dependencies

Navigate to the backend folder and install all required packages:

```bash
cd backend
npm install
```

**Backend Dependencies:**
- `express` - Web server framework
- `cors` - Cross-Origin Resource Sharing middleware
- `axios` - HTTP client for API requests
- `puppeteer` - Browser automation (for web scraping)
- `json2csv` - Convert JSON to CSV format
- `csv-parse` - Parse CSV files
- `dotenv` - Environment variable management

**Note:** The `postinstall` script will automatically install Chrome for Puppeteer:
```bash
npx puppeteer browsers install chrome
```

### 3. Install Frontend Dependencies

Navigate to the frontend folder and install all required packages:

```bash
cd ../frontend
npm install
```

**Frontend Dependencies:**
- `react` - UI library
- `react-dom` - React DOM renderer
- `axios` - HTTP client for API calls
- `react-icons` - Icon library

**Frontend Dev Dependencies (installed automatically):**
- `vite` - Frontend build tool
- `@vitejs/plugin-react` - React plugin for Vite
- `tailwindcss` - Utility-first CSS framework
- `postcss` - CSS transformation tool
- `autoprefixer` - PostCSS plugin for vendor prefixes

## Running the Project

### Start the Backend Server

```bash
cd backend
npm start
# or for development
npm run dev
```

**Expected output:**
```
Server running on http://localhost:5000
```

The backend API will be available at `http://localhost:5000`

### Start the Frontend Development Server

Open a new terminal and run:

```bash
cd frontend
npm run dev
```

**Expected output:**
```
VITE v6.x.x ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Press h to show help
```

The frontend will be available at `http://localhost:5173/`

### Build Frontend for Production

```bash
cd frontend
npm run build
```

This creates an optimized production build in the `dist/` folder.

## Environment Configuration

### Backend Environment Variables (Optional)

Create a `.env` file in the `backend/` folder:

```bash
PORT=5000
REQUEST_TIMEOUT_MS=90000
SCRAPE_REQUEST_TIMEOUT_MS=900000
PAGE_DELAY_MS=200
MAX_PAGES=10
LIST_PAGE_SIZE=50
```

### Frontend Environment Variables (Optional)

Create a `.env` file in the `frontend/` folder:

```bash
VITE_API_BASE_URL=http://localhost:5000
VITE_SCRAPE_TIMEOUT_MS=900000
```

## API Endpoints

### Scrape Products

**Start a background scrape job:**
```
POST /api/products/scrape/job
Body: { "url": "https://wplus.ca/phone/iphone-17" }
```

**Get job status:**
```
GET /api/products/scrape/job/:jobId
```

**Load products from CSV:**
```
GET /api/products/from-csv
```

**Download CSV file:**
```
GET /api/products/csv/latest
```

## Key Features

✅ **Scrape up to 400 products** from ecommerce categories
✅ **Live progress tracking** - See scrolling, scraping, and batch save progress in real-time
✅ **Batch CSV export** - Saves CSV files every 150 products
✅ **Responsive UI** - Built with React + Tailwind CSS
✅ **Background jobs** - Non-blocking scrape operations with polling
✅ **Error handling** - Comprehensive error messages and retry logic

## Supported Websites

- **Wplus.ca** - Primary target with dedicated API scraper
- **Myntra.com** - Hidden API + Puppeteer fallback
- **Generic ecommerce sites** - Via Puppeteer browser automation

## Troubleshooting

### "Chrome not found" Error

If you see errors about Chrome not being available, manually install it:

```bash
cd backend
npx puppeteer browsers install chrome
```

### Port 5000 Already in Use

Change the port by setting the `PORT` environment variable:

```bash
PORT=5001 npm start
```

### Node modules taking too much space

You can safely delete `node_modules` and reinstall later:

```bash
rm -r backend/node_modules frontend/node_modules
npm install  # in each folder
```

### API requests timing out

Increase the timeout values in `.env`:

```bash
SCRAPE_REQUEST_TIMEOUT_MS=1200000  # 20 minutes
```

## Performance Notes

- **First scrape:** May take 1-3 minutes depending on category size
- **CSV generation:** Automatic after scraping completes
- **Live updates:** UI polls job status every 2 seconds
- **Batch size:** Products are saved in CSV files of 150 items each

## System Requirements

- **RAM:** Minimum 2GB (4GB+ recommended for smooth operation)
- **Disk Space:** 500MB for dependencies + space for CSV files
- **OS:** Windows, macOS, or Linux
- **Browser:** Chrome/Chromium (installed automatically via Puppeteer)

## Production Deployment

For production use:

1. Build frontend: `npm run build` in frontend folder
2. Set environment variables appropriately
3. Increase request timeouts for stability
4. Use a process manager like PM2 to keep server running
5. Implement proper error logging and monitoring

## Getting Help

- Check the main [README.md](README.md) for project overview
- Review error messages in console for specific issues
- Verify all Node.js dependencies installed: `npm list`
- Confirm backend and frontend are running on correct ports

---

**Happy scraping! 🚀**
