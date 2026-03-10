import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request) {
  try {
    // 관리자 권한 확인
    const adminCheck = verifyAdmin(request);
    if (!adminCheck.success) {
      return adminCheck;
    }

    const formData = await request.formData();
    const file = formData.get('favicon');

    if (!file) {
      return NextResponse.json(
        { error: '파비콘 파일이 필요합니다.' },
        { status: 400 }
      );
    }

    // 파일 검증
    const allowedTypes = ['image/x-icon', 'image/vnd.microsoft.icon', 'image/png', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: '파비콘은 .ico, .png, .svg 파일만 지원됩니다.' },
        { status: 400 }
      );
    }

    // 파일 크기 제한 (1MB)
    if (file.size > 1024 * 1024) {
      return NextResponse.json(
        { error: '파비콘 파일 크기는 1MB 이하여야 합니다.' },
        { status: 400 }
      );
    }

    // 업로드 디렉토리 확인/생성
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (error) {
      if (error?.code !== 'EEXIST') {
        console.warn('[upload-favicon] 디렉토리 생성 실패:', error);
      }
    }

    // 파일 저장
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // 파일 확장자 확인
    const fileExtension = file.name.split('.').pop().toLowerCase();
    const fileName = `favicon.${fileExtension}`;
    const filePath = path.join(uploadDir, fileName);
    
    await writeFile(filePath, buffer);

    // 웹 경로 반환
    const webPath = `/uploads/${fileName}`;

    return NextResponse.json({
      success: true,
      message: '파비콘이 업로드되었습니다.',
      faviconUrl: webPath
    });

  } catch (error) {
    console.error('파비콘 업로드 실패:', error);
    return NextResponse.json(
      { error: '파비콘 업로드에 실패했습니다.' },
      { status: 500 }
    );
  }
}
