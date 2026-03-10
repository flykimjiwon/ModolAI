import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { verifyToken } from '@/lib/auth';
import { randomBytes } from 'crypto';

export async function POST(request) {
  try {
    // 토큰 검증 (로그인한 사용자만)
    const payload = verifyToken(request);
    if (!payload) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const data = await request.formData();
    const file = data.get('image');

    if (!file) {
      return NextResponse.json({ error: '이미지 파일이 필요합니다.' }, { status: 400 });
    }

    // 파일 크기 검증 (10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: '파일 크기는 10MB를 초과할 수 없습니다.' }, { status: 400 });
    }

    // 파일 확장자 검증
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: '지원하지 않는 파일 형식입니다. (JPG, PNG, GIF, WebP만 지원)' }, { status: 400 });
    }

    // 파일명 생성 (타임스탬프 + 랜덤 + 확장자)
    const timestamp = Date.now();
    const random = randomBytes(8).toString('hex');
    const extension = file.name.split('.').pop();
    const fileName = `${timestamp}_${random}.${extension}`;

    // 업로드 디렉토리 생성
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'images');
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (error) {
      if (error?.code !== 'EEXIST') {
        console.warn('[upload-image] 디렉토리 생성 실패:', error);
      }
    }

    // 파일 저장
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = join(uploadDir, fileName);
    
    await writeFile(filePath, buffer);

    // 공개 URL 생성
    const imageUrl = `/uploads/images/${fileName}`;

    return NextResponse.json({
      success: true,
      url: imageUrl,
      filename: fileName,
      size: file.size,
      type: file.type
    });

  } catch (error) {
    console.error('이미지 업로드 실패:', error);
    return NextResponse.json(
      { error: '이미지 업로드에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// 파일 크기 제한을 위한 설정
export const runtime = 'nodejs';
export const maxDuration = 30; // 30초 제한
