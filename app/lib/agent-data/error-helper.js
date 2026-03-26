/**
 * 에러 해결 도우미 - 정적 레퍼런스 데이터
 *
 * Ollama 모델의 지식 한계를 보완하기 위한 풍부한 에러 패턴 DB.
 * 시스템 프롬프트에 삽입되어 정확한 에러 진단 및 해결책을 제공한다.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 언어/프레임워크 자동 감지 패턴
// ─────────────────────────────────────────────────────────────────────────────
export const LANGUAGE_DETECT_PATTERNS = [
  // Python
  {
    lang: 'python',
    pattern: /Traceback \(most recent call last\)/i,
    confidence: 0.95,
  },
  {
    lang: 'python',
    pattern: /File ".*\.py", line \d+/i,
    confidence: 0.95,
  },
  {
    lang: 'python',
    pattern: /\b(?:IndentationError|SyntaxError|NameError|TypeError|ValueError|KeyError|IndexError|ImportError|ModuleNotFoundError|AttributeError|FileNotFoundError|ZeroDivisionError|RecursionError|StopIteration|RuntimeError|OSError|PermissionError|ConnectionError|TimeoutError)\b/,
    confidence: 0.9,
  },
  {
    lang: 'python',
    pattern: /\bdef\s+\w+\s*\(.*\)\s*:/,
    confidence: 0.7,
  },
  {
    lang: 'python',
    pattern: /\bimport\s+\w+|from\s+\w+\s+import\b/,
    confidence: 0.7,
  },
  {
    lang: 'python',
    pattern: /\bself\.\w+/,
    confidence: 0.6,
  },
  // Java
  {
    lang: 'java',
    pattern: /\bat\s+[\w$.]+\([\w]+\.java:\d+\)/,
    confidence: 0.95,
  },
  {
    lang: 'java',
    pattern: /\b(?:NullPointerException|ClassNotFoundException|ArrayIndexOutOfBoundsException|ClassCastException|StackOverflowError|OutOfMemoryError|ConcurrentModificationException|IllegalArgumentException|IllegalStateException|NumberFormatException|UnsupportedOperationException|NoSuchMethodException|FileNotFoundException|IOException|SQLException|InterruptedException)\b/,
    confidence: 0.9,
  },
  {
    lang: 'java',
    pattern: /\bpublic\s+(?:static\s+)?(?:void|int|String|boolean)\s+\w+\s*\(/,
    confidence: 0.8,
  },
  {
    lang: 'java',
    pattern: /\bSystem\.out\.print/,
    confidence: 0.7,
  },
  {
    lang: 'java',
    pattern: /\bjava\.(?:lang|util|io|net|sql)\./,
    confidence: 0.85,
  },
  // JavaScript
  {
    lang: 'javascript',
    pattern: /\bTypeError:\s+(?:Cannot read propert|undefined is not|null is not)/i,
    confidence: 0.9,
  },
  {
    lang: 'javascript',
    pattern: /\bReferenceError:\s+\w+\s+is not defined/i,
    confidence: 0.9,
  },
  {
    lang: 'javascript',
    pattern: /\bSyntaxError:\s+Unexpected token/i,
    confidence: 0.85,
  },
  {
    lang: 'javascript',
    pattern: /\bat\s+\w+\s+\(.*\.js:\d+:\d+\)/,
    confidence: 0.9,
  },
  {
    lang: 'javascript',
    pattern: /\bconst\s+\w+\s*=\s*require\(/,
    confidence: 0.8,
  },
  {
    lang: 'javascript',
    pattern: /\bconsole\.\w+\(/,
    confidence: 0.6,
  },
  {
    lang: 'javascript',
    pattern: /\bUnhandled(?:Rejection|PromiseRejection)/,
    confidence: 0.85,
  },
  {
    lang: 'javascript',
    pattern: /\bAccess to .* has been blocked by CORS/i,
    confidence: 0.9,
  },
  // TypeScript
  {
    lang: 'typescript',
    pattern: /\bTS\d{4,5}:/,
    confidence: 0.95,
  },
  {
    lang: 'typescript',
    pattern: /\bType '.*' is not assignable to type '.*'/,
    confidence: 0.95,
  },
  {
    lang: 'typescript',
    pattern: /\bProperty '.*' does not exist on type '.*'/,
    confidence: 0.95,
  },
  {
    lang: 'typescript',
    pattern: /\b\.tsx?:\d+:\d+\s*-\s*error\s+TS/,
    confidence: 0.95,
  },
  {
    lang: 'typescript',
    pattern: /\binterface\s+\w+\s*\{/,
    confidence: 0.6,
  },
  // Go
  {
    lang: 'go',
    pattern: /\bgoroutine\s+\d+\s+\[/,
    confidence: 0.95,
  },
  {
    lang: 'go',
    pattern: /\bpanic:\s+runtime error:/,
    confidence: 0.95,
  },
  {
    lang: 'go',
    pattern: /\bruntime\.goexit|runtime\.main/,
    confidence: 0.9,
  },
  {
    lang: 'go',
    pattern: /\b\w+\.go:\d+/,
    confidence: 0.8,
  },
  {
    lang: 'go',
    pattern: /\bfunc\s+\w+\s*\(.*\)\s*(?:\w+|\(.*\))?\s*\{/,
    confidence: 0.7,
  },
  {
    lang: 'go',
    pattern: /\bpackage\s+\w+/,
    confidence: 0.6,
  },
  // Rust
  {
    lang: 'rust',
    pattern: /\berror\[E\d{4}\]:/,
    confidence: 0.95,
  },
  {
    lang: 'rust',
    pattern: /\bcannot borrow .* as mutable/,
    confidence: 0.95,
  },
  {
    lang: 'rust',
    pattern: /\blifetime .* does not live long enough/,
    confidence: 0.95,
  },
  {
    lang: 'rust',
    pattern: /\bthread '.*' panicked at/,
    confidence: 0.9,
  },
  {
    lang: 'rust',
    pattern: /\b(?:fn|let\s+mut|impl|trait|struct)\s+\w+/,
    confidence: 0.7,
  },
  {
    lang: 'rust',
    pattern: /\b\.rs:\d+:\d+/,
    confidence: 0.85,
  },
  // C++
  {
    lang: 'cpp',
    pattern: /\bsegmentation fault/i,
    confidence: 0.7,
  },
  {
    lang: 'cpp',
    pattern: /\bundefined reference to/,
    confidence: 0.85,
  },
  {
    lang: 'cpp',
    pattern: /\b(?:std::(?:vector|string|map|runtime_error|bad_alloc|out_of_range))/,
    confidence: 0.85,
  },
  {
    lang: 'cpp',
    pattern: /\b#include\s*<\w+>/,
    confidence: 0.6,
  },
  {
    lang: 'cpp',
    pattern: /\berror:.*\.(?:cpp|cc|cxx|h|hpp):\d+/,
    confidence: 0.9,
  },
  {
    lang: 'cpp',
    pattern: /\btemplate</,
    confidence: 0.7,
  },
  // C#
  {
    lang: 'csharp',
    pattern: /\bSystem\.(?:NullReferenceException|InvalidCastException|StackOverflowException|ArgumentNullException|InvalidOperationException|FormatException|IndexOutOfRangeException|DivideByZeroException|ObjectDisposedException|NotImplementedException|AggregateException|TaskCanceledException|HttpRequestException)\b/,
    confidence: 0.9,
  },
  {
    lang: 'csharp',
    pattern: /\bat\s+\w+\.\w+\(.*\)\s+in\s+.*\.cs:line\s+\d+/,
    confidence: 0.95,
  },
  {
    lang: 'csharp',
    pattern: /\bnamespace\s+\w+/,
    confidence: 0.6,
  },
  {
    lang: 'csharp',
    pattern: /\busing\s+System/,
    confidence: 0.8,
  },
  // Framework detection
  {
    lang: 'react',
    framework: true,
    pattern: /\bReact|useState|useEffect|jsx|tsx|component/i,
    confidence: 0.7,
  },
  { lang: 'nextjs', framework: true, pattern: /\bnext\/|getServerSideProps|getStaticProps|NextResponse|app\/api\//i, confidence: 0.8 },
  {
    lang: 'spring',
    framework: true,
    pattern: /\b(?:@Controller|@Service|@Repository|@Autowired|@RequestMapping|SpringBoot|ApplicationContext)\b/,
    confidence: 0.85,
  },
  {
    lang: 'django',
    framework: true,
    pattern: /\b(?:django\.|models\.Model|views\.py|urls\.py|settings\.py|INSTALLED_APPS)\b/,
    confidence: 0.85,
  },
  {
    lang: 'fastapi',
    framework: true,
    pattern: /\b(?:FastAPI|@app\.(?:get|post|put|delete)|Depends|HTTPException|BaseModel)\b/,
    confidence: 0.85,
  },
  {
    lang: 'express',
    framework: true,
    pattern: /\b(?:express\(\)|app\.(?:get|post|put|use)\(|req\s*,\s*res\s*,\s*next|middleware)\b/,
    confidence: 0.8,
  },
  {
    lang: 'docker',
    framework: true,
    pattern: /\bDockerfile|docker-compose|ENTRYPOINT|FROM\s+\w+/i,
    confidence: 0.85,
  },
  {
    lang: 'kubernetes',
    framework: true,
    pattern: /\bkubectl|apiVersion:|kind:\s*(?:Pod|Deployment|Service|Ingress)/i,
    confidence: 0.85,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// LANGUAGE ERRORS - 언어별 에러 패턴 DB
// ─────────────────────────────────────────────────────────────────────────────
export const LANGUAGE_ERRORS = {
  python: [
    {
      name: 'SyntaxError',
      pattern: /SyntaxError/,
      cause: '잘못된 파이썬 문법 (괄호 미닫기, 콜론 누락, 잘못된 들여쓰기 등)',
      solution: '에러 메시지에 표시된 줄 번호와 그 이전 줄의 문법을 확인하세요. 괄호/따옴표 짝이 맞는지, 콜론이 있는지 점검합니다.',
      codeExample: {
        before: 'if x == 1\n  print("hello")',
        after: 'if x == 1:\n    print("hello")',
      },
    },
    {
      name: 'IndentationError',
      pattern: /IndentationError/,
      cause: '들여쓰기가 일관되지 않음 (탭과 스페이스 혼용, 잘못된 들여쓰기 레벨)',
      solution: '탭과 스페이스를 혼용하지 마세요. 에디터 설정에서 탭을 스페이스 4칸으로 변환하는 것을 권장합니다.',
      codeExample: {
        before: 'def foo():\n  x = 1\n    y = 2  # 불일치',
        after: 'def foo():\n    x = 1\n    y = 2',
      },
    },
    {
      name: 'NameError',
      pattern: /NameError/,
      cause: '정의되지 않은 변수/함수 참조 (오타, import 누락, 스코프 문제)',
      solution: '변수명 오타를 확인하고, 해당 변수가 사용 전에 정의되었는지 확인하세요. 필요한 모듈이 import 되었는지도 점검합니다.',
      codeExample: {
        before: 'print(username)  # 정의 안됨',
        after: 'username = "admin"\nprint(username)',
      },
    },
    {
      name: 'TypeError (인자)',
      pattern: /TypeError.*(?:argument|expected|got)/,
      cause: '함수에 잘못된 타입이나 개수의 인자를 전달',
      solution: '함수 시그니처를 확인하고, 전달하는 인자의 타입과 개수가 일치하는지 확인하세요.',
      codeExample: {
        before: 'len(123)',
        after: 'len(str(123))  # 또는 len([1,2,3])',
      },
    },
    {
      name: 'TypeError (연산)',
      pattern: /TypeError.*(?:unsupported operand|can only concatenate|not subscriptable)/,
      cause: '호환되지 않는 타입 간 연산 시도',
      solution: '연산에 참여하는 변수들의 타입을 확인하고, 필요시 명시적 타입 변환을 수행하세요.',
      codeExample: {
        before: '"age: " + 25',
        after: '"age: " + str(25)',
      },
    },
    {
      name: 'ValueError',
      pattern: /ValueError/,
      cause: '올바른 타입이지만 잘못된 값을 전달 (예: int("abc"))',
      solution: '입력값의 유효성을 검사하거나 try-except로 처리하세요.',
      codeExample: {
        before: 'int("hello")',
        after: 'try:\n    int("hello")\nexcept ValueError:\n    print("숫자가 아닙니다")',
      },
    },
    {
      name: 'KeyError',
      pattern: /KeyError/,
      cause: '딕셔너리에 존재하지 않는 키로 접근',
      solution: '.get() 메서드를 사용하거나, in 연산자로 키 존재 여부를 먼저 확인하세요.',
      codeExample: {
        before: 'data = {"name": "Kim"}\nprint(data["age"])',
        after: 'data = {"name": "Kim"}\nprint(data.get("age", "미설정"))',
      },
    },
    {
      name: 'IndexError',
      pattern: /IndexError/,
      cause: '리스트/튜플의 범위를 벗어난 인덱스 접근',
      solution: 'len()으로 길이를 확인하거나, 범위 검사를 추가하세요.',
      codeExample: {
        before: 'items = [1, 2, 3]\nprint(items[5])',
        after: 'items = [1, 2, 3]\nif len(items) > 5:\n    print(items[5])',
      },
    },
    {
      name: 'ImportError',
      pattern: /ImportError|ModuleNotFoundError/,
      cause: '모듈을 찾을 수 없음 (미설치, 경로 오류, 가상환경 문제)',
      solution: 'pip install로 패키지를 설치하거나, 가상환경이 활성화되어 있는지 확인하세요. 모듈명 오타도 점검합니다.',
      codeExample: {
        before: 'import padas  # 오타',
        after: 'import pandas  # pip install pandas',
      },
    },
    {
      name: 'AttributeError',
      pattern: /AttributeError/,
      cause: '객체에 존재하지 않는 속성/메서드에 접근 (None 객체 접근 포함)',
      solution: 'dir() 또는 type()으로 객체의 타입과 사용 가능한 속성을 확인하세요. None 체크도 필수입니다.',
      codeExample: {
        before: 'result = None\nresult.upper()',
        after: 'result = None\nif result is not None:\n    result.upper()',
      },
    },
    {
      name: 'FileNotFoundError',
      pattern: /FileNotFoundError/,
      cause: '지정한 경로에 파일이 존재하지 않음',
      solution: 'os.path.exists()로 파일 존재 여부를 확인하고, 경로가 상대경로인 경우 현재 작업 디렉토리(os.getcwd())를 확인하세요.',
      codeExample: {
        before: 'open("data.csv")',
        after: 'import os\nif os.path.exists("data.csv"):\n    open("data.csv")\nelse:\n    print("파일이 없습니다")',
      },
    },
    {
      name: 'ZeroDivisionError',
      pattern: /ZeroDivisionError/,
      cause: '0으로 나누기 시도',
      solution: '나누기 전에 분모가 0인지 확인하세요.',
      codeExample: {
        before: 'result = total / count',
        after: 'result = total / count if count != 0 else 0',
      },
    },
    {
      name: 'RecursionError',
      pattern: /RecursionError|maximum recursion depth/,
      cause: '재귀 호출이 종료 조건 없이 무한히 반복',
      solution: '재귀 함수의 base case(종료 조건)를 확인하고, sys.setrecursionlimit()으로 제한을 조정할 수 있습니다.',
      codeExample: {
        before: 'def factorial(n):\n    return n * factorial(n-1)',
        after: 'def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n-1)',
      },
    },
    {
      name: 'MemoryError',
      pattern: /MemoryError/,
      cause: '사용 가능한 메모리를 초과하는 객체 생성 시도',
      solution: '대용량 데이터는 제너레이터, 청크 읽기, 또는 메모리 매핑을 사용하세요.',
      codeExample: {
        before: 'data = [0] * (10**10)',
        after: 'def data_gen():\n    for i in range(10**10):\n        yield 0',
      },
    },
    {
      name: 'PermissionError',
      pattern: /PermissionError/,
      cause: '파일/디렉토리에 대한 권한 부족',
      solution: '파일 권한을 확인하고(ls -la), 필요시 chmod로 권한을 변경하거나 sudo로 실행하세요.',
      codeExample: {
        before: 'open("/etc/passwd", "w")',
        after: '# chmod 또는 적절한 디렉토리에 저장\nopen("/tmp/output.txt", "w")',
      },
    },
    {
      name: 'ConnectionError',
      pattern: /ConnectionError|ConnectionRefusedError/,
      cause: '네트워크 연결 실패 (서버 다운, DNS 실패, 포트 차단)',
      solution: '서버 상태, 네트워크 연결, 방화벽 설정을 확인하세요. requests 라이브러리 사용 시 timeout 설정을 권장합니다.',
      codeExample: {
        before: 'requests.get("http://api.example.com")',
        after: 'try:\n    requests.get("http://api.example.com", timeout=10)\nexcept requests.ConnectionError:\n    print("서버 연결 실패")',
      },
    },
    {
      name: 'TimeoutError',
      pattern: /TimeoutError|ReadTimeout|ConnectTimeout/,
      cause: '네트워크 요청 또는 작업이 제한 시간을 초과',
      solution: 'timeout 값을 늘리거나, 비동기 처리를 사용하세요. 서버 응답 시간이 정상인지도 확인합니다.',
      codeExample: {
        before: 'requests.get(url, timeout=1)',
        after: 'requests.get(url, timeout=30)',
      },
    },
    {
      name: 'StopIteration',
      pattern: /StopIteration/,
      cause: '이터레이터에 더 이상 반환할 요소가 없음',
      solution: 'for 루프를 사용하거나, next()에 기본값을 제공하세요.',
      codeExample: {
        before: 'it = iter([])\nnext(it)',
        after: 'it = iter([])\nnext(it, None)  # 기본값 제공',
      },
    },
    {
      name: 'UnicodeDecodeError',
      pattern: /UnicodeDecodeError|UnicodeEncodeError/,
      cause: '문자열 인코딩/디코딩 실패 (잘못된 인코딩 지정)',
      solution: '파일의 실제 인코딩을 확인하고, open() 시 encoding 파라미터를 명시하세요.',
      codeExample: {
        before: 'open("data.txt").read()',
        after: 'open("data.txt", encoding="utf-8").read()',
      },
    },
    { name: 'JSONDecodeError', pattern: /JSONDecodeError|json\.decoder/, cause: '잘못된 형식의 JSON 문자열 파싱 시도', solution: 'JSON 문자열이 유효한지 확인하세요. 작은따옴표, 후행 쉼표, 주석 등은 JSON에서 허용되지 않습니다.', codeExample: { before: "json.loads(\"{'key': 'value'}\")", after: 'json.loads(\'{"key": "value"}\')' } },
    {
      name: 'OverflowError',
      pattern: /OverflowError/,
      cause: '숫자 연산 결과가 표현 가능한 범위를 초과',
      solution: 'decimal 모듈을 사용하거나, 큰 수 연산 라이브러리를 활용하세요.',
      codeExample: {
        before: 'math.exp(1000)',
        after: 'from decimal import Decimal\nDecimal(1000).exp()',
      },
    },
    {
      name: 'AssertionError',
      pattern: /AssertionError/,
      cause: 'assert 문의 조건이 False',
      solution: 'assert 조건과 해당 시점의 변수 값을 디버깅하세요. 프로덕션 코드에서는 assert 대신 명시적 예외를 권장합니다.',
      codeExample: {
        before: 'assert len(data) > 0',
        after: 'if not data:\n    raise ValueError("데이터가 비어 있습니다")',
      },
    },
    {
      name: 'OSError (디스크 용량)',
      pattern: /OSError.*No space left|ENOSPC/,
      cause: '디스크 공간 부족',
      solution: 'df -h로 디스크 사용량을 확인하고, 불필요한 파일을 정리하세요.',
      codeExample: {
        before: '# OSError: [Errno 28] No space left on device',
        after: '# df -h 로 확인 후 정리\n# du -sh /tmp/* 으로 대용량 파일 확인',
      },
    },
    {
      name: 'RuntimeError (이벤트루프)',
      pattern: /RuntimeError.*event loop|asyncio/,
      cause: 'asyncio 이벤트 루프가 이미 실행 중이거나 닫힘',
      solution: 'asyncio.run()은 최상위에서만 호출하고, 중첩 시 await를 사용하세요. Jupyter에서는 nest_asyncio를 사용합니다.',
      codeExample: {
        before: 'asyncio.run(main())  # 이벤트 루프 내부에서',
        after: 'await main()  # 또는 nest_asyncio 사용',
      },
    },
    {
      name: 'pickle.UnpicklingError',
      pattern: /UnpicklingError|pickle/,
      cause: 'pickle 파일이 손상되었거나 호환되지 않는 Python 버전',
      solution: 'Python 버전을 확인하고, pickle 대신 JSON이나 다른 직렬화 형식을 고려하세요.',
      codeExample: {
        before: 'pickle.load(open("model.pkl", "r"))',
        after: 'pickle.load(open("model.pkl", "rb"))  # 바이너리 모드',
      },
    },
    {
      name: 'TypeError (unhashable)',
      pattern: /TypeError.*unhashable/,
      cause: '리스트, 딕셔너리 등 mutable 객체를 set이나 dict 키로 사용',
      solution: 'mutable 객체 대신 tuple이나 frozenset을 사용하세요.',
      codeExample: {
        before: 'my_set = {[1, 2, 3]}',
        after: 'my_set = {(1, 2, 3)}  # tuple 사용',
      },
    },
    {
      name: 'pandas SettingWithCopyWarning',
      pattern: /SettingWithCopyWarning/,
      cause: 'DataFrame의 슬라이스에 값을 할당하려는 시도',
      solution: '.loc[]을 사용하거나, .copy()로 명시적 복사를 만드세요.',
      codeExample: {
        before: 'df[df["age"] > 20]["name"] = "adult"',
        after: 'df.loc[df["age"] > 20, "name"] = "adult"',
      },
    },
    {
      name: 'pip 설치 충돌',
      pattern: /pip.*(?:conflict|incompatible|ResolutionImpossible)/,
      cause: '패키지 버전 간 의존성 충돌',
      solution: '가상환경을 새로 만들거나, pip install --force-reinstall을 시도하세요. pipdeptree로 의존성을 확인할 수 있습니다.',
      codeExample: {
        before: 'pip install packageA packageB  # 충돌',
        after: 'python -m venv venv && source venv/bin/activate\npip install packageA packageB',
      },
    },
    {
      name: 'ssl.SSLCertVerificationError',
      pattern: /SSLCertVerification|CERTIFICATE_VERIFY_FAILED/,
      cause: 'SSL 인증서 검증 실패 (자체 서명, 만료, 내부망 등)',
      solution: '내부망에서는 verify=False 또는 인증서 경로를 직접 지정하세요. 프로덕션에서는 인증서를 갱신합니다.',
      codeExample: {
        before: 'requests.get("https://internal-api.company.com")',
        after: 'requests.get("https://internal-api.company.com", verify="/path/to/cert.pem")',
      },
    },
    {
      name: 'multiprocessing 에러',
      pattern: /(?:multiprocessing|Process|Pool).*(?:error|broken|freeze)/,
      cause: 'multiprocessing 에서 프로세스 간 통신 실패 또는 데드락',
      solution: 'if __name__ == "__main__" 가드를 사용하고, 공유 객체에 Lock을 적용하세요.',
      codeExample: {
        before: 'Pool(4).map(func, data)',
        after: 'if __name__ == "__main__":\n    with Pool(4) as p:\n        p.map(func, data)',
      },
    },
  ],

  java: [
    {
      name: 'NullPointerException',
      pattern: /NullPointerException/,
      cause: 'null 객체의 메서드/필드에 접근',
      solution: 'null 체크를 추가하거나 Optional을 사용하세요.',
      codeExample: {
        before: 'String name = user.getName().toUpperCase();',
        after: 'String name = Optional.ofNullable(user)\n    .map(User::getName)\n    .map(String::toUpperCase)\n    .orElse("UNKNOWN");',
      },
    },
    {
      name: 'ClassNotFoundException',
      pattern: /ClassNotFoundException/,
      cause: '클래스를 찾을 수 없음 (의존성 누락, 클래스패스 문제)',
      solution: 'pom.xml/build.gradle에 의존성이 포함되어 있는지, 클래스패스 설정이 올바른지 확인하세요.',
      codeExample: {
        before: 'Class.forName("com.mysql.jdbc.Driver")',
        after: '// pom.xml에 mysql-connector 의존성 추가\nClass.forName("com.mysql.cj.jdbc.Driver")',
      },
    },
    {
      name: 'ArrayIndexOutOfBoundsException',
      pattern: /ArrayIndexOutOfBoundsException/,
      cause: '배열 범위를 벗어난 인덱스 접근',
      solution: 'array.length로 범위를 확인하거나, for-each 루프를 사용하세요.',
      codeExample: {
        before: 'int[] arr = {1, 2, 3};\nSystem.out.println(arr[5]);',
        after: 'int[] arr = {1, 2, 3};\nif (arr.length > 5) {\n    System.out.println(arr[5]);\n}',
      },
    },
    {
      name: 'ClassCastException',
      pattern: /ClassCastException/,
      cause: '호환되지 않는 타입으로 캐스팅',
      solution: 'instanceof로 먼저 타입을 확인하거나, 제네릭을 활용하세요.',
      codeExample: {
        before: 'String s = (String) obj;',
        after: 'if (obj instanceof String s) {\n    // s 사용\n}',
      },
    },
    {
      name: 'StackOverflowError',
      pattern: /StackOverflowError/,
      cause: '스택 메모리 초과 (무한 재귀, 깊은 재귀)',
      solution: '재귀의 종료 조건을 확인하고, 필요시 반복문으로 변환하세요. -Xss 옵션으로 스택 크기를 조정할 수 있습니다.',
      codeExample: {
        before: 'int sum(int n) { return n + sum(n-1); }',
        after: 'int sum(int n) {\n    if (n <= 0) return 0;\n    return n + sum(n - 1);\n}',
      },
    },
    {
      name: 'OutOfMemoryError',
      pattern: /OutOfMemoryError|Java heap space/,
      cause: '힙 메모리 초과 (대용량 객체, 메모리 누수)',
      solution: '-Xmx 옵션으로 힙 크기를 늘리고, 메모리 프로파일러로 누수를 점검하세요.',
      codeExample: {
        before: 'java -jar app.jar',
        after: 'java -Xmx2g -jar app.jar',
      },
    },
    {
      name: 'ConcurrentModificationException',
      pattern: /ConcurrentModificationException/,
      cause: '컬렉션 반복 중 구조 변경',
      solution: 'Iterator.remove()를 사용하거나, ConcurrentHashMap 등 동시성 컬렉션을 사용하세요.',
      codeExample: {
        before: 'for (String s : list) {\n    if (s.isEmpty()) list.remove(s);\n}',
        after: 'list.removeIf(String::isEmpty);',
      },
    },
    {
      name: 'IllegalArgumentException',
      pattern: /IllegalArgumentException/,
      cause: '메서드에 부적절한 인자 전달',
      solution: '메서드 문서를 확인하고, 유효한 인자 범위 내에서 호출하세요.',
      codeExample: {
        before: 'Thread.sleep(-1);',
        after: 'Thread.sleep(1000); // 양수만 가능',
      },
    },
    {
      name: 'IllegalStateException',
      pattern: /IllegalStateException/,
      cause: '객체의 현재 상태에서 허용되지 않는 메서드 호출',
      solution: '객체의 상태를 확인한 후 메서드를 호출하세요.',
      codeExample: {
        before: 'iterator.remove(); // next() 호출 전',
        after: 'iterator.next();\niterator.remove();',
      },
    },
    {
      name: 'NumberFormatException',
      pattern: /NumberFormatException/,
      cause: '숫자로 변환할 수 없는 문자열',
      solution: '파싱 전에 입력값을 검증하거나, try-catch로 처리하세요.',
      codeExample: {
        before: 'int n = Integer.parseInt("abc");',
        after: 'try {\n    int n = Integer.parseInt(input);\n} catch (NumberFormatException e) {\n    System.err.println("숫자가 아닙니다: " + input);\n}',
      },
    },
    {
      name: 'UnsupportedOperationException',
      pattern: /UnsupportedOperationException/,
      cause: '불변 컬렉션(Collections.unmodifiableList 등)에 수정 시도',
      solution: 'new ArrayList<>(원본)으로 수정 가능한 복사본을 만드세요.',
      codeExample: {
        before: 'List<String> list = List.of("a", "b");\nlist.add("c");',
        after: 'List<String> list = new ArrayList<>(List.of("a", "b"));\nlist.add("c");',
      },
    },
    {
      name: 'FileNotFoundException',
      pattern: /FileNotFoundException/,
      cause: '지정한 경로에 파일이 없거나 접근 권한 부족',
      solution: 'File.exists()로 확인하고, 리소스 파일은 getResourceAsStream()을 사용하세요.',
      codeExample: {
        before: 'new FileInputStream("config.yml");',
        after: 'InputStream is = getClass().getResourceAsStream("/config.yml");',
      },
    },
    {
      name: 'IOException',
      pattern: /IOException/,
      cause: '입출력 작업 실패 (파일 잠금, 네트워크 단절, 디스크 오류)',
      solution: 'try-with-resources로 리소스를 관리하고, 구체적 예외 메시지를 확인하세요.',
      codeExample: {
        before: 'FileWriter fw = new FileWriter("out.txt");\nfw.write(data);',
        after: 'try (FileWriter fw = new FileWriter("out.txt")) {\n    fw.write(data);\n}',
      },
    },
    {
      name: 'SQLException',
      pattern: /SQLException/,
      cause: 'SQL 실행 오류 (문법, 연결 실패, 제약조건 위반)',
      solution: 'SQL 쿼리를 직접 DB 클라이언트에서 실행해 확인하고, 연결 풀 설정을 점검하세요.',
      codeExample: {
        before: 'stmt.executeQuery("SELCT * FROM users");',
        after: 'stmt.executeQuery("SELECT * FROM users");',
      },
    },
    {
      name: 'InterruptedException',
      pattern: /InterruptedException/,
      cause: '스레드가 대기/슬립 중 인터럽트됨',
      solution: '인터럽트를 적절히 처리하고, 스레드 상태를 복원하세요.',
      codeExample: {
        before: 'Thread.sleep(1000); // throws 무시',
        after: 'try {\n    Thread.sleep(1000);\n} catch (InterruptedException e) {\n    Thread.currentThread().interrupt();\n}',
      },
    },
    {
      name: 'NoSuchMethodException',
      pattern: /NoSuchMethodException|NoSuchMethodError/,
      cause: '존재하지 않는 메서드 호출 (버전 불일치, 리플렉션 오류)',
      solution: '라이브러리 버전을 확인하고, 메서드 시그니처가 정확한지 점검하세요.',
      codeExample: {
        before: '// 라이브러리 v2에서 제거된 메서드',
        after: '// pom.xml에서 버전 확인 및 마이그레이션 가이드 참고',
      },
    },
    {
      name: 'NoClassDefFoundError',
      pattern: /NoClassDefFoundError/,
      cause: '컴파일 시엔 있었지만 런타임에 클래스를 찾을 수 없음',
      solution: '클래스패스에 필요한 jar가 모두 포함되어 있는지, 빌드 설정을 확인하세요.',
      codeExample: {
        before: 'java -cp app.jar Main',
        after: 'java -cp "app.jar:lib/*" Main',
      },
    },
    {
      name: 'UnsupportedClassVersionError',
      pattern: /UnsupportedClassVersionError/,
      cause: '상위 버전 Java로 컴파일된 클래스를 하위 버전 JVM에서 실행',
      solution: 'javac -source/-target 옵션을 맞추거나, JVM 버전을 업그레이드하세요.',
      codeExample: {
        before: 'javac Main.java  # Java 17로 컴파일\njava Main  # Java 11로 실행',
        after: 'javac --release 11 Main.java\njava Main',
      },
    },
    {
      name: 'DateTimeParseException',
      pattern: /DateTimeParseException/,
      cause: '날짜/시간 문자열이 지정된 포맷과 불일치',
      solution: 'DateTimeFormatter 패턴이 입력과 일치하는지 확인하세요.',
      codeExample: {
        before: 'LocalDate.parse("2024-1-5")',
        after: 'LocalDate.parse("2024-1-5", DateTimeFormatter.ofPattern("yyyy-M-d"))',
      },
    },
    {
      name: 'SecurityException',
      pattern: /SecurityException|AccessControlException/,
      cause: '보안 매니저에 의한 접근 거부',
      solution: '보안 정책 파일을 확인하거나, 필요한 권한을 부여하세요.',
      codeExample: {
        before: 'System.exit(0);  // SecurityManager에 의해 차단',
        after: '// java.policy에 permission java.lang.RuntimePermission "exitVM.*"; 추가',
      },
    },
    {
      name: 'Spring BeanCreationException',
      pattern: /BeanCreationException|NoSuchBeanDefinition/,
      cause: 'Spring 빈 생성 실패 (의존성 주입 실패, 설정 오류)',
      solution: '빈 이름/타입을 확인하고, @Component 또는 @Bean 등록이 되어 있는지 점검하세요.',
      codeExample: {
        before: '@Autowired\nprivate MyService service; // 빈 없음',
        after: '@Service\npublic class MyService { ... }',
      },
    },
    {
      name: 'Spring Circular Dependency',
      pattern: /circular.*depend|BeanCurrentlyInCreation/,
      cause: '순환 의존성 (A→B→A)',
      solution: '@Lazy를 사용하거나, 구조를 리팩토링하여 순환을 제거하세요.',
      codeExample: {
        before: '@Autowired\nprivate ServiceB b; // ServiceB도 ServiceA 의존',
        after: '@Autowired @Lazy\nprivate ServiceB b;',
      },
    },
    {
      name: 'Hibernate LazyInitializationException',
      pattern: /LazyInitializationException/,
      cause: '영속성 컨텍스트 밖에서 지연 로딩된 프록시에 접근',
      solution: 'Fetch Join, @EntityGraph, 또는 트랜잭션 범위를 확장하세요.',
      codeExample: {
        before: '// 세션 종료 후 접근\nuser.getOrders().size();',
        after: '@Query("SELECT u FROM User u JOIN FETCH u.orders WHERE u.id = :id")\nUser findWithOrders(@Param("id") Long id);',
      },
    },
    {
      name: 'TransactionRequiredException',
      pattern: /TransactionRequired/,
      cause: '트랜잭션 없이 JPA 엔티티 수정 시도',
      solution: '@Transactional 어노테이션을 추가하세요.',
      codeExample: {
        before: 'public void updateUser(User u) {\n    em.merge(u);\n}',
        after: '@Transactional\npublic void updateUser(User u) {\n    em.merge(u);\n}',
      },
    },
    {
      name: 'Maven/Gradle 빌드 실패',
      pattern: /BUILD FAILURE|Could not resolve dependencies/,
      cause: '의존성 해석 실패 (저장소 접근 불가, 버전 충돌)',
      solution: 'settings.xml의 저장소 URL, 프록시 설정을 확인하고 ./mvnw dependency:tree로 충돌을 분석하세요.',
      codeExample: {
        before: 'mvn clean install  # BUILD FAILURE',
        after: 'mvn clean install -U  # 강제 업데이트\nmvn dependency:tree  # 충돌 확인',
      },
    },
  ],

  javascript: [
    {
      name: 'TypeError: Cannot read properties of undefined',
      pattern: /TypeError.*Cannot read propert.*undefined/,
      cause: 'undefined 객체의 속성에 접근 시도',
      solution: '옵셔널 체이닝(?.)을 사용하거나, 값 존재 여부를 먼저 확인하세요.',
      codeExample: {
        before: 'const name = user.profile.name;',
        after: 'const name = user?.profile?.name ?? "기본값";',
      },
    },
    {
      name: 'TypeError: Cannot read properties of null',
      pattern: /TypeError.*Cannot read propert.*null/,
      cause: 'null 객체의 속성에 접근 시도',
      solution: 'null 체크를 추가하거나 옵셔널 체이닝(?.)을 사용하세요.',
      codeExample: {
        before: 'document.getElementById("app").innerHTML = "hi";',
        after: 'const el = document.getElementById("app");\nif (el) el.innerHTML = "hi";',
      },
    },
    {
      name: 'TypeError: X is not a function',
      pattern: /TypeError.*is not a function/,
      cause: '함수가 아닌 값을 함수처럼 호출 (오타, import 오류, this 바인딩)',
      solution: 'typeof으로 타입을 확인하고, import 경로와 export 방식이 맞는지 점검하세요.',
      codeExample: {
        before: 'const result = data.map;  // 괄호 빠짐\nresult();',
        after: 'const result = data.map(item => item.id);',
      },
    },
    {
      name: 'ReferenceError: X is not defined',
      pattern: /ReferenceError.*is not defined/,
      cause: '선언되지 않은 변수 참조',
      solution: '변수명 오타를 확인하고, 해당 스코프에서 선언되었는지 확인하세요.',
      codeExample: {
        before: 'console.log(userName);',
        after: 'const userName = "admin";\nconsole.log(userName);',
      },
    },
    { name: 'SyntaxError: Unexpected token', pattern: /SyntaxError.*Unexpected token/, cause: '잘못된 JS 문법 (JSON 파싱 실패, 괄호 미닫기, 세미콜론 누락)', solution: '에러 위치의 코드를 확인하고, JSON.parse 시 유효한 JSON인지 검증하세요.', codeExample: { before: "JSON.parse('{name: \"Kim\"}')", after: 'JSON.parse(\'{"name": "Kim"}\')' } },
    {
      name: 'RangeError: Maximum call stack size exceeded',
      pattern: /RangeError.*(?:Maximum call stack|stack size)/,
      cause: '무한 재귀 호출',
      solution: '재귀 종료 조건을 확인하고, 가능하면 반복문으로 변환하세요.',
      codeExample: {
        before: 'function loop() { loop(); }\nloop();',
        after: 'function loop(n) {\n  if (n <= 0) return;\n  loop(n - 1);\n}',
      },
    },
    {
      name: 'CORS 에러',
      pattern: /CORS|Access-Control-Allow-Origin|cross-origin/,
      cause: '다른 출처(origin)에서의 리소스 요청이 서버 정책에 의해 차단됨',
      solution: '서버에서 적절한 CORS 헤더를 설정하거나, 프록시를 사용하세요.',
      codeExample: {
        before: '// 브라우저에서 다른 도메인 API 호출\nfetch("https://api.other.com/data")',
        after: '// 서버 (Express)\napp.use(cors({ origin: "https://your-domain.com" }));\n// 또는 Next.js API Route를 프록시로 사용',
      },
    },
    {
      name: 'Unhandled Promise Rejection',
      pattern: /UnhandledPromiseRejection|Unhandled.*rejection/,
      cause: 'Promise에서 발생한 에러가 catch 되지 않음',
      solution: '.catch()를 추가하거나, async/await에서 try-catch를 사용하세요.',
      codeExample: {
        before: 'fetch(url).then(r => r.json());',
        after: 'try {\n  const r = await fetch(url);\n  return await r.json();\n} catch (err) {\n  console.error("요청 실패:", err);\n}',
      },
    },
    {
      name: 'TypeError: Assignment to constant variable',
      pattern: /TypeError.*Assignment to constant/,
      cause: 'const로 선언된 변수에 재할당 시도',
      solution: '재할당이 필요하면 let을 사용하세요. 객체의 속성 변경은 const여도 가능합니다.',
      codeExample: {
        before: 'const count = 0;\ncount = 1;',
        after: 'let count = 0;\ncount = 1;',
      },
    },
    {
      name: 'SyntaxError: Cannot use import',
      pattern: /SyntaxError.*Cannot use import/,
      cause: 'CommonJS 환경에서 ES module import 사용',
      solution: 'package.json에 "type": "module"을 추가하거나, require()를 사용하세요.',
      codeExample: {
        before: 'import fs from "fs";  // CJS 환경',
        after: 'const fs = require("fs");\n// 또는 package.json에 "type": "module" 추가',
      },
    },
    {
      name: 'TypeError: Cannot destructure',
      pattern: /TypeError.*Cannot destructure/,
      cause: 'undefined/null에서 구조분해할당 시도',
      solution: '기본값을 제공하거나, 값 존재 여부를 먼저 확인하세요.',
      codeExample: {
        before: 'const { name } = getUser();  // undefined 반환',
        after: 'const { name } = getUser() || {};',
      },
    },
    {
      name: 'ERR_MODULE_NOT_FOUND',
      pattern: /ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND/,
      cause: 'Node.js에서 모듈을 찾을 수 없음',
      solution: 'npm install로 패키지를 설치하고, 파일 경로에 확장자가 필요한지 확인하세요.',
      codeExample: {
        before: 'import { util } from "./util";',
        after: 'import { util } from "./util.js";  // ESM은 확장자 필요',
      },
    },
    {
      name: 'fetch API NetworkError',
      pattern: /NetworkError|Failed to fetch|net::ERR_/,
      cause: '네트워크 요청 실패 (서버 다운, DNS 오류, 방화벽)',
      solution: '서버 상태와 URL을 확인하고, 네트워크 오류 처리를 추가하세요.',
      codeExample: {
        before: 'const data = await fetch(url);',
        after: 'try {\n  const res = await fetch(url);\n  if (!res.ok) throw new Error(`HTTP ${res.status}`);\n  return await res.json();\n} catch (err) {\n  console.error("네트워크 오류:", err.message);\n}',
      },
    },
    {
      name: 'JSON.parse 에러',
      pattern: /JSON\.parse|Unexpected.*in JSON/,
      cause: '유효하지 않은 JSON 문자열 파싱',
      solution: '응답이 JSON인지 확인하고, Content-Type 헤더를 점검하세요.',
      codeExample: {
        before: 'JSON.parse(response)',
        after: 'try {\n  return JSON.parse(response);\n} catch {\n  console.error("JSON 파싱 실패:", response.slice(0, 100));\n}',
      },
    },
    {
      name: 'Event loop blocked',
      pattern: /event loop|ETIMEDOUT|ECONNRESET/,
      cause: '이벤트 루프 블로킹 또는 연결 리셋',
      solution: '동기 작업을 비동기로 변환하고, 연결 타임아웃 설정을 확인하세요.',
      codeExample: {
        before: 'const data = fs.readFileSync(hugefile);',
        after: 'const data = await fs.promises.readFile(hugefile);',
      },
    },
    {
      name: 'AbortError',
      pattern: /AbortError|signal.*aborted/,
      cause: 'AbortController로 요청이 중단됨',
      solution: '타임아웃 설정을 확인하고, 사용자 중단과 시스템 중단을 구분하세요.',
      codeExample: {
        before: 'const ctrl = new AbortController();\nsetTimeout(() => ctrl.abort(), 100);',
        after: 'const ctrl = new AbortController();\nsetTimeout(() => ctrl.abort(), 30000); // 30초',
      },
    },
    {
      name: 'localStorage 접근 오류',
      pattern: /localStorage|SecurityError.*storage/,
      cause: 'SSR 환경 또는 개인정보 보호 모드에서 localStorage 접근',
      solution: 'typeof window를 확인하고, try-catch로 감싸세요.',
      codeExample: {
        before: 'const token = localStorage.getItem("token");',
        after: 'const token = typeof window !== "undefined"\n  ? localStorage.getItem("token")\n  : null;',
      },
    },
    {
      name: 'Circular JSON',
      pattern: /circular.*JSON|Converting circular structure/,
      cause: 'JSON.stringify()에 순환 참조가 있는 객체 전달',
      solution: '순환 참조를 제거하거나, replacer 함수를 사용하세요.',
      codeExample: {
        before: 'const obj = {}; obj.self = obj;\nJSON.stringify(obj);',
        after: 'function safeStringify(obj) {\n  const seen = new WeakSet();\n  return JSON.stringify(obj, (k, v) => {\n    if (typeof v === "object" && v !== null) {\n      if (seen.has(v)) return "[Circular]";\n      seen.add(v);\n    }\n    return v;\n  });\n}',
      },
    },
    {
      name: 'Memory Leak (Node.js)',
      pattern: /heap.*out of memory|FATAL ERROR.*allocation|JavaScript heap/,
      cause: 'Node.js 힙 메모리 초과',
      solution: '--max-old-space-size 옵션으로 메모리를 늘리거나, 메모리 누수 원인을 찾으세요.',
      codeExample: {
        before: 'node app.js  # FATAL ERROR: heap out of memory',
        after: 'node --max-old-space-size=4096 app.js',
      },
    },
    {
      name: 'Webpack/Vite 빌드 에러',
      pattern: /Module build failed|Failed to compile|Cannot find module.*webpack|vite.*error/,
      cause: '번들러 설정 오류, 모듈 해석 실패, 로더 미설정',
      solution: '에러 메시지의 모듈 경로를 확인하고, 필요한 로더/플러그인이 설정되어 있는지 점검하세요.',
      codeExample: {
        before: '// Module build failed: Cannot find module',
        after: 'npm install --save-dev babel-loader\n// webpack.config.js에 loader 추가',
      },
    },
  ],

  typescript: [
    {
      name: 'TS2322: Type not assignable',
      pattern: /TS2322|not assignable to type/,
      cause: '할당하려는 값의 타입이 선언된 타입과 불일치',
      solution: '타입을 맞추거나, 타입 가드/타입 단언을 사용하세요.',
      codeExample: {
        before: 'const name: string = 123;',
        after: 'const name: string = String(123);',
      },
    },
    {
      name: 'TS2345: Argument type mismatch',
      pattern: /TS2345|Argument of type/,
      cause: '함수 인자의 타입이 매개변수 타입과 불일치',
      solution: '함수 시그니처를 확인하고 올바른 타입의 인자를 전달하세요.',
      codeExample: {
        before: 'function greet(name: string) {}\ngreet(123);',
        after: 'greet(String(123));\n// 또는 greet("123");',
      },
    },
    {
      name: 'TS2339: Property does not exist',
      pattern: /TS2339|Property.*does not exist on type/,
      cause: '타입에 정의되지 않은 속성에 접근',
      solution: '인터페이스/타입에 해당 속성을 추가하거나, 타입 가드를 사용하세요.',
      codeExample: {
        before: 'interface User { name: string; }\nconst u: User = { name: "Kim" };\nconsole.log(u.age);',
        after: 'interface User { name: string; age?: number; }\nconst u: User = { name: "Kim" };\nconsole.log(u.age);',
      },
    },
    {
      name: 'TS7006: Implicit any',
      pattern: /TS7006|implicitly has an.*any.*type/,
      cause: '매개변수에 타입이 명시되지 않음 (noImplicitAny 활성화 시)',
      solution: '매개변수에 명시적 타입을 추가하세요.',
      codeExample: {
        before: 'function process(data) { return data; }',
        after: 'function process(data: string): string { return data; }',
      },
    },
    {
      name: 'TS2304: Cannot find name',
      pattern: /TS2304|Cannot find name/,
      cause: '선언되지 않은 이름 참조 (타입 정의 파일 누락)',
      solution: '@types 패키지를 설치하거나, declare 문으로 타입을 선언하세요.',
      codeExample: {
        before: 'const timer = setTimeout(() => {}, 100);\n// Cannot find name "setTimeout"',
        after: 'npm install --save-dev @types/node',
      },
    },
    {
      name: 'TS2531: Object possibly null',
      pattern: /TS2531|possibly.*null/,
      cause: 'null일 수 있는 값에 안전하지 않은 접근',
      solution: 'null 체크를 추가하거나, non-null assertion(!)을 사용하세요 (확실한 경우에만).',
      codeExample: {
        before: 'const el = document.getElementById("app");\nel.innerHTML = "hi";',
        after: 'const el = document.getElementById("app");\nif (el) {\n  el.innerHTML = "hi";\n}',
      },
    },
    {
      name: 'TS2307: Cannot find module',
      pattern: /TS2307|Cannot find module/,
      cause: '모듈을 찾을 수 없음 (타입 선언 파일 누락, 경로 오류)',
      solution: '@types 패키지를 설치하거나, tsconfig.json의 paths를 확인하세요.',
      codeExample: {
        before: 'import styles from "./styles.module.css";',
        after: '// 타입 선언 파일 생성: global.d.ts\ndeclare module "*.module.css" {\n  const classes: { [key: string]: string };\n  export default classes;\n}',
      },
    },
    {
      name: 'TS2556: Spread arguments',
      pattern: /TS2556|spread argument/,
      cause: '스프레드 연산자로 전달된 인자의 타입이 불확정',
      solution: 'as const를 사용하거나, 배열의 타입을 tuple로 명시하세요.',
      codeExample: {
        before: 'const args = ["hello", 42];\nfn(...args);',
        after: 'const args = ["hello", 42] as const;\nfn(...args);',
      },
    },
    {
      name: 'TS1005: Expected token',
      pattern: /TS1005/,
      cause: 'TypeScript 문법 에러 (세미콜론, 괄호, 쉼표 등 누락)',
      solution: '에러 위치 주변의 문법을 확인하세요.',
      codeExample: {
        before: 'const fn = (a: string b: number) => {}',
        after: 'const fn = (a: string, b: number) => {}',
      },
    },
    {
      name: 'TS2366: Return type mismatch',
      pattern: /TS2366|function lacks ending return/,
      cause: '함수의 일부 코드 경로에서 반환값이 없음',
      solution: '모든 코드 경로에서 반환값이 있는지 확인하세요.',
      codeExample: {
        before: 'function check(x: number): string {\n  if (x > 0) return "positive";\n}',
        after: 'function check(x: number): string {\n  if (x > 0) return "positive";\n  return "non-positive";\n}',
      },
    },
    {
      name: 'TS2741: Missing property',
      pattern: /TS2741|missing.*property/,
      cause: '필수 속성이 누락된 객체 할당',
      solution: '누락된 속성을 추가하거나, 속성을 optional(?)로 변경하세요.',
      codeExample: {
        before: 'interface Config { host: string; port: number; }\nconst c: Config = { host: "localhost" };',
        after: 'const c: Config = { host: "localhost", port: 3000 };',
      },
    },
    {
      name: 'TS18046: Unknown type',
      pattern: /TS18046|is of type.*unknown/,
      cause: 'unknown 타입의 값을 직접 사용',
      solution: '타입 가드 또는 타입 단언으로 타입을 좁히세요.',
      codeExample: {
        before: 'function handle(err: unknown) {\n  console.log(err.message);\n}',
        after: 'function handle(err: unknown) {\n  if (err instanceof Error) {\n    console.log(err.message);\n  }\n}',
      },
    },
    {
      name: 'TS2769: No overload matches',
      pattern: /TS2769|No overload matches/,
      cause: '오버로드된 함수에 일치하는 시그니처가 없음',
      solution: '함수의 오버로드 시그니처를 확인하고, 올바른 인자 조합을 전달하세요.',
      codeExample: {
        before: 'addEventListener("click", handler, { passive: true, capture: "yes" });',
        after: 'addEventListener("click", handler, { passive: true, capture: true });',
      },
    },
    {
      name: 'TS2454: Variable used before assignment',
      pattern: /TS2454|used before being assigned/,
      cause: '변수가 할당 전에 사용됨',
      solution: '초기값을 지정하거나, 할당 후에만 사용되도록 코드를 수정하세요.',
      codeExample: {
        before: 'let result: string;\nif (condition) result = "ok";\nconsole.log(result);',
        after: 'let result: string = "";\nif (condition) result = "ok";\nconsole.log(result);',
      },
    },
    {
      name: 'TS6133: Declared but never used',
      pattern: /TS6133|declared but.*never.*(?:used|read)/,
      cause: '선언했지만 사용하지 않는 변수/임포트',
      solution: '사용하지 않는 선언을 제거하거나, _접두사를 사용하세요.',
      codeExample: {
        before: 'import { useState, useEffect } from "react";\n// useEffect 미사용',
        after: 'import { useState } from "react";',
      },
    },
  ],

  go: [
    {
      name: 'nil pointer dereference',
      pattern: /nil pointer dereference/,
      cause: 'nil 포인터의 역참조',
      solution: '포인터 사용 전에 nil 체크를 추가하세요.',
      codeExample: {
        before: 'var p *User\nfmt.Println(p.Name)',
        after: 'if p != nil {\n    fmt.Println(p.Name)\n}',
      },
    },
    {
      name: 'deadlock',
      pattern: /fatal error.*deadlock|all goroutines are asleep/,
      cause: '모든 고루틴이 대기 상태에 빠짐',
      solution: '채널 연산에서 교착 상태가 없는지 확인하고, buffered 채널 사용을 고려하세요.',
      codeExample: {
        before: 'ch := make(chan int)\nch <- 1  // 수신자 없이 블록',
        after: 'ch := make(chan int, 1)\nch <- 1',
      },
    },
    {
      name: 'race condition',
      pattern: /DATA RACE|race condition/,
      cause: '여러 고루틴이 동시에 공유 변수에 접근',
      solution: 'sync.Mutex, sync.RWMutex, 또는 채널을 사용하여 동기화하세요. go test -race로 감지합니다.',
      codeExample: {
        before: 'var count int\nfor i := 0; i < 10; i++ {\n    go func() { count++ }()\n}',
        after: 'var count int64\nfor i := 0; i < 10; i++ {\n    go func() { atomic.AddInt64(&count, 1) }()\n}',
      },
    },
    {
      name: 'goroutine leak',
      pattern: /goroutine leak|too many goroutines/,
      cause: '고루틴이 종료되지 않고 계속 생성됨',
      solution: 'context.WithCancel로 고루틴 수명을 관리하고, defer cancel()을 사용하세요.',
      codeExample: {
        before: 'go func() {\n    for {\n        doWork()\n    }\n}()',
        after: 'ctx, cancel := context.WithCancel(context.Background())\ndefer cancel()\ngo func() {\n    for {\n        select {\n        case <-ctx.Done():\n            return\n        default:\n            doWork()\n        }\n    }\n}()',
      },
    },
    {
      name: 'index out of range',
      pattern: /index out of range/,
      cause: '슬라이스/배열의 범위를 벗어난 인덱스 접근',
      solution: 'len()으로 범위를 확인하세요.',
      codeExample: {
        before: 's := []int{1, 2, 3}\nfmt.Println(s[5])',
        after: 'if len(s) > 5 {\n    fmt.Println(s[5])\n}',
      },
    },
    {
      name: 'slice bounds out of range',
      pattern: /slice bounds out of range/,
      cause: '슬라이스의 범위를 벗어난 슬라이싱',
      solution: '슬라이스의 길이를 확인한 후 슬라이싱하세요.',
      codeExample: {
        before: 's := []int{1, 2}\nfmt.Println(s[1:5])',
        after: 'end := min(5, len(s))\nfmt.Println(s[1:end])',
      },
    },
    {
      name: 'map assignment to nil map',
      pattern: /assignment to entry in nil map/,
      cause: '초기화되지 않은 nil 맵에 값 할당',
      solution: 'make()로 맵을 초기화하세요.',
      codeExample: {
        before: 'var m map[string]int\nm["key"] = 1',
        after: 'm := make(map[string]int)\nm["key"] = 1',
      },
    },
    {
      name: 'interface conversion error',
      pattern: /interface conversion|type assertion/,
      cause: '인터페이스에서 잘못된 타입으로 단언',
      solution: 'comma-ok 패턴으로 타입 단언을 안전하게 수행하세요.',
      codeExample: {
        before: 'var i interface{} = "hello"\nn := i.(int)',
        after: 'if n, ok := i.(int); ok {\n    fmt.Println(n)\n}',
      },
    },
    {
      name: 'cannot use X as type Y',
      pattern: /cannot use.*as type/,
      cause: '타입 불일치',
      solution: '타입 변환을 적용하거나, 인터페이스 구현을 확인하세요.',
      codeExample: {
        before: 'var x int32 = 10\nvar y int64 = x',
        after: 'var x int32 = 10\nvar y int64 = int64(x)',
      },
    },
    {
      name: 'imported and not used',
      pattern: /imported and not used/,
      cause: '임포트한 패키지를 사용하지 않음',
      solution: '사용하지 않는 임포트를 제거하거나, _ 별칭을 사용하세요.',
      codeExample: {
        before: 'import "fmt"  // 미사용',
        after: '// 제거하거나\nimport _ "fmt"  // 사이드이펙트만 필요시',
      },
    },
    {
      name: 'undefined variable',
      pattern: /undefined:\s+\w+/,
      cause: '정의되지 않은 변수/함수 참조',
      solution: '변수명 오타를 확인하고, 올바른 스코프에서 선언되었는지 확인하세요.',
      codeExample: {
        before: 'fmt.Println(userName)',
        after: 'userName := "admin"\nfmt.Println(userName)',
      },
    },
    {
      name: 'multiple-value in single-value context',
      pattern: /multiple-value.*single-value/,
      cause: '여러 반환값을 가진 함수의 결과를 단일 변수에 할당',
      solution: '모든 반환값을 받거나, _ 로 무시하세요.',
      codeExample: {
        before: 'f := os.Open("file.txt")',
        after: 'f, err := os.Open("file.txt")\nif err != nil {\n    log.Fatal(err)\n}',
      },
    },
    {
      name: 'context deadline exceeded',
      pattern: /context deadline exceeded/,
      cause: '컨텍스트 타임아웃 초과',
      solution: '타임아웃 값을 늘리거나, 작업을 최적화하세요.',
      codeExample: {
        before: 'ctx, cancel := context.WithTimeout(ctx, 1*time.Second)',
        after: 'ctx, cancel := context.WithTimeout(ctx, 30*time.Second)\ndefer cancel()',
      },
    },
    {
      name: 'connection refused',
      pattern: /connection refused|dial tcp/,
      cause: '대상 서버에 연결할 수 없음',
      solution: '서버가 실행 중인지, 포트가 올바른지, 방화벽을 확인하세요.',
      codeExample: {
        before: 'conn, err := net.Dial("tcp", "localhost:8080")',
        after: '// 서버 실행 상태 확인: netstat -tlnp | grep 8080\nconn, err := net.DialTimeout("tcp", "localhost:8080", 5*time.Second)',
      },
    },
    {
      name: 'sync.WaitGroup misuse',
      pattern: /WaitGroup.*reused|negative WaitGroup counter/,
      cause: 'WaitGroup 카운터가 음수이거나 잘못된 재사용',
      solution: 'Add()를 고루틴 시작 전에 호출하고, Done()이 Add() 횟수와 일치하는지 확인하세요.',
      codeExample: {
        before: 'var wg sync.WaitGroup\nfor i := 0; i < 5; i++ {\n    go func() {\n        wg.Add(1)\n        defer wg.Done()\n    }()\n}',
        after: 'var wg sync.WaitGroup\nfor i := 0; i < 5; i++ {\n    wg.Add(1)\n    go func() {\n        defer wg.Done()\n    }()\n}\nwg.Wait()',
      },
    },
    {
      name: 'json unmarshal error',
      pattern: /json:.*cannot unmarshal|UnmarshalTypeError/,
      cause: 'JSON 역직렬화 시 타입 불일치',
      solution: '구조체 필드 태그와 JSON 키가 일치하는지, 타입이 맞는지 확인하세요.',
      codeExample: {
        before: 'type Config struct {\n    Port string `json:"port"`\n}\n// JSON: {"port": 8080}  ← 숫자',
        after: 'type Config struct {\n    Port int `json:"port"`\n}',
      },
    },
    {
      name: 'too many open files',
      pattern: /too many open files/,
      cause: '파일 디스크립터 제한 초과',
      solution: 'defer f.Close()로 파일을 즉시 닫고, ulimit -n으로 제한을 늘리세요.',
      codeExample: {
        before: 'for _, name := range files {\n    f, _ := os.Open(name)\n    // close 누락\n}',
        after: 'for _, name := range files {\n    f, err := os.Open(name)\n    if err != nil { continue }\n    defer f.Close()\n    // ...\n}',
      },
    },
    {
      name: 'go mod tidy 에러',
      pattern: /go mod|module.*not found|require.*not found/,
      cause: '모듈 의존성 문제 (프록시 접근 불가, 버전 불일치)',
      solution: 'GOPROXY를 설정하고, go mod tidy를 실행하세요.',
      codeExample: {
        before: 'go build  # module not found',
        after: 'export GOPROXY=https://proxy.golang.org,direct\ngo mod tidy\ngo build',
      },
    },
  ],

  rust: [
    {
      name: 'E0382: Borrow after move',
      pattern: /E0382|use of moved value/,
      cause: '소유권이 이동된 값에 접근 시도',
      solution: '.clone()으로 복사하거나, 참조(&)를 사용하세요.',
      codeExample: {
        before: 'let s = String::from("hello");\nlet s2 = s;\nprintln!("{}", s);  // 이동됨',
        after: 'let s = String::from("hello");\nlet s2 = s.clone();\nprintln!("{}", s);',
      },
    },
    {
      name: 'E0502: Mutable borrow conflict',
      pattern: /E0502|cannot borrow.*as mutable/,
      cause: '불변 참조가 있는 동안 가변 참조를 시도',
      solution: '불변 참조의 수명을 줄이거나, 블록으로 스코프를 분리하세요.',
      codeExample: {
        before: 'let r1 = &v;\nlet r2 = &mut v;  // 충돌',
        after: 'let r1 = &v;\nprintln!("{}", r1);  // 여기서 r1 사용 종료\nlet r2 = &mut v;  // OK',
      },
    },
    { name: 'E0106: Missing lifetime', pattern: /E0106|missing lifetime specifier/, cause: '참조를 반환하는 함수에 생명주기 명시 누락', solution: '생명주기 매개변수를 추가하세요.', codeExample: { before: 'fn first(s: &str) -> &str {\n    &s[..1]\n}', after: "fn first<'a>(s: &'a str) -> &'a str {\n    &s[..1]\n}" } },
    {
      name: 'E0308: Mismatched types',
      pattern: /E0308|mismatched types/,
      cause: '기대하는 타입과 실제 타입이 불일치',
      solution: '타입을 맞추거나, Into/From 트레이트를 사용하세요.',
      codeExample: {
        before: 'fn greet(name: String) {}\ngreet("hello");  // &str ≠ String',
        after: 'greet("hello".to_string());\n// 또는 fn greet(name: &str) {}',
      },
    },
    {
      name: 'E0277: Trait bound not satisfied',
      pattern: /E0277|trait bound.*not satisfied/,
      cause: '필요한 트레이트가 구현되지 않음',
      solution: '해당 트레이트를 구현하거나, #[derive(...)]를 추가하세요.',
      codeExample: {
        before: 'struct Point { x: f64, y: f64 }\nlet p = Point { x: 1.0, y: 2.0 };\nprintln!("{:?}", p);  // Debug 미구현',
        after: '#[derive(Debug)]\nstruct Point { x: f64, y: f64 }',
      },
    },
    {
      name: 'E0599: No method found',
      pattern: /E0599|no method named/,
      cause: '타입에 해당 메서드가 없음 (use 누락, 트레이트 미구현)',
      solution: '해당 트레이트를 use로 가져오거나, 메서드명을 확인하세요.',
      codeExample: {
        before: 'let v: Vec<i32> = vec![3, 1, 2];\nv.sorted();  // 없는 메서드',
        after: 'let mut v: Vec<i32> = vec![3, 1, 2];\nv.sort();',
      },
    },
    {
      name: 'thread panicked',
      pattern: /thread.*panicked at/,
      cause: 'unwrap(), expect(), 또는 panic! 호출 시 에러 발생',
      solution: 'unwrap() 대신 match나 ?를 사용하세요.',
      codeExample: {
        before: 'let f = File::open("data.txt").unwrap();',
        after: 'let f = File::open("data.txt")?;\n// 또는\nlet f = match File::open("data.txt") {\n    Ok(file) => file,\n    Err(e) => return Err(e.into()),\n};',
      },
    },
    {
      name: 'E0515: Cannot return reference to local variable',
      pattern: /E0515|cannot return reference to local/,
      cause: '로컬 변수에 대한 참조를 반환하려는 시도',
      solution: '소유권이 있는 값(String, Vec 등)을 반환하세요.',
      codeExample: {
        before: 'fn make_greeting() -> &str {\n    let s = String::from("hello");\n    &s\n}',
        after: 'fn make_greeting() -> String {\n    String::from("hello")\n}',
      },
    },
    { name: 'E0425: Cannot find value', pattern: /E0425|cannot find value/, cause: '스코프에 없는 변수/함수 참조', solution: '변수명, use 경로, mod 선언을 확인하세요.', codeExample: { before: 'fn main() {\n    println!("{}", my_func());\n}', after: 'fn my_func() -> &\'static str { "hello" }\nfn main() {\n    println!("{}", my_func());\n}' } },
    {
      name: 'E0433: Failed to resolve',
      pattern: /E0433|failed to resolve/,
      cause: '모듈/크레이트 경로를 찾을 수 없음',
      solution: 'Cargo.toml에 의존성이 추가되어 있는지, use 경로가 올바른지 확인하세요.',
      codeExample: {
        before: 'use serde::Serialize;  // Cargo.toml에 없음',
        after: '// Cargo.toml\n// [dependencies]\n// serde = { version = "1", features = ["derive"] }',
      },
    },
    {
      name: 'E0507: Cannot move out of borrowed content',
      pattern: /E0507|cannot move out of/,
      cause: '빌린 값에서 소유권을 이동시키려는 시도',
      solution: '.clone()을 사용하거나, 참조로 작업하세요.',
      codeExample: {
        before: 'fn take_name(user: &User) -> String {\n    user.name  // 이동 시도\n}',
        after: 'fn take_name(user: &User) -> String {\n    user.name.clone()\n}',
      },
    },
    {
      name: 'cargo build 링커 에러',
      pattern: /linker.*not found|ld:.*not found|cc:.*error/,
      cause: '시스템 링커 또는 C 라이브러리 누락',
      solution: '시스템 개발 도구를 설치하세요.',
      codeExample: {
        before: 'cargo build  # linker `cc` not found',
        after: '# Ubuntu/Debian\nsudo apt install build-essential\n# macOS\nxcode-select --install',
      },
    },
    {
      name: 'async/await 에러',
      pattern: /Future.*not.*Send|future cannot be shared/,
      cause: 'Send가 아닌 타입을 async 컨텍스트에서 사용',
      solution: 'Arc<Mutex<T>>를 사용하거나, Send를 구현하는 타입으로 교체하세요.',
      codeExample: {
        before: 'let data = Rc::new(RefCell::new(vec![]));\ntokio::spawn(async move { data.borrow_mut().push(1); });',
        after: 'let data = Arc::new(Mutex::new(vec![]));\ntokio::spawn(async move { data.lock().await.push(1); });',
      },
    },
    {
      name: 'E0046: Missing trait items',
      pattern: /E0046|not all trait items implemented/,
      cause: '트레이트의 필수 메서드를 구현하지 않음',
      solution: '누락된 메서드를 구현하세요.',
      codeExample: {
        before: 'impl Display for MyType {}',
        after: 'impl Display for MyType {\n    fn fmt(&self, f: &mut Formatter) -> fmt::Result {\n        write!(f, "{}", self.0)\n    }\n}',
      },
    },
    {
      name: 'integer overflow',
      pattern: /integer overflow|attempt to.*with overflow/,
      cause: '정수 연산이 표현 가능한 범위를 초과',
      solution: 'checked_add 등 checked 연산을 사용하거나, 더 큰 타입(u64, i128)을 사용하세요.',
      codeExample: {
        before: 'let x: u8 = 255;\nlet y = x + 1;  // overflow',
        after: 'let x: u8 = 255;\nlet y = x.checked_add(1).unwrap_or(u8::MAX);',
      },
    },
  ],

  cpp: [
    {
      name: 'Segmentation fault',
      pattern: /[Ss]egmentation fault|SIGSEGV/,
      cause: '잘못된 메모리 접근 (null 포인터, 해제된 메모리, 배열 범위 초과)',
      solution: 'gdb 또는 Valgrind로 디버깅하고, 스마트 포인터 사용을 권장합니다.',
      codeExample: {
        before: 'int* p = nullptr;\n*p = 42;',
        after: 'auto p = std::make_unique<int>(42);',
      },
    },
    {
      name: 'Dangling pointer',
      pattern: /dangling.*pointer|use.*after.*free/,
      cause: '이미 해제된 메모리에 대한 포인터 사용',
      solution: '스마트 포인터(unique_ptr, shared_ptr)를 사용하세요.',
      codeExample: {
        before: 'int* p = new int(42);\ndelete p;\n*p = 10;  // dangling',
        after: 'auto p = std::make_unique<int>(42);\n// 자동 해제됨',
      },
    },
    {
      name: 'Memory leak',
      pattern: /memory leak|definitely lost/,
      cause: '동적 할당 메모리를 해제하지 않음',
      solution: 'RAII 패턴과 스마트 포인터를 사용하세요. Valgrind로 누수를 감지합니다.',
      codeExample: {
        before: 'void func() {\n    int* arr = new int[100];\n    // delete[] 누락\n}',
        after: 'void func() {\n    auto arr = std::make_unique<int[]>(100);\n}',
      },
    },
    {
      name: 'Undefined behavior',
      pattern: /undefined behavior|UB|sanitizer/,
      cause: '정의되지 않은 동작 (초기화되지 않은 변수, 부호 정수 오버플로 등)',
      solution: '-fsanitize=undefined 플래그로 컴파일하여 감지하고, 변수를 항상 초기화하세요.',
      codeExample: {
        before: 'int x;\nif (x > 0) { ... }  // 초기화 안됨',
        after: 'int x = 0;\nif (x > 0) { ... }',
      },
    },
    {
      name: 'Double free',
      pattern: /double free|free\(\).*invalid/,
      cause: '이미 해제된 메모리를 다시 해제',
      solution: '스마트 포인터를 사용하거나, 해제 후 nullptr로 설정하세요.',
      codeExample: {
        before: 'delete p;\ndelete p;  // double free',
        after: 'delete p;\np = nullptr;',
      },
    },
    {
      name: 'Stack buffer overflow',
      pattern: /stack.*overflow|buffer overflow|stack smashing/,
      cause: '스택 버퍼 범위를 벗어난 쓰기',
      solution: '배열 대신 std::vector를 사용하고, 범위 검사를 추가하세요.',
      codeExample: {
        before: 'char buf[10];\nstrcpy(buf, very_long_string);',
        after: 'std::string buf = very_long_string;',
      },
    },
    {
      name: 'Undefined reference',
      pattern: /undefined reference to/,
      cause: '링크 시 심볼을 찾을 수 없음 (구현 누락, 라이브러리 미링크)',
      solution: '함수 구현이 있는지, 라이브러리가 올바르게 링크되었는지 확인하세요.',
      codeExample: {
        before: 'g++ main.cpp  # undefined reference to `foo()`',
        after: 'g++ main.cpp foo.cpp -o main',
      },
    },
    {
      name: 'No matching function',
      pattern: /no matching function|no viable/,
      cause: '호출하려는 함수의 시그니처와 일치하는 오버로드가 없음',
      solution: '함수 선언을 확인하고, 인자 타입을 맞추세요.',
      codeExample: {
        before: 'void print(int x);\nprint("hello");',
        after: 'void print(int x);\nvoid print(const std::string& s);\nprint("hello");',
      },
    },
    {
      name: 'Redefinition of symbol',
      pattern: /redefinition of|multiple definition/,
      cause: '같은 심볼이 여러 번 정의됨 (헤더 가드 누락)',
      solution: '#pragma once 또는 인클루드 가드를 사용하세요.',
      codeExample: {
        before: '// header.h\nint globalVar = 42;',
        after: '// header.h\n#pragma once\nextern int globalVar;\n\n// header.cpp\nint globalVar = 42;',
      },
    },
    {
      name: 'Template instantiation error',
      pattern: /template.*error|instantiation of/,
      cause: '템플릿 인스턴스화 실패 (타입 불일치, 개념 위반)',
      solution: '에러 메시지 끝부분의 실제 원인을 확인하고, 템플릿 인자 타입을 점검하세요.',
      codeExample: {
        before: 'std::sort(list.begin(), list.end());\n// MyType에 < 연산자 없음',
        after: 'bool operator<(const MyType& a, const MyType& b) { ... }\nstd::sort(list.begin(), list.end());',
      },
    },
    {
      name: 'Iterator invalidation',
      pattern: /iterator.*invalid|vector.*iterator/,
      cause: '컨테이너 수정으로 기존 이터레이터가 무효화됨',
      solution: '이터레이터를 갱신하거나, std::remove_if + erase 패턴을 사용하세요.',
      codeExample: {
        before: 'for (auto it = v.begin(); it != v.end(); ++it)\n    if (*it == 0) v.erase(it);',
        after: 'v.erase(std::remove(v.begin(), v.end(), 0), v.end());',
      },
    },
    {
      name: 'Missing header',
      pattern: /'.*' was not declared|use of undeclared identifier/,
      cause: '필요한 헤더 파일이 포함되지 않음',
      solution: '해당 기능의 헤더를 #include하세요.',
      codeExample: {
        before: 'std::string s = "hello";  // <string> 미포함',
        after: '#include <string>\nstd::string s = "hello";',
      },
    },
    {
      name: 'Const correctness',
      pattern: /cannot assign to.*const|discards qualifiers/,
      cause: 'const 객체를 수정하려는 시도',
      solution: 'const를 제거하거나, mutable 키워드를 사용하세요 (적절한 경우에만).',
      codeExample: {
        before: 'void process(const std::string& s) {\n    s += " done";  // const 위반\n}',
        after: 'void process(std::string& s) {\n    s += " done";\n}',
      },
    },
    {
      name: 'CMake 에러',
      pattern: /CMake Error|Could not find.*package/,
      cause: 'CMake 설정 오류, 패키지 미설치',
      solution: 'find_package에 필요한 라이브러리를 설치하고, CMAKE_PREFIX_PATH를 설정하세요.',
      codeExample: {
        before: 'cmake ..  # Could not find package "Boost"',
        after: 'sudo apt install libboost-all-dev\ncmake .. -DCMAKE_PREFIX_PATH=/usr/local',
      },
    },
  ],

  csharp: [
    {
      name: 'NullReferenceException',
      pattern: /NullReferenceException/,
      cause: 'null 객체의 멤버에 접근',
      solution: 'null 조건 연산자(?.)를 사용하거나, null 체크를 추가하세요.',
      codeExample: {
        before: 'string name = user.Name.ToUpper();',
        after: 'string name = user?.Name?.ToUpper() ?? "UNKNOWN";',
      },
    },
    {
      name: 'InvalidCastException',
      pattern: /InvalidCastException/,
      cause: '호환되지 않는 타입으로 캐스팅',
      solution: 'as 연산자와 null 체크를 사용하세요.',
      codeExample: {
        before: 'var s = (string)obj;',
        after: 'var s = obj as string;\nif (s != null) { ... }',
      },
    },
    {
      name: 'StackOverflowException',
      pattern: /StackOverflowException/,
      cause: '무한 재귀 또는 너무 깊은 호출 스택',
      solution: '재귀 종료 조건을 확인하고, 필요시 반복문으로 변환하세요.',
      codeExample: {
        before: 'public int Fib(int n) => Fib(n-1) + Fib(n-2);',
        after: 'public int Fib(int n) {\n    if (n <= 1) return n;\n    return Fib(n-1) + Fib(n-2);\n}',
      },
    },
    {
      name: 'ArgumentNullException',
      pattern: /ArgumentNullException/,
      cause: 'null이 허용되지 않는 매개변수에 null 전달',
      solution: '호출 전에 null 체크를 수행하세요.',
      codeExample: {
        before: 'File.ReadAllText(null);',
        after: 'if (path != null)\n    File.ReadAllText(path);',
      },
    },
    {
      name: 'InvalidOperationException',
      pattern: /InvalidOperationException/,
      cause: '현재 상태에서 허용되지 않는 작업 수행',
      solution: '객체 상태를 확인한 후 작업을 수행하세요.',
      codeExample: {
        before: 'var first = list.First();  // 빈 리스트',
        after: 'var first = list.FirstOrDefault();',
      },
    },
    {
      name: 'FormatException',
      pattern: /FormatException/,
      cause: '잘못된 형식의 문자열을 변환 시도',
      solution: 'TryParse를 사용하여 안전하게 변환하세요.',
      codeExample: {
        before: 'int n = int.Parse("abc");',
        after: 'if (int.TryParse(input, out int n)) {\n    // 성공\n} else {\n    // 실패 처리\n}',
      },
    },
    {
      name: 'IndexOutOfRangeException',
      pattern: /IndexOutOfRangeException/,
      cause: '배열/컬렉션의 유효 범위를 벗어난 인덱스',
      solution: 'Length/Count를 먼저 확인하세요.',
      codeExample: {
        before: 'var item = arr[10];',
        after: 'if (arr.Length > 10)\n    var item = arr[10];',
      },
    },
    {
      name: 'DivideByZeroException',
      pattern: /DivideByZeroException/,
      cause: '정수를 0으로 나누기',
      solution: '나누기 전에 분모를 확인하세요.',
      codeExample: {
        before: 'int result = total / count;',
        after: 'int result = count != 0 ? total / count : 0;',
      },
    },
    {
      name: 'ObjectDisposedException',
      pattern: /ObjectDisposedException/,
      cause: '이미 Dispose된 객체 사용',
      solution: 'using 블록 내에서만 객체를 사용하세요.',
      codeExample: {
        before: 'var stream = new FileStream(path, FileMode.Open);\nstream.Dispose();\nstream.Read(...);',
        after: 'using var stream = new FileStream(path, FileMode.Open);\n// using 블록 내에서 사용',
      },
    },
    {
      name: 'NotImplementedException',
      pattern: /NotImplementedException/,
      cause: '아직 구현되지 않은 메서드 호출',
      solution: '해당 메서드의 구현을 완성하세요.',
      codeExample: {
        before: 'public override string ToString() {\n    throw new NotImplementedException();\n}',
        after: 'public override string ToString() {\n    return $"{Name} ({Id})";\n}',
      },
    },
    {
      name: 'AggregateException',
      pattern: /AggregateException/,
      cause: 'Task에서 여러 예외가 동시에 발생',
      solution: 'Flatten()으로 내부 예외를 확인하고, 각각 처리하세요.',
      codeExample: {
        before: 'task.Wait();  // AggregateException',
        after: 'try {\n    await task;\n} catch (Exception ex) {\n    Console.Error.WriteLine(ex.Message);\n}',
      },
    },
    {
      name: 'TaskCanceledException',
      pattern: /TaskCanceledException/,
      cause: 'HTTP 요청 등 비동기 작업의 타임아웃 또는 취소',
      solution: '타임아웃을 늘리거나, CancellationToken을 적절히 처리하세요.',
      codeExample: {
        before: 'var result = await client.GetAsync(url);',
        after: 'using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(30));\nvar result = await client.GetAsync(url, cts.Token);',
      },
    },
    {
      name: 'HttpRequestException',
      pattern: /HttpRequestException/,
      cause: 'HTTP 요청 실패 (연결 거부, DNS 실패, SSL 오류)',
      solution: '서버 상태를 확인하고, 재시도 로직을 추가하세요.',
      codeExample: {
        before: 'var response = await client.GetAsync(url);',
        after: 'try {\n    var response = await client.GetAsync(url);\n    response.EnsureSuccessStatusCode();\n} catch (HttpRequestException ex) {\n    Console.Error.WriteLine($"HTTP 요청 실패: {ex.Message}");\n}',
      },
    },
    {
      name: 'Entity Framework 마이그레이션 에러',
      pattern: /migration|DbUpdateException|EF.*error/,
      cause: 'DB 스키마와 모델 불일치, 마이그레이션 실패',
      solution: 'dotnet ef migrations add/update로 마이그레이션을 동기화하세요.',
      codeExample: {
        before: 'dotnet ef database update  # 에러',
        after: 'dotnet ef migrations add FixSchema\ndotnet ef database update',
      },
    },
    {
      name: 'LINQ 관련 에러',
      pattern: /Sequence contains no elements|InvalidOperationException.*LINQ/,
      cause: '빈 시퀀스에서 First(), Single() 등 호출',
      solution: 'FirstOrDefault(), SingleOrDefault()를 사용하세요.',
      codeExample: {
        before: 'var item = list.Single(x => x.Id == 999);',
        after: 'var item = list.SingleOrDefault(x => x.Id == 999);\nif (item == null) { /* 처리 */ }',
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// FRAMEWORK ERRORS - 프레임워크별 에러 패턴
// ─────────────────────────────────────────────────────────────────────────────
export const FRAMEWORK_ERRORS = {
  react: [
    {
      name: 'Invalid hook call',
      pattern: /Invalid hook call/,
      cause: '훅을 조건문/반복문 안에서 호출하거나, 함수 컴포넌트 밖에서 호출',
      solution: '훅은 반드시 컴포넌트/커스텀 훅의 최상위에서만 호출하세요.',
      codeExample: {
        before: 'if (condition) {\n  const [val, setVal] = useState(0);\n}',
        after: 'const [val, setVal] = useState(0);\nif (condition) { /* val 사용 */ }',
      },
    },
    {
      name: 'Too many re-renders',
      pattern: /Too many re-renders/,
      cause: '렌더링 중 setState를 직접 호출하여 무한 루프 발생',
      solution: 'setState를 이벤트 핸들러나 useEffect 안에서 호출하세요.',
      codeExample: {
        before: 'function App() {\n  const [count, setCount] = useState(0);\n  setCount(count + 1);  // 렌더링마다 호출\n}',
        after: 'function App() {\n  const [count, setCount] = useState(0);\n  return <button onClick={() => setCount(c => c + 1)}>+</button>;\n}',
      },
    },
    {
      name: 'Cannot update unmounted component',
      pattern: /Can't perform.*state update.*unmounted/,
      cause: '언마운트된 컴포넌트에서 상태 업데이트 시도',
      solution: 'useEffect cleanup에서 비동기 작업을 취소하세요.',
      codeExample: {
        before: 'useEffect(() => {\n  fetchData().then(data => setData(data));\n}, []);',
        after: 'useEffect(() => {\n  let cancelled = false;\n  fetchData().then(data => {\n    if (!cancelled) setData(data);\n  });\n  return () => { cancelled = true; };\n}, []);',
      },
    },
    {
      name: 'Each child should have a unique key',
      pattern: /unique "key" prop/,
      cause: '리스트 렌더링 시 key prop이 없거나 중복됨',
      solution: '각 항목에 고유한 key를 제공하세요. index는 가능하면 피하세요.',
      codeExample: {
        before: '{items.map(item => <li>{item.name}</li>)}',
        after: '{items.map(item => <li key={item.id}>{item.name}</li>)}',
      },
    },
    {
      name: 'Objects are not valid as React child',
      pattern: /Objects are not valid as a React child/,
      cause: '객체를 직접 JSX에 렌더링하려는 시도',
      solution: '객체의 특정 속성을 렌더링하거나, JSON.stringify를 사용하세요.',
      codeExample: {
        before: '<div>{user}</div>',
        after: '<div>{user.name}</div>',
      },
    },
    {
      name: 'Hydration mismatch',
      pattern: /Hydration failed|content does not match/,
      cause: '서버와 클라이언트의 렌더링 결과가 다름 (SSR)',
      solution: 'useEffect 안에서 클라이언트 전용 로직을 실행하세요.',
      codeExample: {
        before: 'return <div>{new Date().toISOString()}</div>;',
        after: 'const [time, setTime] = useState("");\nuseEffect(() => setTime(new Date().toISOString()), []);\nreturn <div>{time}</div>;',
      },
    },
    {
      name: 'useEffect dependency warning',
      pattern: /React Hook useEffect has.*missing dependency/,
      cause: 'useEffect 내에서 사용되지만 의존성 배열에 포함되지 않은 값',
      solution: '의존성 배열에 누락된 값을 추가하거나, useCallback/useMemo를 사용하세요.',
      codeExample: {
        before: 'useEffect(() => {\n  fetchUser(userId);\n}, []);  // userId 누락',
        after: 'useEffect(() => {\n  fetchUser(userId);\n}, [userId]);',
      },
    },
    {
      name: 'Rendered fewer/more hooks',
      pattern: /Rendered (?:fewer|more) hooks than/,
      cause: '조건부로 다른 수의 훅을 호출',
      solution: '모든 훅 호출이 항상 같은 순서와 개수로 실행되도록 하세요.',
      codeExample: {
        before: 'if (isAdmin) {\n  useEffect(() => { ... }, []);\n}',
        after: 'useEffect(() => {\n  if (isAdmin) { ... }\n}, [isAdmin]);',
      },
    },
    {
      name: 'Maximum update depth exceeded',
      pattern: /Maximum update depth exceeded/,
      cause: 'setState가 끊임없이 호출되는 무한 루프',
      solution: '의존성 배열을 점검하고, setState 호출 조건을 확인하세요.',
      codeExample: {
        before: 'useEffect(() => {\n  setCount(count + 1);\n}, [count]);',
        after: 'useEffect(() => {\n  setCount(c => c + 1);\n}, []);  // 또는 조건부 업데이트',
      },
    },
    {
      name: 'React Router 에러',
      pattern: /useNavigate|useLocation|useParams|Router/,
      cause: 'Router 컨텍스트 바깥에서 라우터 훅 사용',
      solution: '컴포넌트가 <BrowserRouter> 안에 있는지 확인하세요.',
      codeExample: {
        before: 'function App() {\n  const navigate = useNavigate();\n  return <div>...</div>;\n}',
        after: '<BrowserRouter>\n  <App />\n</BrowserRouter>',
      },
    },
  ],

  nextjs: [
    { name: 'Server Component에서 useState', pattern: /useState.*server|client.*component.*hook/, cause: 'Server Component에서 클라이언트 훅 사용', solution: "파일 상단에 'use client'를 추가하세요.", codeExample: { before: 'export default function Page() {\n  const [state, setState] = useState(0);\n}', after: "'use client';\nexport default function Page() {\n  const [state, setState] = useState(0);\n}" } },
    {
      name: 'Dynamic server usage',
      pattern: /Dynamic server usage|cookies\(\)|headers\(\)/,
      cause: '정적 생성 페이지에서 동적 서버 API 사용',
      solution: 'export const dynamic = "force-dynamic"을 추가하세요.',
      codeExample: {
        before: 'export default function Page() {\n  const cookieStore = cookies();\n}',
        after: 'export const dynamic = "force-dynamic";\nexport default function Page() {\n  const cookieStore = cookies();\n}',
      },
    },
    {
      name: 'NEXT_REDIRECT',
      pattern: /NEXT_REDIRECT/,
      cause: 'redirect()가 try-catch 안에서 잡힘',
      solution: 'redirect()는 throw하므로 catch에서 다시 throw하세요.',
      codeExample: {
        before: 'try {\n  redirect("/login");\n} catch (e) {\n  // redirect 잡힘\n}',
        after: 'try {\n  // 로직\n} catch (e) {\n  if (e?.digest?.startsWith("NEXT_REDIRECT")) throw e;\n  // 에러 처리\n}',
      },
    },
    { name: 'Module not found: fs', pattern: /Module not found.*(?:fs|path|crypto|child_process)/, cause: 'Node.js 전용 모듈을 클라이언트에서 임포트', solution: '서버 전용 코드를 API route나 Server Component로 분리하세요.', codeExample: { before: "import fs from 'fs';  // 클라이언트 컴포넌트에서", after: "// API Route (app/api/read/route.js)에서 사용\nimport fs from 'fs';" } },
    {
      name: 'Image optimization error',
      pattern: /next\/image|Image.*Error/,
      cause: 'Next.js Image 컴포넌트 설정 오류 (도메인 미등록 등)',
      solution: 'next.config.js에 images.remotePatterns를 설정하세요.',
      codeExample: {
        before: '<Image src="https://external.com/img.jpg" />',
        after: '// next.config.js\nimages: {\n  remotePatterns: [{ hostname: "external.com" }]\n}',
      },
    },
    {
      name: 'API Route body parsing',
      pattern: /body.*undefined|request\.json.*failed/,
      cause: 'API Route에서 body 파싱 실패',
      solution: 'Content-Type이 application/json인지 확인하고, await request.json()을 사용하세요.',
      codeExample: {
        before: 'export async function POST(req) {\n  const { name } = req.body;\n}',
        after: 'export async function POST(req) {\n  const { name } = await req.json();\n}',
      },
    },
    {
      name: 'Middleware 에러',
      pattern: /middleware.*error|NextResponse.*redirect/,
      cause: 'Middleware 설정/로직 오류',
      solution: 'middleware.js의 matcher 설정과 로직을 확인하세요.',
      codeExample: {
        before: 'export function middleware(request) {\n  return Response.redirect("/login");\n}',
        after: 'import { NextResponse } from "next/server";\nexport function middleware(request) {\n  return NextResponse.redirect(new URL("/login", request.url));\n}',
      },
    },
    {
      name: 'Build output 에러',
      pattern: /Static generation.*failed|Error occurred prerendering/,
      cause: '빌드 시 정적 페이지 생성 실패',
      solution: '해당 페이지의 데이터 fetching 로직을 확인하고, 빌드 시 접근 가능한 데이터인지 점검하세요.',
      codeExample: {
        before: '// 빌드 시 외부 API 접근 불가',
        after: 'export const dynamic = "force-dynamic";\n// 또는 fallback 데이터 제공',
      },
    },
  ],

  spring: [
    {
      name: 'BeanCreationException',
      pattern: /BeanCreationException|BeanDefinition/,
      cause: 'Spring 빈 생성 실패',
      solution: '컴포넌트 스캔 범위, 의존성 주입 설정을 확인하세요.',
      codeExample: {
        before: '@Autowired MyService service; // 빈 미등록',
        after: '@Service\npublic class MyService { ... }',
      },
    },
    {
      name: 'NoSuchBeanDefinitionException',
      pattern: /NoSuchBeanDefinition/,
      cause: '요청한 타입/이름의 빈이 컨텍스트에 없음',
      solution: '@Component, @Service, @Repository 어노테이션과 패키지 스캔 범위를 확인하세요.',
      codeExample: {
        before: '@Autowired\nprivate CustomRepo repo;  // 미등록',
        after: '@Repository\npublic class CustomRepo { ... }',
      },
    },
    {
      name: 'HttpMessageNotReadableException',
      pattern: /HttpMessageNotReadable/,
      cause: 'Request Body를 역직렬화할 수 없음 (JSON 형식 오류)',
      solution: 'Content-Type 헤더와 JSON 형식을 확인하세요.',
      codeExample: {
        before: '// {name: "Kim"}  ← 잘못된 JSON',
        after: '// {"name": "Kim"}  ← 올바른 JSON',
      },
    },
    {
      name: '405 Method Not Allowed',
      pattern: /405|Method Not Allowed|Request method.*not supported/,
      cause: '지원하지 않는 HTTP 메서드로 요청',
      solution: '@GetMapping, @PostMapping 등이 올바른 메서드와 매핑되어 있는지 확인하세요.',
      codeExample: {
        before: '@GetMapping("/users")\npublic void createUser() { }',
        after: '@PostMapping("/users")\npublic void createUser() { }',
      },
    },
    {
      name: 'DataIntegrityViolationException',
      pattern: /DataIntegrityViolation|constraint.*violation/,
      cause: 'DB 제약조건 위반 (유니크, FK, NOT NULL 등)',
      solution: '입력 데이터의 유효성을 검증하고, DB 스키마를 확인하세요.',
      codeExample: {
        before: '// 중복 이메일 삽입 시도',
        after: '@Column(unique = true)\nprivate String email;\n// 삽입 전 중복 체크 로직 추가',
      },
    },
    {
      name: 'LazyInitializationException',
      pattern: /LazyInitialization/,
      cause: '영속성 컨텍스트 종료 후 지연 로딩 접근',
      solution: 'Fetch Join이나 @EntityGraph를 사용하세요.',
      codeExample: {
        before: 'user.getOrders().size();  // 세션 종료 후',
        after: '@Query("SELECT u FROM User u JOIN FETCH u.orders")\nList<User> findAllWithOrders();',
      },
    },
    {
      name: 'CircularDependencyException',
      pattern: /circular.*depend|BeanCurrentlyInCreation/,
      cause: '순환 의존성',
      solution: '@Lazy로 지연 주입하거나, 설계를 리팩토링하세요.',
      codeExample: {
        before: '// A → B → A 순환',
        after: '@Autowired @Lazy\nprivate ServiceB serviceB;',
      },
    },
    {
      name: '401 Unauthorized (Spring Security)',
      pattern: /401.*(?:Unauthorized|spring.security)/,
      cause: 'Spring Security 인증 실패',
      solution: 'SecurityFilterChain 설정에서 해당 경로의 허용 여부를 확인하세요.',
      codeExample: {
        before: '// /api/public이 인증 필요로 설정됨',
        after: '.authorizeHttpRequests(auth -> auth\n    .requestMatchers("/api/public/**").permitAll()\n    .anyRequest().authenticated()\n)',
      },
    },
    {
      name: 'MethodArgumentNotValidException',
      pattern: /MethodArgumentNotValid|Validation failed/,
      cause: '@Valid 검증 실패',
      solution: '입력값이 @NotNull, @Size 등 제약조건을 만족하는지 확인하세요.',
      codeExample: {
        before: '// name이 null인 채로 요청',
        after: '// 요청: {"name": "Kim", "email": "kim@test.com"}',
      },
    },
    {
      name: 'Connection pool exhausted',
      pattern: /connection pool|HikariPool.*timeout/,
      cause: '커넥션 풀이 고갈됨 (커넥션 반환 지연, 풀 크기 부족)',
      solution: 'HikariCP 설정(maximumPoolSize, connectionTimeout)을 조정하고, 커넥션 누수를 점검하세요.',
      codeExample: {
        before: 'spring.datasource.hikari.maximum-pool-size=5',
        after: 'spring.datasource.hikari.maximum-pool-size=20\nspring.datasource.hikari.leak-detection-threshold=30000',
      },
    },
  ],

  django: [
    { name: 'TemplateDoesNotExist', pattern: /TemplateDoesNotExist/, cause: '템플릿 파일을 찾을 수 없음', solution: 'TEMPLATES 설정의 DIRS와 APP_DIRS를 확인하고, 템플릿 경로가 올바른지 점검하세요.', codeExample: { before: "render(request, 'myapp/index.html')", after: "# templates/myapp/index.html 파일 생성 확인\n# settings.py TEMPLATES[0]['DIRS'] 확인" } },
    {
      name: 'OperationalError (no such table)',
      pattern: /OperationalError.*no such table/,
      cause: '마이그레이션이 적용되지 않음',
      solution: 'python manage.py makemigrations && migrate를 실행하세요.',
      codeExample: {
        before: 'python manage.py runserver  # 테이블 없음',
        after: 'python manage.py makemigrations\npython manage.py migrate',
      },
    },
    { name: 'ImproperlyConfigured', pattern: /ImproperlyConfigured/, cause: 'Django 설정 오류 (SECRET_KEY 누락, DB 설정 등)', solution: 'settings.py의 필수 설정값을 확인하세요.', codeExample: { before: '# SECRET_KEY 미설정', after: "SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'dev-key')" } },
    {
      name: 'IntegrityError',
      pattern: /IntegrityError/,
      cause: 'DB 제약조건 위반',
      solution: '유니크 제약, FK 참조, NOT NULL 조건을 확인하세요.',
      codeExample: {
        before: 'User.objects.create(email="dup@test.com")  # 중복',
        after: 'User.objects.get_or_create(email="dup@test.com")',
      },
    },
    {
      name: 'CSRF verification failed',
      pattern: /CSRF.*fail|Forbidden.*CSRF/,
      cause: 'CSRF 토큰 누락 또는 불일치',
      solution: '폼에 {% csrf_token %}을 추가하거나, AJAX 요청에 X-CSRFToken 헤더를 포함하세요.',
      codeExample: {
        before: '<form method="POST">\n  <input name="data" />\n</form>',
        after: '<form method="POST">\n  {% csrf_token %}\n  <input name="data" />\n</form>',
      },
    },
    { name: 'Reverse not found', pattern: /Reverse.*NoReverseMatch/, cause: 'URL 패턴을 찾을 수 없음 (이름 불일치, 인자 누락)', solution: 'urls.py의 name과 reverse()의 인자를 확인하세요.', codeExample: { before: "reverse('user-detail')", after: "# urls.py: path('user/<int:pk>/', views.detail, name='user-detail')\nreverse('user-detail', args=[1])" } },
    { name: 'FieldDoesNotExist', pattern: /FieldDoesNotExist|Cannot resolve keyword/, cause: '모델에 없는 필드명으로 쿼리', solution: '모델 필드명과 쿼리 키워드가 일치하는지 확인하세요.', codeExample: { before: "User.objects.filter(username='Kim')", after: "# 모델 필드 확인\nUser.objects.filter(name='Kim')  # 실제 필드명" } },
    { name: 'DisallowedHost', pattern: /DisallowedHost/, cause: 'ALLOWED_HOSTS에 현재 호스트가 포함되지 않음', solution: 'settings.py의 ALLOWED_HOSTS에 호스트를 추가하세요.', codeExample: { before: "ALLOWED_HOSTS = []", after: "ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'yourdomain.com']" } },
    {
      name: 'N+1 쿼리 문제',
      pattern: /SELECT.*FROM.*(?:많은 쿼리|slow query)/,
      cause: '루프 안에서 개별 쿼리가 실행되는 N+1 문제',
      solution: 'select_related() 또는 prefetch_related()를 사용하세요.',
      codeExample: {
        before: 'for order in Order.objects.all():\n    print(order.user.name)  # N+1',
        after: 'for order in Order.objects.select_related("user").all():\n    print(order.user.name)',
      },
    },
    {
      name: 'Migration 충돌',
      pattern: /Conflicting migrations|migration.*conflict/,
      cause: '여러 브랜치에서 생성된 마이그레이션 파일이 충돌',
      solution: 'python manage.py makemigrations --merge로 병합하세요.',
      codeExample: {
        before: 'python manage.py migrate  # conflicting migrations',
        after: 'python manage.py makemigrations --merge\npython manage.py migrate',
      },
    },
  ],

  fastapi: [
    {
      name: '422 Validation Error',
      pattern: /422|Validation Error|RequestValidationError/,
      cause: '요청 데이터가 Pydantic 모델 검증에 실패',
      solution: '요청 body/query/path 파라미터가 스키마와 일치하는지 확인하세요.',
      codeExample: {
        before: '# POST /users body: {"age": "abc"}',
        after: '# POST /users body: {"age": 25}  ← int 타입',
      },
    },
    {
      name: 'Depends 주입 에러',
      pattern: /Depends|dependency.*error/,
      cause: 'FastAPI 의존성 주입 실패',
      solution: 'Depends() 함수의 반환값과 타입 힌트를 확인하세요.',
      codeExample: {
        before: 'def get_db():\n    db = SessionLocal()\n    return db  # close 안됨',
        after: 'def get_db():\n    db = SessionLocal()\n    try:\n        yield db\n    finally:\n        db.close()',
      },
    },
    {
      name: 'Circular import',
      pattern: /circular import|ImportError.*partially initialized/,
      cause: '모듈 간 순환 임포트',
      solution: '임포트를 함수 안으로 이동하거나, 구조를 리팩토링하세요.',
      codeExample: {
        before: '# a.py\nfrom b import func_b\n# b.py\nfrom a import func_a',
        after: '# a.py\ndef use_b():\n    from b import func_b\n    func_b()',
      },
    },
    {
      name: 'CORS 에러',
      pattern: /CORSMiddleware|CORS/,
      cause: 'CORS 미들웨어 미설정',
      solution: 'CORSMiddleware를 추가하세요.',
      codeExample: {
        before: 'app = FastAPI()',
        after: 'from fastapi.middleware.cors import CORSMiddleware\napp.add_middleware(\n    CORSMiddleware,\n    allow_origins=["*"],\n    allow_methods=["*"],\n    allow_headers=["*"],\n)',
      },
    },
    {
      name: 'Async DB 세션 에러',
      pattern: /async.*session|greenlet.*error/,
      cause: '동기 ORM을 비동기 컨텍스트에서 사용',
      solution: 'AsyncSession과 async 엔진을 사용하세요.',
      codeExample: {
        before: 'result = session.query(User).all()',
        after: 'result = await session.execute(select(User))\nusers = result.scalars().all()',
      },
    },
  ],

  express: [
    { name: 'Cannot GET /route', pattern: /Cannot (?:GET|POST|PUT|DELETE)/, cause: '등록되지 않은 라우트로 요청', solution: '라우트 경로와 HTTP 메서드가 올바르게 등록되어 있는지 확인하세요.', codeExample: { before: "app.get('/user', handler);\n// GET /users → 404", after: "app.get('/users', handler);" } },
    {
      name: 'req.body undefined',
      pattern: /req\.body.*undefined|Cannot read.*body/,
      cause: 'body-parser 미들웨어 미설정',
      solution: 'express.json() 미들웨어를 라우트 전에 추가하세요.',
      codeExample: {
        before: 'app.post("/api", (req, res) => {\n  console.log(req.body);  // undefined\n});',
        after: 'app.use(express.json());\napp.post("/api", (req, res) => {\n  console.log(req.body);\n});',
      },
    },
    {
      name: 'Headers already sent',
      pattern: /Can't set headers.*already sent/,
      cause: '응답을 이미 보낸 후 다시 응답 시도',
      solution: 'return을 사용하여 중복 응답을 방지하세요.',
      codeExample: {
        before: 'app.get("/", (req, res) => {\n  res.send("hello");\n  res.send("world");\n});',
        after: 'app.get("/", (req, res) => {\n  return res.send("hello");\n});',
      },
    },
    {
      name: 'EADDRINUSE',
      pattern: /EADDRINUSE/,
      cause: '포트가 이미 사용 중',
      solution: '다른 포트를 사용하거나, 기존 프로세스를 종료하세요.',
      codeExample: {
        before: 'app.listen(3000);  // 이미 사용 중',
        after: '// lsof -i :3000 으로 확인 후\n// kill -9 <PID>\napp.listen(3000);',
      },
    },
    {
      name: 'Middleware 순서 에러',
      pattern: /middleware.*order|404.*before.*route/,
      cause: '미들웨어 등록 순서가 잘못됨',
      solution: '인증 → 라우트 → 에러 핸들러 순으로 등록하세요.',
      codeExample: {
        before: 'app.use(errorHandler);\napp.use("/api", router);  // 순서 잘못',
        after: 'app.use("/api", router);\napp.use(errorHandler);  // 에러 핸들러는 마지막',
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// DATABASE ERRORS - DB별 에러 패턴
// ─────────────────────────────────────────────────────────────────────────────
export const DATABASE_ERRORS = {
  postgresql: [
    { name: '23505 unique_violation', pattern: /23505|unique.*violation|duplicate key/, cause: '유니크 제약조건 위반 (중복 키)', solution: 'ON CONFLICT 절을 사용하거나, 삽입 전 중복 확인을 하세요.', codeExample: { before: "INSERT INTO users (email) VALUES ('dup@test.com');", after: "INSERT INTO users (email) VALUES ('dup@test.com')\nON CONFLICT (email) DO UPDATE SET updated_at = NOW();" } },
    {
      name: '23503 foreign_key_violation',
      pattern: /23503|foreign key.*violation/,
      cause: 'FK 참조 무결성 위반 (존재하지 않는 참조)',
      solution: '참조하는 레코드가 먼저 존재하는지 확인하세요.',
      codeExample: {
        before: 'INSERT INTO orders (user_id) VALUES (999); -- user 없음',
        after: '-- 먼저 user 존재 확인\nSELECT id FROM users WHERE id = 999;',
      },
    },
    { name: '23502 not_null_violation', pattern: /23502|not-null.*violation|null value.*violates/, cause: 'NOT NULL 컬럼에 NULL 값 삽입', solution: '해당 컬럼에 값을 제공하거나, DEFAULT 값을 설정하세요.', codeExample: { before: 'INSERT INTO users (name) VALUES (NULL);', after: 'INSERT INTO users (name) VALUES (COALESCE(input_name, \'Unknown\'));' } },
    { name: '42P01 undefined_table', pattern: /42P01|relation.*does not exist/, cause: '존재하지 않는 테이블 참조', solution: '테이블 이름과 스키마를 확인하고, 마이그레이션이 적용되었는지 점검하세요.', codeExample: { before: 'SELECT * FROM user_profiles;  -- 테이블 없음', after: "-- \\dt 로 테이블 목록 확인\n-- CREATE TABLE IF NOT EXISTS user_profiles (...);" } },
    {
      name: '42703 undefined_column',
      pattern: /42703|column.*does not exist/,
      cause: '존재하지 않는 컬럼 참조',
      solution: '컬럼 이름의 오타를 확인하고, 대소문자를 주의하세요 (PostgreSQL은 큰따옴표 없으면 소문자).',
      codeExample: {
        before: 'SELECT userName FROM users;',
        after: 'SELECT "userName" FROM users;\n-- 또는 SELECT user_name FROM users;',
      },
    },
    { name: '42601 syntax_error', pattern: /42601|syntax error at or near/, cause: 'SQL 문법 에러', solution: '에러 위치 주변의 SQL 문법을 확인하세요.', codeExample: { before: "SELECT * FROM users WEHRE id = 1;", after: "SELECT * FROM users WHERE id = 1;" } },
    {
      name: '53300 too_many_connections',
      pattern: /53300|too many.*connections|remaining connection slots/,
      cause: '최대 연결 수 초과',
      solution: '커넥션 풀을 사용하고, max_connections을 조정하세요.',
      codeExample: {
        before: '-- 직접 연결 생성',
        after: '-- pgbouncer 또는 커넥션 풀 사용\n-- postgresql.conf: max_connections = 200',
      },
    },
    {
      name: '40001 serialization_failure',
      pattern: /40001|serialization failure|deadlock detected/,
      cause: '트랜잭션 직렬화 실패 또는 교착 상태',
      solution: '트랜잭션을 재시도하거나, 격리 수준을 조정하세요.',
      codeExample: {
        before: '-- SERIALIZABLE 격리 수준에서 충돌',
        after: 'BEGIN;\n-- 작업\nCOMMIT;\n-- 실패 시 재시도 로직 추가',
      },
    },
    {
      name: '57014 query_canceled',
      pattern: /57014|canceling statement.*timeout/,
      cause: '쿼리 실행 시간 초과',
      solution: 'statement_timeout을 늘리거나, 쿼리를 최적화하세요.',
      codeExample: {
        before: 'SET statement_timeout = 1000;  -- 1초',
        after: 'SET statement_timeout = 30000;  -- 30초\n-- 또는 쿼리에 인덱스 추가',
      },
    },
    { name: '28P01 invalid_password', pattern: /28P01|password authentication failed/, cause: 'DB 인증 실패', solution: '사용자명, 비밀번호, pg_hba.conf 설정을 확인하세요.', codeExample: { before: "psql -U admin -d mydb  # 인증 실패", after: "# pg_hba.conf 확인\n# ALTER USER admin PASSWORD 'newpass';" } },
    { name: '55P03 lock_not_available', pattern: /55P03|lock.*not available|could not obtain lock/, cause: '다른 트랜잭션이 잠금을 보유하고 있음', solution: 'pg_stat_activity로 블로킹 쿼리를 확인하고, 필요시 종료하세요.', codeExample: { before: 'ALTER TABLE users ADD COLUMN age INT;  -- 잠금 대기', after: "SELECT pid, query FROM pg_stat_activity WHERE state = 'active';\n-- 필요시: SELECT pg_terminate_backend(pid);" } },
    { name: '08006 connection_failure', pattern: /08006|08001|could not connect|connection refused/, cause: 'PostgreSQL 서버 연결 실패', solution: '서버가 실행 중인지, 호스트/포트/방화벽 설정을 확인하세요.', codeExample: { before: "psql -h db.server.com -p 5432", after: "# pg_isready -h db.server.com -p 5432\n# systemctl status postgresql" } },
  ],

  mysql: [
    { name: '1062 Duplicate entry', pattern: /1062|Duplicate entry/, cause: '유니크 키 중복', solution: 'INSERT ... ON DUPLICATE KEY UPDATE를 사용하세요.', codeExample: { before: "INSERT INTO users (email) VALUES ('dup@test.com');", after: "INSERT INTO users (email) VALUES ('dup@test.com')\nON DUPLICATE KEY UPDATE updated_at = NOW();" } },
    { name: '1045 Access denied', pattern: /1045|Access denied/, cause: '인증 실패 (사용자명/비밀번호 오류)', solution: '사용자 권한과 인증 정보를 확인하세요.', codeExample: { before: "mysql -u root -p wrong_password", after: "ALTER USER 'root'@'localhost' IDENTIFIED BY 'new_password';\nFLUSH PRIVILEGES;" } },
    {
      name: '1146 Table does not exist',
      pattern: /1146|Table.*doesn't exist/,
      cause: '존재하지 않는 테이블',
      solution: 'SHOW TABLES로 확인하고, 마이그레이션을 실행하세요.',
      codeExample: {
        before: 'SELECT * FROM user_profiles;',
        after: 'SHOW TABLES;\n-- 테이블 생성 또는 마이그레이션 실행',
      },
    },
    {
      name: '1054 Unknown column',
      pattern: /1054|Unknown column/,
      cause: '존재하지 않는 컬럼 참조',
      solution: 'DESCRIBE 테이블명으로 컬럼을 확인하세요.',
      codeExample: {
        before: 'SELECT user_name FROM users;',
        after: 'DESCRIBE users;\n-- 올바른 컬럼명 확인',
      },
    },
    {
      name: '2002 Connection refused',
      pattern: /2002|Can't connect.*MySQL|Connection refused/,
      cause: 'MySQL 서버 연결 실패',
      solution: '서버 실행 상태와 소켓/포트를 확인하세요.',
      codeExample: {
        before: 'mysql -h localhost -P 3306',
        after: 'sudo systemctl status mysql\nsudo systemctl start mysql',
      },
    },
    {
      name: '1205 Lock wait timeout',
      pattern: /1205|Lock wait timeout/,
      cause: '잠금 대기 시간 초과',
      solution: 'innodb_lock_wait_timeout을 늘리거나, 블로킹 트랜잭션을 확인하세요.',
      codeExample: {
        before: 'UPDATE orders SET status = "done";  -- 잠금 대기',
        after: 'SHOW ENGINE INNODB STATUS;\n-- 블로킹 트랜잭션 확인 후 커밋/롤백',
      },
    },
    {
      name: '1451 FK constraint fail',
      pattern: /1451|foreign key constraint fails/,
      cause: 'FK 제약으로 삭제/수정 불가',
      solution: 'ON DELETE CASCADE를 설정하거나, 참조하는 레코드를 먼저 삭제하세요.',
      codeExample: {
        before: 'DELETE FROM users WHERE id = 1;  -- orders가 참조 중',
        after: 'DELETE FROM orders WHERE user_id = 1;\nDELETE FROM users WHERE id = 1;',
      },
    },
    {
      name: '1040 Too many connections',
      pattern: /1040|Too many connections/,
      cause: '최대 연결 수 초과',
      solution: 'max_connections을 늘리거나, 커넥션 풀을 사용하세요.',
      codeExample: {
        before: '-- 기본 max_connections = 151',
        after: 'SET GLOBAL max_connections = 500;\n-- 또는 커넥션 풀 라이브러리 사용',
      },
    },
  ],

  mongodb: [
    {
      name: 'E11000 Duplicate key',
      pattern: /E11000|duplicate key error/,
      cause: '유니크 인덱스 위반',
      solution: '중복 키 확인 후 updateOne with upsert를 사용하세요.',
      codeExample: {
        before: 'db.users.insertOne({ email: "dup@test.com" })',
        after: 'db.users.updateOne(\n  { email: "dup@test.com" },\n  { $set: { name: "Kim" } },\n  { upsert: true }\n)',
      },
    },
    {
      name: 'MongoServerError: Authentication failed',
      pattern: /Authentication failed|MongoServerError.*auth/,
      cause: 'MongoDB 인증 실패',
      solution: '인증 데이터베이스(authSource)와 자격 증명을 확인하세요.',
      codeExample: {
        before: 'mongodb://user:pass@host:27017/mydb',
        after: 'mongodb://user:pass@host:27017/mydb?authSource=admin',
      },
    },
    {
      name: 'MongoNetworkError',
      pattern: /MongoNetworkError|connection.*refused|ECONNREFUSED/,
      cause: 'MongoDB 서버 연결 실패',
      solution: 'mongod 서비스 상태를 확인하세요.',
      codeExample: {
        before: 'mongoose.connect("mongodb://localhost:27017")',
        after: '// sudo systemctl status mongod\nmongoose.connect("mongodb://localhost:27017", {\n  serverSelectionTimeoutMS: 5000\n})',
      },
    },
    {
      name: 'Document validation failed',
      pattern: /Document failed validation/,
      cause: '스키마 검증 실패',
      solution: '문서가 컬렉션의 validation rules에 맞는지 확인하세요.',
      codeExample: {
        before: 'db.users.insertOne({ age: "old" })',
        after: 'db.users.insertOne({ age: 30 })  // 숫자 타입',
      },
    },
    {
      name: 'Cursor timeout',
      pattern: /cursor.*timeout|CursorNotFound/,
      cause: '커서가 서버에서 만료됨 (기본 10분)',
      solution: 'noCursorTimeout 옵션을 사용하거나, 배치 크기를 조정하세요.',
      codeExample: {
        before: 'db.bigCollection.find().forEach(process)',
        after: 'db.bigCollection.find().batchSize(1000).forEach(process)',
      },
    },
  ],

  redis: [
    {
      name: 'WRONGTYPE',
      pattern: /WRONGTYPE/,
      cause: '키의 데이터 타입과 다른 명령어 사용',
      solution: 'TYPE 명령으로 키의 타입을 확인하세요.',
      codeExample: {
        before: 'SET mykey "value"\nLPUSH mykey "item"  // string에 list 명령',
        after: 'TYPE mykey  // string 확인\nGET mykey',
      },
    },
    {
      name: 'OOM (Out of Memory)',
      pattern: /OOM.*maxmemory|out of memory/,
      cause: 'Redis 메모리 한도 초과',
      solution: 'maxmemory-policy를 설정하거나, 메모리를 늘리세요.',
      codeExample: {
        before: '# maxmemory에 도달',
        after: '# redis.conf\nmaxmemory 2gb\nmaxmemory-policy allkeys-lru',
      },
    },
    {
      name: 'READONLY',
      pattern: /READONLY|can't write against a read only/,
      cause: '읽기 전용 레플리카에 쓰기 시도',
      solution: '마스터 노드에 연결하세요.',
      codeExample: {
        before: '// 레플리카에 SET 시도',
        after: '// 마스터 노드 주소로 연결 변경',
      },
    },
    { name: 'Connection refused', pattern: /ECONNREFUSED.*6379|Connection refused/, cause: 'Redis 서버 연결 실패', solution: 'Redis 서버 상태를 확인하세요.', codeExample: { before: "redis-cli ping  # Could not connect", after: "sudo systemctl start redis\nredis-cli ping  # PONG" } },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// DEVOPS ERRORS - DevOps 관련 에러 패턴
// ─────────────────────────────────────────────────────────────────────────────
export const DEVOPS_ERRORS = {
  docker: [
    {
      name: 'Image not found',
      pattern: /manifest.*not found|pull.*not found|no such image/,
      cause: '이미지가 레지스트리에 없음 (이름/태그 오류)',
      solution: '이미지 이름과 태그를 확인하고, docker pull로 가져오세요.',
      codeExample: {
        before: 'docker run myapp:latst',
        after: 'docker run myapp:latest  # 태그 오타 수정',
      },
    },
    {
      name: 'Port already allocated',
      pattern: /port is already allocated|bind.*address already in use/,
      cause: '호스트 포트가 이미 사용 중',
      solution: '다른 포트를 매핑하거나 기존 컨테이너를 중지하세요.',
      codeExample: {
        before: 'docker run -p 3000:3000 myapp',
        after: 'docker run -p 3001:3000 myapp\n# 또는 docker stop <기존 컨테이너>',
      },
    },
    {
      name: 'Permission denied (socket)',
      pattern: /permission denied.*docker\.sock/,
      cause: 'Docker 소켓에 대한 접근 권한 없음',
      solution: '사용자를 docker 그룹에 추가하세요.',
      codeExample: {
        before: 'docker ps  # permission denied',
        after: 'sudo usermod -aG docker $USER\n# 로그아웃 후 재로그인',
      },
    },
    {
      name: 'No space left on device',
      pattern: /no space left|disk space/,
      cause: 'Docker 디스크 공간 부족',
      solution: 'docker system prune으로 사용하지 않는 리소스를 정리하세요.',
      codeExample: {
        before: 'docker build .  # no space left',
        after: 'docker system prune -af\ndocker volume prune',
      },
    },
    {
      name: 'COPY failed: file not found',
      pattern: /COPY failed|ADD failed|file not found/,
      cause: 'Dockerfile의 COPY/ADD 경로에 파일이 없음',
      solution: '.dockerignore와 빌드 컨텍스트 경로를 확인하세요.',
      codeExample: {
        before: 'COPY package.json /app/\n# .dockerignore에 package.json이 포함',
        after: '# .dockerignore에서 package.json 제외 확인\nCOPY package.json /app/',
      },
    },
    {
      name: 'Container exited with code 137',
      pattern: /exit code 137|OOM.*kill/,
      cause: 'OOM Killer에 의해 컨테이너가 종료됨',
      solution: '--memory 옵션으로 메모리 제한을 늘리세요.',
      codeExample: {
        before: 'docker run myapp',
        after: 'docker run --memory=2g myapp',
      },
    },
    {
      name: 'Network not found',
      pattern: /network.*not found/,
      cause: '존재하지 않는 Docker 네트워크 참조',
      solution: 'docker network ls로 확인하고, 필요시 생성하세요.',
      codeExample: {
        before: 'docker run --network mynet myapp',
        after: 'docker network create mynet\ndocker run --network mynet myapp',
      },
    },
  ],

  kubernetes: [
    {
      name: 'CrashLoopBackOff',
      pattern: /CrashLoopBackOff/,
      cause: '컨테이너가 반복적으로 시작 후 종료됨',
      solution: 'kubectl logs로 에러 원인을 확인하세요.',
      codeExample: {
        before: 'kubectl get pods  # CrashLoopBackOff',
        after: 'kubectl logs <pod-name> --previous\nkubectl describe pod <pod-name>',
      },
    },
    {
      name: 'ImagePullBackOff',
      pattern: /ImagePullBackOff|ErrImagePull/,
      cause: '이미지를 가져올 수 없음 (이미지 없음, 인증 실패)',
      solution: '이미지 이름/태그, imagePullSecrets을 확인하세요.',
      codeExample: {
        before: 'image: myregistry.io/app:v1  # pull 실패',
        after: '# 이미지 존재 확인 후\nkubectl create secret docker-registry regcred ...',
      },
    },
    {
      name: 'OOMKilled',
      pattern: /OOMKilled/,
      cause: '컨테이너 메모리 제한 초과',
      solution: 'resources.limits.memory를 늘리세요.',
      codeExample: {
        before: 'resources:\n  limits:\n    memory: 64Mi',
        after: 'resources:\n  limits:\n    memory: 512Mi',
      },
    },
    {
      name: 'Pending (insufficient resources)',
      pattern: /Pending|Insufficient.*(?:cpu|memory)/,
      cause: '클러스터에 충분한 리소스가 없음',
      solution: '노드를 추가하거나, 리소스 요청을 줄이세요.',
      codeExample: {
        before: 'resources:\n  requests:\n    cpu: "8"',
        after: 'resources:\n  requests:\n    cpu: "1"',
      },
    },
    {
      name: 'Forbidden (RBAC)',
      pattern: /forbidden.*RBAC|cannot.*resource/,
      cause: 'RBAC 권한 부족',
      solution: '필요한 Role/ClusterRole을 생성하고 바인딩하세요.',
      codeExample: {
        before: 'kubectl get secrets  # forbidden',
        after: 'kubectl create rolebinding read-secrets \\\n  --role=secret-reader --user=myuser',
      },
    },
    {
      name: 'Service not reachable',
      pattern: /service.*unreachable|no endpoints/,
      cause: '서비스에 연결된 엔드포인트가 없음',
      solution: 'selector가 Pod 레이블과 일치하는지 확인하세요.',
      codeExample: {
        before: 'selector:\n  app: myapp  # Pod에는 app: my-app',
        after: 'selector:\n  app: my-app  # Pod 레이블과 일치',
      },
    },
    {
      name: 'ConfigMap/Secret not found',
      pattern: /configmap.*not found|secret.*not found/,
      cause: '참조하는 ConfigMap 또는 Secret이 없음',
      solution: '같은 네임스페이스에 해당 리소스가 있는지 확인하세요.',
      codeExample: {
        before: 'envFrom:\n  - configMapRef:\n      name: app-config  # 없음',
        after: 'kubectl create configmap app-config --from-file=config.yaml',
      },
    },
    {
      name: 'Liveness probe failed',
      pattern: /Liveness probe failed|readiness probe failed/,
      cause: 'Health check 실패로 컨테이너 재시작',
      solution: 'probe 설정(경로, 포트, 타임아웃)을 확인하세요.',
      codeExample: {
        before: 'livenessProbe:\n  httpGet:\n    path: /health\n    port: 8080\n  initialDelaySeconds: 3',
        after: 'livenessProbe:\n  httpGet:\n    path: /health\n    port: 8080\n  initialDelaySeconds: 30\n  timeoutSeconds: 5',
      },
    },
  ],

  nginx: [
    {
      name: '502 Bad Gateway',
      pattern: /502 Bad Gateway|upstream.*connect/,
      cause: '백엔드 서버에 연결할 수 없음',
      solution: '백엔드 서버가 실행 중인지, upstream 설정이 올바른지 확인하세요.',
      codeExample: {
        before: 'proxy_pass http://localhost:3000;  # 서버 다운',
        after: '# 백엔드 서버 실행 확인\n# systemctl status myapp',
      },
    },
    {
      name: '504 Gateway Timeout',
      pattern: /504 Gateway Timeout/,
      cause: '백엔드 서버 응답 시간 초과',
      solution: 'proxy_read_timeout을 늘리세요.',
      codeExample: {
        before: '# 기본 60초 타임아웃',
        after: 'proxy_read_timeout 300;\nproxy_connect_timeout 300;\nproxy_send_timeout 300;',
      },
    },
    {
      name: '413 Request Entity Too Large',
      pattern: /413.*Too Large|client_max_body_size/,
      cause: '요청 본문이 nginx 제한보다 큼',
      solution: 'client_max_body_size를 늘리세요.',
      codeExample: {
        before: '# 기본 1MB 제한',
        after: 'client_max_body_size 50M;',
      },
    },
    {
      name: 'Permission denied (log)',
      pattern: /permission denied.*log|open\(\).*failed/,
      cause: '로그 파일 또는 디렉토리 권한 부족',
      solution: '로그 디렉토리 소유권을 nginx 사용자에게 부여하세요.',
      codeExample: {
        before: '# nginx: open() "/var/log/nginx/access.log" failed',
        after: 'sudo chown -R www-data:www-data /var/log/nginx/',
      },
    },
    {
      name: 'SSL certificate error',
      pattern: /SSL.*certificate|ssl_certificate/,
      cause: 'SSL 인증서 파일 오류',
      solution: '인증서 경로, 만료일, 체인을 확인하세요.',
      codeExample: {
        before: 'ssl_certificate /etc/ssl/cert.pem;',
        after: '# openssl x509 -in cert.pem -noout -dates\nssl_certificate /etc/ssl/fullchain.pem;\nssl_certificate_key /etc/ssl/privkey.pem;',
      },
    },
    {
      name: 'Config test failed',
      pattern: /nginx.*test failed|configuration file.*test/,
      cause: 'nginx 설정 파일 문법 오류',
      solution: 'nginx -t로 설정을 검증하세요.',
      codeExample: {
        before: 'sudo systemctl reload nginx  # 실패',
        after: 'sudo nginx -t  # 문법 확인\nsudo systemctl reload nginx',
      },
    },
  ],

  ssl_tls: [
    { name: 'Certificate expired', pattern: /certificate.*expired|SSL_ERROR_EXPIRED/, cause: 'SSL 인증서 만료', solution: '인증서를 갱신하세요. Let\'s Encrypt는 certbot renew를 사용합니다.', codeExample: { before: '# 인증서 만료 확인', after: 'sudo certbot renew\n# 또는 openssl x509 -in cert.pem -noout -dates' } },
    {
      name: 'Self-signed certificate',
      pattern: /self.signed|CERT_HAS_EXPIRED|unable to verify/,
      cause: '자체 서명 인증서 사용 (신뢰되지 않음)',
      solution: '신뢰할 수 있는 CA에서 발급받거나, 환경에 CA 인증서를 등록하세요.',
      codeExample: {
        before: 'curl https://internal-server.local',
        after: 'curl --cacert /path/to/ca-cert.pem https://internal-server.local',
      },
    },
    {
      name: 'Certificate chain incomplete',
      pattern: /unable to get.*issuer|incomplete.*chain/,
      cause: '중간 인증서(체인)가 누락됨',
      solution: '중간 인증서를 서버 인증서에 포함하세요.',
      codeExample: {
        before: 'ssl_certificate server.crt;',
        after: 'cat server.crt intermediate.crt > fullchain.crt\nssl_certificate fullchain.crt;',
      },
    },
    {
      name: 'TLS handshake failure',
      pattern: /handshake.*fail|SSL routines.*error/,
      cause: 'TLS 버전 불일치 또는 암호화 스위트 불일치',
      solution: 'TLS 최소 버전과 암호화 스위트 설정을 확인하세요.',
      codeExample: {
        before: 'ssl_protocols TLSv1;  # 너무 오래됨',
        after: 'ssl_protocols TLSv1.2 TLSv1.3;',
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// HTTP STATUS REFERENCE - HTTP 상태코드 레퍼런스
// ─────────────────────────────────────────────────────────────────────────────
export const HTTP_STATUS_REFERENCE = {
  '400': {
    name: 'Bad Request',
    cause: '잘못된 요청 문법, 누락된 파라미터, 유효하지 않은 데이터',
    solution: '요청 형식(Content-Type, JSON 구조, 필수 필드)을 확인하세요.',
  },
  '401': {
    name: 'Unauthorized',
    cause: '인증 정보 누락 또는 만료 (토큰, 세션)',
    solution: '인증 토큰/쿠키가 유효한지 확인하고, 필요시 재로그인하세요.',
  },
  '403': {
    name: 'Forbidden',
    cause: '인증은 되었지만 해당 리소스에 대한 권한 없음',
    solution: '사용자 권한/역할 설정을 확인하세요. CORS 문제일 수도 있습니다.',
  },
  '404': {
    name: 'Not Found',
    cause: '요청한 리소스가 존재하지 않음',
    solution: 'URL 경로, 리소스 ID를 확인하세요. API 버전이 맞는지도 점검합니다.',
  },
  '405': {
    name: 'Method Not Allowed',
    cause: '해당 엔드포인트에서 지원하지 않는 HTTP 메서드',
    solution: 'API 문서에서 허용되는 HTTP 메서드를 확인하세요.',
  },
  '408': {
    name: 'Request Timeout',
    cause: '서버가 요청을 기다리다 타임아웃',
    solution: '네트워크 상태를 확인하고, 요청 크기를 줄여보세요.',
  },
  '409': {
    name: 'Conflict',
    cause: '리소스 상태와 충돌하는 요청 (동시 수정, 중복 생성)',
    solution: '최신 상태를 조회한 후 다시 시도하세요.',
  },
  '413': {
    name: 'Payload Too Large',
    cause: '요청 본문이 서버 제한을 초과',
    solution: '서버의 body size 제한(nginx: client_max_body_size, express: limit)을 늘리세요.',
  },
  '415': {
    name: 'Unsupported Media Type',
    cause: 'Content-Type이 서버가 처리할 수 없는 형식',
    solution: 'Content-Type 헤더를 올바르게 설정하세요 (보통 application/json).',
  },
  '422': {
    name: 'Unprocessable Entity',
    cause: '문법은 올바르지만 의미적으로 처리할 수 없는 데이터',
    solution: '요청 데이터의 값이 비즈니스 규칙에 맞는지 확인하세요.',
  },
  '429': {
    name: 'Too Many Requests',
    cause: 'Rate limit 초과',
    solution: '요청 빈도를 줄이거나, Retry-After 헤더를 확인하고 대기하세요.',
  },
  '500': {
    name: 'Internal Server Error',
    cause: '서버 내부 에러 (미처리 예외, 설정 오류)',
    solution: '서버 로그를 확인하세요. 개발 환경에서 디버그 모드를 활성화합니다.',
  },
  '502': {
    name: 'Bad Gateway',
    cause: '프록시/게이트웨이가 백엔드에서 유효하지 않은 응답을 받음',
    solution: '백엔드 서버 상태를 확인하세요.',
  },
  '503': {
    name: 'Service Unavailable',
    cause: '서버가 일시적으로 요청을 처리할 수 없음 (과부하, 점검)',
    solution: '잠시 후 재시도하세요. 서버 상태와 로드를 확인합니다.',
  },
  '504': {
    name: 'Gateway Timeout',
    cause: '프록시가 백엔드 응답을 기다리다 타임아웃',
    solution: '백엔드 응답 시간을 확인하고, 프록시 타임아웃을 늘리세요.',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// COMMON ERROR CATEGORIES - 빠른 선택용 카테고리
// ─────────────────────────────────────────────────────────────────────────────
export const COMMON_ERROR_CATEGORIES = [
  {
    id: 'cors',
    label: 'CORS 에러',
    icon: '🌐',
    keywords: ['CORS', 'Access-Control', 'cross-origin'],
  },
  {
    id: 'null',
    label: 'Null/Undefined',
    icon: '⚠️',
    keywords: ['null', 'undefined', 'NullPointer', 'NullReference'],
  },
  {
    id: 'import',
    label: 'Import/Module 에러',
    icon: '📦',
    keywords: ['import', 'module', 'require', 'ModuleNotFound'],
  },
  {
    id: 'type',
    label: '타입 에러',
    icon: '🔤',
    keywords: ['TypeError', 'TypeScript', 'type', 'TS2322'],
  },
  {
    id: 'syntax',
    label: '문법 에러',
    icon: '📝',
    keywords: ['SyntaxError', 'syntax', 'Unexpected token'],
  },
  {
    id: 'connection',
    label: '연결/네트워크',
    icon: '🔌',
    keywords: ['Connection', 'ECONNREFUSED', 'timeout', 'Network'],
  },
  {
    id: 'auth',
    label: '인증/권한',
    icon: '🔒',
    keywords: ['401', '403', 'Unauthorized', 'Forbidden', 'auth'],
  },
  {
    id: 'memory',
    label: '메모리 에러',
    icon: '💾',
    keywords: ['OutOfMemory', 'heap', 'MemoryError', 'OOM'],
  },
  {
    id: 'db',
    label: '데이터베이스',
    icon: '🗄️',
    keywords: ['SQL', 'database', 'constraint', 'query'],
  },
  {
    id: 'docker',
    label: 'Docker/K8s',
    icon: '🐳',
    keywords: ['Docker', 'container', 'Kubernetes', 'pod'],
  },
];
