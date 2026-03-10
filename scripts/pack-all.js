const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// package.json 읽기
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// 출력 디렉토리 (첫 번째 인자 또는 현재 디렉토리)
const outputDir = process.argv[2] || process.cwd();

// 병렬 처리 개수 (동시에 처리할 패키지 수) - 환경변수로 오버라이드 가능
// tar 압축은 CPU 집약적이므로 더 높은 병렬 처리 가능
const CONCURRENCY = parseInt(process.env.PACK_CONCURRENCY || '10', 10);

// 타임아웃 설정 (밀리초) - tar 압축은 빠르므로 짧은 타임아웃 사용
const TIMEOUT = parseInt(process.env.PACK_TIMEOUT || '30000', 10);

// 재시도 횟수
const MAX_RETRIES = 2;

// 출력 디렉토리 생성
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// node_modules 디렉토리 경로
const nodeModulesPath = path.join(__dirname, '..', 'node_modules');

// node_modules에서 모든 패키지 정보 수집
function getAllPackagesFromNodeModules() {
  const packages = new Map();

  const yarnLockPath = path.join(__dirname, '..', 'yarn.lock');

  // 방법 1: yarn.lock 사용
  if (fs.existsSync(yarnLockPath)) {
    console.log('yarn.lock에서 패키지 정보를 수집하는 중...\n');
    try {
      const lockContent = fs.readFileSync(yarnLockPath, 'utf8');
      const lines = lockContent.split('\n');

      let currentPackages = [];
      let currentVersion = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 패키지 이름 라인 (들여쓰기 없고, @로 시작하거나 문자로 시작)
        if (line.match(/^[^#\s]/) && line.includes('@')) {
          // 쉼표로 구분된 여러 패키지가 있을 수 있음
          const packageEntries = line.split(',').map((s) => s.trim());
          currentPackages = [];

          for (const entry of packageEntries) {
            // "package-name@version" 또는 package-name@version 형태
            const match = entry.match(/^"?([^@"]+)@/);
            if (match && match[1]) {
              const pkgName = match[1].trim();
              // 빈 문자열이나 특수문자만 있는 경우 제외
              if (pkgName && pkgName.length > 0 && pkgName !== '"') {
                currentPackages.push(pkgName);
              }
            }
          }
        }
        // 버전 라인 (들여쓰기 있음)
        else if (line.match(/^\s+version\s+"(.+)"/)) {
          const versionMatch = line.match(/version\s+"(.+)"/);
          if (versionMatch && currentPackages.length > 0) {
            currentVersion = versionMatch[1];
            // 모든 현재 패키지에 대해 버전 저장
            for (const pkgName of currentPackages) {
              if (!packages.has(pkgName)) {
                packages.set(pkgName, {
                  name: pkgName,
                  version: currentVersion,
                  resolved: null,
                });
              }
            }
            currentPackages = [];
            currentVersion = null;
          }
        }
      }

      if (packages.size > 0) {
        console.log(
          `✓ yarn.lock에서 ${packages.size}개의 패키지를 찾았습니다.\n`
        );
        return Array.from(packages.values());
      }
    } catch (error) {
      console.warn('⚠️  yarn.lock 파싱 실패, 다른 방법을 시도합니다...\n');
    }
  }

  // 방법 2: yarn list 사용
  if (!fs.existsSync(nodeModulesPath)) {
    console.error('❌ node_modules 디렉토리를 찾을 수 없습니다.');
    console.error('먼저 yarn install을 실행해주세요.');
    process.exit(1);
  }

  console.log('yarn list로 패키지 정보를 수집하는 중...\n');

  try {
    const listOutput = execSync('yarn list --json --depth=0', {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      stdio: 'pipe',
    });

    const lines = listOutput.split('\n').filter((line) => line.trim());

    lines.forEach((line) => {
      try {
        const data = JSON.parse(line);
        if (data.type === 'tree' && data.data && data.data.trees) {
          data.data.trees.forEach((tree) => {
            const match = tree.name.match(/^(.+)@(.+)$/);
            if (match) {
              const [, name, version] = match;
              if (!packages.has(name)) {
                packages.set(name, {
                  name,
                  version,
                  resolved: null,
                });
              }
            }
          });
        }
      } catch (e) {
        console.warn('[pack-all] yarn list 파싱 실패:', e?.message);
      }
    });

    if (packages.size > 0) {
      return Array.from(packages.values());
    }
  } catch (error) {
    console.warn(
      '⚠️  yarn list 실행 실패, node_modules 디렉토리를 직접 스캔합니다...\n'
    );

    // 대안: node_modules 디렉토리를 직접 스캔
    function scanNodeModules(dir, depth = 0) {
      if (depth > 3) return; // 너무 깊이 들어가지 않도록 제한

      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        entries.forEach((entry) => {
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            const pkgPath = path.join(dir, entry.name);
            const pkgJsonPath = path.join(pkgPath, 'package.json');

            if (fs.existsSync(pkgJsonPath)) {
              try {
                const pkgJson = JSON.parse(
                  fs.readFileSync(pkgJsonPath, 'utf8')
                );
                if (pkgJson.name && pkgJson.version) {
                  if (!packages.has(pkgJson.name)) {
                    packages.set(pkgJson.name, {
                      name: pkgJson.name,
                      version: pkgJson.version,
                      resolved: null,
                    });
                  }
                }
              } catch (e) {
                console.warn(
                  '[pack-all] package.json 파싱 실패:',
                  pkgJsonPath,
                  e?.message
                );
              }
            }

            // @scope 패키지 처리
            if (entry.name.startsWith('@')) {
              scanNodeModules(pkgPath, depth + 1);
            }
          }
        });
      } catch (error) {
        console.warn('[pack-all] 디렉토리 읽기 실패:', dir, error?.message);
      }
    }

    scanNodeModules(nodeModulesPath);
  }

  return Array.from(packages.values());
}

// node_modules에서 패키지 경로 찾기
function findPackageInNodeModules(packageName) {
  const normalPath = path.join(nodeModulesPath, packageName);
  if (fs.existsSync(normalPath)) {
    return normalPath;
  }

  // @scope 패키지인 경우
  if (packageName.includes('/')) {
    const scopedPath = path.join(nodeModulesPath, packageName);
    if (fs.existsSync(scopedPath)) {
      return scopedPath;
    }
  }

  return null;
}

// 단일 패키지 패킹 함수 (재시도 로직 포함)
async function packPackage(pkg, index, total, retryCount = 0) {
  const tgzName = `${pkg.name.replace(/\//g, '-').replace(/@/g, '')}-${
    pkg.version
  }.tgz`;
  const tgzPath = path.join(outputDir, tgzName);

  // 이미 존재하면 스킵
  if (fs.existsSync(tgzPath)) {
    console.log(
      `[${index + 1}/${total}] ⊘ 스킵 (이미 존재): ${pkg.name}@${pkg.version}`
    );
    return {
      success: true,
      skipped: true,
      name: pkg.name,
      version: pkg.version,
    };
  }

  try {
    const retryText =
      retryCount > 0 ? ` (재시도 ${retryCount}/${MAX_RETRIES})` : '';
    console.log(
      `[${index + 1}/${total}] 패킹 중: ${pkg.name}@${pkg.version}${retryText}`
    );

    // node_modules에서 패키지 경로 찾기
    const pkgPath = findPackageInNodeModules(pkg.name);
    if (!pkgPath) {
      throw new Error('node_modules에서 패키지를 찾을 수 없습니다');
    }

    // package.json 읽어서 파일 목록 확인
    const pkgJsonPath = path.join(pkgPath, 'package.json');
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

    // tar를 사용하여 node_modules의 패키지를 직접 압축 (원격 다운로드 없음)
    // npm pack 형식과 동일하게 package/ 디렉토리 안에 압축
    const packageName = path.basename(pkgPath);
    const parentDir = path.dirname(pkgPath);

    // tar 명령어로 직접 압축 (gzip 사용)
    // --exclude를 사용하여 불필요한 파일 제외
    const command = `tar -czf "${tgzPath}" -C "${parentDir}" --exclude='node_modules' --exclude='.git' --exclude='test' --exclude='tests' --exclude='*.test.js' --exclude='*.spec.js' "${packageName}"`;

    await execAsync(command, {
      timeout: TIMEOUT,
      maxBuffer: 50 * 1024 * 1024, // 50MB 버퍼
    });

    // 생성된 파일 확인
    if (!fs.existsSync(tgzPath)) {
      throw new Error('tar 파일 생성 실패');
    }

    console.log(`[${index + 1}/${total}] ✓ 완료: ${pkg.name}@${pkg.version}`);
    return {
      success: true,
      skipped: false,
      name: pkg.name,
      version: pkg.version,
    };
  } catch (error) {
    // 타임아웃이나 일시적 오류의 경우 재시도
    if (retryCount < MAX_RETRIES) {
      console.warn(
        `[${index + 1}/${total}] ⚠ 오류 발생, 재시도 중: ${pkg.name}@${
          pkg.version
        }`
      );
      // 재시도 전 잠시 대기 (지수 백오프)
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * Math.pow(2, retryCount))
      );
      return packPackage(pkg, index, total, retryCount + 1);
    }

    console.error(
      `[${index + 1}/${total}] ✗ 실패: ${pkg.name}@${pkg.version} - ${
        error.message
      }`
    );
    return {
      success: false,
      skipped: false,
      name: pkg.name,
      version: pkg.version,
      error: error.message,
    };
  }
}

// 병렬 처리 함수
async function processPackagesInParallel(packages) {
  const total = packages.length;
  const results = [];

  // CONCURRENCY 개수만큼 동시에 처리
  for (let i = 0; i < packages.length; i += CONCURRENCY) {
    const batch = packages.slice(i, Math.min(i + CONCURRENCY, packages.length));
    const batchPromises = batch.map((pkg, idx) =>
      packPackage(pkg, i + idx, total)
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // 진행 상황 표시
    const completed = results.length;
    const successCount = results.filter((r) => r.success && !r.skipped).length;
    const skippedCount = results.filter((r) => r.skipped).length;
    const failedCount = results.filter((r) => !r.success).length;
    console.log(
      `\n진행 상황: ${completed}/${total} (성공: ${successCount}, 스킵: ${skippedCount}, 실패: ${failedCount})\n`
    );
  }

  return results;
}

// 메인 실행
(async () => {
  try {
    // 모든 패키지 가져오기
    const allPackages = getAllPackagesFromNodeModules();
    const total = allPackages.length;

    console.log(`총 ${total}개의 패키지를 패킹합니다...`);
    console.log(`출력 디렉토리: ${outputDir}`);
    console.log(`패킹 방식: node_modules 직접 압축 (오프라인 모드)`);
    console.log(
      `병렬 처리 개수: ${CONCURRENCY} (PACK_CONCURRENCY 환경변수로 변경 가능)`
    );
    console.log(
      `패키지당 타임아웃: ${
        TIMEOUT / 1000
      }초 (PACK_TIMEOUT 환경변수로 변경 가능)`
    );
    console.log(`최대 재시도 횟수: ${MAX_RETRIES}\n`);

    // 병렬 처리 시작
    const startTime = Date.now();
    const results = await processPackagesInParallel(allPackages);
    const endTime = Date.now();

    // 결과 집계
    const success = results.filter((r) => r.success && !r.skipped).length;
    const skipped = results.filter((r) => r.skipped).length;
    const failed = results.filter((r) => !r.success).length;
    const failedPackages = results.filter((r) => !r.success);

    console.log('\n=== 패킹 완료 ===');
    console.log(`총 소요 시간: ${((endTime - startTime) / 1000).toFixed(2)}초`);
    console.log(`성공: ${success}개`);
    console.log(`스킵: ${skipped}개`);
    console.log(`실패: ${failed}개`);

    if (failedPackages.length > 0) {
      console.log('\n실패한 패키지:');
      failedPackages.forEach((pkg) => {
        console.log(
          `  - ${pkg.name}@${pkg.version}: ${pkg.error || '알 수 없는 오류'}`
        );
      });
    }

    console.log(`\n모든 .tgz 파일이 ${outputDir} 디렉토리에 저장되었습니다.`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ 오류 발생:', error.message);
    process.exit(1);
  }
})();
