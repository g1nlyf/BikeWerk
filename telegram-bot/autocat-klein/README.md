# AutoCat Kleinanzeigen

A specialized module for scraping, filtering, and analyzing bicycle listings from Kleinanzeigen.de using LLM (Gemini) and Playwright.

## Features
- **Hybrid Scraping**: Fast HTML parsing + Playwright Fallback.
- **LLM Analysis**: Uses Gemini 1.5 Flash to extract structured data (JSON).
- **Smart Filtering**: Whitelists, price sanity checks, image counting.
- **Deduplication**: Prevents processing the same ad twice.
- **Dockerized**: Runs with full browser support in Docker.

## Installation

1. Go to module directory:
   ```bash
   cd autocat-klein
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment:
   Ensure the root `.env` (in `../.env`) has:
   ```env
   GEMINI_API_KEY=...
   DATABASE_URL=postgres://user:pass@localhost:5432/yourdb
   REDIS_HOST=localhost
   REDIS_PORT=6379
   ```

## Usage

### CLI
Run the scraper to collect N listings:
```bash
npm run autocat -- --count=50
```

Options:
- `--count=N`: Number of listings to process.
- `--mode=auto`: Default mode.

### Docker
Run the full stack (Redis + Scraper):
```bash
cd docker
docker-compose up --build
```

## Architecture
- **Fetcher**: Axios with rotation/backoff.
- **Parser**: Cheerio for speed.
- **LLM**: Gemini Flash for extraction.
- **Fallback**: Playwright (headless) for tough pages.
- **Queue**: BullMQ (Redis) for job management.

## Testing
```bash
npm test
```
