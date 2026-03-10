import { query } from '@/lib/postgres';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { runAutoMigration } from '@/lib/autoMigrate';


export async function POST(request) {
  const { email, password } = await request.json();

  // 이메일을 소문자로 정규화 (중복 방지)
  const normalizedEmail = email?.toLowerCase().trim();

  const result = await query(
    'SELECT id, email, password_hash, name, department, cell, role, auth_type FROM users WHERE email = $1',
    [normalizedEmail]
  );

  if (result.rows.length === 0) {
    return new Response(
      JSON.stringify({ error: '이메일이 존재하지 않습니다' }),
      {
        status: 401,
      }
    );
  }

  const user = result.rows[0];

  // SSO 사용자는 일반 로그인 불가
  if (user.auth_type === 'sso') {
    return new Response(
      JSON.stringify({ error: 'SSO 계정입니다. Swing 로그인(/sso)을 이용해주세요.' }),
      {
        status: 401,
      }
    );
  }

  // password_hash가 없는 경우 (비정상 케이스)
  if (!user.password_hash) {
    return new Response(
      JSON.stringify({ error: '비밀번호가 설정되지 않은 계정입니다. 관리자에게 문의하세요.' }),
      {
        status: 401,
      }
    );
  }

  const match = await bcryptjs.compare(password, user.password_hash);
  if (!match) {
    return new Response(
      JSON.stringify({ error: '비밀번호가 올바르지 않습니다' }),
      {
        status: 401,
      }
    );
  }

  // 마지막 접속시간 업데이트
  await query(
    'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
    [user.id]
  );

  // admin@shinhan.com 로그인 시 초기 스키마 + 마이그레이션 자동 실행 (백그라운드, 로그인 응답 지연 없음)
  if (normalizedEmail === 'admin@shinhan.com') {
    runAutoMigration().catch((err) =>
      console.warn('[AutoMigrate] 백그라운드 실패:', err.message)
    );
  }


  // JWT 발급 (비밀키는 .env 에 보관) - 1시간 세션 (refresh token으로 자동 연장)
  const token = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      department: user.department,
      cell: user.cell,
      role: user.role || 'user',
      authType: 'local',
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Refresh token 발급 (30일) → httpOnly cookie
  const refreshToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip') || null;
  const userAgent = request.headers.get('user-agent') || null;

  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [user.id, tokenHash, expiresAt, ipAddress, userAgent]
  ).catch((err) => {
    console.warn('[Login] refresh token 저장 실패 (skip):', err.message);
  });

  const response = new Response(JSON.stringify({ token }), { status: 200 });
  const cookieOptions = [
    `refresh_token=${refreshToken}`,
    'HttpOnly',
    'Path=/api/auth',
    'SameSite=Lax',
    `Max-Age=${30 * 24 * 60 * 60}`,
    ...(process.env.NODE_ENV === 'production' ? ['Secure'] : []),
  ].join('; ');
  response.headers.set('Set-Cookie', cookieOptions);
  return response;
}
