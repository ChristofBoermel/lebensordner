-- Post-restore deep verifier.
-- Run after baseline restore migration. Returns rows only for mismatches/missing items.

-- 1) Foreign keys
WITH expected_fks(table_name, column_name, ref_table, ref_column, on_delete) AS (
  VALUES
    ('documents', 'user_id', 'profiles', 'id', 'c'),
    ('documents', 'subcategory_id', 'subcategories', 'id', 'n'),
    ('documents', 'custom_category_id', 'custom_categories', 'id', 'n'),
    ('documents', 'reminder_watcher_id', 'trusted_persons', 'id', 'n'),
    ('trusted_persons', 'user_id', 'profiles', 'id', 'c'),
    ('trusted_persons', 'linked_user_id', 'users', 'id', 'n'),
    ('reminders', 'user_id', 'profiles', 'id', 'c'),
    ('reminders', 'document_id', 'documents', 'id', 'c'),
    ('reminders', 'reminder_watcher_id', 'trusted_persons', 'id', 'n'),
    ('medical_info', 'user_id', 'profiles', 'id', 'c'),
    ('emergency_contacts', 'user_id', 'profiles', 'id', 'c'),
    ('advance_directives', 'user_id', 'profiles', 'id', 'c'),
    ('funeral_wishes', 'user_id', 'profiles', 'id', 'c')
),
actual_fks AS (
  SELECT
    rel_t.relname AS table_name,
    a.attname AS column_name,
    rel_r.relname AS ref_table,
    af.attname AS ref_column,
    c.confdeltype AS on_delete
  FROM pg_constraint c
  JOIN pg_class rel_t ON rel_t.oid = c.conrelid
  JOIN pg_namespace n_t ON n_t.oid = rel_t.relnamespace AND n_t.nspname = 'public'
  JOIN pg_class rel_r ON rel_r.oid = c.confrelid
  JOIN pg_namespace n_r ON n_r.oid = rel_r.relnamespace
  JOIN pg_attribute a
    ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
  JOIN pg_attribute af
    ON af.attrelid = c.confrelid AND af.attnum = c.confkey[1]
  WHERE c.contype = 'f'
    AND array_length(c.conkey, 1) = 1
    AND c.connamespace = 'public'::regnamespace
)
SELECT 'missing_fk' AS issue_type, e.table_name || '.' || e.column_name AS object_name
FROM expected_fks e
LEFT JOIN actual_fks a
  ON a.table_name = e.table_name
 AND a.column_name = e.column_name
 AND a.ref_table = e.ref_table
 AND a.ref_column = e.ref_column
 AND a.on_delete = e.on_delete
WHERE a.table_name IS NULL
ORDER BY object_name;

-- 2) Critical indexes
WITH expected_indexes(index_name) AS (
  VALUES
    ('idx_documents_user_id'),
    ('idx_documents_category'),
    ('idx_documents_user_category'),
    ('idx_documents_subcategory'),
    ('idx_documents_custom_category'),
    ('idx_documents_reminder_watcher'),
    ('idx_trusted_persons_user_id'),
    ('idx_trusted_persons_rls_check'),
    ('unique_trusted_person_email_per_user'),
    ('idx_reminders_user_id'),
    ('idx_reminders_due_date'),
    ('idx_reminders_watcher')
)
SELECT 'missing_index' AS issue_type, e.index_name AS object_name
FROM expected_indexes e
LEFT JOIN pg_indexes i
  ON i.schemaname = 'public'
 AND i.indexname = e.index_name
WHERE i.indexname IS NULL
ORDER BY e.index_name;

-- 3) Critical triggers
WITH expected_triggers(trigger_name, table_name) AS (
  VALUES
    ('update_profiles_updated_at', 'profiles'),
    ('update_documents_updated_at', 'documents'),
    ('update_trusted_persons_updated_at', 'trusted_persons'),
    ('update_medical_info_updated_at', 'medical_info'),
    ('update_emergency_contacts_updated_at', 'emergency_contacts'),
    ('update_advance_directives_updated_at', 'advance_directives'),
    ('update_funeral_wishes_updated_at', 'funeral_wishes'),
    ('enforce_document_limit', 'documents'),
    ('trg_storage_used', 'documents')
)
SELECT 'missing_trigger' AS issue_type, e.table_name || '.' || e.trigger_name AS object_name
FROM expected_triggers e
LEFT JOIN information_schema.triggers t
  ON t.trigger_schema = 'public'
 AND t.event_object_table = e.table_name
 AND t.trigger_name = e.trigger_name
WHERE t.trigger_name IS NULL
ORDER BY object_name;

-- 4) Critical functions + security-definer marker
WITH expected_functions(function_name, should_be_security_definer) AS (
  VALUES
    ('update_updated_at_column', false),
    ('handle_new_user', true),
    ('check_document_limits', false),
    ('update_storage_used_on_document_change', false),
    ('delete_user_account', true),
    ('get_document_counts', true)
)
SELECT
  'missing_or_misconfigured_function' AS issue_type,
  e.function_name AS object_name
FROM expected_functions e
LEFT JOIN LATERAL (
  SELECT p.prosecdef
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = e.function_name
    AND n.nspname = 'public'
  LIMIT 1
) f ON true
WHERE f.prosecdef IS NULL
   OR f.prosecdef <> e.should_be_security_definer
ORDER BY e.function_name;

-- 5) Core table RLS enabled
WITH expected_rls(table_name) AS (
  VALUES
    ('profiles'),
    ('documents'),
    ('trusted_persons'),
    ('reminders'),
    ('medical_info'),
    ('emergency_contacts'),
    ('advance_directives'),
    ('funeral_wishes')
)
SELECT 'rls_not_enabled' AS issue_type, e.table_name AS object_name
FROM expected_rls e
LEFT JOIN pg_class c
  ON c.relname = e.table_name
LEFT JOIN pg_namespace n
  ON n.oid = c.relnamespace
WHERE n.nspname <> 'public' OR c.relrowsecurity IS DISTINCT FROM true
ORDER BY e.table_name;

-- 6) Core policies
WITH expected_policies(policy_name, table_name) AS (
  VALUES
    ('rls_profiles_select_self', 'profiles'),
    ('rls_profiles_insert_self', 'profiles'),
    ('rls_profiles_update_self', 'profiles'),
    ('rls_profiles_service_role', 'profiles'),
    ('Users can read own documents', 'documents'),
    ('Trusted persons can read owner documents', 'documents'),
    ('Users can insert own documents', 'documents'),
    ('Users can update own documents', 'documents'),
    ('Users can delete own documents', 'documents')
)
SELECT 'missing_policy' AS issue_type, e.table_name || '.' || e.policy_name AS object_name
FROM expected_policies e
LEFT JOIN pg_policies p
  ON p.schemaname = 'public'
 AND p.tablename = e.table_name
 AND p.policyname = e.policy_name
WHERE p.policyname IS NULL
ORDER BY object_name;

-- 7) Grants for authenticated/service_role (core tables)
WITH expected_grants(table_name, grantee, privilege_type) AS (
  VALUES
    ('profiles', 'authenticated', 'SELECT'),
    ('profiles', 'authenticated', 'INSERT'),
    ('profiles', 'authenticated', 'UPDATE'),
    ('documents', 'authenticated', 'SELECT'),
    ('documents', 'authenticated', 'INSERT'),
    ('documents', 'authenticated', 'UPDATE'),
    ('documents', 'authenticated', 'DELETE'),
    ('trusted_persons', 'authenticated', 'SELECT'),
    ('trusted_persons', 'authenticated', 'INSERT'),
    ('trusted_persons', 'authenticated', 'UPDATE'),
    ('trusted_persons', 'authenticated', 'DELETE'),
    ('reminders', 'authenticated', 'SELECT'),
    ('reminders', 'authenticated', 'INSERT'),
    ('reminders', 'authenticated', 'UPDATE'),
    ('reminders', 'authenticated', 'DELETE')
)
SELECT
  'missing_grant' AS issue_type,
  e.table_name || ' ' || e.grantee || ' ' || e.privilege_type AS object_name
FROM expected_grants e
LEFT JOIN information_schema.role_table_grants g
  ON g.table_schema = 'public'
 AND g.table_name = e.table_name
 AND g.grantee = e.grantee
 AND g.privilege_type = e.privilege_type
WHERE g.table_name IS NULL
ORDER BY object_name;
