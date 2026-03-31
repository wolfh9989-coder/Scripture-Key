# System Architecture

## High-Level Components

1. Scripture Data Service
- Canon text storage
- Original language mapping
- Cross-reference index

2. Interpretation Engine
- Multi-layer analysis pipeline
- Context retrieval (historical, literary, theological)
- Explainability and confidence scoring

3. Lattice Graph Service
- Verse nodes and typed edges
- Theme/person/event traversals
- Related-verse ranking

4. UMIE Pattern Engine
- Phrase repetition detection
- Numeric motif analysis
- Structural and symmetry candidate detection

5. Artifact Insight Service
- User insight CRUD
- Credibility scoring and moderation
- Verification badge workflow

6. BRCIS Command Layer
- Voice ingestion and intent detection
- Query planner and orchestration
- Response formatter by user mode

7. Presentation Layer
- Web client with split panes, graph canvas, timeline, and map
- Adaptive output modes (Beginner/Study/Deep/Devotional)

## Data Plane Recommendation

Hybrid model:

- Relational DB (PostgreSQL): canonical text, metadata, users, insights
- Graph DB (Neo4j or equivalent): scripture relationships and fast traversals
- Search Index (OpenSearch/Elasticsearch): semantic and lexical retrieval
- Cache (Redis): hot verse payloads and query results

## Request Flow Example: Unlock Verse

1. Client requests unlock for verse.
2. Scripture Data Service returns verse payload and source metadata.
3. Interpretation Engine computes layer stack and confidence bands.
4. Lattice Graph Service returns top relationship clusters.
5. UMIE service returns detected patterns for verse scope.
6. API aggregates into one explainable response envelope.

## Explainability Contract

Every generated interpretation should include:

- claim
- evidence references
- confidence score (0-1)
- interpretation type
- optional alternate views

## Reliability Targets

- p95 verse open latency under 1200 ms in Phase 1
- p95 unlock latency under 2200 ms in Phase 2
- graceful fallback when a sub-engine is degraded

## Security and Moderation

- Role-based access and scoped permissions
- Insight moderation queue and audit log
- Abuse detection signals and rate limiting
- Content provenance tracking for generated outputs
