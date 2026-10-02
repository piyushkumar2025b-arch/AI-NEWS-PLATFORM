# AI & Tech News Ingestion Platform

A production-grade, multi-source news and research ingestion pipeline with protocol adapters, connectors, deduplication, and normalized API delivery.

## Key Capabilities

- **Protocol Adapters**: Unified data ingestion across REST, RSS 2.0, Atom 1.0, and Dublin Core feeds.
- **Connectors**: Ingestion connectors covering leading frontier AI labs, research preprints (arXiv CS.CL, CS.CV, Crossref, OpenAlex, Nature AI), tech publications, video channels (YouTube Data API), and developer communities (Hacker News, DEV.to, Lobsters, Hugging Face).
- **Processing Pipelines**:
  - Validation: rejects invalid schemas, titles, and malformed URLs.
  - Normalization: uniform Article schema with canonical IDs and fingerprints.
  - Filtering: automated exclusion of sponsored / low-signal items.
  - Deduplication: exact fingerprint matching and fuzzy Jaccard similarity checking with source provenance linking.
  - Taxonomical Enrichment: automatic category tagging and topic classification.
- **Media Engine**: Safe media resolver with SSRF defenses, private IP blocking, DNS TOCTOU protection, and a memory-bounded media proxy (80MB byte budget with LRU eviction).
- **Syndication**: RSS 2.0, Atom, JSON Feed 1.1, and CSV exports with CSV formula injection sanitization.
- **Resilience**: Adaptive Circuit Breakers with fast-fail, token bucket rate limiters, and health / readiness telemetry.

## Configuration & Environment Variables

Create a `.env` or `.env.local` file in the root directory:

```env
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
ADMIN_API_KEY=your-admin-key-here

# Optional API Keys
YOUTUBE_API_KEY=
GITHUB_TOKEN=
HF_TOKEN=
GUARDIAN_API_KEY=
NEWSAPI_KEY=
SEMANTIC_SCHOLAR_API_KEY=

# Ingestion Toggles
ENABLE_GDELT=true
ENABLE_GOOGLE_NEWS=true
ENABLE_HACKERNEWS=true
ENABLE_ARXIV=true
```

## API Endpoints

### Public Endpoints
- `GET /api/v1/news` — Query normalized articles (filters: `category`, `sourceId`, `query`, `sort`, `page`, `limit`)
- `GET /api/v1/news/:id` — Retrieve full article details
- `GET /api/v1/videos` — Video query and filtering (`search`, `channel`, `sort=latest|engagement`)
- `GET /api/v1/search` — Unified keyword and semantic search
- `GET /api/v1/categories` — Category counts and taxonomy list
- `GET /api/v1/feed/rss`, `/atom`, `/json` — Syndicated feeds
- `GET /api/v1/export/csv` — Sanitized data export
- `GET /api/v1/health` — System status and repository statistics
- `GET /api/v1/health/readiness` — Readiness probe for deployment orchestrators
- `GET /api/v1/media/proxy?url=...` — Memory-bounded safe media proxy

### Authenticated Admin Endpoints (`x-api-key` header required)
- `POST /api/v1/admin/sources/:source_id/enable` — Enable source connector
- `POST /api/v1/admin/sources/:source_id/disable` — Disable source connector
- `POST /api/v1/admin/sources/:source_id/fetch` — Trigger immediate source ingestion
- `POST /api/v1/admin/circuits/:name/reset` — Reset circuit breaker
- `POST /api/v1/ingest/all` — Trigger full background ingestion cycle
- `POST /api/v1/ingest/source/:source_id` — Trigger single connector ingestion
- `POST /api/v1/sources` — Register custom RSS/Atom source

## Development & Testing

```bash
# Run tests
npm test

# Build application
npm run build
```
