/**
 * Public settings API - accessible without authentication
 * Returns only publicly available settings such as loginType
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

    // Return only publicly available settings (exclude sensitive info)
    return NextResponse.json(
      {
        loginType: settings.login_type || 'local',
        siteTitle: settings.site_title || 'Modol',
        siteDescription: settings.site_description || 'modol AI',
        faviconUrl: settings.favicon_url || null,
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error('Failed to fetch public settings:', error);

    // Return defaults on DB error
    return NextResponse.json(
      {
        loginType: 'local',
        siteTitle: 'Modol',
        siteDescription: 'modol AI',
        faviconUrl: null,
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  }
}
