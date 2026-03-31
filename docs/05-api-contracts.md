# API Contracts (Draft)

Base path: /api/v1

## Scripture Retrieval

GET /scripture/{translation}/{book}/{chapter}/{verse}

Response:
- scripture reference
- verse text
- cross references
- original language payload
- available commentary IDs

## Unlock Verse (Key Mode)

POST /scripture/unlock

Request:
- scriptureId
- mode (beginner|study|deep|devotional)
- includePatterns (bool)
- includeGraph (bool)

Response:
- layers:
  - literal
  - historical
  - prophetic
  - symbolic
- relatedVerses[]
- confidence[]
- evidence[]

## Lattice Graph

GET /graph/verse/{scriptureId}
GET /graph/theme/{theme}
GET /graph/person/{name}
GET /graph/event/{event}

Response:
- nodes[]
- edges[]
- clusters[]

## Pattern Engine

POST /patterns/analyze

Request:
- scopeType (verse|chapter|book|corpus)
- scopeRef
- patternTypes[] (phrase_repeat|numeric|chiastic|parallel)

Response:
- findings[]
- confidence per finding
- evidence spans

## Voice and Conversational Query

POST /brcis/query

Request:
- inputType (text|voice)
- content
- mode

Response:
- intent
- answer
- supportingReferences[]
- alternateInterpretations[]

## Insights and Credibility

POST /insights
GET /insights/verse/{scriptureId}
POST /insights/{insightId}/vote
POST /insights/{insightId}/verify

Rules:
- verification requires scoped role
- credibility score is recalculated on votes, reports, and moderator actions

## Timeline and Map

GET /timeline/events
GET /map/locations/{location}
GET /map/scripture/{scriptureId}

Response:
- event/location descriptors
- linked verse references
- relationship metadata
