# Supabase Schema Export (Safe How-To)

Goal:
- Export schema details (columns, constraints, indexes, enums) from Supabase without printing or storing any API keys.
- Save outputs locally in `docs/` so code and migrations can be validated against the real schema.

This repo does NOT connect to Supabase from scripts for schema introspection (no direct DB connection, no pg-meta).
Instead, use the Supabase SQL Editor and copy the results to files.

## Step 1: Generate SQL queries

Run:
- `node scripts/supabase_schema_dump.js`

It prints four SQL queries:
- columns
- constraints
- indexes
- enums (bonus)

## Step 2: Run in Supabase SQL Editor

In Supabase dashboard:
- Open SQL Editor
- Paste the query block
- Run it
- Copy the single JSON cell result

## Step 3: Save results locally

Create/update these files with the copied JSON output (exact filenames):
- `docs/supabase_schema_columns.json`
- `docs/supabase_schema_constraints.json`
- `docs/supabase_schema_indexes.json`

Optional but recommended (enums):
- `docs/supabase_schema_enums.json`

## Notes

- Do not paste anon keys, service role keys, or any secrets into repo files.
- If you need to share schema snapshots externally, share only these JSON exports or screenshots of the table editor (columns/types/constraints).

