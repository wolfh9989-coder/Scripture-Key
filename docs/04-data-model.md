# Data Model Draft

## Core Entities

### Scripture
- id (uuid)
- testament (enum: OT, NT)
- book (text)
- chapter (int)
- verse (int)
- text (text)
- translation_code (text)

Unique index:
- (translation_code, book, chapter, verse)

### ScriptureOriginal
- id (uuid)
- scripture_id (uuid fk)
- language (enum: hebrew, aramaic, greek)
- original_text (text)
- transliteration (text)
- morphology_json (jsonb)

### StrongEntry
- id (uuid)
- strong_number (text unique)
- lemma (text)
- definition (text)
- language (text)

### ScriptureStrongLink
- id (uuid)
- scripture_original_id (uuid fk)
- strong_entry_id (uuid fk)
- token_index (int)

### ScriptureNode
- id (uuid)
- scripture_id (uuid fk)
- themes (text[])
- people (text[])
- events (text[])

### ScriptureConnection
- id (uuid)
- from_scripture_id (uuid fk)
- to_scripture_id (uuid fk)
- relationship_type (text)
- confidence_score (numeric)
- evidence_json (jsonb)

### UserProfile
- id (uuid)
- username (text unique)
- display_name (text)
- reputation_score (numeric)
- created_at (timestamptz)

Note: usernames are globally unique across the full app.

### ScriptureInsight
- id (uuid)
- user_id (uuid fk)
- scripture_id (uuid fk)
- content (text)
- credibility_score (numeric)
- status (enum: pending, verified, flagged, removed)
- created_at (timestamptz)

### InterpretationRecord
- id (uuid)
- scripture_id (uuid fk)
- mode (enum: beginner, study, deep, devotional)
- literal_layer (text)
- historical_layer (text)
- prophetic_layer (text)
- symbolic_layer (text)
- alternatives_json (jsonb)
- confidence_json (jsonb)
- generated_at (timestamptz)

## Graph Projection

Nodes:
- Verse
- Theme
- Person
- Event
- Prophecy

Edges:
- REFERENCES
- FULFILLS
- PARALLELS
- SPOKEN_BY
- THEME_OF
- OCCURS_AT

## SQL Skeleton

```sql
create table scripture (
  id uuid primary key,
  testament text not null,
  book text not null,
  chapter int not null,
  verse int not null,
  text text not null,
  translation_code text not null,
  unique (translation_code, book, chapter, verse)
);

create table user_profile (
  id uuid primary key,
  username text not null unique,
  display_name text not null,
  reputation_score numeric not null default 0,
  created_at timestamptz not null default now()
);

create table scripture_insight (
  id uuid primary key,
  user_id uuid not null references user_profile(id),
  scripture_id uuid not null references scripture(id),
  content text not null,
  credibility_score numeric not null default 0,
  status text not null,
  created_at timestamptz not null default now()
);
```
