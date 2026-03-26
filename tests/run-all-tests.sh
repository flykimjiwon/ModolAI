#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  ModolAI — 종합 테스트 러너 (병렬 실행)
#  Usage: bash tests/run-all-tests.sh [base_url]
# ═══════════════════════════════════════════════════════════
set -euo pipefail

BASE_URL="${1:-http://localhost:3100}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
REPORT_DIR="$PROJECT_DIR/tests/reports"

mkdir -p "$REPORT_DIR"

echo ""
echo "╔═══════════════════════════════════════════════════╗"
echo "║     ModolAI 종합 테스트 스위트                     ║"
echo "║     Target: $BASE_URL                             ║"
echo "║     $(date '+%Y-%m-%d %H:%M:%S')                  ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# ─── Phase 0: Server Health Check ──────────────────────
echo "▶ [Phase 0] 서버 상태 확인..."
if curl -sf "$BASE_URL" -o /dev/null -w "" 2>/dev/null; then
  echo "  ✅ 서버 응답 정상"
else
  echo "  ❌ 서버 미응답 ($BASE_URL)"
  echo "  서버를 먼저 시작하세요: npm run dev"
  exit 1
fi

# ─── Phase 1: Legacy API Tests ─────────────────────────
echo ""
echo "▶ [Phase 1] Legacy API 테스트..."
node "$SCRIPT_DIR/test-api.js" "$BASE_URL" 2>/dev/null | tee "$REPORT_DIR/legacy-api.log" || true

# ─── Phase 2: PostgreSQL Connection ────────────────────
echo ""
echo "▶ [Phase 2] PostgreSQL 연결 테스트..."
if [ -f "$PROJECT_DIR/scripts/test-postgres-connection.js" ]; then
  cd "$PROJECT_DIR" && node scripts/test-postgres-connection.js 2>/dev/null && echo "  ✅ PostgreSQL 연결 성공" || echo "  ⚠️  PostgreSQL 연결 실패"
else
  echo "  ⏭️  건너뜀 (스크립트 없음)"
fi

# ─── Phase 3: Playwright 테스트 (병렬 실행) ─────────────
echo ""
echo "▶ [Phase 3] Playwright E2E + API 테스트 (4 workers, 병렬)..."
echo "  프로젝트: auth-setup → chromium-1, chromium-2, api-tests"
echo ""

cd "$PROJECT_DIR"

# Run all Playwright projects
BASE_URL="$BASE_URL" npx playwright test \
  --reporter=list \
  2>&1 | tee "$REPORT_DIR/playwright.log" || true

# ─── Phase 4: Report Summary ──────────────────────────
echo ""
echo "╔═══════════════════════════════════════════════════╗"
echo "║     테스트 완료!                                    ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""
echo "📊 리포트 위치:"
echo "  • Legacy API:  $REPORT_DIR/legacy-api.log"
echo "  • Playwright:  $REPORT_DIR/playwright.log"
echo "  • HTML 리포트: $REPORT_DIR/html/index.html"
echo "  • JSON 리포트: $REPORT_DIR/results.json"
echo ""
echo "🔍 HTML 리포트 열기:"
echo "  npx playwright show-report tests/reports/html"
echo ""
