#!/bin/sh
set -e

echo "🚂 Starting Railway Booking Backend Container..."

# Push Prisma schema to PostgreSQL
echo "Applying database schema..."
npx prisma db push --accept-data-loss

# Seed initial stations, coaches, seats, and demo bookings
echo "Seeding database..."
npx prisma db seed || true

echo "Starting Express Server..."
exec node dist/server.js
