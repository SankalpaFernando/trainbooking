#!/bin/sh
set -e

echo "🚂 Starting Railway Booking Backend Container..."

# Push Prisma schema to PostgreSQL
echo "Applying database schema..."
npx prisma db push --accept-data-loss

# Seed initial stations, coaches, seats, and demo bookings only when the database is empty
echo "Checking database seed state..."
if [ "$(npx prisma db execute --stdin <<< 'SELECT COUNT(*) FROM "Station";' 2>/dev/null | tail -n 1 | tr -d '[:space:]')" = "0" ]; then
  echo "Seeding database..."
  npx prisma db seed
else
  echo "Database already contains data. Skipping seed."
fi

echo "Starting Express Server..."
exec node dist/server.js
