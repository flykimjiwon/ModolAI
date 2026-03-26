/**
 * 코드 컨버터 정적 레퍼런스 데이터
 *
 * Ollama 모델의 지식 한계를 보완하기 위해
 * 언어별 문법, 변환 패턴, 타입 매핑, 표준 라이브러리 대응표,
 * 주의사항 등을 정적으로 임베딩한다.
 *
 * 시스템 프롬프트에 삽입되어 코드 변환 품질을 높인다.
 */

// ─────────────────────────────────────────────────────────────────────────────
// LANGUAGES (10개)
// ─────────────────────────────────────────────────────────────────────────────

export const LANGUAGES = [
  {
    id: 'python',
    name: 'Python',
    extension: '.py',
    paradigm: ['객체지향', '함수형', '절차적'],
    typeSystem: '동적 타입 (duck typing)',
    packageManager: 'pip / poetry',
    features: ['리스트 컴프리헨션', '데코레이터', '제너레이터', 'with문', 'f-string', '멀티플 리턴', 'unpacking'],
  },
  {
    id: 'javascript',
    name: 'JavaScript',
    extension: '.js',
    paradigm: ['객체지향(프로토타입)', '함수형', '이벤트 기반'],
    typeSystem: '동적 타입 (약타입)',
    packageManager: 'npm / yarn / pnpm',
    features: ['클로저', 'Promise/async-await', '구조분해', '스프레드 연산자', '템플릿 리터럴', '프로토타입 체인'],
  },
  {
    id: 'typescript',
    name: 'TypeScript',
    extension: '.ts',
    paradigm: ['객체지향', '함수형', '제네릭'],
    typeSystem: '정적 타입 (구조적 타이핑)',
    packageManager: 'npm / yarn / pnpm',
    features: ['인터페이스', '제네릭', '유니온/인터섹션 타입', '타입 가드', '데코레이터', 'enum', '유틸리티 타입'],
  },
  {
    id: 'java',
    name: 'Java',
    extension: '.java',
    paradigm: ['객체지향', '제네릭'],
    typeSystem: '정적 타입 (명목적 타이핑)',
    packageManager: 'Maven / Gradle',
    features: ['Stream API', 'Optional', '람다', '어노테이션', '제네릭', '인터페이스 default 메서드', 'record'],
  },
  {
    id: 'go',
    name: 'Go',
    extension: '.go',
    paradigm: ['절차적', '구조체 기반', '동시성'],
    typeSystem: '정적 타입 (구조적 타이핑)',
    packageManager: 'go mod',
    features: ['goroutine', 'channel', 'defer', 'interface (암묵적 구현)', '멀티플 리턴', 'slice', 'error 패턴'],
  },
  {
    id: 'rust',
    name: 'Rust',
    extension: '.rs',
    paradigm: ['시스템', '함수형', '소유권 기반'],
    typeSystem: '정적 타입 (소유권/차용)',
    packageManager: 'cargo',
    features: ['소유권/차용', 'lifetime', 'trait', 'match 패턴', 'Result/Option', '매크로', 'async/await'],
  },
  {
    id: 'cpp',
    name: 'C++',
    extension: '.cpp',
    paradigm: ['객체지향', '제네릭', '시스템'],
    typeSystem: '정적 타입 (명목적 타이핑)',
    packageManager: 'vcpkg / conan / CMake',
    features: ['RAII', '템플릿', 'STL', '스마트 포인터', '연산자 오버로딩', 'constexpr', 'move 시맨틱'],
  },
  {
    id: 'csharp',
    name: 'C#',
    extension: '.cs',
    paradigm: ['객체지향', '함수형', '제네릭'],
    typeSystem: '정적 타입 (명목적 타이핑)',
    packageManager: 'NuGet',
    features: ['LINQ', 'async/await', '속성(Property)', '이벤트/델리게이트', 'record', 'nullable reference', 'pattern matching'],
  },
  {
    id: 'kotlin',
    name: 'Kotlin',
    extension: '.kt',
    paradigm: ['객체지향', '함수형'],
    typeSystem: '정적 타입 (null safety)',
    packageManager: 'Gradle / Maven',
    features: ['null safety (?)', 'data class', '확장 함수', 'coroutine', 'sealed class', 'when 표현식', 'scope 함수'],
  },
  {
    id: 'swift',
    name: 'Swift',
    extension: '.swift',
    paradigm: ['객체지향', '함수형', '프로토콜 지향'],
    typeSystem: '정적 타입 (프로토콜 기반)',
    packageManager: 'Swift Package Manager',
    features: ['Optional', 'guard', 'protocol', 'extension', 'enum associated values', 'async/await', 'property wrapper'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SYNTAX_COMPARISON: 언어쌍별 문법 비교표
// ─────────────────────────────────────────────────────────────────────────────

export const SYNTAX_COMPARISON = {
  variableDeclaration: {
    python: { mutable: 'x = 10', immutable: '관례적으로 UPPER_CASE (언어 수준 const 없음)', note: '타입 힌트: x: int = 10' },
    javascript: { mutable: 'let x = 10', immutable: 'const x = 10', note: 'var는 함수 스코프 (레거시)' },
    typescript: { mutable: 'let x: number = 10', immutable: 'const x: number = 10', note: 'as const로 리터럴 타입 고정 가능' },
    java: { mutable: 'int x = 10', immutable: 'final int x = 10', note: 'var x = 10 (Java 10+ 타입 추론)' },
    go: { mutable: 'var x int = 10 또는 x := 10', immutable: 'const x int = 10', note: ':=는 함수 내부에서만 사용' },
    rust: { mutable: 'let mut x: i32 = 10', immutable: 'let x: i32 = 10', note: '기본이 불변, mut 키워드로 가변 선언' },
    cpp: { mutable: 'int x = 10', immutable: 'const int x = 10', note: 'constexpr int x = 10 (컴파일 타임 상수)' },
    csharp: { mutable: 'int x = 10', immutable: 'const int x = 10', note: 'readonly는 런타임 상수, const는 컴파일 타임 상수' },
    kotlin: { mutable: 'var x: Int = 10', immutable: 'val x: Int = 10', note: 'val은 재할당 불가, 내부 상태 변경은 가능' },
    swift: { mutable: 'var x: Int = 10', immutable: 'let x: Int = 10', note: 'let은 완전 불변 (struct의 경우)' },
  },
  loop: {
    python: { for: 'for i in range(10):', forEach: 'for item in items:', while: 'while cond:', note: 'enumerate(), zip() 활용' },
    javascript: { for: 'for (let i = 0; i < 10; i++)', forEach: 'items.forEach(item => {})', while: 'while (cond) {}', note: 'for...of (iterable), for...in (key)' },
    typescript: { for: 'for (let i = 0; i < 10; i++)', forEach: 'items.forEach((item: T) => {})', while: 'while (cond) {}', note: 'JS와 동일, 타입 추론 활용' },
    java: { for: 'for (int i = 0; i < 10; i++)', forEach: 'for (var item : items)', while: 'while (cond) {}', note: 'Stream.forEach()도 가능' },
    go: { for: 'for i := 0; i < 10; i++', forEach: 'for i, v := range items', while: 'for cond {}', note: 'Go는 for 하나로 모든 반복 처리' },
    rust: { for: 'for i in 0..10', forEach: 'for item in &items', while: 'while cond {}', note: 'iter(), into_iter(), iter_mut() 구분' },
    cpp: { for: 'for (int i = 0; i < 10; i++)', forEach: 'for (auto& item : items)', while: 'while (cond) {}', note: 'std::for_each, ranges (C++20)' },
    csharp: { for: 'for (int i = 0; i < 10; i++)', forEach: 'foreach (var item in items)', while: 'while (cond) {}', note: 'LINQ .ForEach() (List에만)' },
    kotlin: { for: 'for (i in 0 until 10)', forEach: 'items.forEach { item -> }', while: 'while (cond) {}', note: 'repeat(10) {}, indices, withIndex()' },
    swift: { for: 'for i in 0..<10', forEach: 'items.forEach { item in }', while: 'while cond {}', note: 'stride(from:to:by:) 활용' },
  },
  function: {
    python: { basic: 'def fn(a: int, b: str) -> int:', lambda: 'lambda x: x + 1', note: '*args, **kwargs, 기본값 인자' },
    javascript: { basic: 'function fn(a, b) {} 또는 (a, b) => {}', lambda: '(x) => x + 1', note: '화살표 함수는 this 바인딩 없음' },
    typescript: { basic: 'function fn(a: number, b: string): number {}', lambda: '(x: number): number => x + 1', note: '제네릭: function fn<T>(a: T): T {}' },
    java: { basic: 'int fn(int a, String b) {}', lambda: '(x) -> x + 1', note: '메서드 오버로딩, varargs(int... args)' },
    go: { basic: 'func fn(a int, b string) int {}', lambda: 'func(x int) int { return x + 1 }', note: '멀티플 리턴: func fn() (int, error)' },
    rust: { basic: 'fn fn_name(a: i32, b: &str) -> i32 {}', lambda: '|x| x + 1', note: 'impl Fn/FnMut/FnOnce 트레이트 구분' },
    cpp: { basic: 'int fn(int a, std::string b) {}', lambda: '[](int x) { return x + 1; }', note: '템플릿: template<typename T> T fn(T a)' },
    csharp: { basic: 'int Fn(int a, string b) {}', lambda: '(x) => x + 1', note: 'Func<int,int>, Action<int> 델리게이트' },
    kotlin: { basic: 'fun fn(a: Int, b: String): Int {}', lambda: '{ x: Int -> x + 1 }', note: '확장 함수: fun String.fn() {}' },
    swift: { basic: 'func fn(a: Int, b: String) -> Int {}', lambda: '{ (x: Int) -> Int in x + 1 }', note: '인자 레이블: func fn(from a: Int)' },
  },
  classAndStruct: {
    python: { class: 'class Foo:\n  def __init__(self):', struct: 'dataclass 또는 NamedTuple', note: '__init__, __repr__, @property 등 매직 메서드' },
    javascript: { class: 'class Foo { constructor() {} }', struct: '일반 객체 {} 또는 Object.freeze({})', note: 'private #field (ES2022)' },
    typescript: { class: 'class Foo { constructor() {} }', struct: 'interface / type', note: 'abstract, implements, private/protected' },
    java: { class: 'class Foo { Foo() {} }', struct: 'record Foo(int x) {} (Java 16+)', note: 'abstract, interface, enum, sealed (Java 17+)' },
    go: { class: 'type Foo struct {}', struct: 'type Foo struct { X int }', note: 'Go에는 class 없음, 메서드는 receiver로 정의' },
    rust: { class: 'struct + impl 블록', struct: 'struct Foo { x: i32 }', note: 'trait로 다형성, derive 매크로 활용' },
    cpp: { class: 'class Foo { public: Foo(); };', struct: 'struct Foo { int x; };', note: 'struct는 기본 public, class는 기본 private' },
    csharp: { class: 'class Foo { public Foo() {} }', struct: 'struct Foo { public int X; }', note: 'record class, record struct (C# 10+)' },
    kotlin: { class: 'class Foo(val x: Int)', struct: 'data class Foo(val x: Int)', note: 'sealed class, object(싱글턴), companion object' },
    swift: { class: 'class Foo { init() {} }', struct: 'struct Foo { var x: Int }', note: 'struct는 값 타입, class는 참조 타입' },
  },
  errorHandling: {
    python: { try: 'try:\n  ...\nexcept Exception as e:\n  ...\nfinally:', custom: 'class MyError(Exception): pass', note: 'raise, 다중 except, else 블록' },
    javascript: { try: 'try { } catch (e) { } finally { }', custom: 'class MyError extends Error {}', note: 'throw new Error(), Promise.catch()' },
    typescript: { try: 'try { } catch (e: unknown) { } finally { }', custom: 'class MyError extends Error {}', note: 'catch 파라미터는 unknown 권장' },
    java: { try: 'try { } catch (Exception e) { } finally { }', custom: 'class MyException extends Exception {}', note: 'checked vs unchecked, try-with-resources' },
    go: { try: 'if err != nil { return err }', custom: 'errors.New() / fmt.Errorf()', note: 'Go에는 try-catch 없음, 에러를 값으로 반환' },
    rust: { try: 'match result { Ok(v) => v, Err(e) => ... }', custom: '#[derive(Debug)] enum MyError {}', note: '? 연산자, Result<T,E>, unwrap()은 패닉' },
    cpp: { try: 'try { } catch (const std::exception& e) { }', custom: 'class MyError : public std::exception {}', note: 'noexcept, std::error_code (C++11)' },
    csharp: { try: 'try { } catch (Exception e) { } finally { }', custom: 'class MyException : Exception {}', note: 'when 필터: catch (Exception e) when (...)' },
    kotlin: { try: 'try { } catch (e: Exception) { } finally { }', custom: 'class MyException : Exception()', note: 'Kotlin은 모두 unchecked exception' },
    swift: { try: 'do { try fn() } catch { }', custom: 'enum MyError: Error { case ... }', note: 'throws, try?, try!, rethrows' },
  },
  async: {
    python: { basic: 'async def fn():\n  await other()', note: 'asyncio.gather(), asyncio.run(), async for, async with' },
    javascript: { basic: 'async function fn() { await other(); }', note: 'Promise.all(), Promise.race(), Promise.allSettled()' },
    typescript: { basic: 'async function fn(): Promise<T> { await other(); }', note: 'JS와 동일, 반환 타입은 Promise<T>' },
    java: { basic: 'CompletableFuture.supplyAsync(() -> {})', note: 'ExecutorService, virtual threads (Java 21+)' },
    go: { basic: 'go func() {}()', note: 'goroutine + channel, sync.WaitGroup, select' },
    rust: { basic: 'async fn name() -> T { other().await }', note: 'tokio/async-std 런타임 필요, .await (후위)' },
    cpp: { basic: 'std::async(std::launch::async, fn)', note: 'std::future, std::promise, co_await (C++20 coroutine)' },
    csharp: { basic: 'async Task<T> Fn() { await other(); }', note: 'Task.WhenAll(), ValueTask, ConfigureAwait' },
    kotlin: { basic: 'suspend fun fn() { other() }', note: 'launch {}, async {}, withContext(), Flow' },
    swift: { basic: 'func fn() async throws -> T { try await other() }', note: 'Task {}, TaskGroup, AsyncSequence' },
  },
  moduleSystem: {
    python: { import: 'import os / from os import path', export: '__all__ = [...] 또는 모듈 수준 정의', note: '__init__.py로 패키지 구성' },
    javascript: { import: "import { x } from './mod'", export: "export const x = 1 / export default fn", note: 'CommonJS: require() / module.exports' },
    typescript: { import: "import { x } from './mod'", export: "export const x: number = 1", note: 'type-only: import type { T }' },
    java: { import: 'import java.util.List', export: 'public class (파일당 1개 public class)', note: '패키지 = 디렉토리 구조' },
    go: { import: 'import "fmt" / import alias "pkg/path"', export: '대문자로 시작하면 exported', note: 'go.mod로 모듈 관리, init() 함수' },
    rust: { import: 'use std::collections::HashMap', export: 'pub fn / pub struct', note: 'mod.rs, crate, super, self' },
    cpp: { import: '#include <vector> / #include "my.h"', export: '헤더 파일에 선언', note: 'namespace, C++20 modules import' },
    csharp: { import: 'using System.Collections.Generic', export: 'public class / namespace', note: 'global using (C# 10+)' },
    kotlin: { import: 'import kotlin.collections.*', export: 'public (기본값), internal', note: 'typealias, 파일 수준 함수' },
    swift: { import: 'import Foundation', export: 'public / open / internal (기본)', note: '@testable import, 모듈 = 타겟' },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSION_PATTERNS (30+): 주요 변환 패턴
// ─────────────────────────────────────────────────────────────────────────────

export const CONVERSION_PATTERNS = [
  // Python → 다른 언어
  {
    id: 'py-list-comp-to-java-stream',
    from: 'python', to: 'java',
    name: 'List Comprehension → Stream API',
    source: '[x * 2 for x in items if x > 0]',
    target: 'items.stream().filter(x -> x > 0).map(x -> x * 2).collect(Collectors.toList())',
    note: 'Java Stream은 lazy 평가, 한 번만 소비 가능. toList()는 불변 리스트 (Java 16+)',
  },
  {
    id: 'py-dict-comp-to-java-stream',
    from: 'python', to: 'java',
    name: 'Dict Comprehension → Stream.collect(toMap)',
    source: '{k: v*2 for k, v in items.items()}',
    target: 'items.entrySet().stream().collect(Collectors.toMap(Map.Entry::getKey, e -> e.getValue() * 2))',
    note: '키 충돌 시 mergeFunction 필요: toMap(k, v, (v1, v2) -> v2)',
  },
  {
    id: 'py-with-to-java-try-resources',
    from: 'python', to: 'java',
    name: 'with문 → try-with-resources',
    source: 'with open("file.txt") as f:\n    data = f.read()',
    target: 'try (var reader = new BufferedReader(new FileReader("file.txt"))) {\n    String data = reader.lines().collect(Collectors.joining("\\n"));\n}',
    note: 'AutoCloseable 인터페이스 구현 필요. Python의 __enter__/__exit__ = Java의 close()',
  },
  {
    id: 'py-generator-to-java-stream',
    from: 'python', to: 'java',
    name: 'Generator → Stream/Iterator',
    source: 'def gen():\n    for i in range(10):\n        yield i * 2',
    target: 'IntStream.range(0, 10).map(i -> i * 2)',
    note: 'Java에는 yield 없음. 복잡한 경우 Iterator<T> 직접 구현 또는 Stream.generate() 사용',
  },
  {
    id: 'py-decorator-to-java-annotation',
    from: 'python', to: 'java',
    name: 'Decorator → Annotation + AOP',
    source: '@timer\ndef slow_fn(): ...',
    target: '@Timed\npublic void slowFn() { ... }\n// + AOP 프레임워크 (Spring AOP 등) 설정 필요',
    note: 'Python 데코레이터는 런타임 래핑, Java 어노테이션은 메타데이터 (AOP로 동적 처리)',
  },
  // JavaScript/TypeScript → 다른 언어
  {
    id: 'js-promise-to-go-goroutine',
    from: 'javascript', to: 'go',
    name: 'Promise.all → goroutine + WaitGroup',
    source: 'const [a, b] = await Promise.all([fetchA(), fetchB()])',
    target: 'var wg sync.WaitGroup\nvar a, b Result\nwg.Add(2)\ngo func() { defer wg.Done(); a = fetchA() }()\ngo func() { defer wg.Done(); b = fetchB() }()\nwg.Wait()',
    note: 'Go는 에러를 별도 반환해야 함. errgroup 패키지 권장',
  },
  {
    id: 'js-destructuring-to-go',
    from: 'javascript', to: 'go',
    name: '구조분해 → 개별 변수 할당',
    source: 'const { name, age, ...rest } = user',
    target: 'name := user.Name\nage := user.Age\n// rest에 해당하는 패턴은 Go에 없음 - 별도 구조체 필요',
    note: 'Go에는 구조분해 할당 없음. reflect 패키지로 동적 접근은 가능하나 권장하지 않음',
  },
  {
    id: 'js-optional-chaining-to-go',
    from: 'javascript', to: 'go',
    name: 'Optional Chaining → nil 체크',
    source: 'const val = obj?.nested?.deep?.value ?? "default"',
    target: 'var val string = "default"\nif obj != nil && obj.Nested != nil && obj.Nested.Deep != nil {\n    val = obj.Nested.Deep.Value\n}',
    note: 'Go는 nil 체크를 명시적으로 해야 함. 포인터 체인은 panic 위험',
  },
  {
    id: 'ts-interface-to-go-struct',
    from: 'typescript', to: 'go',
    name: 'Interface → struct + 메서드',
    source: 'interface User { name: string; greet(): string; }',
    target: 'type User struct { Name string }\nfunc (u User) Greet() string { return "Hi " + u.Name }',
    note: 'Go 인터페이스는 암묵적 구현 (implements 선언 불필요)',
  },
  {
    id: 'ts-generic-to-go',
    from: 'typescript', to: 'go',
    name: 'Generic → Go Generics (1.18+)',
    source: 'function first<T>(arr: T[]): T | undefined { return arr[0]; }',
    target: 'func First[T any](arr []T) (T, bool) {\n    if len(arr) == 0 { var zero T; return zero, false }\n    return arr[0], true\n}',
    note: 'Go 제네릭은 constraints 패키지 활용. any = interface{}',
  },
  // Java → 다른 언어
  {
    id: 'java-stream-to-py-list-comp',
    from: 'java', to: 'python',
    name: 'Stream API → List Comprehension',
    source: 'list.stream().filter(x -> x > 0).map(x -> x * 2).collect(Collectors.toList())',
    target: '[x * 2 for x in list if x > 0]',
    note: 'Python은 eager 평가. 대용량은 제너레이터 표현식 (x * 2 for x in ...) 사용',
  },
  {
    id: 'java-optional-to-py',
    from: 'java', to: 'python',
    name: 'Optional → None 체크 또는 walrus 연산자',
    source: 'Optional.ofNullable(val).map(v -> v.toUpperCase()).orElse("default")',
    target: 'val.upper() if val is not None else "default"',
    note: 'Python은 None이 곧 Optional. typing.Optional[str] = str | None',
  },
  {
    id: 'java-enum-to-py',
    from: 'java', to: 'python',
    name: 'Java Enum → Python Enum',
    source: 'enum Color { RED, GREEN, BLUE }',
    target: 'from enum import Enum\nclass Color(Enum):\n    RED = auto()\n    GREEN = auto()\n    BLUE = auto()',
    note: 'Python Enum은 Java와 달리 메서드 추가가 자유로움. IntEnum은 정수 비교 가능',
  },
  // C# → 다른 언어
  {
    id: 'csharp-linq-to-py',
    from: 'csharp', to: 'python',
    name: 'LINQ → 리스트 컴프리헨션 / itertools',
    source: 'var result = items.Where(x => x > 0).Select(x => x * 2).ToList();',
    target: 'result = [x * 2 for x in items if x > 0]',
    note: 'GroupBy → itertools.groupby (정렬 필요), OrderBy → sorted()',
  },
  {
    id: 'csharp-async-to-py',
    from: 'csharp', to: 'python',
    name: 'async Task → async def',
    source: 'async Task<string> FetchAsync() { return await client.GetStringAsync(url); }',
    target: 'async def fetch_async() -> str:\n    async with aiohttp.ClientSession() as session:\n        async with session.get(url) as resp:\n            return await resp.text()',
    note: 'C# HttpClient ≈ Python aiohttp. C# Task.WhenAll ≈ asyncio.gather()',
  },
  {
    id: 'csharp-property-to-py',
    from: 'csharp', to: 'python',
    name: 'Property → @property 데코레이터',
    source: 'public string Name { get; set; }',
    target: '@property\ndef name(self) -> str:\n    return self._name\n\n@name.setter\ndef name(self, value: str):\n    self._name = value',
    note: '자동 프로퍼티(C#)는 Python에서 그냥 public 속성으로 충분한 경우가 많음',
  },
  // Rust → 다른 언어
  {
    id: 'rust-match-to-py',
    from: 'rust', to: 'python',
    name: 'match → match-case (Python 3.10+)',
    source: 'match value {\n    1 => "one",\n    2..=5 => "few",\n    _ => "many"\n}',
    target: 'match value:\n    case 1: return "one"\n    case n if 2 <= n <= 5: return "few"\n    case _: return "many"',
    note: 'Python match는 3.10+. 이전 버전은 if-elif 체인 사용',
  },
  {
    id: 'rust-result-to-go',
    from: 'rust', to: 'go',
    name: 'Result<T,E> → (T, error) 멀티플 리턴',
    source: 'fn parse(s: &str) -> Result<i32, ParseIntError> {\n    s.parse::<i32>()\n}',
    target: 'func parse(s string) (int, error) {\n    n, err := strconv.Atoi(s)\n    return n, err\n}',
    note: 'Rust ? 연산자 ≈ Go if err != nil { return ..., err } 패턴',
  },
  {
    id: 'rust-ownership-to-cpp',
    from: 'rust', to: 'cpp',
    name: '소유권/차용 → 스마트 포인터',
    source: 'let s = String::from("hello");\nlet r = &s; // 차용',
    target: 'auto s = std::make_unique<std::string>("hello");\nconst auto& r = *s; // 참조',
    note: 'Rust 소유권 = C++ unique_ptr, Rust Arc = C++ shared_ptr, Rust &T = C++ const&',
  },
  {
    id: 'rust-trait-to-ts-interface',
    from: 'rust', to: 'typescript',
    name: 'trait → interface',
    source: 'trait Printable {\n    fn print(&self) -> String;\n}',
    target: 'interface Printable {\n    print(): string;\n}',
    note: 'Rust trait은 default impl 가능 → TS에서는 abstract class로 대응',
  },
  // Go → 다른 언어
  {
    id: 'go-goroutine-to-js-promise',
    from: 'go', to: 'javascript',
    name: 'goroutine + channel → Promise',
    source: 'ch := make(chan int)\ngo func() { ch <- compute() }()\nresult := <-ch',
    target: 'const result = await new Promise(resolve => {\n    resolve(compute());\n});',
    note: 'Go channel의 select → Promise.race(). Go의 동시성 모델과 JS의 이벤트 루프는 근본적으로 다름',
  },
  {
    id: 'go-error-to-rust-result',
    from: 'go', to: 'rust',
    name: '(T, error) → Result<T, E>',
    source: 'val, err := doSomething()\nif err != nil { return 0, err }',
    target: 'let val = do_something()?;',
    note: 'Rust ? 연산자가 Go의 if err != nil 패턴을 대체. 에러 타입 변환은 From trait',
  },
  {
    id: 'go-interface-to-ts',
    from: 'go', to: 'typescript',
    name: 'Go interface → TS interface',
    source: 'type Reader interface {\n    Read(p []byte) (n int, err error)\n}',
    target: 'interface Reader {\n    read(p: Uint8Array): { n: number; err: Error | null };\n}',
    note: 'Go 인터페이스는 암묵적 구현, TS는 implements 명시 또는 구조적 타이핑으로 암묵적',
  },
  // Kotlin → 다른 언어
  {
    id: 'kotlin-scope-to-js',
    from: 'kotlin', to: 'javascript',
    name: 'Scope 함수 (let/apply/run) → 체이닝/변수',
    source: 'user?.let { println(it.name) }',
    target: 'if (user != null) { console.log(user.name); }',
    note: 'Kotlin let/also/apply/run/with는 JS에 직접 대응 없음. optional chaining(?.)은 유사',
  },
  {
    id: 'kotlin-data-class-to-ts',
    from: 'kotlin', to: 'typescript',
    name: 'data class → interface + 함수',
    source: 'data class User(val name: String, val age: Int)',
    target: 'interface User { readonly name: string; readonly age: number; }',
    note: 'Kotlin data class의 copy() → TS 스프레드: { ...user, name: "new" }',
  },
  {
    id: 'kotlin-sealed-to-ts',
    from: 'kotlin', to: 'typescript',
    name: 'sealed class → 유니온 타입',
    source: 'sealed class Result {\n    data class Success(val data: String) : Result()\n    data class Failure(val error: Exception) : Result()\n}',
    target: 'type Result = \n    | { type: "success"; data: string }\n    | { type: "failure"; error: Error };',
    note: 'Kotlin when + sealed = TS switch + discriminated union. 완전성 체크 모두 지원',
  },
  // Swift → 다른 언어
  {
    id: 'swift-optional-to-kotlin',
    from: 'swift', to: 'kotlin',
    name: 'Optional → nullable',
    source: 'let name: String? = user?.name\nlet displayName = name ?? "Unknown"',
    target: 'val name: String? = user?.name\nval displayName = name ?: "Unknown"',
    note: 'Swift ?. = Kotlin ?., Swift ?? = Kotlin ?:, Swift if let = Kotlin ?.let {}',
  },
  {
    id: 'swift-guard-to-kotlin',
    from: 'swift', to: 'kotlin',
    name: 'guard let → ?: return / require',
    source: 'guard let user = fetchUser() else { return }',
    target: 'val user = fetchUser() ?: return',
    note: 'Swift guard는 early return 강제. Kotlin은 ?: return 또는 requireNotNull()',
  },
  {
    id: 'swift-enum-to-rust',
    from: 'swift', to: 'rust',
    name: 'Enum (associated values) → Enum',
    source: 'enum Shape {\n    case circle(radius: Double)\n    case rect(width: Double, height: Double)\n}',
    target: 'enum Shape {\n    Circle { radius: f64 },\n    Rect { width: f64, height: f64 },\n}',
    note: 'Swift enum + associated values ≈ Rust enum (대수적 데이터 타입). 패턴 매칭 유사',
  },
  // C++ → 다른 언어
  {
    id: 'cpp-template-to-ts-generic',
    from: 'cpp', to: 'typescript',
    name: 'Template → Generic',
    source: 'template<typename T>\nT max_val(T a, T b) { return a > b ? a : b; }',
    target: 'function maxVal<T extends number | string>(a: T, b: T): T { return a > b ? a : b; }',
    note: 'C++ 템플릿은 컴파일 타임 코드 생성, TS 제네릭은 타입 체크만 (런타임에 소거)',
  },
  {
    id: 'cpp-raii-to-py',
    from: 'cpp', to: 'python',
    name: 'RAII → with문 (context manager)',
    source: '{\n    std::lock_guard<std::mutex> lock(mtx);\n    // 보호 영역\n} // lock 자동 해제',
    target: 'with threading.Lock() as lock:\n    # 보호 영역\n# lock 자동 해제',
    note: 'C++ RAII = 스코프 종료 시 자동 해제. Python은 __enter__/__exit__ 또는 contextlib.contextmanager',
  },
  {
    id: 'cpp-smart-ptr-to-rust',
    from: 'cpp', to: 'rust',
    name: '스마트 포인터 → 소유권 시스템',
    source: 'std::unique_ptr<Foo> p = std::make_unique<Foo>();\nstd::shared_ptr<Foo> sp = std::make_shared<Foo>();',
    target: 'let p = Box::new(Foo::new()); // unique_ptr ≈ Box\nlet sp = Arc::new(Foo::new()); // shared_ptr ≈ Arc',
    note: 'unique_ptr → Box, shared_ptr → Arc/Rc, weak_ptr → Weak. Rust는 컴파일 타임 검증',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// STDLIB_MAPPING: 표준 라이브러리 대응표
// ─────────────────────────────────────────────────────────────────────────────

export const STDLIB_MAPPING = {
  fileIO: {
    python: { read: 'open("f").read()', write: 'open("f","w").write(s)', exists: 'os.path.exists("f")', listDir: 'os.listdir("d")', module: 'os, pathlib' },
    javascript: { read: 'fs.readFileSync("f","utf8")', write: 'fs.writeFileSync("f",s)', exists: 'fs.existsSync("f")', listDir: 'fs.readdirSync("d")', module: 'fs (Node.js)' },
    typescript: { read: 'fs.readFileSync("f","utf8")', write: 'fs.writeFileSync("f",s)', exists: 'fs.existsSync("f")', listDir: 'fs.readdirSync("d")', module: 'fs (Node.js), @types/node' },
    java: { read: 'Files.readString(Path.of("f"))', write: 'Files.writeString(Path.of("f"),s)', exists: 'Files.exists(Path.of("f"))', listDir: 'Files.list(Path.of("d"))', module: 'java.nio.file' },
    go: { read: 'os.ReadFile("f")', write: 'os.WriteFile("f",[]byte(s),0644)', exists: 'os.Stat("f") (err==nil)', listDir: 'os.ReadDir("d")', module: 'os, io' },
    rust: { read: 'fs::read_to_string("f")?', write: 'fs::write("f",s)?', exists: 'Path::new("f").exists()', listDir: 'fs::read_dir("d")?', module: 'std::fs, std::path' },
    cpp: { read: 'std::ifstream ifs("f"); std::string s((std::istreambuf_iterator<char>(ifs)),{})', write: 'std::ofstream("f") << s', exists: 'std::filesystem::exists("f")', listDir: 'std::filesystem::directory_iterator("d")', module: '<fstream>, <filesystem>' },
    csharp: { read: 'File.ReadAllText("f")', write: 'File.WriteAllText("f",s)', exists: 'File.Exists("f")', listDir: 'Directory.GetFiles("d")', module: 'System.IO' },
    kotlin: { read: 'File("f").readText()', write: 'File("f").writeText(s)', exists: 'File("f").exists()', listDir: 'File("d").listFiles()', module: 'java.io, kotlin.io' },
    swift: { read: 'try String(contentsOfFile:"f")', write: 'try s.write(toFile:"f",atomically:true,encoding:.utf8)', exists: 'FileManager.default.fileExists(atPath:"f")', listDir: 'FileManager.default.contentsOfDirectory(atPath:"d")', module: 'Foundation' },
  },
  http: {
    python: { get: 'requests.get(url)', post: 'requests.post(url, json=data)', asyncGet: 'await aiohttp.ClientSession().get(url)', module: 'requests, aiohttp, urllib3' },
    javascript: { get: 'fetch(url)', post: 'fetch(url, {method:"POST",body:JSON.stringify(data)})', asyncGet: 'await fetch(url)', module: 'fetch (built-in), axios' },
    typescript: { get: 'fetch(url)', post: 'fetch(url, {method:"POST",body:JSON.stringify(data)})', asyncGet: 'await fetch(url)', module: 'fetch, axios, @types/node-fetch' },
    java: { get: 'HttpClient.newHttpClient().send(req, BodyHandlers.ofString())', post: 'HttpRequest.newBuilder(uri).POST(BodyPublishers.ofString(json))', asyncGet: 'client.sendAsync(req, BodyHandlers.ofString())', module: 'java.net.http (Java 11+)' },
    go: { get: 'http.Get(url)', post: 'http.Post(url, "application/json", bytes.NewReader(data))', asyncGet: 'go http.Get(url)', module: 'net/http' },
    rust: { get: 'reqwest::get(url).await?', post: 'reqwest::Client::new().post(url).json(&data).send().await?', asyncGet: 'reqwest::get(url).await?', module: 'reqwest, hyper' },
    cpp: { get: 'httplib::Client("host").Get("/path")', post: 'cli.Post("/path", json, "application/json")', asyncGet: '비표준 (libcurl, cpp-httplib 등)', module: 'cpp-httplib, libcurl, Boost.Beast' },
    csharp: { get: 'await new HttpClient().GetStringAsync(url)', post: 'await client.PostAsync(url, new StringContent(json))', asyncGet: 'await client.GetAsync(url)', module: 'System.Net.Http' },
    kotlin: { get: 'URL(url).readText()', post: 'OkHttpClient().newCall(request).execute()', asyncGet: 'withContext(Dispatchers.IO) { URL(url).readText() }', module: 'java.net, OkHttp, Ktor' },
    swift: { get: 'URLSession.shared.data(from: url)', post: 'URLSession.shared.upload(for: req, from: data)', asyncGet: 'let (data, _) = try await URLSession.shared.data(from: url)', module: 'Foundation (URLSession)' },
  },
  json: {
    python: { parse: 'json.loads(s)', stringify: 'json.dumps(obj)', module: 'json (built-in)' },
    javascript: { parse: 'JSON.parse(s)', stringify: 'JSON.stringify(obj)', module: 'JSON (built-in)' },
    typescript: { parse: 'JSON.parse(s) as T', stringify: 'JSON.stringify(obj)', module: 'JSON (built-in), zod/io-ts로 검증' },
    java: { parse: 'new ObjectMapper().readValue(s, Cls.class)', stringify: 'new ObjectMapper().writeValueAsString(obj)', module: 'Jackson, Gson, org.json' },
    go: { parse: 'json.Unmarshal([]byte(s), &obj)', stringify: 'json.Marshal(obj)', module: 'encoding/json' },
    rust: { parse: 'serde_json::from_str::<T>(s)?', stringify: 'serde_json::to_string(&obj)?', module: 'serde, serde_json' },
    cpp: { parse: 'nlohmann::json::parse(s)', stringify: 'j.dump()', module: 'nlohmann/json, RapidJSON' },
    csharp: { parse: 'JsonSerializer.Deserialize<T>(s)', stringify: 'JsonSerializer.Serialize(obj)', module: 'System.Text.Json, Newtonsoft.Json' },
    kotlin: { parse: 'Json.decodeFromString<T>(s)', stringify: 'Json.encodeToString(obj)', module: 'kotlinx.serialization, Gson, Moshi' },
    swift: { parse: 'try JSONDecoder().decode(T.self, from: data)', stringify: 'try JSONEncoder().encode(obj)', module: 'Foundation (Codable)' },
  },
  datetime: {
    python: { now: 'datetime.now()', format: 'dt.strftime("%Y-%m-%d")', parse: 'datetime.strptime(s, "%Y-%m-%d")', module: 'datetime, dateutil' },
    javascript: { now: 'new Date()', format: 'date.toISOString() 또는 Intl.DateTimeFormat', parse: 'new Date(s)', module: 'Date (built-in), dayjs, date-fns' },
    typescript: { now: 'new Date()', format: 'date.toISOString()', parse: 'new Date(s)', module: 'Date, dayjs, date-fns, @types/...' },
    java: { now: 'LocalDateTime.now()', format: 'dt.format(DateTimeFormatter.ofPattern("yyyy-MM-dd"))', parse: 'LocalDate.parse(s)', module: 'java.time (Java 8+)' },
    go: { now: 'time.Now()', format: 'now.Format("2006-01-02")', parse: 'time.Parse("2006-01-02", s)', module: 'time' },
    rust: { now: 'chrono::Local::now()', format: 'now.format("%Y-%m-%d")', parse: 'NaiveDate::parse_from_str(s, "%Y-%m-%d")', module: 'chrono' },
    cpp: { now: 'std::chrono::system_clock::now()', format: 'std::format("{:%Y-%m-%d}", tp) (C++20)', parse: 'std::istringstream + std::get_time', module: '<chrono>, <format>' },
    csharp: { now: 'DateTime.Now', format: 'dt.ToString("yyyy-MM-dd")', parse: 'DateTime.Parse(s)', module: 'System (built-in)' },
    kotlin: { now: 'LocalDateTime.now()', format: 'dt.format(DateTimeFormatter.ofPattern("yyyy-MM-dd"))', parse: 'LocalDate.parse(s)', module: 'java.time, kotlinx-datetime' },
    swift: { now: 'Date()', format: 'DateFormatter().string(from: date)', parse: 'formatter.date(from: s)', module: 'Foundation (DateFormatter)' },
  },
  regex: {
    python: { match: 're.search(r"pattern", s)', findAll: 're.findall(r"pattern", s)', replace: 're.sub(r"pattern", repl, s)', module: 're (built-in)' },
    javascript: { match: 's.match(/pattern/)', findAll: 's.matchAll(/pattern/g)', replace: 's.replace(/pattern/g, repl)', module: 'RegExp (built-in)' },
    typescript: { match: 's.match(/pattern/)', findAll: 's.matchAll(/pattern/g)', replace: 's.replace(/pattern/g, repl)', module: 'RegExp (built-in)' },
    java: { match: 'Pattern.compile("pattern").matcher(s).find()', findAll: 'pattern.matcher(s).results()', replace: 's.replaceAll("pattern", repl)', module: 'java.util.regex' },
    go: { match: 'regexp.MatchString("pattern", s)', findAll: 're.FindAllString(s, -1)', replace: 're.ReplaceAllString(s, repl)', module: 'regexp' },
    rust: { match: 'Regex::new(r"pattern")?.is_match(s)', findAll: 're.find_iter(s)', replace: 're.replace_all(s, repl)', module: 'regex crate' },
    cpp: { match: 'std::regex_search(s, std::regex("pattern"))', findAll: 'std::sregex_iterator', replace: 'std::regex_replace(s, re, repl)', module: '<regex>' },
    csharp: { match: 'Regex.IsMatch(s, "pattern")', findAll: 'Regex.Matches(s, "pattern")', replace: 'Regex.Replace(s, "pattern", repl)', module: 'System.Text.RegularExpressions' },
    kotlin: { match: '"pattern".toRegex().containsMatchIn(s)', findAll: '"pattern".toRegex().findAll(s)', replace: 's.replace("pattern".toRegex(), repl)', module: 'kotlin.text.Regex' },
    swift: { match: 's.range(of: "pattern", options: .regularExpression)', findAll: 'NSRegularExpression + matches()', replace: 's.replacingOccurrences(of: "pattern", with: repl, options: .regularExpression)', module: 'Foundation (NSRegularExpression), Regex (Swift 5.7+)' },
  },
  stringOps: {
    python: { split: 's.split(",")', join: '",".join(lst)', trim: 's.strip()', upper: 's.upper()', contains: '"sub" in s', format: 'f"Hello {name}"', module: 'str (built-in)' },
    javascript: { split: 's.split(",")', join: 'arr.join(",")', trim: 's.trim()', upper: 's.toUpperCase()', contains: 's.includes("sub")', format: '`Hello ${name}`', module: 'String (built-in)' },
    typescript: { split: 's.split(",")', join: 'arr.join(",")', trim: 's.trim()', upper: 's.toUpperCase()', contains: 's.includes("sub")', format: '`Hello ${name}`', module: 'string (built-in)' },
    java: { split: 's.split(",")', join: 'String.join(",", list)', trim: 's.trim()', upper: 's.toUpperCase()', contains: 's.contains("sub")', format: 'String.format("Hello %s", name)', module: 'java.lang.String' },
    go: { split: 'strings.Split(s, ",")', join: 'strings.Join(sl, ",")', trim: 'strings.TrimSpace(s)', upper: 'strings.ToUpper(s)', contains: 'strings.Contains(s, "sub")', format: 'fmt.Sprintf("Hello %s", name)', module: 'strings, fmt' },
    rust: { split: 's.split(",").collect::<Vec<&str>>()', join: 'v.join(",")', trim: 's.trim()', upper: 's.to_uppercase()', contains: 's.contains("sub")', format: 'format!("Hello {}", name)', module: 'std::string::String, &str' },
    cpp: { split: '수동 구현 또는 std::views::split (C++20)', join: '수동 구현 또는 boost::algorithm::join', trim: '수동 구현 또는 boost::trim', upper: 'std::transform + ::toupper', contains: 's.find("sub") != std::string::npos', format: 'std::format("Hello {}", name) (C++20)', module: '<string>, <algorithm>, <format>' },
    csharp: { split: 's.Split(",")', join: 'string.Join(",", list)', trim: 's.Trim()', upper: 's.ToUpper()', contains: 's.Contains("sub")', format: '$"Hello {name}"', module: 'System.String' },
    kotlin: { split: 's.split(",")', join: 'list.joinToString(",")', trim: 's.trim()', upper: 's.uppercase()', contains: '"sub" in s', format: '"Hello $name"', module: 'kotlin.String' },
    swift: { split: 's.split(separator: ",")', join: 'arr.joined(separator: ",")', trim: 's.trimmingCharacters(in: .whitespaces)', upper: 's.uppercased()', contains: 's.contains("sub")', format: '"Hello \\(name)"', module: 'String (built-in)' },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// TYPE_MAPPING: 타입 매핑표
// ─────────────────────────────────────────────────────────────────────────────

export const TYPE_MAPPING = {
  integer: {
    python: 'int (무제한 정밀도)',
    javascript: 'number (53비트) / BigInt',
    typescript: 'number / bigint',
    java: 'int (32bit) / long (64bit) / BigInteger',
    go: 'int / int32 / int64',
    rust: 'i32 / i64 / i128 / isize',
    cpp: 'int / long / long long / int32_t',
    csharp: 'int (32bit) / long (64bit) / BigInteger',
    kotlin: 'Int (32bit) / Long (64bit)',
    swift: 'Int (플랫폼 크기) / Int32 / Int64',
    note: 'Python int는 오버플로 없음. JS number는 2^53까지만 안전 (Number.MAX_SAFE_INTEGER)',
  },
  float: {
    python: 'float (64bit)',
    javascript: 'number (64bit IEEE 754)',
    typescript: 'number',
    java: 'float (32bit) / double (64bit) / BigDecimal',
    go: 'float32 / float64',
    rust: 'f32 / f64',
    cpp: 'float / double / long double',
    csharp: 'float (32bit) / double (64bit) / decimal (128bit)',
    kotlin: 'Float (32bit) / Double (64bit)',
    swift: 'Float (32bit) / Double (64bit)',
    note: '금융 계산: Java BigDecimal, C# decimal, Python Decimal 사용 권장',
  },
  string: {
    python: 'str (불변, 유니코드)',
    javascript: 'string (불변, UTF-16)',
    typescript: 'string',
    java: 'String (불변) / StringBuilder (가변)',
    go: 'string (불변, UTF-8 byte slice)',
    rust: 'String (가변, 소유) / &str (불변 참조)',
    cpp: 'std::string / std::string_view (C++17)',
    csharp: 'string (불변) / StringBuilder (가변)',
    kotlin: 'String (불변)',
    swift: 'String (값 타입, COW)',
    note: 'Go string은 바이트 슬라이스, 문자열 인덱싱 시 rune 변환 필요',
  },
  boolean: {
    python: 'bool (True/False)',
    javascript: 'boolean (true/false)',
    typescript: 'boolean',
    java: 'boolean (primitive) / Boolean (wrapper)',
    go: 'bool (true/false)',
    rust: 'bool',
    cpp: 'bool',
    csharp: 'bool',
    kotlin: 'Boolean',
    swift: 'Bool',
    note: 'Python: 0, "", [], None은 falsy. JS: 0, "", null, undefined, NaN은 falsy. Go: 0은 false가 아님',
  },
  array: {
    python: 'list (동적, 이종 가능)',
    javascript: 'Array (동적, 이종 가능)',
    typescript: 'T[] / Array<T>',
    java: 'T[] (고정) / ArrayList<T> (동적) / List.of() (불변)',
    go: '[]T (slice, 동적) / [N]T (array, 고정)',
    rust: 'Vec<T> (동적) / [T; N] (고정) / &[T] (slice)',
    cpp: 'std::vector<T> (동적) / std::array<T,N> (고정)',
    csharp: 'T[] (고정) / List<T> (동적) / ImmutableList<T>',
    kotlin: 'List<T> (불변) / MutableList<T> (가변) / Array<T>',
    swift: '[T] (Array, 값 타입)',
    note: 'Java 배열은 공변(covariant), 제네릭 컬렉션은 불변(invariant)',
  },
  map: {
    python: 'dict (순서 보장, Python 3.7+)',
    javascript: 'Object {} / Map',
    typescript: 'Record<K,V> / Map<K,V>',
    java: 'HashMap<K,V> / LinkedHashMap<K,V> (순서) / TreeMap<K,V> (정렬)',
    go: 'map[K]V (순서 미보장)',
    rust: 'HashMap<K,V> / BTreeMap<K,V> (정렬)',
    cpp: 'std::unordered_map<K,V> / std::map<K,V> (정렬)',
    csharp: 'Dictionary<K,V> / SortedDictionary<K,V>',
    kotlin: 'Map<K,V> (불변) / MutableMap<K,V> (가변)',
    swift: '[K: V] (Dictionary)',
    note: 'Go map 순회 순서는 매번 랜덤. Python dict는 삽입 순서 보장',
  },
  set: {
    python: 'set (해시 기반, 가변) / frozenset (불변)',
    javascript: 'Set',
    typescript: 'Set<T>',
    java: 'HashSet<T> / LinkedHashSet<T> / TreeSet<T>',
    go: 'map[T]struct{} (관용적 구현)',
    rust: 'HashSet<T> / BTreeSet<T>',
    cpp: 'std::unordered_set<T> / std::set<T> (정렬)',
    csharp: 'HashSet<T> / SortedSet<T>',
    kotlin: 'Set<T> (불변) / MutableSet<T>',
    swift: 'Set<T>',
    note: 'Go에는 내장 Set 없음. map[T]struct{} 패턴 사용 (빈 struct는 메모리 0)',
  },
  nullable: {
    python: 'None (Optional[T] = T | None)',
    javascript: 'null / undefined',
    typescript: 'T | null / T | undefined / T?',
    java: 'null / Optional<T>',
    go: 'nil (포인터, slice, map, interface, channel)',
    rust: 'Option<T> (Some(v) / None)',
    cpp: 'nullptr / std::optional<T> (C++17)',
    csharp: 'null / Nullable<T> / T?',
    kotlin: 'null / T? (nullable type)',
    swift: 'nil / Optional<T> / T?',
    note: 'Rust/Swift/Kotlin은 컴파일 타임 null safety. Java Optional은 반환 타입 전용 권장',
  },
  tuple: {
    python: 'tuple (불변, 이종)',
    javascript: '[a, b] (Array로 대용)',
    typescript: '[T1, T2] (tuple type)',
    java: 'Pair (없음, 라이브러리 또는 record 사용)',
    go: '없음 (struct 또는 멀티플 리턴)',
    rust: '(T1, T2) (최대 12개)',
    cpp: 'std::tuple<T1, T2> / std::pair<T1, T2>',
    csharp: '(T1, T2) (ValueTuple) / Tuple<T1, T2>',
    kotlin: 'Pair<A,B> / Triple<A,B,C> / data class',
    swift: '(T1, T2) (이름 없는/있는 튜플)',
    note: 'Java는 내장 Tuple 없음. record 또는 Map.entry() 활용. Go는 멀티플 리턴으로 대체',
  },
  enum: {
    python: 'enum.Enum / IntEnum / StrEnum',
    javascript: 'Object.freeze({}) 또는 관례적 상수',
    typescript: 'enum / const enum / union literal type',
    java: 'enum (메서드, 필드 포함 가능)',
    go: 'const + iota',
    rust: 'enum (associated data 가능 = ADT)',
    cpp: 'enum class (scoped)',
    csharp: 'enum (정수 기반) / [Flags]',
    kotlin: 'enum class (속성, 메서드 포함)',
    swift: 'enum (associated values, raw values)',
    note: 'Rust/Swift enum은 ADT. TS const enum은 컴파일 시 인라인. Go는 진정한 enum 없음',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// COMMON_PITFALLS: 언어쌍별 주의사항
// ─────────────────────────────────────────────────────────────────────────────

export const COMMON_PITFALLS = [
  // 숫자/정수 관련
  {
    id: 'integer-division',
    languages: ['python', 'java', 'go', 'cpp', 'csharp'],
    title: '정수 나눗셈 동작 차이',
    description: 'Python 3에서 / 는 항상 float 반환 (5/2=2.5). Java, Go, C++, C#에서 정수끼리 / 는 정수 반환 (5/2=2). Python에서 정수 나눗셈은 // 연산자 사용.',
    severity: 'high',
    example: {
      python: '5 / 2  # → 2.5 (float)\n5 // 2  # → 2 (int)',
      java: '5 / 2  // → 2 (int)\n5.0 / 2  // → 2.5 (double)',
    },
  },
  {
    id: 'integer-overflow',
    languages: ['python', 'java', 'go', 'cpp', 'csharp', 'rust'],
    title: '정수 오버플로',
    description: 'Python int는 자동 확장 (오버플로 없음). Java/Go/C++/C# int는 오버플로 시 wraparound. Rust는 디버그 모드에서 패닉, 릴리스에서 wraparound.',
    severity: 'high',
    example: {
      python: 'x = 2 ** 1000  # 정상 동작',
      java: 'int x = Integer.MAX_VALUE + 1;  // -2147483648 (wraparound)',
    },
  },
  {
    id: 'floating-point-precision',
    languages: ['python', 'javascript', 'java', 'go', 'rust', 'cpp', 'csharp'],
    title: '부동소수점 정밀도',
    description: '모든 언어에서 0.1 + 0.2 != 0.3 (IEEE 754). 금융 계산: Python Decimal, Java BigDecimal, C# decimal 사용.',
    severity: 'medium',
  },
  // null/None 관련
  {
    id: 'null-none-undefined',
    languages: ['python', 'javascript', 'typescript', 'java', 'go', 'kotlin', 'swift'],
    title: 'null / None / undefined 차이',
    description: 'Python: None 하나만 존재. JS: null (명시적 비어있음) + undefined (미할당). Java: null (NPE 위험). Go: nil (포인터/인터페이스만). Kotlin/Swift: 컴파일 타임 null safety.',
    severity: 'high',
    example: {
      javascript: 'typeof null === "object"  // JS의 유명한 버그\ntypeof undefined === "undefined"',
      python: 'x is None  // (== None 대신 is 사용)',
    },
  },
  {
    id: 'js-equality',
    languages: ['javascript', 'typescript', 'python', 'java'],
    title: 'JS 동등 비교 (== vs ===)',
    description: 'JS == 는 타입 강제 변환 발생 ("1" == 1 → true). === 사용 권장. Python == 는 값 비교, is는 identity 비교. Java == 는 참조 비교 (String은 .equals() 사용).',
    severity: 'high',
  },
  // 문자열/인코딩 관련
  {
    id: 'string-encoding',
    languages: ['python', 'javascript', 'go', 'rust', 'java'],
    title: '문자열 인코딩 차이',
    description: 'Python str: 유니코드 코드포인트 시퀀스. JS string: UTF-16 (서로게이트 페어). Go string: UTF-8 바이트 슬라이스 (rune으로 문자 접근). Rust &str: UTF-8 보장. Java String: UTF-16.',
    severity: 'medium',
    example: {
      go: 'len("한글")  // → 6 (바이트)\nlen([]rune("한글"))  // → 2 (문자)',
      javascript: '"😀".length  // → 2 (서로게이트 페어)\n[..."😀"].length  // → 1',
    },
  },
  {
    id: 'string-mutability',
    languages: ['python', 'javascript', 'java', 'go', 'rust', 'csharp'],
    title: '문자열 불변성',
    description: 'Python, JS, Java, Go, C# string은 불변. 반복 연결 시 새 객체 생성 → 성능 저하. StringBuilder (Java/C#), strings.Builder (Go), join() (Python) 사용.',
    severity: 'medium',
  },
  // 컬렉션 관련
  {
    id: 'mutable-default-arg',
    languages: ['python'],
    title: 'Python 가변 기본 인자',
    description: 'def fn(lst=[]): 는 모든 호출에서 같은 리스트 객체 공유 → 버그. def fn(lst=None): lst = lst or [] 패턴 사용.',
    severity: 'high',
    example: {
      python: '# 위험\ndef add(item, lst=[]):\n    lst.append(item)\n    return lst\n# 안전\ndef add(item, lst=None):\n    if lst is None: lst = []\n    lst.append(item)\n    return lst',
    },
  },
  {
    id: 'array-copy-vs-reference',
    languages: ['python', 'javascript', 'java', 'go', 'rust'],
    title: '배열/리스트 복사 vs 참조',
    description: 'Python: b = a[:] (얕은 복사). JS: b = [...a] 또는 a.slice(). Java: new ArrayList<>(a). Go: copy(dst, src). 중첩 구조는 deepcopy 필요.',
    severity: 'medium',
  },
  {
    id: 'map-iteration-order',
    languages: ['python', 'javascript', 'java', 'go'],
    title: 'Map/Dict 순회 순서',
    description: 'Python dict: 삽입 순서 보장 (3.7+). JS Object: 정수 키 먼저, 그 외 삽입 순서. Java HashMap: 순서 미보장 (LinkedHashMap 사용). Go map: 의도적으로 랜덤.',
    severity: 'medium',
  },
  // 동시성/비동기 관련
  {
    id: 'async-model-difference',
    languages: ['javascript', 'python', 'go', 'java', 'rust'],
    title: '비동기 모델 차이',
    description: 'JS: 단일 스레드 이벤트 루프. Python: asyncio (단일 스레드 코루틴). Go: goroutine (경량 스레드, 멀티코어). Java: 스레드 풀 / virtual threads. Rust: async/await (런타임 선택).',
    severity: 'high',
  },
  {
    id: 'go-goroutine-leak',
    languages: ['go', 'javascript'],
    title: 'goroutine 누수 / Promise 미처리',
    description: 'Go: goroutine에서 channel 읽기를 대기하면 영원히 block → 메모리 누수. context.WithCancel/WithTimeout 사용. JS: Promise rejection 미처리 시 UnhandledPromiseRejection.',
    severity: 'high',
  },
  // 타입 시스템 관련
  {
    id: 'structural-vs-nominal',
    languages: ['typescript', 'go', 'java', 'csharp', 'rust'],
    title: '구조적 vs 명목적 타이핑',
    description: 'TS/Go: 구조적 타이핑 (같은 구조면 호환). Java/C#/Rust: 명목적 타이핑 (이름이 달라면 호환 불가). 변환 시 인터페이스 구현 방식 주의.',
    severity: 'medium',
  },
  {
    id: 'type-erasure',
    languages: ['java', 'kotlin', 'typescript'],
    title: '타입 소거 (Type Erasure)',
    description: 'Java/Kotlin 제네릭: 런타임에 타입 정보 소거 (List<String>과 List<Int> 구분 불가). TS: 컴파일 후 모든 타입 소거. Kotlin reified inline 함수로 우회 가능.',
    severity: 'medium',
  },
  // 메모리 관리 관련
  {
    id: 'memory-management-model',
    languages: ['python', 'javascript', 'java', 'go', 'rust', 'cpp'],
    title: '메모리 관리 모델 차이',
    description: 'Python/JS/Java/Go/Kotlin: GC (가비지 컬렉션). Rust: 소유권 시스템 (컴파일 타임). C++: 수동 (RAII/스마트 포인터 활용). C#: GC + IDisposable.',
    severity: 'medium',
  },
  {
    id: 'rust-borrow-checker',
    languages: ['rust', 'cpp', 'python', 'java'],
    title: 'Rust 차용 검사기',
    description: 'Rust로 변환 시 소유권/수명 주석이 필요할 수 있음. 불변 참조(&T)는 여러 개, 가변 참조(&mut T)는 하나만. clone()으로 우회 가능하나 성능 비용.',
    severity: 'high',
  },
  // 패키지/모듈 관련
  {
    id: 'package-structure',
    languages: ['java', 'go', 'python', 'rust'],
    title: '패키지/모듈 구조 차이',
    description: 'Java: 파일당 1 public class, 패키지=디렉토리. Go: 패키지=디렉토리, 대문자=exported. Python: __init__.py, 모듈=파일. Rust: mod.rs, crate 단위.',
    severity: 'low',
  },
  {
    id: 'circular-import',
    languages: ['python', 'javascript', 'go', 'rust'],
    title: '순환 import',
    description: 'Python: 런타임에 발생 가능 (부분 import 허용). JS (ESM): 호이스팅으로 일부 동작. Go: 컴파일 에러 (금지). Rust: 모듈 트리 구조로 방지.',
    severity: 'medium',
  },
  // 에러 처리 관련
  {
    id: 'checked-vs-unchecked-exception',
    languages: ['java', 'kotlin', 'python', 'javascript'],
    title: 'Checked vs Unchecked Exception',
    description: 'Java만 checked exception 존재 (throws 선언 강제). Kotlin/Python/JS는 모두 unchecked. Java → Kotlin 변환 시 try-catch 제거 가능.',
    severity: 'medium',
  },
  {
    id: 'go-error-handling-pattern',
    languages: ['go', 'python', 'javascript', 'rust'],
    title: 'Go 에러 처리 패턴',
    description: 'Go: if err != nil { return err } 반복 패턴. Python: try-except. JS: try-catch + Promise.catch(). Rust: Result + ? 연산자. Go→다른 언어: 에러 반환을 예외로 변환 필요.',
    severity: 'high',
  },
  // 기타 중요 주의사항
  {
    id: 'naming-convention',
    languages: ['python', 'javascript', 'java', 'go', 'rust', 'csharp', 'kotlin', 'swift', 'cpp'],
    title: '네이밍 컨벤션 차이',
    description: 'Python: snake_case (함수/변수), PascalCase (클래스). JS/TS: camelCase. Java/Kotlin/C#: camelCase (변수), PascalCase (클래스/메서드-C#). Go: PascalCase (exported), camelCase (unexported). Rust: snake_case. Swift: camelCase.',
    severity: 'low',
  },
  {
    id: 'zero-indexing',
    languages: ['python', 'javascript', 'java', 'go', 'rust', 'cpp', 'csharp', 'kotlin', 'swift'],
    title: '인덱스 기반 차이',
    description: '모든 10개 언어가 0-based 인덱싱 사용. 단, Lua, R 등에서 변환 시 주의. Python 음수 인덱스 (a[-1]) 는 대부분 다른 언어에서 a[a.length-1]로 변환.',
    severity: 'low',
  },
  {
    id: 'switch-fallthrough',
    languages: ['javascript', 'java', 'cpp', 'csharp', 'go', 'swift', 'kotlin', 'rust'],
    title: 'switch/match fallthrough',
    description: 'JS/Java/C++: switch에서 break 없으면 fallthrough. C#: 명시적 goto case 필요. Go: 기본적으로 break (fallthrough 키워드로 명시). Swift/Kotlin/Rust: fallthrough 없음.',
    severity: 'medium',
  },
  {
    id: 'pass-by-value-vs-reference',
    languages: ['python', 'javascript', 'java', 'go', 'rust', 'cpp', 'csharp', 'swift'],
    title: '값 전달 vs 참조 전달',
    description: 'Python: 객체 참조 전달 (pass by object reference). JS: primitive는 값, 객체는 참조. Java: 항상 값 전달 (객체는 참조의 값). Go: 값 전달 (포인터로 참조). Rust: 이동(move) 또는 차용(&). Swift: struct 값, class 참조.',
    severity: 'high',
  },
  {
    id: 'scope-rules',
    languages: ['python', 'javascript', 'java', 'go'],
    title: '변수 스코프 규칙',
    description: 'Python: LEGB (Local, Enclosing, Global, Built-in), for 루프 변수는 함수 스코프. JS let/const: 블록 스코프. Java: 블록 스코프. Go: 블록 스코프, := 섀도잉 주의.',
    severity: 'medium',
    example: {
      python: 'for i in range(3): pass\nprint(i)  # → 2 (루프 변수가 함수 스코프에 남음)',
      javascript: 'for (let i = 0; i < 3; i++) {}\nconsole.log(i);  // ReferenceError',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 시스템 프롬프트 빌더 헬퍼
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 주어진 소스/대상 언어에 해당하는 변환 패턴을 필터링한다.
 */
export function getRelevantPatterns(sourceId, targetId) {
  return CONVERSION_PATTERNS.filter(
    (p) => p.from === sourceId && p.to === targetId
  );
}

/**
 * 주어진 소스/대상 언어에 해당하는 역방향 변환 패턴도 포함하여 반환한다.
 */
export function getAllRelevantPatterns(sourceId, targetId) {
  const direct = CONVERSION_PATTERNS.filter(
    (p) => p.from === sourceId && p.to === targetId
  );
  const reverse = CONVERSION_PATTERNS.filter(
    (p) => p.from === targetId && p.to === sourceId
  );
  return { direct, reverse };
}

/**
 * 두 언어에 관련된 주의사항(pitfalls)을 필터링한다.
 */
export function getRelevantPitfalls(sourceId, targetId) {
  return COMMON_PITFALLS.filter(
    (p) => p.languages.includes(sourceId) && p.languages.includes(targetId)
  );
}

/**
 * 두 언어의 타입 매핑을 구성한다.
 */
export function getTypeMappingPair(sourceId, targetId) {
  const entries = [];
  for (const [typeName, mapping] of Object.entries(TYPE_MAPPING)) {
    const src = mapping[sourceId];
    const tgt = mapping[targetId];
    if (src && tgt) {
      entries.push({ type: typeName, source: src, target: tgt, note: mapping.note || '' });
    }
  }
  return entries;
}

/**
 * 두 언어의 표준 라이브러리 대응표를 구성한다.
 */
export function getStdlibMappingPair(sourceId, targetId) {
  const entries = [];
  for (const [category, mapping] of Object.entries(STDLIB_MAPPING)) {
    const src = mapping[sourceId];
    const tgt = mapping[targetId];
    if (src && tgt) {
      entries.push({ category, source: src, target: tgt });
    }
  }
  return entries;
}

/**
 * 두 언어의 문법 비교표를 구성한다.
 */
export function getSyntaxComparisonPair(sourceId, targetId) {
  const entries = [];
  for (const [category, mapping] of Object.entries(SYNTAX_COMPARISON)) {
    const src = mapping[sourceId];
    const tgt = mapping[targetId];
    if (src && tgt) {
      entries.push({ category, source: src, target: tgt });
    }
  }
  return entries;
}

/**
 * 시스템 프롬프트에 삽입할 레퍼런스 텍스트를 조합한다.
 */
export function buildConversionReference(sourceId, targetId) {
  const sourceLang = LANGUAGES.find((l) => l.id === sourceId);
  const targetLang = LANGUAGES.find((l) => l.id === targetId);
  if (!sourceLang || !targetLang) return '';

  const sections = [];

  // 언어 정보
  sections.push(`[소스 언어] ${sourceLang.name} (${sourceLang.typeSystem}, ${sourceLang.paradigm.join('/')})`);
  sections.push(`[대상 언어] ${targetLang.name} (${targetLang.typeSystem}, ${targetLang.paradigm.join('/')})`);
  sections.push('');

  // 문법 비교
  const syntax = getSyntaxComparisonPair(sourceId, targetId);
  if (syntax.length > 0) {
    sections.push('=== 문법 비교 ===');
    for (const s of syntax) {
      sections.push(`[${s.category}]`);
      sections.push(`  ${sourceLang.name}: ${JSON.stringify(s.source)}`);
      sections.push(`  ${targetLang.name}: ${JSON.stringify(s.target)}`);
    }
    sections.push('');
  }

  // 변환 패턴
  const { direct, reverse } = getAllRelevantPatterns(sourceId, targetId);
  if (direct.length > 0) {
    sections.push(`=== ${sourceLang.name} → ${targetLang.name} 변환 패턴 ===`);
    for (const p of direct) {
      sections.push(`[${p.name}]`);
      sections.push(`  변환 전: ${p.source}`);
      sections.push(`  변환 후: ${p.target}`);
      if (p.note) sections.push(`  주의: ${p.note}`);
    }
    sections.push('');
  }
  if (reverse.length > 0) {
    sections.push(`=== ${targetLang.name} → ${sourceLang.name} 참고 역패턴 ===`);
    for (const p of reverse) {
      sections.push(`[${p.name}] ${p.source} → ${p.target}`);
      if (p.note) sections.push(`  주의: ${p.note}`);
    }
    sections.push('');
  }

  // 타입 매핑
  const types = getTypeMappingPair(sourceId, targetId);
  if (types.length > 0) {
    sections.push('=== 타입 매핑 ===');
    for (const t of types) {
      sections.push(`  ${t.type}: ${t.source} → ${t.target}${t.note ? ` (${t.note})` : ''}`);
    }
    sections.push('');
  }

  // 표준 라이브러리 대응
  const stdlib = getStdlibMappingPair(sourceId, targetId);
  if (stdlib.length > 0) {
    sections.push('=== 표준 라이브러리 대응 ===');
    for (const s of stdlib) {
      sections.push(`[${s.category}]`);
      sections.push(`  ${sourceLang.name}: ${JSON.stringify(s.source)}`);
      sections.push(`  ${targetLang.name}: ${JSON.stringify(s.target)}`);
    }
    sections.push('');
  }

  // 주의사항
  const pitfalls = getRelevantPitfalls(sourceId, targetId);
  if (pitfalls.length > 0) {
    sections.push('=== 주의사항 ===');
    for (const p of pitfalls) {
      sections.push(`[${p.severity.toUpperCase()}] ${p.title}`);
      sections.push(`  ${p.description}`);
      if (p.example) {
        for (const [lang, code] of Object.entries(p.example)) {
          sections.push(`  ${lang}: ${code}`);
        }
      }
    }
  }

  return sections.join('\n');
}
