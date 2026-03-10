#!/usr/bin/env node

/**
 * Docker 빌드 스크립트
 * package.json의 버전을 자동으로 읽어서 Docker 이미지 버전으로 사용
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// package.json 읽기
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const appName = packageJson.name;
const appVersion = packageJson.version;

console.log(`📦 Docker 이미지 빌드 시작...`);
console.log(`   앱 이름: ${appName}`);
console.log(`   버전: ${appVersion}`);
console.log(`   이미지 태그: ${appName}:${appVersion}\n`);

// 환경변수 설정
process.env.APP_VERSION = appVersion;
process.env.DOCKER_BUILDKIT = '1';

try {
  // docker compose build 실행
  execSync('docker compose build', {
    stdio: 'inherit',
    env: process.env,
    cwd: path.join(__dirname, '..'),
  });

  console.log(`\n✅ 빌드 완료: ${appName}:${appVersion}`);
} catch (error) {
  console.error('\n❌ error 빌드 실패:', error.message);
  process.exit(1);
}
