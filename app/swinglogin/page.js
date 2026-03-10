'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TokenManager } from '@/lib/tokenManager';

const DEFAULTS = {
  swingUrl: 'https://apigw.shinhan.com:8443',
  clientId: '',
  clientSecret: '',
  companyCode: 'SH',
  employeeNo: '23103159',
};

const maskSecret = (value) =>
  value ? `${value.slice(0, 4)}****${value.slice(-4)}` : '';

const toBase64 = (buffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)));

const toHex = (buffer) =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

function sha256FallbackBytes(ascii) {
  const rightRotate = (value, amount) => (value >>> amount) | (value << (32 - amount));
  let mathPow = Math.pow;
  let maxWord = mathPow(2, 32);
  let result = '';

  const words = [];
  const asciiBitLength = ascii.length * 8;

  let hash = [];
  let k = [];
  let primeCounter = 0;
  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate += 1) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter += 1;
    }
  }

  ascii += '\x80';
  while (ascii.length % 64 - 56) ascii += '\x00';
  for (let i = 0; i < ascii.length; i += 1) {
    const j = ascii.charCodeAt(i);
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (let j = 0; j < words.length;) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);
    for (let i = 0; i < 64; i += 1) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
              (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
              w[i - 7] +
              (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
            0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
      hash.pop();
    }
    for (let i = 0; i < 8; i += 1) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (let i = 0; i < 8; i += 1) {
    for (let j = 3; j + 1; j -= 1) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += String.fromCharCode(b);
    }
  }
  return new Uint8Array(
    Array.from(result, (c) => c.charCodeAt(0))
  );
}

async function sha256Base64(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  if (globalThis.crypto?.subtle?.digest) {
    const hash = await globalThis.crypto.subtle.digest('SHA-256', data);
    return toBase64(hash);
  }
  const hashBytes = sha256FallbackBytes(text);
  return toBase64(hashBytes.buffer);
}

async function sha256Hex(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  if (globalThis.crypto?.subtle?.digest) {
    const hash = await globalThis.crypto.subtle.digest('SHA-256', data);
    return toHex(hash);
  }
  const hashBytes = sha256FallbackBytes(text);
  return toHex(hashBytes.buffer);
}

export default function SwingLoginPage() {
  const [swingUrl, setSwingUrl] = useState(DEFAULTS.swingUrl);
  const [companyCode, setCompanyCode] = useState(DEFAULTS.companyCode);
  const [clientId, setClientId] = useState(DEFAULTS.clientId);
  const [clientSecret, setClientSecret] = useState(DEFAULTS.clientSecret);
  const [employeeNo, setEmployeeNo] = useState(DEFAULTS.employeeNo);
  const [password, setPassword] = useState('');
  const [hashEncoding] = useState('hex');
  const [rawRequestJson, setRawRequestJson] = useState(
    JSON.stringify(
      {
        common: {
          companyCode: DEFAULTS.companyCode,
          clientId: DEFAULTS.clientId,
          clientSecret: DEFAULTS.clientSecret,
          employeeNo: DEFAULTS.employeeNo,
        },
        data: {
          loginPassword: '',
        },
      },
      null,
      2
    )
  );
  const [useRawRequest, setUseRawRequest] = useState(false);
  const [responseData, setResponseData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);

  const router = useRouter();

  // 관리자 권한 확인 (admin 레이아웃과 동일한 패턴)
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setIsValidating(true);

        // 토큰 존재 확인
        const token = localStorage.getItem('token');
        if (!token) {
          const loginUrl = await TokenManager.getLoginUrl(window.location.pathname);
          router.replace(loginUrl);
          return;
        }

        // 토큰 유효성 검증
        const result = await TokenManager.validateToken();
        if (!result.valid) {
          console.log('토큰이 유효하지 않습니다:', result.reason);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          const loginUrl = await TokenManager.getLoginUrl(window.location.pathname);
          router.replace(loginUrl);
          return;
        }

        // 관리자 권한 확인
        if (result.user.role !== 'admin') {
          console.log('관리자 권한이 필요합니다.');
          router.replace('/');
          return;
        }
      } catch (error) {
        console.error('인증 초기화 실패:', error);
        const loginUrl = await TokenManager.getLoginUrl(window.location.pathname);
        router.replace(loginUrl);
      } finally {
        setIsValidating(false);
      }
    };

    initializeAuth();
  }, [router]);

  const addLog = (message, data = null) => {
    const entry = {
      time: new Date().toLocaleTimeString('ko-KR'),
      message,
      data,
    };
    setLogs((prev) => [entry, ...prev].slice(0, 50));
    console.log(`[swinglogin] ${message}`, data || '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setResponseData(null);

    if (!employeeNo || !password) {
      addLog('입력값 누락: employeeNo 또는 password');
      return;
    }

    setLoading(true);
    try {
      const loginPassword = await sha256Hex(password);
      let payload = {
        common: {
          companyCode,
          clientId,
          clientSecret,
          employeeNo,
        },
        data: {
          loginPassword,
        },
      };

      if (useRawRequest && rawRequestJson.trim()) {
        try {
          payload = JSON.parse(rawRequestJson);
        } catch (parseError) {
          addLog('요청 JSON 파싱 실패', { message: parseError.message });
          setLoading(false);
          return;
        }
      }

      addLog('IDPW 인증 요청 (서버 프록시)', {
        endpoint: `${swingUrl}/cau/v1/idpw-authorize`,
        common: {
          companyCode: payload.common?.companyCode,
          clientId: payload.common?.clientId,
          clientSecret: maskSecret(payload.common?.clientSecret || ''),
          employeeNo: payload.common?.employeeNo,
        },
        data: {
          loginPassword: payload.data?.loginPassword
            ? `${String(payload.data.loginPassword).slice(0, 6)}...`
            : '',
          encoding: hashEncoding,
        },
      });

      // 서버 프록시를 통해 호출 (CORS 우회)
      const res = await fetch('/api/auth/swing-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ swingUrl, payload }),
      });

      const result = await res.json().catch(() => ({}));

      if (result.error) {
        setResponseData({ error: result.error, detail: result.detail });
        addLog('요청 실패', { error: result.error, detail: result.detail });
      } else {
        setResponseData(result.data);
        addLog('응답 수신', { status: result.status, body: result.data });
      }
    } catch (error) {
      addLog('요청 실패', { message: error.message });
      setResponseData({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  // 인증 확인 중 로딩 화면
  if (isValidating) {
    return (
      <div className='min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center'>
        <div className='flex flex-col items-center gap-4'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
          <p className='text-gray-600 dark:text-gray-400'>인증 확인 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200'>
      <div className='w-full max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6'>
        <div className='bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6'>
          <h1 className='text-2xl font-bold text-gray-900 dark:text-white mb-2'>
            Swing Login (ID/PW 인증)
          </h1>
          <p className='text-sm text-gray-500 dark:text-gray-400 mb-6'>
            ID는 사번(employeeNo)이며, PW는 SHA256(Base64)로 암호화되어
            전송됩니다.
          </p>

          <form onSubmit={handleSubmit} className='space-y-4'>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  SWING_URL
                </label>
                <p className='text-xs text-gray-500 dark:text-gray-400 mb-2'>
                  API Gateway 기본 주소 (예: https://apigw.shinhan.com:8443)
                </p>
                <input
                  value={swingUrl}
                  onChange={(e) => setSwingUrl(e.target.value)}
                  className='input-primary w-full'
                  placeholder='https://apigw.shinhan.com:8443'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  companyCode
                </label>
                <p className='text-xs text-gray-500 dark:text-gray-400 mb-2'>
                  그룹사 코드 (예: SH, SY)
                </p>
                <input
                  value={companyCode}
                  onChange={(e) => setCompanyCode(e.target.value)}
                  className='input-primary w-full'
                  placeholder='SH'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  clientId
                </label>
                <p className='text-xs text-gray-500 dark:text-gray-400 mb-2'>
                  API 호출 시스템 인증 ID
                </p>
                <input
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className='input-primary w-full'
                  placeholder='clientId를 입력하세요'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  clientSecret
                </label>
                <p className='text-xs text-gray-500 dark:text-gray-400 mb-2'>
                  API 호출 시스템 인증 Secret (화면 표시됨)
                </p>
                <input
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  className='input-primary w-full'
                  placeholder='clientSecret을 입력하세요'
                />
              </div>
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                employeeNo (ID)
              </label>
              <p className='text-xs text-gray-500 dark:text-gray-400 mb-2'>
                로그인 사용자 사번
              </p>
              <input
                value={employeeNo}
                onChange={(e) => setEmployeeNo(e.target.value)}
                className='input-primary w-full'
                placeholder='사번을 입력하세요'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                Password (평문 입력)
              </label>
              <p className='text-xs text-gray-500 dark:text-gray-400 mb-2'>
                선택한 형식으로 SHA256 해시 후 전송됩니다.
              </p>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type='password'
                className='input-primary w-full'
                placeholder='비밀번호를 입력하세요'
              />
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                해시 인코딩 방식
              </label>
              <div className='text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-md'>
                SHA256 (Hex) - /api/auth/sso와 동일
              </div>
            </div>
            <div className='border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-900/40'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm font-medium text-gray-800 dark:text-gray-200'>
                    요청 JSON 수동 수정
                  </p>
                  <p className='text-xs text-gray-500 dark:text-gray-400'>
                    켜면 아래 JSON을 그대로 전송합니다.
                  </p>
                </div>
                <button
                  type='button'
                  onClick={() => setUseRawRequest(!useRawRequest)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out ${useRawRequest
                    ? 'bg-blue-600'
                    : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${useRawRequest ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>
              {useRawRequest && (
                <textarea
                  value={rawRequestJson}
                  onChange={(e) => setRawRequestJson(e.target.value)}
                  className='mt-3 w-full h-40 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-xs text-gray-800 dark:text-gray-200 font-mono'
                  placeholder='여기에 요청 JSON을 직접 입력하세요'
                />
              )}
            </div>

            <button
              type='submit'
              disabled={loading}
              className='btn-primary w-full'
            >
              {loading ? '요청 중...' : '로그인 요청'}
            </button>
          </form>

          <div className='mt-6'>
            <h2 className='text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2'>
              요청 데이터 (전송 페이로드)
            </h2>
            <pre className='bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-xs text-gray-800 dark:text-gray-200 overflow-auto mb-4'>
              {JSON.stringify(
                useRawRequest && rawRequestJson.trim()
                  ? (() => {
                    try {
                      return JSON.parse(rawRequestJson);
                    } catch {
                      return { error: '요청 JSON 파싱 실패' };
                    }
                  })()
                  : {
                    common: {
                      companyCode,
                      clientId,
                      clientSecret,
                      employeeNo,
                    },
                    data: {
                      loginPassword: password ? '(SHA256 Hex)' : '',
                    },
                  },
                null,
                2
              )}
            </pre>
            <h2 className='text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2'>
              응답 데이터
            </h2>
            <pre className='bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-xs text-gray-800 dark:text-gray-200 overflow-auto'>
              {responseData
                ? JSON.stringify(responseData, null, 2)
                : '응답 대기 중...'}
            </pre>
          </div>
        </div>

        <aside className='bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 h-fit'>
          <h2 className='text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3'>
            요청 로그
          </h2>
          <div className='space-y-3 max-h-[70vh] overflow-auto'>
            {logs.length === 0 ? (
              <div className='text-xs text-gray-500 dark:text-gray-400'>
                로그가 없습니다.
              </div>
            ) : (
              logs.map((log, idx) => (
                <div
                  key={`${log.time}-${idx}`}
                  className='rounded-md border border-gray-200 dark:border-gray-700 p-2 text-xs text-gray-700 dark:text-gray-300'
                >
                  <div className='flex items-center justify-between mb-1'>
                    <span className='font-medium'>{log.message}</span>
                    <span className='text-gray-400'>{log.time}</span>
                  </div>
                  {log.data ? (
                    <pre className='whitespace-pre-wrap text-[11px] text-gray-600 dark:text-gray-400'>
                      {JSON.stringify(log.data, null, 2)}
                    </pre>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
