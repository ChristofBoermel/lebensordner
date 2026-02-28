#!/bin/sh
set -e
# Substitute environment variables into Kong declarative config before startup
sed \
  -e "s|\${SUPABASE_ANON_KEY}|${SUPABASE_ANON_KEY}|g" \
  -e "s|\${SUPABASE_SERVICE_KEY}|${SUPABASE_SERVICE_KEY}|g" \
  /var/lib/kong/kong.yml.template \
  > /var/lib/kong/kong.yml

exec /docker-entrypoint.sh kong docker-start
