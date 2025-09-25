-- Query to get all tables and their columns with types
-- Run this in your Supabase SQL editor or any PostgreSQL client

SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default,
    c.character_maximum_length
FROM 
    information_schema.tables t
    INNER JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE 
    t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
    AND c.table_schema = 'public'
ORDER BY 
    t.table_name, 
    c.ordinal_position;

-- Alternative query with more detailed information
SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    CASE 
        WHEN c.character_maximum_length IS NOT NULL 
        THEN c.data_type || '(' || c.character_maximum_length || ')'
        WHEN c.numeric_precision IS NOT NULL AND c.numeric_scale IS NOT NULL
        THEN c.data_type || '(' || c.numeric_precision || ',' || c.numeric_scale || ')'
        WHEN c.numeric_precision IS NOT NULL
        THEN c.data_type || '(' || c.numeric_precision || ')'
        ELSE c.data_type
    END as full_data_type,
    c.is_nullable,
    c.column_default,
    CASE 
        WHEN tc.constraint_type = 'PRIMARY KEY' THEN 'PK'
        WHEN tc.constraint_type = 'FOREIGN KEY' THEN 'FK'
        WHEN tc.constraint_type = 'UNIQUE' THEN 'UQ'
        ELSE ''
    END as constraints
FROM 
    information_schema.tables t
    INNER JOIN information_schema.columns c ON t.table_name = c.table_name
    LEFT JOIN information_schema.key_column_usage kcu ON 
        c.table_name = kcu.table_name AND 
        c.column_name = kcu.column_name
    LEFT JOIN information_schema.table_constraints tc ON 
        kcu.constraint_name = tc.constraint_name
WHERE 
    t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
    AND c.table_schema = 'public'
ORDER BY 
    t.table_name, 
    c.ordinal_position;

-- Simple version - just table names and column types
SELECT 
    table_name,
    string_agg(
        column_name || ' ' || data_type, 
        ', ' ORDER BY ordinal_position
    ) as columns
FROM 
    information_schema.columns 
WHERE 
    table_schema = 'public'
GROUP BY 
    table_name
ORDER BY 
    table_name;
