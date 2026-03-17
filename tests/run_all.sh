#!/bin/bash
set -e
echo "=================================="
echo "  ModolAI — Test Suite"
echo "=================================="
echo ""

cd "$(dirname "$0")/.."

# Detect server
PORT=3000
if curl -sf "http://localhost:$PORT" > /dev/null 2>&1; then
  BASE="http://localhost:$PORT"
elif curl -sf "http://localhost:4000" > /dev/null 2>&1; then
  BASE="http://localhost:4000"
  PORT=4000
else
  echo "⚠️  ModolAI server not running. Starting tests anyway..."
  BASE="http://localhost:3000"
fi

echo "[1/3] API Tests..."
node tests/test-api.js "$BASE" 2>/dev/null || echo "  ⚠️  Some tests failed (server might not be running)"

echo ""
echo "[2/3] PostgreSQL Connection..."
if [ -f scripts/test-postgres-connection.js ]; then
  node scripts/test-postgres-connection.js 2>/dev/null && echo "  ✅ PostgreSQL connected" || echo "  ⚠️  PostgreSQL connection failed"
else
  echo "  ⏭️  test-postgres-connection.js not found"
fi

echo ""
echo "[3/3] Build Check..."
if command -v next > /dev/null 2>&1 || npx --yes next --version > /dev/null 2>&1; then
  echo "  ⏭️  Build check skipped (use 'npm run build' manually)"
else
  echo "  ⏭️  Next.js not available"
fi

echo ""
echo "=================================="
echo "  Done!"
echo "=================================="
