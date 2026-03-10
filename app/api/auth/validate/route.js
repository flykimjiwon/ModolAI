import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

/**
 * 토큰 유효성 검증 API
 */
export async function POST(request) {
  try {
    const authHeader = request.headers.get("authorization");
    
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "인증 토큰이 필요합니다." }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    
    if (!token) {
      return NextResponse.json({ error: "토큰이 제공되지 않았습니다." }, { status: 401 });
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      
      // 토큰이 유효하면 사용자 정보 반환
      return NextResponse.json({
        success: true,
        user: {
          id: payload.sub,
          email: payload.email,
          name: payload.name,
          role: payload.role || 'user',
          department: payload.department,
          cell: payload.cell
        },
        tokenInfo: {
          iat: payload.iat,
          exp: payload.exp,
          expiresIn: payload.exp - Math.floor(Date.now() / 1000)
        }
      });

    } catch (jwtError) {
      console.log('[Auth Validate] JWT 검증 실패:', jwtError.message);
      
      // JWT 에러 타입에 따른 구체적인 응답
      if (jwtError.name === 'TokenExpiredError') {
        return NextResponse.json({ 
          error: "토큰이 만료되었습니다.", 
          errorType: "expired" 
        }, { status: 401 });
      }
      
      if (jwtError.name === 'JsonWebTokenError') {
        return NextResponse.json({ 
          error: "유효하지 않은 토큰입니다.", 
          errorType: "invalid" 
        }, { status: 401 });
      }
      
      return NextResponse.json({ 
        error: "토큰 검증에 실패했습니다.", 
        errorType: "validation_failed" 
      }, { status: 401 });
    }

  } catch (error) {
    console.error('[Auth Validate] 토큰 검증 중 오류:', error);
    return NextResponse.json({ 
      error: "서버 오류가 발생했습니다.",
      errorType: "server_error" 
    }, { status: 500 });
  }
}