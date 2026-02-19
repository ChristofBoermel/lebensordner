-- Migration 039: Document Count RPC Function
-- Purpose: Create get_document_counts RPC function (SECURITY DEFINER) to replace
--          in-memory document counting in the family/members route with a single
--          aggregated DB query, reducing N+1 risk for large member lists.
-- Date: 2026-02-18
-- Security rationale: SECURITY DEFINER allows the function to read documents on
--          behalf of the caller without exposing the service role. REVOKE from PUBLIC
--          and GRANT to service_role ensures only server-side code (adminClient) can
--          invoke it, preventing unauthenticated clients from enumerating counts.

-- ============================================================================
-- 1. FUNCTION: get_document_counts(p_user_ids uuid[])
-- Purpose: Return one row per user_id with the total number of documents owned
--          by that user. Users with zero documents are omitted from the result;
--          callers should use a ?? 0 fallback when looking up absent entries.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_document_counts(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, doc_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT d.user_id, COUNT(*)::bigint
    FROM documents d
    WHERE d.user_id = ANY(p_user_ids)
    GROUP BY d.user_id;
END;
$$;

COMMENT ON FUNCTION get_document_counts(uuid[]) IS 'Returns one row per user_id with the document count for each user in the supplied array. Users with no documents are omitted; callers should default absent entries to 0.';

-- ============================================================================
-- Permission hardening
-- SECURITY DEFINER functions inherit owner privileges, so we restrict EXECUTE
-- to service_role only (used by the server-side adminClient). Prevents direct
-- invocation by authenticated or anonymous Supabase client roles.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION get_document_counts(uuid[]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_document_counts(uuid[]) TO service_role;

-- ============================================================================
-- ROLLBACK SCRIPT (commented out - uncomment to reverse this migration)
-- ============================================================================

-- DROP FUNCTION IF EXISTS get_document_counts(uuid[]);
