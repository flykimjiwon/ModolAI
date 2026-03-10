import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';

/**
 * 관리자 권한 검증 미들웨어
 */
export function verifyAdmin(request) {
  const authHeader = request.headers.get("authorization");
  
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const token = authHeader.split(" ")[1];
  
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    
    // 관리자 권한 확인
    if (payload.role !== 'admin') {
      return NextResponse.json({ error: "Admin privileges required." }, { status: 403 });
    }
    
    return { 
      success: true, 
      user: {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role
      }
    };
  } catch (error) {
    console.log('[Admin Auth] JWT 토큰 검증 실패:', error.message, 'Token length:', token?.length || 0);
    return NextResponse.json({ error: "Invalid token." }, { status: 401 });
  }
}

/**
 * 관리자 또는 일반 사용자 권한 검증 (관리자가 사용자 데이터를 볼 때)
 */
export function verifyUser(request) {
  const authHeader = request.headers.get("authorization");
  
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const token = authHeader.split(" ")[1];
  
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    
    return { 
      success: true, 
      user: {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role || 'user',
        department: payload.department,
        cell: payload.cell
      }
    };
  } catch (error) {
    return NextResponse.json({ error: "Invalid token." }, { status: 401 });
  }
}