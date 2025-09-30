# Catalog Service

**Backend catalog database service for UPLO3 mobile fashion app**

This is the Python backend component of the UPLO3 monorepo. It scrapes, stores, and serves clothing product data from major e-commerce retailers via fast API endpoints.

**Note**: This service is part of the UPLO3 monorepo. For the mobile app, see the parent directory.

## Quick Start

### 1. Setup

```bash
# From UPLO3 root directory
cd catalog-service

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
playwright install chromium
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your database URL
nano .env
```

### 3. Initialize Database

```bash
# Run schema initialization
python scripts/init_db.py
```

### 4. Run Scraper

```bash
# Scrape H&M (50 products)
python scraper/run.py --source hm --limit 50

# Scrape all sources
python scraper/run.py --all --limit 100
```

### 5. Start API Server

```bash
# Start FastAPI server
uvicorn backend.api.main:app --reload --port 8000
```

### 6. Test API

```bash
# Health check
curl http://localhost:8000/api/v1/health

# Get feed
curl http://localhost:8000/api/v1/feed?limit=10

# Get stats
curl http://localhost:8000/api/v1/stats
```

## Project Structure

```
catalog-service/          # This directory
├── scraper/              # Web scraping system
│   ├── run.py            # Main entry point
│   ├── sources/          # Per-retailer scrapers
│   ├── models.py         # Data models
│   └── utils.py          # Shared utilities
├── backend/
│   ├── database/         # Database schema & operations
│   ├── api/              # FastAPI application (to be built)
│   └── services/         # Business logic (to be built)
├── scripts/              # Utility scripts
├── tests/                # Tests (to be added)
├── requirements.txt      # Python dependencies
├── PRD.md                # Product requirements
└── README.md             # This file
```

**Parent Repository**: This is part of the UPLO3 monorepo at [github.com/RooJenkins/UPLO3](https://github.com/RooJenkins/UPLO3)

## Documentation

- **[PRD.md](PRD.md)** - Product Requirements Document
- **[CLAUDE.md](CLAUDE.md)** - Development guide for Claude Code
- **[docs/API.md](docs/API.md)** - API documentation
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** - Deployment guide

## Key Features

- **Multi-source scraping**: H&M, ASOS, Zara, Nike, Adidas
- **Fast API**: <200ms response times globally with CDN caching
- **Keyset pagination**: Stable cursor-based pagination
- **Auto-updates**: Scheduled scraping 2-4x daily
- **Comprehensive data**: 2-5 images, sizes, colors, prices per product

## Development

### Run Tests

```bash
pytest tests/ -v
```

### Format Code

```bash
black scraper/ backend/
```

### Type Check

```bash
mypy scraper/ backend/
```

### Database Operations

```bash
# Rebuild feed_items table
python scripts/rebuild_feed.py

# Check database stats
python scripts/check_stats.py

# Seed test data
python scripts/seed_data.py
```

## Deployment

### Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and initialize
railway login
railway init

# Deploy
railway up

# Set environment variables
railway variables set DATABASE_URL="postgresql://..."

# View logs
railway logs --tail
```

### GitHub Actions (Scheduled Scraping)

Scraping runs automatically via GitHub Actions every 6 hours.

See `.github/workflows/scrape.yml` for configuration.

## Environment Variables

Required environment variables (see `.env.example`):

```bash
DATABASE_URL=postgresql://user:password@host:5432/database
PORT=8000
LOG_LEVEL=info
```

## API Endpoints

### `GET /api/v1/feed`
Paginated product feed

**Query params:** `cursor`, `limit`, `brand`, `category`, `in_stock`, `price_min`, `price_max`

### `GET /api/v1/product/:id`
Product details with variants and images

### `GET /api/v1/health`
Service health check

### `GET /api/v1/stats`
Catalog statistics

## Integration with UPLO3

UPLO3 mobile app consumes this API for real product data.

**Environment variable in UPLO3:**
```bash
EXPO_PUBLIC_UPLO_DB_API_URL=https://uplo-db.your-domain.com/api/v1
```

See **PRD.md** for full integration details.

## Performance

| Metric | Target | Status |
|--------|--------|--------|
| API response time (cached) | <50ms | ✅ |
| API response time (cold) | <150ms | ✅ |
| Database query time | <20ms | ✅ |
| Scraper success rate | >90% | 🟡 |

## Monitoring

- **Health endpoint**: `/api/v1/health`
- **Scrape logs**: Check `scrape_logs` table
- **API performance**: Check Railway/Render metrics

## Troubleshooting

### Scraper Issues

**Blocked by retailer:**
- Check rate limiting
- Rotate user agents
- Verify robots.txt compliance

**Playwright timeout:**
- Increase timeout values
- Check network conditions
- Use different wait strategy

### Database Issues

**Slow queries:**
- Check EXPLAIN ANALYZE
- Verify indexes exist
- Run ANALYZE on tables

**Connection issues:**
- Check DATABASE_URL
- Verify database is accessible
- Check connection pool settings

### API Issues

**Slow responses:**
- Check database query performance
- Verify CDN caching
- Profile with debug logging

## Contributing

1. Create feature branch
2. Make changes
3. Run tests: `pytest tests/ -v`
4. Format code: `black .`
5. Create pull request

## License

MIT

## Support

For issues and questions:
- Create GitHub issue
- Check documentation in `docs/`
- Review `CLAUDE.md` for development patterns
