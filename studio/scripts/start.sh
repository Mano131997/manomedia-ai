#!/bin/sh
# Container start: create/update the database, make the first admin, start the app.
set -e
npx prisma db push --skip-generate
node scripts/ensure-admin.mjs
exec npx next start -p "${PORT:-3000}"
