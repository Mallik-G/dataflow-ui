-- SQL script to drop all tables in the nexa_admin schema
-- Run this with psql or your preferred PostgreSQL client

-- Set the search path to nexa_admin schema
SET search_path TO nexa_admin;

-- Generate DROP statements for all tables
DO $$ 
DECLARE
    table_name TEXT;
    target_schema TEXT := 'nexa_admin';
BEGIN
    -- Loop through all tables in the nexa_admin schema
    FOR table_name IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = target_schema
    LOOP
        -- Drop each table with CASCADE to handle foreign keys
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(target_schema) || '.' || quote_ident(table_name) || ' CASCADE';
        RAISE NOTICE 'Dropped table: %.%', target_schema, table_name;
    END LOOP;
END $$;

-- Verify all tables are dropped
SELECT COUNT(*) as remaining_tables 
FROM pg_tables 
WHERE schemaname = 'nexa_admin';

-- If the result is 0, all tables have been successfully dropped