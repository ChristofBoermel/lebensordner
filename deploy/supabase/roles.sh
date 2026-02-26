#!/bin/bash
set -e

# This script runs during PostgreSQL initialization to create
# the roles needed by Supabase services (PostgREST, GoTrue, Storage).
# It uses POSTGRES_PASSWORD from the environment for role passwords.

psql -v ON_ERROR_STOP=1 --username supabase_admin --dbname postgres <<-EOSQL

  -- Create postgres role if missing
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'postgres') THEN
      CREATE ROLE postgres LOGIN SUPERUSER PASSWORD '${POSTGRES_PASSWORD}';
    END IF;
  END \$\$;

  -- Authenticator (PostgREST)
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
      CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD '${POSTGRES_PASSWORD}';
    END IF;
  END \$\$;

  -- Anon
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
      CREATE ROLE anon NOLOGIN NOINHERIT;
    END IF;
  END \$\$;

  -- Authenticated
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
      CREATE ROLE authenticated NOLOGIN NOINHERIT;
    END IF;
  END \$\$;

  -- Service role
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
      CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
    END IF;
  END \$\$;

  -- Auth admin (GoTrue)
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
      CREATE ROLE supabase_auth_admin NOINHERIT LOGIN PASSWORD '${POSTGRES_PASSWORD}';
    END IF;
  END \$\$;

  -- Storage admin
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
      CREATE ROLE supabase_storage_admin NOINHERIT LOGIN PASSWORD '${POSTGRES_PASSWORD}';
    END IF;
  END \$\$;

  -- Grant roles
  GRANT anon TO authenticator;
  GRANT authenticated TO authenticator;
  GRANT service_role TO authenticator;
  GRANT supabase_auth_admin TO supabase_admin;
  GRANT supabase_storage_admin TO supabase_admin;

  -- Set passwords for existing roles (in case they already exist without passwords)
  ALTER ROLE authenticator WITH PASSWORD '${POSTGRES_PASSWORD}';
  ALTER ROLE supabase_auth_admin WITH PASSWORD '${POSTGRES_PASSWORD}';
  ALTER ROLE supabase_storage_admin WITH PASSWORD '${POSTGRES_PASSWORD}';

EOSQL
