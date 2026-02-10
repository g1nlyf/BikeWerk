/**
 * Safe helper for capturing Supabase schema details without logging secrets.
 *
 * This script does NOT connect to Supabase. It prints SQL queries you can run in
 * the Supabase SQL Editor to export schema metadata as JSON.
 *
 * Usage:
 *   node scripts/supabase_schema_dump.js
 *
 * Then copy the single-cell JSON outputs into:
 *   docs/supabase_schema_columns.json
 *   docs/supabase_schema_constraints.json
 *   docs/supabase_schema_indexes.json
 */

function main() {
  // Read env vars for operator context only. Never print their values.
  const hasSupabaseUrl = Boolean(process.env.SUPABASE_URL)
  const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  console.log(
    `SUPABASE_URL set: ${hasSupabaseUrl ? 'yes' : 'no'}; SUPABASE_SERVICE_ROLE_KEY set: ${hasServiceRoleKey ? 'yes' : 'no'}`,
  )
  console.log('')
  const targets = [
    'orders',
    'leads',
    'customers',
    'shipments',
    'tasks',
    'inspections',
    'order_status_events',
    'users',
  ]

  const tableList = targets.map((t) => `'${t}'`).join(', ')

  const columnsQuery = `
-- 1) Columns (types/defaults/nullability)
select jsonb_pretty(
  jsonb_object_agg(c.table_name, c.cols)
) as columns_json
from (
  select
    table_name,
    jsonb_agg(
      jsonb_build_object(
        'column', column_name,
        'data_type', data_type,
        'udt_name', udt_name,
        'is_nullable', is_nullable,
        'column_default', column_default
      )
      order by ordinal_position
    ) as cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name in (${tableList})
  group by table_name
) c;
`.trim()

  const constraintsQuery = `
-- 2) Constraints (pk/unique/fk/check)
select jsonb_pretty(
  jsonb_object_agg(t.table_name, t.constraints)
) as constraints_json
from (
  select
    tc.table_name,
    jsonb_agg(
      jsonb_build_object(
        'constraint_name', tc.constraint_name,
        'constraint_type', tc.constraint_type,
        'columns', coalesce(cols.columns, '[]'::jsonb),
        'fk', fk.fk,
        'check', chk.check
      )
      order by tc.constraint_type, tc.constraint_name
    ) as constraints
  from information_schema.table_constraints tc
  left join (
    select
      kcu.table_name,
      kcu.constraint_name,
      jsonb_agg(kcu.column_name order by kcu.ordinal_position) as columns
    from information_schema.key_column_usage kcu
    where kcu.table_schema = 'public'
    group by kcu.table_name, kcu.constraint_name
  ) cols on cols.table_name = tc.table_name and cols.constraint_name = tc.constraint_name
  left join (
    select
      kcu.table_name,
      kcu.constraint_name,
      jsonb_build_object(
        'foreign_table', ccu.table_name,
        'foreign_columns', jsonb_agg(ccu.column_name)
      ) as fk
    from information_schema.key_column_usage kcu
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_schema = kcu.constraint_schema
     and ccu.constraint_name = kcu.constraint_name
    where kcu.table_schema = 'public'
    group by kcu.table_name, kcu.constraint_name, ccu.table_name
  ) fk on fk.table_name = tc.table_name and fk.constraint_name = tc.constraint_name
  left join (
    select
      conrelid::regclass::text as table_name,
      conname as constraint_name,
      pg_get_constraintdef(oid) as check
    from pg_constraint
    where contype = 'c'
  ) chk on chk.table_name = tc.table_name and chk.constraint_name = tc.constraint_name
  where tc.table_schema = 'public'
    and tc.table_name in (${tableList})
  group by tc.table_name
) t;
`.trim()

  const indexesQuery = `
-- 3) Indexes
select jsonb_pretty(
  jsonb_object_agg(i.tablename, i.indexes)
) as indexes_json
from (
  select
    tablename,
    jsonb_agg(
      jsonb_build_object(
        'indexname', indexname,
        'indexdef', indexdef
      )
      order by indexname
    ) as indexes
  from pg_indexes
  where schemaname = 'public'
    and tablename in (${tableList})
  group by tablename
) i;
`.trim()

  const enumsQuery = `
-- Bonus) Enum values (lead_status_enum, order_status_enum, etc.)
select jsonb_pretty(
  jsonb_object_agg(t.typname, t.values)
) as enum_json
from (
  select
    t.typname,
    jsonb_agg(e.enumlabel order by e.enumsortorder) as values
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
  group by t.typname
) t;
`.trim()

  console.log('Run these in Supabase SQL Editor and copy the outputs into docs/*.json files.')
  console.log('\n==== columns ====\n' + columnsQuery)
  console.log('\n==== constraints ====\n' + constraintsQuery)
  console.log('\n==== indexes ====\n' + indexesQuery)
  console.log('\n==== enums (bonus) ====\n' + enumsQuery)
}

main()
