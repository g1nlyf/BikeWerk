# Operational Guide

## Legal & Ethical Considerations
**WARNING**: Scraping Kleinanzeigen.de may violate their Terms of Service.
- Ensure you have `CONFIRM_TERMS=true` in your env to acknowledge this.
- Respect `robots.txt`.
- Use high delays (default is polite).
- Do not bypass CAPTCHAs aggressively.

## Deployment
- **Database**: Uses the shared EUBike Postgres. Ensure network connectivity.
- **Redis**: Required for job queues.
- **Proxies**: Recommended for high volume. Configure `PROXY_POOL` in `.env`.

## Monitoring
- Check logs for "429 Too Many Requests".
- Monitor `importLog` table (if configured) or console output.
- Watch for "Needs Playwright" spikes (indicates HTML structure change).

## Troubleshooting
- **Playwright Fails**: Check Docker memory (needs ~1GB+).
- **LLM Errors**: Check Quota/API Key.
- **No Results**: Check search templates in `src/config/search-templates.json`.
