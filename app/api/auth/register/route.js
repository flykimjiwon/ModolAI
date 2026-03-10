import { query } from '@/lib/postgres';
import bcryptjs from 'bcryptjs';

export async function POST(request) {
  const { name, email, password, department, position } = await request.json();

  // 입력값 검증
  if (!name || !email || !password || !department || !position) {
    return new Response(
      JSON.stringify({ error: '모든 필드를 입력해주세요.' }),
      {
        status: 400,
      }
    );
  }

  // 이메일을 소문자로 정규화 (중복 방지)
  const normalizedEmail = email.toLowerCase().trim();

  // 유효한 부서인지 확인
  const validDepartments = [
    '디지털서비스개발부',
    '글로벌서비스개발부',
    '금융서비스개발부',
    '정보서비스개발부',
    'Tech혁신Unit',
    '기타부서',
  ];
  if (!validDepartments.includes(department)) {
    return new Response(
      JSON.stringify({ error: '유효하지 않은 부서입니다.' }),
      {
        status: 400,
      }
    );
  }

  try {
    // 중복 이메일 사전 검증 (정규화된 이메일로 검색)
    const existingResult = await query(
      'SELECT id FROM users WHERE email = $1 LIMIT 1',
      [normalizedEmail]
    );

    if (existingResult.rows.length > 0) {
      return new Response(
        JSON.stringify({ error: '이미 등록된 이메일입니다.' }),
        {
          status: 409,
        }
      );
    }

    // 비밀번호 해시
    const hash = await bcryptjs.hash(password, 12);

    await query(
      `INSERT INTO users (name, email, password_hash, department, employee_position_name, role, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        name,
        normalizedEmail, // 정규화된 이메일 저장
        hash,
        department,
        position,
        'user', // 기본 역할
        new Date(),
      ]
    );
    return new Response(JSON.stringify({ ok: true }), { status: 201 });
  } catch (e) {
    // 중복 이메일(Unique constraint) 오류
    if (e.code === '23505') {
      return new Response(
        JSON.stringify({ error: '이미 등록된 이메일입니다.' }),
        {
          status: 409,
        }
      );
    }
    return new Response(
      JSON.stringify({ error: '회원가입 중 오류가 발생했습니다.' }),
      {
        status: 500,
      }
    );
  }
}
