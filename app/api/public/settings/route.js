/**
 * 공개 설정 API - 인증 없이 접근 가능
 * loginType 등 공개 가능한 설정만 반환
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET() {
  try {
    const result = await query(
      `SELECT
         login_type,
         site_title,
         site_description,
         favicon_url
       FROM settings
       WHERE config_type = 'general'
       LIMIT 1`
    );
    const settings = result.rows[0] || {};

    // 공개 가능한 설정만 반환 (민감 정보 제외)
    return NextResponse.json(
      {
        loginType: settings.login_type || 'local',
        siteTitle: settings.site_title || 'TechAI',
        siteDescription: settings.site_description || '신한은행 Tech그룹 AI',
        faviconUrl: settings.favicon_url || null,
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error('공개 설정 조회 실패:', error);

    // DB 오류 시 기본값 반환
    return NextResponse.json(
      {
        loginType: 'local',
        siteTitle: 'TechAI',
        siteDescription: '신한은행 Tech그룹 AI',
        faviconUrl: null,
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  }
}
