import { query } from '@/lib/postgres';

export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return new Response(JSON.stringify({ error: '이메일이 필요합니다.' }), {
        status: 400,
      });
    }

    // 이메일을 소문자로 정규화 (중복 방지)
    const normalizedEmail = email.toLowerCase().trim();

    const result = await query(
      'SELECT id FROM users WHERE email = $1 LIMIT 1',
      [normalizedEmail]
    );
    const existingUser = result.rows[0] || null;

    return new Response(
      JSON.stringify({
        available: !existingUser,
        message: existingUser
          ? 'Email already registered.'
          : '사용 가능한 이메일입니다.',
      }),
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error('이메일 검증 오류:', error);
    return new Response(
      JSON.stringify({ error: 'Server error occurred.' }),
      {
        status: 500,
      }
    );
  }
}
