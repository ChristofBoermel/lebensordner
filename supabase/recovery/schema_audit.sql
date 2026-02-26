-- Schema audit for production recovery.
-- Run in Supabase SQL editor. It returns missing tables/columns/functions/policies.

WITH expected_tables(table_name) AS (
  VALUES
    ('profiles'),
    ('documents'),
    ('trusted_persons'),
    ('reminders'),
    ('medical_info'),
    ('emergency_contacts'),
    ('advance_directives'),
    ('funeral_wishes'),
    ('subcategories'),
    ('custom_categories'),
    ('feedback'),
    ('emergency_access_requests'),
    ('download_tokens'),
    ('email_retry_queue'),
    ('onboarding_feedback'),
    ('rate_limits'),
    ('auth_lockouts'),
    ('consent_ledger'),
    ('security_audit_log'),
    ('user_vault_keys'),
    ('document_relationship_keys'),
    ('document_share_tokens'),
    ('vaccinations'),
    ('download_link_documents'),
    ('download_link_wrapped_deks')
)
SELECT 'missing_table' AS issue_type, e.table_name AS object_name
FROM expected_tables e
LEFT JOIN information_schema.tables t
  ON t.table_schema = 'public' AND t.table_name = e.table_name
WHERE t.table_name IS NULL
ORDER BY e.table_name;

WITH expected_columns(table_name, column_name) AS (
  VALUES
    ('documents', 'id'),
    ('documents', 'user_id'),
    ('documents', 'category'),
    ('documents', 'title'),
    ('documents', 'file_name'),
    ('documents', 'file_path'),
    ('documents', 'file_size'),
    ('documents', 'metadata'),
    ('documents', 'wrapped_dek'),
    ('documents', 'file_iv'),
    ('documents', 'is_encrypted'),
    ('trusted_persons', 'linked_user_id'),
    ('trusted_persons', 'invitation_status'),
    ('trusted_persons', 'email_status'),
    ('reminders', 'reminder_watcher_id'),
    ('download_tokens', 'link_type'),
    ('profiles', 'subscription_status'),
    ('profiles', 'stripe_price_id'),
    ('profiles', 'role'),
    ('medical_info', 'conditions'),
    ('medical_info', 'medication_plan_updated_at'),
    ('emergency_contacts', 'email'),
    ('advance_directives', 'patient_decree_document_id'),
    ('document_share_tokens', 'permission'),
    ('document_share_tokens', 'revoked_at'),
    ('document_relationship_keys', 'wrapped_rk')
)
SELECT 'missing_column' AS issue_type, (e.table_name || '.' || e.column_name) AS object_name
FROM expected_columns e
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = e.table_name
 AND c.column_name = e.column_name
WHERE c.column_name IS NULL
ORDER BY e.table_name, e.column_name;

WITH expected_functions(function_name) AS (
  VALUES
    ('update_updated_at_column'),
    ('check_document_limits'),
    ('delete_user_account'),
    ('get_document_counts')
)
SELECT 'missing_function' AS issue_type, e.function_name AS object_name
FROM expected_functions e
LEFT JOIN LATERAL (
  SELECT 1
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = e.function_name
    AND n.nspname = 'public'
  LIMIT 1
) f ON true
WHERE f IS NULL
ORDER BY e.function_name;

WITH expected_policies(policy_name, table_name) AS (
  VALUES
    ('rls_profiles_select_self', 'profiles'),
    ('rls_profiles_insert_self', 'profiles'),
    ('rls_profiles_update_self', 'profiles'),
    ('Users can read own documents', 'documents'),
    ('Users can insert own documents', 'documents'),
    ('Users can update own documents', 'documents'),
    ('Users can delete own documents', 'documents')
)
SELECT 'missing_policy' AS issue_type, (e.table_name || '.' || e.policy_name) AS object_name
FROM expected_policies e
LEFT JOIN pg_policies p
  ON p.schemaname = 'public'
 AND p.tablename = e.table_name
 AND p.policyname = e.policy_name
WHERE p.policyname IS NULL
ORDER BY e.table_name, e.policy_name;
