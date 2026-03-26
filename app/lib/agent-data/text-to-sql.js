/**
 * Text-to-SQL 에이전트 정적 레퍼런스 데이터
 *
 * Ollama 모델의 SQL 지식 한계를 보완하기 위해
 * 방언별 함수 매핑, 쿼리 패턴, 스키마 예시, 최적화 팁을 포함한다.
 * 시스템 프롬프트에 삽입되어 정확한 SQL 생성을 돕는다.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. DIALECTS — 지원하는 SQL 방언 정의
// ─────────────────────────────────────────────────────────────────────────────

export const DIALECTS = [
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    description: '오픈소스 객체-관계형 DBMS. JSONB, 배열, CTE, Window 함수 등 고급 기능 지원',
    version: '15+',
    defaultPort: 5432,
    features: [
      'JSONB 네이티브 지원',
      'CTE (WITH 절) 및 재귀 CTE',
      'Window 함수 (ROW_NUMBER, RANK, LAG, LEAD 등)',
      'LATERAL JOIN',
      'ARRAY 타입 및 unnest()',
      'UPSERT (ON CONFLICT)',
      'GENERATE_SERIES()',
      'MATERIALIZED VIEW',
      'FULL TEXT SEARCH (tsvector/tsquery)',
      'PARTITION BY RANGE/LIST/HASH',
    ],
    limitations: [
      'PIVOT/UNPIVOT 직접 지원 없음 (crosstab 확장 또는 CASE 사용)',
      'TOP N 대신 LIMIT/OFFSET 사용',
      'AUTO_INCREMENT 대신 SERIAL/IDENTITY 사용',
    ],
  },
  {
    id: 'mysql',
    name: 'MySQL',
    description: '가장 널리 사용되는 오픈소스 RDBMS. 8.0부터 CTE, Window 함수 지원',
    version: '8.0+',
    defaultPort: 3306,
    features: [
      'CTE (WITH 절, 8.0+)',
      'Window 함수 (8.0+)',
      'JSON 타입 및 JSON_EXTRACT()',
      'ON DUPLICATE KEY UPDATE (UPSERT)',
      'FULLTEXT 인덱스',
      'Generated Columns (가상/저장)',
      'GROUP_CONCAT()',
      'REGEXP_REPLACE() (8.0+)',
    ],
    limitations: [
      'FULL OUTER JOIN 미지원 (UNION으로 대체)',
      'LATERAL JOIN 제한적 (8.0.14+)',
      'CHECK 제약조건 미지원 (8.0.16 미만)',
      'MERGE 문 미지원',
      'INTERSECT/EXCEPT 미지원 (8.0.31 미만)',
    ],
  },
  {
    id: 'oracle',
    name: 'Oracle',
    description: '엔터프라이즈급 상용 RDBMS. PL/SQL, 파티셔닝, 고급 분석함수 지원',
    version: '19c+',
    defaultPort: 1521,
    features: [
      'PL/SQL 프로시저/함수/패키지',
      'PIVOT/UNPIVOT 네이티브',
      'CONNECT BY (계층형 쿼리)',
      'MERGE (UPSERT)',
      'Analytic Functions (Window 함수)',
      'FLASHBACK 쿼리',
      'MATERIALIZED VIEW',
      'DBMS_SCHEDULER',
      'ROWNUM / FETCH FIRST N ROWS',
      'LISTAGG()',
    ],
    limitations: [
      'LIMIT 미지원 (ROWNUM 또는 FETCH FIRST 사용)',
      'BOOLEAN 타입 미지원 (NUMBER(1) 사용)',
      'GROUP_CONCAT 미지원 (LISTAGG 사용)',
      'AUTO_INCREMENT 미지원 (SEQUENCE + TRIGGER 또는 IDENTITY)',
      'IF NOT EXISTS 미지원',
    ],
  },
  {
    id: 'sqlite',
    name: 'SQLite',
    description: '서버리스 경량 임베디드 데이터베이스. 단일 파일, 제로 설정',
    version: '3.39+',
    defaultPort: null,
    features: [
      'CTE 및 재귀 CTE',
      'Window 함수 (3.25+)',
      'UPSERT (ON CONFLICT, 3.24+)',
      'JSON 함수 (3.38+)',
      'GENERATED COLUMNS (3.31+)',
      '서버 불필요 (임베디드)',
      'ATTACH DATABASE (다중 DB 파일)',
      'FTS5 (Full-Text Search)',
    ],
    limitations: [
      'ALTER TABLE 제한 (컬럼 삭제/변경 제한적)',
      'RIGHT/FULL OUTER JOIN 미지원 (3.39 미만)',
      'GRANT/REVOKE 미지원 (파일 권한으로 관리)',
      '동시 쓰기 제한 (WAL 모드 사용 권장)',
      '저장 프로시저 미지원',
      'DATETIME 타입 없음 (TEXT/INTEGER/REAL로 저장)',
    ],
  },
  {
    id: 'mssql',
    name: 'MSSQL (SQL Server)',
    description: 'Microsoft 상용 RDBMS. T-SQL, SSRS, SSAS 등 BI 생태계 통합',
    version: '2019+',
    defaultPort: 1433,
    features: [
      'T-SQL 프로시저/함수',
      'CTE 및 재귀 CTE',
      'Window 함수',
      'MERGE 문 (UPSERT)',
      'PIVOT/UNPIVOT',
      'CROSS APPLY / OUTER APPLY',
      'STRING_AGG() (2017+)',
      'JSON 함수 (2016+)',
      'TEMPORAL TABLE (시스템 버전 관리)',
      'OFFSET FETCH (2012+)',
    ],
    limitations: [
      'LIMIT 미지원 (TOP 또는 OFFSET FETCH 사용)',
      'BOOLEAN 타입 미지원 (BIT 사용)',
      'GROUP_CONCAT 미지원 (STRING_AGG 또는 FOR XML PATH 사용)',
      'FULL TEXT SEARCH 별도 설치 필요',
      'GENERATE_SERIES 미지원 (재귀 CTE로 대체)',
    ],
  },
  {
    id: 'vertica',
    name: 'Vertica',
    description: 'HP/OpenText 컬럼 지향 분석 DBMS. 프로젝션 기반 스토리지, 대규모 분석·ML 내장 함수 지원',
    version: '12+',
    defaultPort: 5433,
    features: [
      '컬럼 지향 스토리지 (Projection 기반)',
      '프로젝션(Projection) 자동/수동 설계',
      '세그먼테이션 (해시/범위 분산)',
      'Flex Table (스키마리스 반정형 데이터)',
      'COPY / MERGE 벌크 로딩',
      '분석 함수 (TIMESERIES, GAP FILLING, INTERPOLATE)',
      'PATTERN MATCHING (이벤트 시계열 패턴)',
      'TOPN / BOTTOMN 최적화 함수',
      'ML 내장 함수 (PREDICT, LOGISTIC_REG, KMEANS, RF_CLASSIFIER 등)',
      'ANSI SQL 윈도우 함수 전체 지원',
      'QUALIFY 절 지원',
      'EXPORT TO PARQUET / ORC',
    ],
    limitations: [
      'UPDATE/DELETE 성능 제한 (컬럼 스토어 특성상 OLTP 부적합)',
      'UPSERT 직접 구문 없음 (MERGE 사용)',
      'LATERAL JOIN 미지원',
      'RECURSIVE CTE 미지원 (CONNECT BY 우회)',
      'BOOLEAN 리터럴은 TRUE/FALSE (1/0 아님)',
      'AUTO_INCREMENT 대신 IDENTITY 또는 SEQUENCE 사용',
      'FULL OUTER JOIN 성능 주의 (대규모 테이블)',
    ],
  },
  {
    id: 'mariadb',
    name: 'MariaDB',
    description: 'MySQL 포크 오픈소스 RDBMS. MySQL 호환 + Aria/ColumnStore, 시퀀스, 시스템 버전 테이블 등 독자 기능',
    version: '10.6+',
    defaultPort: 3306,
    features: [
      'MySQL 호환 문법 + MariaDB 확장',
      'CTE 및 재귀 CTE (10.2+)',
      'Window 함수 (10.2+)',
      '시퀀스 객체 (CREATE SEQUENCE, 10.3+)',
      '시스템 버전 테이블 (Temporal Table, 10.3+)',
      'JSON_TABLE (10.6+)',
      'RETURNING 절 (INSERT/DELETE, 10.5+)',
      'Oracle 호환 모드 (sql_mode=ORACLE)',
      'ColumnStore 엔진 (분석용 컬럼 스토리지)',
      'Aria 스토리지 엔진 (크래시 세이프 MyISAM 대체)',
      'INTERSECT / EXCEPT (10.3+)',
      'INVISIBLE COLUMNS (10.3+)',
    ],
    limitations: [
      'FULL OUTER JOIN 미지원 (UNION으로 대체)',
      'CHECK 제약조건 강제 적용 (MySQL과 다름, 10.2.1+)',
      'MySQL 8.0 전용 기능 일부 미지원 (LATERAL JOIN 미지원 등)',
      'JSON 성능이 PostgreSQL JSONB보다 낮음',
      'ColumnStore 엔진 사용 시 트랜잭션 제한',
      'MERGE 문 미지원 (INSERT ... ON DUPLICATE KEY UPDATE 사용)',
    ],
  },
  {
    id: 'redshift',
    name: 'Amazon Redshift',
    description: 'AWS 클라우드 데이터 웨어하우스. PostgreSQL 기반 MPP, 컬럼 지향 스토리지, Spectrum(S3 쿼리) 지원',
    version: 'Serverless / RA3',
    defaultPort: 5439,
    features: [
      'PostgreSQL 8.x 기반 SQL (호환성 제한 있음)',
      '컬럼 지향 스토리지 + MPP (대규모 병렬 처리)',
      'DISTKEY / SORTKEY (분산키/정렬키 물리 설계)',
      'Spectrum (S3 외부 테이블 직접 쿼리)',
      'COPY 명령 벌크 로딩 (S3, DynamoDB 등)',
      'UNLOAD (S3로 데이터 내보내기)',
      'SUPER 타입 (반정형 JSON 네이티브)',
      'Materialized View (자동/수동 리프레시)',
      'Concurrency Scaling (자동 확장)',
      'APPROXIMATE COUNT(DISTINCT) — HyperLogLog',
      'Window 함수 전체 지원',
    ],
    limitations: [
      'LATERAL JOIN 미지원',
      'UPSERT 제한 (DELETE + INSERT 또는 MERGE 사용, 2023+)',
      'CTE는 지원하나 재귀 CTE 미지원',
      'ARRAY/HSTORE 타입 미지원 (SUPER 타입 사용)',
      'GENERATE_SERIES 미지원',
      'UNIQUE 제약조건 강제 안됨 (advisory only)',
      'LIMIT 절 서브쿼리 내부 사용 제한',
      '트랜잭션 격리 수준 SERIALIZABLE 고정',
    ],
  },
  {
    id: 'bigquery',
    name: 'Google BigQuery',
    description: 'GCP 서버리스 분석 데이터 웨어하우스. 표준 SQL + STRUCT/ARRAY/GEOGRAPHY, ML/BI 내장 기능',
    version: 'Standard SQL',
    defaultPort: null,
    features: [
      '서버리스 (인프라 관리 불필요, 슬롯 기반 과금)',
      'STRUCT / ARRAY / GEOGRAPHY 네이티브 타입',
      'UNNEST (배열 펼치기)',
      'PIVOT / UNPIVOT (네이티브)',
      'QUALIFY 절 (윈도우 함수 필터)',
      'MERGE 문 지원',
      'CREATE MODEL (BigQuery ML — 회귀, 분류, 클러스터링 등)',
      'INFORMATION_SCHEMA 메타데이터 쿼리',
      '파티셔닝 (날짜/정수 범위) + 클러스터링',
      'SAFE_DIVIDE, SAFE_CAST 등 안전 함수',
      'Federated Query (Cloud SQL, Spanner 등)',
      'JavaScript UDF 지원',
    ],
    limitations: [
      '테이블명에 백틱(`) 필수 (프로젝트.데이터셋.테이블)',
      'UPDATE/DELETE 시 WHERE 절 필수 (DML 쿼터 제한)',
      'LIMIT 없는 대형 쿼리 비용 주의 (스캔 바이트 과금)',
      'INDEX 개념 없음 (파티셔닝/클러스터링으로 대체)',
      'AUTO_INCREMENT / SEQUENCE 미지원',
      'LATERAL JOIN 미지원 (UNNEST + CROSS JOIN으로 대체)',
      '트랜잭션은 스크립트 블록 내에서만 (멀티 문장 DML)',
    ],
  },
  {
    id: 'snowflake',
    name: 'Snowflake',
    description: '클라우드 네이티브 데이터 웨어하우스. VARIANT(반정형), 타임 트래블, CLONE, TASK/STREAM 지원',
    version: 'Enterprise+',
    defaultPort: 443,
    features: [
      'VARIANT / OBJECT / ARRAY (반정형 데이터 네이티브)',
      'FLATTEN (반정형 데이터 펼치기) + LATERAL',
      '타임 트래블 (최대 90일 이전 데이터 조회)',
      'ZERO-COPY CLONE (테이블/스키마/DB 즉시 복제)',
      'TASK / STREAM (CDC 및 스케줄링)',
      'QUALIFY 절 (윈도우 함수 결과 필터)',
      'PIVOT / UNPIVOT 네이티브',
      '스테이지(Stage) + COPY INTO (벌크 로딩/언로딩)',
      'UDF (JavaScript, Python, Java, SQL)',
      '마이크로 파티셔닝 자동 관리',
      'Materialized View',
      'SEARCH OPTIMIZATION SERVICE',
    ],
    limitations: [
      'MERGE 시 비결정적 매칭 에러 주의',
      '인덱스 개념 없음 (마이크로 파티셔닝 + 클러스터링 키)',
      'GENERATE_SERIES 미지원 (TABLE(GENERATOR(ROWCOUNT => n)) 사용)',
      'FULL OUTER JOIN + QUALIFY 조합 제한',
      'PL/SQL 스타일 프로시저 일부 제한',
      'BOOLEAN 컬럼에 GROUP BY 시 주의 (TRUE/FALSE/NULL 3값)',
    ],
  },
  {
    id: 'hive',
    name: 'Apache Hive',
    description: 'Hadoop 기반 데이터 웨어하우스. HiveQL, 파티셔닝/버킷팅, ORC/Parquet, Hive 3+ ACID 트랜잭션',
    version: '3.1+',
    defaultPort: 10000,
    features: [
      'HiveQL (SQL-like 쿼리 언어)',
      '파티셔닝 (디렉토리 기반 파티션 프루닝)',
      '버킷팅 (해시 기반 데이터 분산)',
      'ORC / Parquet / Avro 파일 포맷 지원',
      'ACID 트랜잭션 (Hive 3+, ORC 전용)',
      'LATERAL VIEW EXPLODE (배열/맵 펼치기)',
      'UDF / UDTF / UDAF (사용자 정의 함수)',
      'MSCK REPAIR TABLE (파티션 자동 인식)',
      'INSERT OVERWRITE (파티션/테이블 덮어쓰기)',
      'WINDOW 함수 지원',
      'DISTRIBUTE BY / CLUSTER BY / SORT BY',
      'Tez / LLAP 실행 엔진',
    ],
    limitations: [
      'OFFSET 미지원 (LIMIT만 사용, ROW_NUMBER 우회)',
      'UPDATE/DELETE는 ACID 테이블에서만 (ORC + 트랜잭션 매니저)',
      'UPSERT 미지원 (MERGE 사용, Hive 2.2+)',
      'CTE 지원하나 재귀 CTE 미지원',
      'LATERAL JOIN 미지원 (LATERAL VIEW 사용)',
      '서브쿼리 제한 (WHERE 절 IN/EXISTS만 일부 지원)',
      '낮은 레이턴시 쿼리 부적합 (배치 지향)',
      'AUTO_INCREMENT 미지원',
    ],
  },
  {
    id: 'presto',
    name: 'Presto / Trino',
    description: '분산 SQL 쿼리 엔진. ANSI SQL 준수, 다중 데이터소스 커넥터, 대화형 분석에 최적화',
    version: 'Trino 4xx+ / Presto 0.28x+',
    defaultPort: 8080,
    features: [
      'ANSI SQL 준수 (높은 SQL 표준 호환성)',
      '다중 데이터소스 커넥터 (Hive, MySQL, PostgreSQL, Kafka, S3 등)',
      'UNNEST + CROSS JOIN UNNEST (배열/맵 펼치기)',
      'LAMBDA 표현식 (transform, filter, reduce)',
      'TRY / TRY_CAST (에러 무시 안전 함수)',
      'APPROX_DISTINCT, APPROX_PERCENTILE (근사 집계)',
      'WITH ORDINALITY (순서 인덱스 포함 UNNEST)',
      'ROW 타입 (구조체)',
      'ARRAY / MAP 네이티브 타입 및 함수',
      'EXPLAIN ANALYZE (실행 계획 + 실제 통계)',
      'Window 함수 전체 지원',
    ],
    limitations: [
      'UPDATE / DELETE 제한 (커넥터 의존, 대부분 읽기 전용)',
      'INSERT 시 트랜잭션 미지원 (커넥터별 다름)',
      'MERGE 미지원 (Trino 일부 커넥터에서 제한적 지원)',
      '재귀 CTE 미지원',
      'UPSERT / ON CONFLICT 미지원',
      'CREATE INDEX 미지원 (쿼리 엔진이므로)',
      'AUTO_INCREMENT 미지원',
      'LATERAL JOIN 제한적 (Trino 최신 버전 일부 지원)',
    ],
  },
  {
    id: 'clickhouse',
    name: 'ClickHouse',
    description: '오픈소스 컬럼 지향 OLAP DBMS. MergeTree 엔진 패밀리, 초고속 집계·실시간 분석 특화',
    version: '23.x+',
    defaultPort: 8123,
    features: [
      'MergeTree 엔진 패밀리 (MergeTree, ReplacingMergeTree, SummingMergeTree, AggregatingMergeTree 등)',
      'Materialized View (INSERT 트리거 기반 실시간 집계)',
      'ARRAY JOIN (배열 펼치기)',
      '-If / -Array / -Map 조합 함수 (sumIf, countArray, avgMap 등)',
      'LowCardinality 타입 (딕셔너리 인코딩, 문자열 최적화)',
      'Codec 압축 (LZ4, ZSTD, Delta, DoubleDelta, Gorilla 등)',
      'PREWHERE 절 (WHERE 전 사전 필터링)',
      'FINAL 키워드 (MergeTree 최신 버전 행만 조회)',
      'Nullable 타입 지원',
      'FORMAT 절 (JSON, CSV, Parquet, Pretty 등 다양한 출력 포맷)',
      '분산 테이블 (Distributed + ReplicatedMergeTree)',
      'Window 함수 지원 (22.x+)',
    ],
    limitations: [
      'UPDATE / DELETE는 ALTER TABLE ... UPDATE/DELETE (비동기 뮤테이션)',
      '트랜잭션 미지원 (ACID 보장 안됨)',
      'JOIN 성능 제한 (대형 조인은 서브쿼리 또는 딕셔너리 권장)',
      'UPSERT 미지원 (ReplacingMergeTree + FINAL 또는 CollapsingMergeTree 사용)',
      'FULL OUTER JOIN 미지원 (UNION으로 대체)',
      'AUTO_INCREMENT 미지원',
      'UNIQUE 제약조건 미지원 (ReplacingMergeTree로 근사)',
      'Window 함수 일부 제한 (ROWS BETWEEN 제한적)',
    ],
  },
  {
    id: 'db2',
    name: 'IBM DB2',
    description: 'IBM 엔터프라이즈 RDBMS. SQL PL, TEMPORAL 테이블, MQT, XML 네이티브, 강력한 OLAP 함수 지원',
    version: '11.5+',
    defaultPort: 50000,
    features: [
      'SQL PL (저장 프로시저/함수/트리거)',
      'MERGE 문 (UPSERT + 조건부 DELETE)',
      'OLAP 함수 (RANK, DENSE_RANK, ROW_NUMBER, NTILE 등)',
      'XML 네이티브 타입 및 XQuery',
      'TEMPORAL 테이블 (시스템/비즈니스 타임)',
      'RCTE (재귀 CTE, RECURSIVE 키워드 불필요)',
      'MQT (Materialized Query Table, 머티리얼라이즈드 뷰)',
      'FETCH FIRST n ROWS ONLY (페이지네이션)',
      'LATERAL 상관 서브쿼리 지원',
      'VALUES 절 (인라인 테이블)',
      'ARRAY 타입 (SQL PL 내부)',
      'JSON 함수 (11.1+)',
    ],
    limitations: [
      'LIMIT / OFFSET 미지원 (FETCH FIRST n ROWS ONLY 사용)',
      'BOOLEAN 타입 제한 (SMALLINT 0/1 관행)',
      'GROUP_CONCAT 미지원 (LISTAGG 또는 XMLAGG 사용)',
      'GENERATE_SERIES 미지원 (RCTE로 대체)',
      'IF NOT EXISTS 미지원 (예외 처리로 우회)',
      'ON CONFLICT 구문 미지원 (MERGE 사용)',
    ],
  },
  {
    id: 'teradata',
    name: 'Teradata',
    description: 'MPP 기반 엔터프라이즈 분석 DBMS. PRIMARY INDEX 해시 분산, QUALIFY, COLLECT STATISTICS, PERIOD 타입 지원',
    version: '17+',
    defaultPort: 1025,
    features: [
      'PRIMARY INDEX (PI) 해시 기반 행 분산',
      'COLLECT STATISTICS (옵티마이저 통계 수집)',
      'QUALIFY 절 (윈도우 함수 결과 필터, 업계 최초)',
      'SAMPLE 절 (행 샘플링)',
      'SET / MULTISET 테이블 (중복 허용/제거)',
      'VOLATILE / GLOBAL TEMPORARY 테이블',
      'NUSI / USI 인덱스 (Non-Unique/Unique Secondary)',
      'PERIOD 데이터타입 (시간 범위 네이티브)',
      'MERGE 문 지원',
      'NORMALIZE / EXPAND ON (시간 범위 정규화)',
      'HASHROW / HASHBUCKET (분산 확인 함수)',
      'Window 함수 전체 지원 (RESET WHEN 포함)',
    ],
    limitations: [
      'LIMIT 미지원 (TOP n 또는 SAMPLE 또는 QUALIFY + ROW_NUMBER 사용)',
      'BOOLEAN 타입 미지원 (BYTEINT 0/1 관행)',
      'LATERAL JOIN 미지원',
      'ARRAY / JSON 타입 제한적 (JSON Shredding 함수 사용)',
      'AUTO_INCREMENT 미지원 (IDENTITY 컬럼 사용)',
      'INSERT ... VALUES 다중 행 미지원 (INSERT ... SELECT 또는 BTEQ .REPEAT)',
      'GROUP_CONCAT 미지원 (TD_SYSFNLIB.OREPLACE + XML 우회 또는 재귀 쿼리)',
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 2. FUNCTION_MAPPING — 방언별 함수 대응표
// ─────────────────────────────────────────────────────────────────────────────

export const FUNCTION_MAPPING = {
  // ── 문자열 함수 ──
  string: [
    {
      name: '문자열 연결 (CONCAT)',
      postgresql: "CONCAT(a, b) 또는 a || b",
      mysql: "CONCAT(a, b) 또는 CONCAT_WS(sep, a, b)",
      oracle: "a || b 또는 CONCAT(a, b)  -- CONCAT은 2개만",
      sqlite: "a || b",
      mssql: "CONCAT(a, b) 또는 a + b",
      vertica: "CONCAT(a, b) 또는 a || b",
      mariadb: "CONCAT(a, b) 또는 CONCAT_WS(sep, a, b)",
      redshift: "CONCAT(a, b) 또는 a || b",
      bigquery: "CONCAT(a, b) — 다중 인자 지원",
      snowflake: "CONCAT(a, b) 또는 a || b",
      hive: "CONCAT(a, b), CONCAT_WS(sep, a, b)",
      presto: "CONCAT(a, b) 또는 a || b",
      clickhouse: "concat(a, b) 또는 a || b",
      db2: "CONCAT(a, b) 또는 a || b  -- CONCAT은 2개만",
      teradata: "a || b  -- CONCAT 함수 미지원",
    },
    {
      name: '부분 문자열 (SUBSTRING)',
      postgresql: "SUBSTRING(str FROM pos FOR len)",
      mysql: "SUBSTRING(str, pos, len) 또는 SUBSTR(str, pos, len)",
      oracle: "SUBSTR(str, pos, len)",
      sqlite: "SUBSTR(str, pos, len)",
      mssql: "SUBSTRING(str, pos, len)",
      vertica: "SUBSTR(str, pos, len) 또는 SUBSTRING(str FROM pos FOR len)",
      mariadb: "SUBSTRING(str, pos, len) 또는 SUBSTR(str, pos, len)",
      redshift: "SUBSTRING(str, pos, len) 또는 SUBSTR(str, pos, len)",
      bigquery: "SUBSTR(str, pos, len)",
      snowflake: "SUBSTR(str, pos, len) 또는 SUBSTRING(str, pos, len)",
      hive: "SUBSTR(str, pos, len) 또는 SUBSTRING(str, pos, len)",
      presto: "SUBSTR(str, pos, len)",
      clickhouse: "substring(str, pos, len)",
      db2: "SUBSTR(str, pos, len)",
      teradata: "SUBSTR(str, pos, len) 또는 SUBSTRING(str FROM pos FOR len)",
    },
    {
      name: '문자열 길이 (LENGTH)',
      postgresql: "LENGTH(str) 또는 CHAR_LENGTH(str)",
      mysql: "LENGTH(str) -- 바이트, CHAR_LENGTH(str) -- 문자",
      oracle: "LENGTH(str) -- 문자, LENGTHB(str) -- 바이트",
      sqlite: "LENGTH(str)",
      mssql: "LEN(str) -- 후행공백 제외, DATALENGTH(str) -- 바이트",
      vertica: "LENGTH(str) 또는 CHAR_LENGTH(str)",
      mariadb: "LENGTH(str) -- 바이트, CHAR_LENGTH(str) -- 문자",
      redshift: "LEN(str) 또는 LENGTH(str) 또는 CHAR_LENGTH(str)",
      bigquery: "LENGTH(str) -- 문자, BYTE_LENGTH(str) -- 바이트",
      snowflake: "LENGTH(str) 또는 LEN(str)",
      hive: "LENGTH(str)",
      presto: "LENGTH(str)",
      clickhouse: "length(str) -- 바이트, lengthUTF8(str) -- 문자",
      db2: "LENGTH(str) -- 바이트, CHAR_LENGTH(str) -- 문자",
      teradata: "CHARACTER_LENGTH(str) 또는 CHAR_LENGTH(str)",
    },
    {
      name: '대문자 변환 (UPPER)',
      postgresql: "UPPER(str)",
      mysql: "UPPER(str) 또는 UCASE(str)",
      oracle: "UPPER(str)",
      sqlite: "UPPER(str)",
      mssql: "UPPER(str)",
      vertica: "UPPER(str)",
      mariadb: "UPPER(str) 또는 UCASE(str)",
      redshift: "UPPER(str)",
      bigquery: "UPPER(str)",
      snowflake: "UPPER(str)",
      hive: "UPPER(str) 또는 UCASE(str)",
      presto: "UPPER(str)",
      clickhouse: "upper(str)",
      db2: "UPPER(str) 또는 UCASE(str)",
      teradata: "UPPER(str)",
    },
    {
      name: '소문자 변환 (LOWER)',
      postgresql: "LOWER(str)",
      mysql: "LOWER(str) 또는 LCASE(str)",
      oracle: "LOWER(str)",
      sqlite: "LOWER(str)",
      mssql: "LOWER(str)",
      vertica: "LOWER(str)",
      mariadb: "LOWER(str) 또는 LCASE(str)",
      redshift: "LOWER(str)",
      bigquery: "LOWER(str)",
      snowflake: "LOWER(str)",
      hive: "LOWER(str) 또는 LCASE(str)",
      presto: "LOWER(str)",
      clickhouse: "lower(str)",
      db2: "LOWER(str) 또는 LCASE(str)",
      teradata: "LOWER(str)",
    },
    {
      name: '공백 제거 (TRIM)',
      postgresql: "TRIM(str), LTRIM(str), RTRIM(str)",
      mysql: "TRIM(str), LTRIM(str), RTRIM(str)",
      oracle: "TRIM(str), LTRIM(str), RTRIM(str)",
      sqlite: "TRIM(str), LTRIM(str), RTRIM(str)",
      mssql: "TRIM(str), LTRIM(str), RTRIM(str)",
      vertica: "TRIM(str), LTRIM(str), RTRIM(str)",
      mariadb: "TRIM(str), LTRIM(str), RTRIM(str)",
      redshift: "TRIM(str), LTRIM(str), RTRIM(str)",
      bigquery: "TRIM(str), LTRIM(str), RTRIM(str)",
      snowflake: "TRIM(str), LTRIM(str), RTRIM(str)",
      hive: "TRIM(str), LTRIM(str), RTRIM(str)",
      presto: "TRIM(str), LTRIM(str), RTRIM(str)",
      clickhouse: "trim(str), trimLeft(str), trimRight(str)",
      db2: "STRIP(str) 또는 TRIM(str), LTRIM(str), RTRIM(str)",
      teradata: "TRIM(str), TRIM(LEADING FROM str), TRIM(TRAILING FROM str)",
    },
    {
      name: '문자열 치환 (REPLACE)',
      postgresql: "REPLACE(str, from, to)",
      mysql: "REPLACE(str, from, to)",
      oracle: "REPLACE(str, from, to)",
      sqlite: "REPLACE(str, from, to)",
      mssql: "REPLACE(str, from, to)",
      vertica: "REPLACE(str, from, to)",
      mariadb: "REPLACE(str, from, to)",
      redshift: "REPLACE(str, from, to)",
      bigquery: "REPLACE(str, from, to)",
      snowflake: "REPLACE(str, from, to)",
      hive: "REGEXP_REPLACE(str, pattern, replacement) — REPLACE 미지원, TRANSLATE 사용",
      presto: "REPLACE(str, from, to)",
      clickhouse: "replaceAll(str, from, to)",
      db2: "REPLACE(str, from, to)",
      teradata: "OREPLACE(str, from, to)",
    },
    {
      name: '문자열 패딩 (LPAD/RPAD)',
      postgresql: "LPAD(str, len, fill), RPAD(str, len, fill)",
      mysql: "LPAD(str, len, fill), RPAD(str, len, fill)",
      oracle: "LPAD(str, len, fill), RPAD(str, len, fill)",
      sqlite: "미지원 — printf('%05d', val) 또는 substr('0000'||val, -5) 우회",
      mssql: "미지원 — RIGHT(REPLICATE('0', len) + str, len) 우회",
      vertica: "LPAD(str, len, fill), RPAD(str, len, fill)",
      mariadb: "LPAD(str, len, fill), RPAD(str, len, fill)",
      redshift: "LPAD(str, len, fill), RPAD(str, len, fill)",
      bigquery: "LPAD(str, len, fill), RPAD(str, len, fill)",
      snowflake: "LPAD(str, len, fill), RPAD(str, len, fill)",
      hive: "LPAD(str, len, fill), RPAD(str, len, fill)",
      presto: "LPAD(str, len, fill), RPAD(str, len, fill)",
      clickhouse: "leftPad(str, len, fill), rightPad(str, len, fill)",
      db2: "LPAD(str, len, fill), RPAD(str, len, fill)  -- 11.1+",
      teradata: "LPAD(str, len, fill), RPAD(str, len, fill)  -- 14+",
    },
    {
      name: '문자열 위치 (POSITION/INSTR)',
      postgresql: "POSITION(sub IN str) 또는 STRPOS(str, sub)",
      mysql: "LOCATE(sub, str) 또는 INSTR(str, sub)",
      oracle: "INSTR(str, sub)",
      sqlite: "INSTR(str, sub)",
      mssql: "CHARINDEX(sub, str)",
      vertica: "POSITION(sub IN str) 또는 INSTR(str, sub)",
      mariadb: "LOCATE(sub, str) 또는 INSTR(str, sub)",
      redshift: "POSITION(sub IN str) 또는 STRPOS(str, sub) 또는 CHARINDEX(sub, str)",
      bigquery: "STRPOS(str, sub) — 1-based, 없으면 0",
      snowflake: "POSITION(sub IN str) 또는 CHARINDEX(sub, str)",
      hive: "INSTR(str, sub) 또는 LOCATE(sub, str)",
      presto: "STRPOS(str, sub)",
      clickhouse: "position(str, sub) 또는 positionUTF8(str, sub)",
      db2: "POSSTR(str, sub) 또는 LOCATE(sub, str)",
      teradata: "POSITION(sub IN str) 또는 INDEX(str, sub)",
    },
    {
      name: '문자열 반복 (REPEAT)',
      postgresql: "REPEAT(str, n)",
      mysql: "REPEAT(str, n)",
      oracle: "RPAD(str, LENGTH(str)*n, str)",
      sqlite: "미지원 — replace(zeroblob(n), x'00', str) 우회",
      mssql: "REPLICATE(str, n)",
      vertica: "REPEAT(str, n)",
      mariadb: "REPEAT(str, n)",
      redshift: "REPEAT(str, n)",
      bigquery: "REPEAT(str, n)",
      snowflake: "REPEAT(str, n)",
      hive: "REPEAT(str, n)",
      presto: "미지원 — LPAD 또는 ARRAY + REDUCE 우회",
      clickhouse: "repeat(str, n)",
      db2: "REPEAT(str, n)",
      teradata: "미지원 — LPAD 우회: SUBSTR(LPAD(' ', n*LENGTH(str)+1, str), 2)",
    },
    {
      name: '문자열 뒤집기 (REVERSE)',
      postgresql: "REVERSE(str)",
      mysql: "REVERSE(str)",
      oracle: "REVERSE(str)",
      sqlite: "미지원",
      mssql: "REVERSE(str)",
      vertica: "미지원 — UDF 필요",
      mariadb: "REVERSE(str)",
      redshift: "REVERSE(str)",
      bigquery: "REVERSE(str)",
      snowflake: "REVERSE(str)",
      hive: "REVERSE(str)",
      presto: "REVERSE(str)",
      clickhouse: "reverse(str) — 바이트 단위, reverseUTF8(str) — 문자 단위",
      db2: "REVERSE(str)  -- 11.1+",
      teradata: "미지원 — UDF 또는 재귀 쿼리 우회",
    },
    {
      name: '정규식 매칭',
      postgresql: "str ~ pattern, REGEXP_MATCHES(str, pattern)",
      mysql: "str REGEXP pattern, REGEXP_LIKE(str, pattern)",
      oracle: "REGEXP_LIKE(str, pattern)",
      sqlite: "미지원 (확장 필요)",
      mssql: "미지원 (CLR 또는 LIKE 패턴 우회)",
      vertica: "REGEXP_LIKE(str, pattern)",
      mariadb: "str REGEXP pattern, REGEXP_LIKE(str, pattern)  -- 10.0.5+",
      redshift: "str ~ pattern, REGEXP_INSTR(str, pattern)",
      bigquery: "REGEXP_CONTAINS(str, pattern)",
      snowflake: "REGEXP_LIKE(str, pattern) 또는 RLIKE(str, pattern)",
      hive: "str RLIKE pattern 또는 str REGEXP pattern",
      presto: "REGEXP_LIKE(str, pattern)",
      clickhouse: "match(str, pattern) — RE2 정규식",
      db2: "REGEXP_LIKE(str, pattern)  -- 11.1+",
      teradata: "REGEXP_SIMILAR(str, pattern)",
    },
    {
      name: '정규식 치환',
      postgresql: "REGEXP_REPLACE(str, pattern, replacement)",
      mysql: "REGEXP_REPLACE(str, pattern, replacement)  -- 8.0+",
      oracle: "REGEXP_REPLACE(str, pattern, replacement)",
      sqlite: "미지원",
      mssql: "미지원 (CLR 함수 필요)",
      vertica: "REGEXP_REPLACE(str, pattern, replacement)",
      mariadb: "REGEXP_REPLACE(str, pattern, replacement)  -- 10.0.5+",
      redshift: "REGEXP_REPLACE(str, pattern, replacement)",
      bigquery: "REGEXP_REPLACE(str, pattern, replacement)",
      snowflake: "REGEXP_REPLACE(str, pattern, replacement)",
      hive: "REGEXP_REPLACE(str, pattern, replacement)",
      presto: "REGEXP_REPLACE(str, pattern, replacement)",
      clickhouse: "replaceRegexpAll(str, pattern, replacement)",
      db2: "REGEXP_REPLACE(str, pattern, replacement)  -- 11.1+",
      teradata: "REGEXP_REPLACE(str, pattern, replacement)  -- 14+",
    },
  ],

  // ── 날짜/시간 함수 ──
  datetime: [
    {
      name: '현재 시각 (NOW)',
      postgresql: "NOW() 또는 CURRENT_TIMESTAMP",
      mysql: "NOW() 또는 CURRENT_TIMESTAMP",
      oracle: "SYSDATE (날짜), SYSTIMESTAMP (타임스탬프)",
      sqlite: "datetime('now') 또는 CURRENT_TIMESTAMP",
      mssql: "GETDATE() 또는 SYSDATETIME()",
      vertica: "NOW() 또는 CURRENT_TIMESTAMP 또는 GETDATE()",
      mariadb: "NOW() 또는 CURRENT_TIMESTAMP",
      redshift: "GETDATE() 또는 SYSDATE 또는 CURRENT_TIMESTAMP",
      bigquery: "CURRENT_TIMESTAMP() 또는 CURRENT_DATETIME()",
      snowflake: "CURRENT_TIMESTAMP() 또는 SYSDATE()",
      hive: "CURRENT_TIMESTAMP 또는 from_unixtime(unix_timestamp())",
      presto: "NOW() 또는 CURRENT_TIMESTAMP",
      clickhouse: "now() 또는 NOW()",
      db2: "CURRENT TIMESTAMP",
      teradata: "CURRENT_TIMESTAMP",
    },
    {
      name: '현재 날짜 (CURRENT_DATE)',
      postgresql: "CURRENT_DATE",
      mysql: "CURDATE() 또는 CURRENT_DATE",
      oracle: "TRUNC(SYSDATE)",
      sqlite: "date('now')",
      mssql: "CAST(GETDATE() AS DATE)",
      vertica: "CURRENT_DATE",
      mariadb: "CURDATE() 또는 CURRENT_DATE",
      redshift: "CURRENT_DATE 또는 TRUNC(GETDATE())",
      bigquery: "CURRENT_DATE()",
      snowflake: "CURRENT_DATE()",
      hive: "CURRENT_DATE",
      presto: "CURRENT_DATE",
      clickhouse: "today() 또는 CURRENT_DATE",
      db2: "CURRENT DATE",
      teradata: "CURRENT_DATE",
    },
    {
      name: '날짜 더하기 (DATE_ADD)',
      postgresql: "date + INTERVAL '7 days' 또는 date + 7",
      mysql: "DATE_ADD(date, INTERVAL 7 DAY)",
      oracle: "date + 7 (일), ADD_MONTHS(date, n)",
      sqlite: "date(d, '+7 days')",
      mssql: "DATEADD(DAY, 7, date)",
      vertica: "TIMESTAMPADD(DAY, 7, date) 또는 date + INTERVAL '7 days'",
      mariadb: "DATE_ADD(date, INTERVAL 7 DAY) 또는 date + INTERVAL 7 DAY",
      redshift: "DATEADD(DAY, 7, date) 또는 date + INTERVAL '7 days'",
      bigquery: "DATE_ADD(date, INTERVAL 7 DAY) 또는 TIMESTAMP_ADD(ts, INTERVAL 7 DAY)",
      snowflake: "DATEADD(DAY, 7, date) 또는 date + INTERVAL '7 DAY'",
      hive: "DATE_ADD(date, 7)  -- 일 수만",
      presto: "date_add('day', 7, date)",
      clickhouse: "addDays(date, 7), addMonths(date, n)",
      db2: "date + 7 DAYS 또는 date + 3 MONTHS",
      teradata: "date + INTERVAL '7' DAY 또는 ADD_MONTHS(date, n)",
    },
    {
      name: '날짜 차이 (DATEDIFF)',
      postgresql: "date1 - date2 (일 수), AGE(date1, date2)",
      mysql: "DATEDIFF(date1, date2)  -- 일 수만",
      oracle: "date1 - date2 (일 수), MONTHS_BETWEEN(d1, d2)",
      sqlite: "julianday(d1) - julianday(d2)",
      mssql: "DATEDIFF(DAY, date2, date1)",
      vertica: "DATEDIFF('day', date2, date1) 또는 TIMESTAMPDIFF(DAY, date2, date1)",
      mariadb: "DATEDIFF(date1, date2) 또는 TIMESTAMPDIFF(DAY, date2, date1)",
      redshift: "DATEDIFF(DAY, date2, date1)",
      bigquery: "DATE_DIFF(date1, date2, DAY) 또는 TIMESTAMP_DIFF(ts1, ts2, DAY)",
      snowflake: "DATEDIFF(DAY, date2, date1)",
      hive: "DATEDIFF(date1, date2)  -- 일 수만",
      presto: "date_diff('day', date2, date1)",
      clickhouse: "dateDiff('day', date2, date1)",
      db2: "DAYS(date1) - DAYS(date2) 또는 TIMESTAMPDIFF(16, CHAR(ts1 - ts2))",
      teradata: "date1 - date2 (INTEGER 일수 반환) 또는 MONTHS_BETWEEN(d1, d2)",
    },
    {
      name: '날짜 포맷 (DATE_FORMAT)',
      postgresql: "TO_CHAR(date, 'YYYY-MM-DD')",
      mysql: "DATE_FORMAT(date, '%Y-%m-%d')",
      oracle: "TO_CHAR(date, 'YYYY-MM-DD')",
      sqlite: "strftime('%Y-%m-%d', date)",
      mssql: "FORMAT(date, 'yyyy-MM-dd') 또는 CONVERT(VARCHAR, date, 23)",
      vertica: "TO_CHAR(date, 'YYYY-MM-DD')",
      mariadb: "DATE_FORMAT(date, '%Y-%m-%d')",
      redshift: "TO_CHAR(date, 'YYYY-MM-DD')",
      bigquery: "FORMAT_DATE('%Y-%m-%d', date) 또는 FORMAT_TIMESTAMP('%Y-%m-%d', ts)",
      snowflake: "TO_CHAR(date, 'YYYY-MM-DD') 또는 TO_VARCHAR(date, 'YYYY-MM-DD')",
      hive: "DATE_FORMAT(date, 'yyyy-MM-dd')  -- Java SimpleDateFormat",
      presto: "DATE_FORMAT(date, '%Y-%m-%d')  -- MySQL 호환 포맷",
      clickhouse: "formatDateTime(date, '%Y-%m-%d')",
      db2: "TO_CHAR(date, 'YYYY-MM-DD') 또는 VARCHAR_FORMAT(date, 'YYYY-MM-DD')",
      teradata: "TO_CHAR(date, 'YYYY-MM-DD') 또는 CAST(date AS FORMAT 'YYYY-MM-DD')",
    },
    {
      name: '날짜 부분 추출 (EXTRACT)',
      postgresql: "EXTRACT(YEAR FROM date)",
      mysql: "EXTRACT(YEAR FROM date) 또는 YEAR(date)",
      oracle: "EXTRACT(YEAR FROM date)",
      sqlite: "strftime('%Y', date) -- 문자열 반환, CAST 필요",
      mssql: "DATEPART(YEAR, date) 또는 YEAR(date)",
      vertica: "EXTRACT(YEAR FROM date) 또는 DATE_PART('year', date)",
      mariadb: "EXTRACT(YEAR FROM date) 또는 YEAR(date)",
      redshift: "EXTRACT(YEAR FROM date) 또는 DATE_PART('year', date)",
      bigquery: "EXTRACT(YEAR FROM date)",
      snowflake: "EXTRACT(YEAR FROM date) 또는 DATE_PART('YEAR', date) 또는 YEAR(date)",
      hive: "YEAR(date), MONTH(date), DAY(date) 또는 EXTRACT(YEAR FROM date)",
      presto: "EXTRACT(YEAR FROM date) 또는 YEAR(date)",
      clickhouse: "toYear(date), toMonth(date), toDayOfMonth(date)",
      db2: "EXTRACT(YEAR FROM date) 또는 YEAR(date)",
      teradata: "EXTRACT(YEAR FROM date)",
    },
    {
      name: '날짜 잘라내기 (DATE_TRUNC)',
      postgresql: "DATE_TRUNC('month', date)",
      mysql: "DATE_FORMAT(date, '%Y-%m-01')  -- 월 초",
      oracle: "TRUNC(date, 'MM')",
      sqlite: "date(d, 'start of month')",
      mssql: "DATETRUNC(MONTH, date)  -- 2022+, 이전: DATEADD(MONTH, DATEDIFF(MONTH,0,date), 0)",
      vertica: "DATE_TRUNC('month', date)",
      mariadb: "DATE_FORMAT(date, '%Y-%m-01') 또는 DATE(date - INTERVAL (DAY(date)-1) DAY)",
      redshift: "DATE_TRUNC('month', date)",
      bigquery: "DATE_TRUNC(date, MONTH) 또는 TIMESTAMP_TRUNC(ts, MONTH)",
      snowflake: "DATE_TRUNC('MONTH', date)",
      hive: "TRUNC(date, 'MM')  -- Hive 2.1+",
      presto: "DATE_TRUNC('month', date)",
      clickhouse: "toStartOfMonth(date), toStartOfYear(date), toMonday(date)",
      db2: "TRUNC_TIMESTAMP(ts, 'MM') 또는 DATE(YEAR(date)||'-'||MONTH(date)||'-01')",
      teradata: "TRUNC(date, 'MM') 또는 date - EXTRACT(DAY FROM date) + 1",
    },
    {
      name: '문자열→날짜 변환 (STR_TO_DATE)',
      postgresql: "TO_DATE('2024-01-15', 'YYYY-MM-DD')",
      mysql: "STR_TO_DATE('2024-01-15', '%Y-%m-%d')",
      oracle: "TO_DATE('2024-01-15', 'YYYY-MM-DD')",
      sqlite: "date('2024-01-15')  -- ISO 형식만",
      mssql: "CAST('2024-01-15' AS DATE) 또는 CONVERT(DATE, '2024-01-15', 23)",
      vertica: "TO_DATE('2024-01-15', 'YYYY-MM-DD') 또는 CAST('2024-01-15' AS DATE)",
      mariadb: "STR_TO_DATE('2024-01-15', '%Y-%m-%d')",
      redshift: "TO_DATE('2024-01-15', 'YYYY-MM-DD') 또는 CAST('2024-01-15' AS DATE)",
      bigquery: "PARSE_DATE('%Y-%m-%d', '2024-01-15') 또는 CAST('2024-01-15' AS DATE)",
      snowflake: "TO_DATE('2024-01-15', 'YYYY-MM-DD') 또는 '2024-01-15'::DATE",
      hive: "TO_DATE('2024-01-15') 또는 CAST('2024-01-15' AS DATE)",
      presto: "DATE '2024-01-15' 또는 CAST('2024-01-15' AS DATE)",
      clickhouse: "toDate('2024-01-15') 또는 parseDateTimeBestEffort('2024-01-15')",
      db2: "DATE('2024-01-15') 또는 TO_DATE('2024-01-15', 'YYYY-MM-DD')",
      teradata: "CAST('2024-01-15' AS DATE FORMAT 'YYYY-MM-DD')",
    },
    {
      name: '요일 추출',
      postgresql: "EXTRACT(DOW FROM date) -- 0=일",
      mysql: "DAYOFWEEK(date) -- 1=일, WEEKDAY(date) -- 0=월",
      oracle: "TO_CHAR(date, 'D') -- 1=일",
      sqlite: "strftime('%w', date) -- 0=일",
      mssql: "DATEPART(WEEKDAY, date) -- SET DATEFIRST 의존",
      vertica: "DAYOFWEEK(date) -- 1=일, DAYOFWEEK_ISO(date) -- 1=월",
      mariadb: "DAYOFWEEK(date) -- 1=일, WEEKDAY(date) -- 0=월",
      redshift: "EXTRACT(DOW FROM date) -- 0=일",
      bigquery: "EXTRACT(DAYOFWEEK FROM date) -- 1=일",
      snowflake: "DAYOFWEEK(date) -- 0=일, DAYOFWEEKISO(date) -- 1=월",
      hive: "DAYOFWEEK(date) -- 1=일  (Hive 2.2+)",
      presto: "DAY_OF_WEEK(date) -- 1=월 (ISO)",
      clickhouse: "toDayOfWeek(date) -- 1=월 (ISO), toDayOfWeek(date, 1) -- 1=일",
      db2: "DAYOFWEEK(date) -- 1=일",
      teradata: "TD_DAY_OF_WEEK(date) 또는 EXTRACT(DOW FROM date)",
    },
    {
      name: '타임존 변환',
      postgresql: "timestamp AT TIME ZONE 'Asia/Seoul'",
      mysql: "CONVERT_TZ(dt, '+00:00', '+09:00')",
      oracle: "FROM_TZ(ts, 'UTC') AT TIME ZONE 'Asia/Seoul'",
      sqlite: "datetime(dt, '+9 hours')  -- 수동",
      mssql: "AT TIME ZONE 'Korea Standard Time' (2016+)",
      vertica: "ts AT TIME ZONE 'Asia/Seoul'",
      mariadb: "CONVERT_TZ(dt, '+00:00', '+09:00')",
      redshift: "CONVERT_TIMEZONE('UTC', 'Asia/Seoul', ts)",
      bigquery: "TIMESTAMP(dt, 'Asia/Seoul') 또는 DATETIME(ts, 'Asia/Seoul')",
      snowflake: "CONVERT_TIMEZONE('UTC', 'Asia/Seoul', ts)",
      hive: "FROM_UTC_TIMESTAMP(ts, 'Asia/Seoul'), TO_UTC_TIMESTAMP(ts, 'Asia/Seoul')",
      presto: "ts AT TIME ZONE 'Asia/Seoul'",
      clickhouse: "toTimezone(ts, 'Asia/Seoul')",
      db2: "ts AT TIME ZONE 'Asia/Seoul'  -- 타임존 지원 컬럼 필요",
      teradata: "ts AT TIME ZONE 'Asia/Seoul'  -- TIMESTAMP WITH TIME ZONE 타입 필요",
    },
  ],

  // ── 집계 함수 ──
  aggregate: [
    {
      name: 'COUNT / SUM / AVG / MIN / MAX',
      postgresql: "COUNT(*), SUM(col), AVG(col), MIN(col), MAX(col)",
      mysql: "COUNT(*), SUM(col), AVG(col), MIN(col), MAX(col)",
      oracle: "COUNT(*), SUM(col), AVG(col), MIN(col), MAX(col)",
      sqlite: "COUNT(*), SUM(col), AVG(col), MIN(col), MAX(col)",
      mssql: "COUNT(*), SUM(col), AVG(col), MIN(col), MAX(col)",
      vertica: "COUNT(*), SUM(col), AVG(col), MIN(col), MAX(col)",
      mariadb: "COUNT(*), SUM(col), AVG(col), MIN(col), MAX(col)",
      redshift: "COUNT(*), SUM(col), AVG(col), MIN(col), MAX(col)",
      bigquery: "COUNT(*), SUM(col), AVG(col), MIN(col), MAX(col)",
      snowflake: "COUNT(*), SUM(col), AVG(col), MIN(col), MAX(col)",
      hive: "COUNT(*), SUM(col), AVG(col), MIN(col), MAX(col)",
      presto: "COUNT(*), SUM(col), AVG(col), MIN(col), MAX(col)",
      clickhouse: "count(), sum(col), avg(col), min(col), max(col)",
      db2: "COUNT(*), SUM(col), AVG(col), MIN(col), MAX(col)",
      teradata: "COUNT(*), SUM(col), AVG(col), MIN(col), MAX(col)",
    },
    {
      name: '그룹 문자열 연결 (GROUP_CONCAT)',
      postgresql: "STRING_AGG(col, ', ' ORDER BY col)",
      mysql: "GROUP_CONCAT(col ORDER BY col SEPARATOR ', ')",
      oracle: "LISTAGG(col, ', ') WITHIN GROUP (ORDER BY col)",
      sqlite: "GROUP_CONCAT(col, ', ')  -- ORDER BY 미지원",
      mssql: "STRING_AGG(col, ', ') WITHIN GROUP (ORDER BY col)  -- 2017+",
      vertica: "LISTAGG(col, ', ') WITHIN GROUP (ORDER BY col)",
      mariadb: "GROUP_CONCAT(col ORDER BY col SEPARATOR ', ')",
      redshift: "LISTAGG(col, ', ') WITHIN GROUP (ORDER BY col)",
      bigquery: "STRING_AGG(col, ', ' ORDER BY col)",
      snowflake: "LISTAGG(col, ', ') WITHIN GROUP (ORDER BY col)",
      hive: "CONCAT_WS(', ', COLLECT_LIST(col))  -- 정렬은 SORT_ARRAY 조합",
      presto: "ARRAY_JOIN(ARRAY_AGG(col ORDER BY col), ', ')",
      clickhouse: "groupArray(col) — 배열 반환, arrayStringConcat(groupArray(col), ', ')",
      db2: "LISTAGG(col, ', ') WITHIN GROUP (ORDER BY col)  -- 9.7+",
      teradata: "미지원 — 재귀 CTE 또는 TD_SYSFNLIB.OREPLACE 우회",
    },
    {
      name: '조건부 집계',
      postgresql: "COUNT(*) FILTER (WHERE cond)",
      mysql: "SUM(CASE WHEN cond THEN 1 ELSE 0 END)",
      oracle: "SUM(CASE WHEN cond THEN 1 ELSE 0 END)",
      sqlite: "SUM(CASE WHEN cond THEN 1 ELSE 0 END)",
      mssql: "COUNT(CASE WHEN cond THEN 1 END)",
      vertica: "COUNT(*) FILTER (WHERE cond) 또는 SUM(CASE WHEN cond THEN 1 ELSE 0 END)",
      mariadb: "SUM(CASE WHEN cond THEN 1 ELSE 0 END) 또는 SUM(IF(cond, 1, 0))",
      redshift: "SUM(CASE WHEN cond THEN 1 ELSE 0 END)",
      bigquery: "COUNTIF(cond) 또는 SUM(IF(cond, 1, 0))",
      snowflake: "COUNT_IF(cond) 또는 SUM(CASE WHEN cond THEN 1 ELSE 0 END)",
      hive: "SUM(CASE WHEN cond THEN 1 ELSE 0 END) 또는 COUNT(IF(cond, 1, NULL))",
      presto: "COUNT(*) FILTER (WHERE cond)",
      clickhouse: "countIf(cond), sumIf(col, cond)  -- -If 조합 함수",
      db2: "SUM(CASE WHEN cond THEN 1 ELSE 0 END)",
      teradata: "SUM(CASE WHEN cond THEN 1 ELSE 0 END)",
    },
    {
      name: '중앙값 (MEDIAN)',
      postgresql: "PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY col)",
      mysql: "미지원 — 서브쿼리/변수 우회 필요",
      oracle: "MEDIAN(col) 또는 PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY col)",
      sqlite: "미지원 — 서브쿼리 우회",
      mssql: "PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY col) OVER()",
      vertica: "MEDIAN(col) 또는 PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY col)",
      mariadb: "PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY col) OVER()  -- 10.3.3+",
      redshift: "MEDIAN(col) 또는 PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY col)",
      bigquery: "PERCENTILE_CONT(col, 0.5) OVER() 또는 APPROX_QUANTILES(col, 2)[OFFSET(1)]",
      snowflake: "MEDIAN(col) 또는 PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY col)",
      hive: "PERCENTILE(col, 0.5) 또는 PERCENTILE_APPROX(col, 0.5)",
      presto: "APPROX_PERCENTILE(col, 0.5)",
      clickhouse: "median(col) 또는 quantile(0.5)(col)",
      db2: "MEDIAN(col)  -- 11.1+ 또는 PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY col)",
      teradata: "MEDIAN(col) 또는 PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY col)",
    },
    {
      name: '배열 집계',
      postgresql: "ARRAY_AGG(col ORDER BY col)",
      mysql: "JSON_ARRAYAGG(col)  -- 8.0+",
      oracle: "COLLECT(col)  -- 커스텀 TYPE 필요",
      sqlite: "JSON_GROUP_ARRAY(col)  -- 3.38+",
      mssql: "미지원 — FOR JSON PATH 우회",
      vertica: "미지원 — STRING_AGG 후 파싱 우회",
      mariadb: "JSON_ARRAYAGG(col)  -- 10.5+",
      redshift: "미지원 — LISTAGG 후 파싱 우회",
      bigquery: "ARRAY_AGG(col ORDER BY col)",
      snowflake: "ARRAY_AGG(col) WITHIN GROUP (ORDER BY col)",
      hive: "COLLECT_LIST(col) -- 중복 포함, COLLECT_SET(col) -- 중복 제거",
      presto: "ARRAY_AGG(col ORDER BY col)",
      clickhouse: "groupArray(col)  -- 배열 반환",
      db2: "미지원 — XMLAGG + XMLELEMENT 우회",
      teradata: "미지원 — 재귀 CTE 우회",
    },
  ],

  // ── 조건/NULL 함수 ──
  conditional: [
    {
      name: 'NULL 대체 (COALESCE)',
      postgresql: "COALESCE(a, b, c)",
      mysql: "COALESCE(a, b, c) 또는 IFNULL(a, b)",
      oracle: "COALESCE(a, b, c) 또는 NVL(a, b)",
      sqlite: "COALESCE(a, b, c) 또는 IFNULL(a, b)",
      mssql: "COALESCE(a, b, c) 또는 ISNULL(a, b)",
      vertica: "COALESCE(a, b, c) 또는 NVL(a, b)",
      mariadb: "COALESCE(a, b, c) 또는 IFNULL(a, b)",
      redshift: "COALESCE(a, b, c) 또는 NVL(a, b)",
      bigquery: "COALESCE(a, b, c) 또는 IFNULL(a, b)",
      snowflake: "COALESCE(a, b, c) 또는 NVL(a, b) 또는 IFNULL(a, b)",
      hive: "COALESCE(a, b, c) 또는 NVL(a, b)",
      presto: "COALESCE(a, b, c)",
      clickhouse: "coalesce(a, b, c) 또는 ifNull(a, b)",
      db2: "COALESCE(a, b, c)",
      teradata: "COALESCE(a, b, c) 또는 NVL(a, b)  -- 14+",
    },
    {
      name: 'NULLIF',
      postgresql: "NULLIF(a, b)",
      mysql: "NULLIF(a, b)",
      oracle: "NULLIF(a, b)",
      sqlite: "NULLIF(a, b)",
      mssql: "NULLIF(a, b)",
      vertica: "NULLIF(a, b)",
      mariadb: "NULLIF(a, b)",
      redshift: "NULLIF(a, b)",
      bigquery: "NULLIF(a, b)",
      snowflake: "NULLIF(a, b)",
      hive: "NULLIF(a, b)  -- Hive 2.3+, 이전: IF(a=b, NULL, a)",
      presto: "NULLIF(a, b)",
      clickhouse: "nullIf(a, b)",
      db2: "NULLIF(a, b)",
      teradata: "NULLIF(a, b)",
    },
    {
      name: 'CASE 표현식',
      postgresql: "CASE WHEN cond THEN val ELSE default END",
      mysql: "CASE WHEN cond THEN val ELSE default END",
      oracle: "CASE WHEN cond THEN val ELSE default END, DECODE(expr, v1, r1, ...)",
      sqlite: "CASE WHEN cond THEN val ELSE default END",
      mssql: "CASE WHEN cond THEN val ELSE default END, IIF(cond, true_val, false_val)",
      vertica: "CASE WHEN cond THEN val ELSE default END, DECODE(expr, v1, r1, ...)",
      mariadb: "CASE WHEN cond THEN val ELSE default END",
      redshift: "CASE WHEN cond THEN val ELSE default END, DECODE(expr, v1, r1, ...)",
      bigquery: "CASE WHEN cond THEN val ELSE default END, IF(cond, true_val, false_val)",
      snowflake: "CASE WHEN cond THEN val ELSE default END, DECODE(expr, v1, r1, ...)",
      hive: "CASE WHEN cond THEN val ELSE default END",
      presto: "CASE WHEN cond THEN val ELSE default END",
      clickhouse: "CASE WHEN cond THEN val ELSE default END, multiIf(c1,v1, c2,v2, default)",
      db2: "CASE WHEN cond THEN val ELSE default END, DECODE(expr, v1, r1, ...)  -- 11+",
      teradata: "CASE WHEN cond THEN val ELSE default END",
    },
    {
      name: 'IF / IIF',
      postgresql: "미지원 — CASE 사용",
      mysql: "IF(cond, true_val, false_val)",
      oracle: "미지원 — CASE 또는 DECODE 사용",
      sqlite: "IIF(cond, true_val, false_val)  -- 3.32+",
      mssql: "IIF(cond, true_val, false_val)",
      vertica: "미지원 — CASE 사용",
      mariadb: "IF(cond, true_val, false_val)",
      redshift: "미지원 — CASE 사용",
      bigquery: "IF(cond, true_val, false_val)",
      snowflake: "IFF(cond, true_val, false_val)",
      hive: "IF(cond, true_val, false_val)",
      presto: "IF(cond, true_val, false_val)",
      clickhouse: "if(cond, true_val, false_val), multiIf(c1,v1, c2,v2, default)",
      db2: "미지원 — CASE 사용",
      teradata: "미지원 — CASE 사용",
    },
    {
      name: 'NVL / NVL2 (Oracle 전용)',
      postgresql: "COALESCE(a, b), CASE WHEN a IS NOT NULL THEN x ELSE y END",
      mysql: "IFNULL(a, b), IF(a IS NOT NULL, x, y)",
      oracle: "NVL(a, b), NVL2(a, not_null_val, null_val)",
      sqlite: "IFNULL(a, b)",
      mssql: "ISNULL(a, b)",
      vertica: "NVL(a, b), NVL2(a, not_null_val, null_val)",
      mariadb: "IFNULL(a, b), IF(a IS NOT NULL, x, y)",
      redshift: "NVL(a, b), NVL2(a, not_null_val, null_val)",
      bigquery: "IFNULL(a, b), IF(a IS NOT NULL, x, y)",
      snowflake: "NVL(a, b), NVL2(a, not_null_val, null_val)",
      hive: "NVL(a, b), IF(a IS NOT NULL, x, y)",
      presto: "COALESCE(a, b), IF(a IS NOT NULL, x, y)",
      clickhouse: "ifNull(a, b), if(isNotNull(a), x, y)",
      db2: "COALESCE(a, b), CASE WHEN a IS NOT NULL THEN x ELSE y END",
      teradata: "NVL(a, b)  -- 14+, COALESCE(a, b)",
    },
    {
      name: 'GREATEST / LEAST',
      postgresql: "GREATEST(a, b, c), LEAST(a, b, c)",
      mysql: "GREATEST(a, b, c), LEAST(a, b, c)",
      oracle: "GREATEST(a, b, c), LEAST(a, b, c)",
      sqlite: "MAX(a, b, c), MIN(a, b, c)",
      mssql: "미지원 — CASE 또는 IIF 중첩 우회, 2022+: GREATEST/LEAST",
      vertica: "GREATEST(a, b, c), LEAST(a, b, c)",
      mariadb: "GREATEST(a, b, c), LEAST(a, b, c)",
      redshift: "GREATEST(a, b, c), LEAST(a, b, c)",
      bigquery: "GREATEST(a, b, c), LEAST(a, b, c)",
      snowflake: "GREATEST(a, b, c), LEAST(a, b, c)",
      hive: "GREATEST(a, b, c), LEAST(a, b, c)",
      presto: "GREATEST(a, b, c), LEAST(a, b, c)",
      clickhouse: "greatest(a, b), least(a, b)  -- 2개만, 중첩 필요",
      db2: "GREATEST(a, b, c), LEAST(a, b, c)  -- 11.1+",
      teradata: "미지원 — CASE WHEN 중첩 우회",
    },
  ],

  // ── 타입 변환 함수 ──
  typecast: [
    {
      name: 'CAST',
      postgresql: "CAST(val AS INTEGER) 또는 val::INTEGER",
      mysql: "CAST(val AS SIGNED) 또는 CAST(val AS DECIMAL(10,2))",
      oracle: "CAST(val AS NUMBER)",
      sqlite: "CAST(val AS INTEGER)",
      mssql: "CAST(val AS INT) 또는 CONVERT(INT, val)",
      vertica: "CAST(val AS INTEGER) 또는 val::INTEGER",
      mariadb: "CAST(val AS SIGNED) 또는 CAST(val AS DECIMAL(10,2))",
      redshift: "CAST(val AS INTEGER) 또는 val::INTEGER",
      bigquery: "CAST(val AS INT64), SAFE_CAST(val AS INT64) — 실패 시 NULL",
      snowflake: "CAST(val AS INTEGER) 또는 val::INTEGER 또는 TRY_CAST(val AS INTEGER)",
      hive: "CAST(val AS INT), CAST(val AS DOUBLE)",
      presto: "CAST(val AS INTEGER), TRY_CAST(val AS INTEGER) — 실패 시 NULL",
      clickhouse: "CAST(val, 'Int32') 또는 toInt32(val), toInt32OrNull(val)",
      db2: "CAST(val AS INTEGER)",
      teradata: "CAST(val AS INTEGER)",
    },
    {
      name: '숫자→문자 (TO_CHAR)',
      postgresql: "TO_CHAR(num, 'FM999,999')",
      mysql: "FORMAT(num, 0) 또는 CAST(num AS CHAR)",
      oracle: "TO_CHAR(num, '999,999')",
      sqlite: "CAST(num AS TEXT) 또는 printf('%d', num)",
      mssql: "FORMAT(num, 'N0') 또는 CAST(num AS VARCHAR)",
      vertica: "TO_CHAR(num, '999,999')",
      mariadb: "FORMAT(num, 0) 또는 CAST(num AS CHAR)",
      redshift: "TO_CHAR(num, '999,999') 또는 CAST(num AS VARCHAR)",
      bigquery: "CAST(num AS STRING) 또는 FORMAT('%d', num)",
      snowflake: "TO_CHAR(num, '999,999') 또는 TO_VARCHAR(num)",
      hive: "CAST(num AS STRING)",
      presto: "CAST(num AS VARCHAR) 또는 FORMAT('%d', num)",
      clickhouse: "toString(num) 또는 CAST(num, 'String')",
      db2: "CHAR(num) 또는 VARCHAR_FORMAT(num, '999,999')",
      teradata: "CAST(num AS VARCHAR(20)) 또는 TRIM(num (FORMAT '999,999'))",
    },
    {
      name: '문자→숫자 (TO_NUMBER)',
      postgresql: "TO_NUMBER(str, '999999') 또는 str::NUMERIC",
      mysql: "CAST(str AS DECIMAL(10,2)) 또는 str + 0",
      oracle: "TO_NUMBER(str, '999999')",
      sqlite: "CAST(str AS REAL)",
      mssql: "CAST(str AS DECIMAL(10,2)) 또는 TRY_CAST(str AS DECIMAL(10,2))",
      vertica: "TO_NUMBER(str, '999999') 또는 str::NUMERIC",
      mariadb: "CAST(str AS DECIMAL(10,2)) 또는 str + 0",
      redshift: "CAST(str AS DECIMAL(10,2)) 또는 str::NUMERIC",
      bigquery: "CAST(str AS NUMERIC) 또는 SAFE_CAST(str AS FLOAT64)",
      snowflake: "TO_NUMBER(str, 10, 2) 또는 str::NUMBER(10,2) 또는 TRY_TO_NUMBER(str)",
      hive: "CAST(str AS DOUBLE) 또는 CAST(str AS DECIMAL(10,2))",
      presto: "CAST(str AS DOUBLE) 또는 TRY_CAST(str AS DECIMAL(10,2))",
      clickhouse: "toFloat64(str) 또는 toFloat64OrNull(str)",
      db2: "CAST(str AS DECIMAL(10,2)) 또는 DECFLOAT(str)",
      teradata: "CAST(str AS DECIMAL(10,2))",
    },
    {
      name: 'JSON 값 추출',
      postgresql: "col->>'key' 또는 col->'arr'->0, jsonb_extract_path_text(col, 'key')",
      mysql: "JSON_EXTRACT(col, '$.key') 또는 col->>'$.key'",
      oracle: "JSON_VALUE(col, '$.key')",
      sqlite: "json_extract(col, '$.key') 또는 col->>'$.key'  -- 3.38+",
      mssql: "JSON_VALUE(col, '$.key'), JSON_QUERY(col, '$.arr')",
      vertica: "MAPVALUES(col)['key'] — Flex Table, 또는 JSON 파서 UDx",
      mariadb: "JSON_EXTRACT(col, '$.key') 또는 col->>'$.key'",
      redshift: "JSON_EXTRACT_PATH_TEXT(col, 'key') — 문자열 JSON 컬럼",
      bigquery: "JSON_VALUE(col, '$.key'), JSON_EXTRACT(col, '$.key')",
      snowflake: "col:key::STRING — VARIANT 점 표기, col['key'], GET_PATH(col, 'key')",
      hive: "GET_JSON_OBJECT(col, '$.key')",
      presto: "JSON_EXTRACT_SCALAR(col, '$.key'), JSON_EXTRACT(col, '$.arr')",
      clickhouse: "JSONExtractString(col, 'key'), JSONExtractInt(col, 'key')",
      db2: "JSON_VALUE(col, '$.key')  -- 11.1+",
      teradata: "JSONExtractValue(col, '$.key')  -- 16+",
    },
    {
      name: 'BOOLEAN 처리',
      postgresql: "TRUE/FALSE 네이티브, CAST(val AS BOOLEAN)",
      mysql: "TRUE=1, FALSE=0, CAST 미지원",
      oracle: "미지원 — NUMBER(1) + 0/1, VARCHAR2 + 'Y'/'N'",
      sqlite: "0/1 사용, CAST 미지원",
      mssql: "BIT 타입: 0/1, CAST(val AS BIT)",
      vertica: "TRUE/FALSE 네이티브, BOOLEAN 타입 지원",
      mariadb: "TRUE=1, FALSE=0 (MySQL 호환)",
      redshift: "BOOLEAN 타입 지원, TRUE/FALSE 네이티브",
      bigquery: "BOOL 타입, TRUE/FALSE 네이티브",
      snowflake: "BOOLEAN 타입, TRUE/FALSE 네이티브",
      hive: "BOOLEAN 타입, TRUE/FALSE 네이티브",
      presto: "BOOLEAN 타입, TRUE/FALSE 네이티브",
      clickhouse: "UInt8 타입: 0/1, 또는 Bool 타입 (22.x+)",
      db2: "BOOLEAN 타입 (11.1+), 이전: SMALLINT 0/1",
      teradata: "미지원 — BYTEINT 0/1 관행",
    },
  ],

  // ── 수학 함수 ──
  math: [
    {
      name: '반올림 (ROUND)',
      postgresql: "ROUND(num, 2)",
      mysql: "ROUND(num, 2)",
      oracle: "ROUND(num, 2)",
      sqlite: "ROUND(num, 2)",
      mssql: "ROUND(num, 2)",
      vertica: "ROUND(num, 2)",
      mariadb: "ROUND(num, 2)",
      redshift: "ROUND(num, 2)",
      bigquery: "ROUND(num, 2)",
      snowflake: "ROUND(num, 2)",
      hive: "ROUND(num, 2) 또는 BROUND(num, 2) — 은행가 반올림",
      presto: "ROUND(num, 2)",
      clickhouse: "round(num, 2)",
      db2: "ROUND(num, 2) 또는 DECIMAL(ROUND(num, 2), 10, 2)",
      teradata: "ROUND(num, 2)  -- 14+, 이전: CAST(num AS DECIMAL(10,2))",
    },
    {
      name: '올림/내림 (CEIL/FLOOR)',
      postgresql: "CEIL(num), FLOOR(num)",
      mysql: "CEIL(num), FLOOR(num)",
      oracle: "CEIL(num), FLOOR(num)",
      sqlite: "미지원 — CAST(num+0.5 AS INT) 우회, 또는 ROUND 사용",
      mssql: "CEILING(num), FLOOR(num)",
      vertica: "CEIL(num), FLOOR(num)",
      mariadb: "CEIL(num), FLOOR(num)",
      redshift: "CEIL(num), FLOOR(num)",
      bigquery: "CEIL(num), FLOOR(num)",
      snowflake: "CEIL(num), FLOOR(num)",
      hive: "CEIL(num), FLOOR(num)",
      presto: "CEIL(num), FLOOR(num)",
      clickhouse: "ceil(num), floor(num)",
      db2: "CEIL(num), FLOOR(num)",
      teradata: "미지원 — CASE WHEN 우회: CASE WHEN num > CAST(num AS INT) THEN CAST(num AS INT)+1 ELSE CAST(num AS INT) END",
    },
    {
      name: '절대값 (ABS)',
      postgresql: "ABS(num)",
      mysql: "ABS(num)",
      oracle: "ABS(num)",
      sqlite: "ABS(num)",
      mssql: "ABS(num)",
      vertica: "ABS(num)",
      mariadb: "ABS(num)",
      redshift: "ABS(num)",
      bigquery: "ABS(num)",
      snowflake: "ABS(num)",
      hive: "ABS(num)",
      presto: "ABS(num)",
      clickhouse: "abs(num)",
      db2: "ABS(num)",
      teradata: "ABS(num)",
    },
    {
      name: '나머지 (MOD)',
      postgresql: "MOD(a, b) 또는 a % b",
      mysql: "MOD(a, b) 또는 a % b",
      oracle: "MOD(a, b)",
      sqlite: "a % b",
      mssql: "a % b",
      vertica: "MOD(a, b) 또는 a % b",
      mariadb: "MOD(a, b) 또는 a % b",
      redshift: "MOD(a, b) 또는 a % b",
      bigquery: "MOD(a, b)",
      snowflake: "MOD(a, b) 또는 a % b",
      hive: "a % b 또는 MOD(a, b) — pmod(a, b)는 양수 보장",
      presto: "a % b",
      clickhouse: "modulo(a, b) 또는 a % b",
      db2: "MOD(a, b)",
      teradata: "MOD(a, b) 또는 a MOD b",
    },
    {
      name: '거듭제곱 (POWER)',
      postgresql: "POWER(base, exp)",
      mysql: "POWER(base, exp) 또는 POW(base, exp)",
      oracle: "POWER(base, exp)",
      sqlite: "미지원 — 수학 확장 필요",
      mssql: "POWER(base, exp)",
      vertica: "POWER(base, exp)",
      mariadb: "POWER(base, exp) 또는 POW(base, exp)",
      redshift: "POWER(base, exp) 또는 POW(base, exp)",
      bigquery: "POWER(base, exp) 또는 POW(base, exp)",
      snowflake: "POWER(base, exp) 또는 POW(base, exp)",
      hive: "POWER(base, exp) 또는 POW(base, exp)",
      presto: "POWER(base, exp)",
      clickhouse: "power(base, exp) 또는 pow(base, exp)",
      db2: "POWER(base, exp)",
      teradata: "POWER(base, exp)  -- 14+, 이전: EXP(exp * LN(base))",
    },
    {
      name: '로그 (LOG)',
      postgresql: "LN(num)  -- 자연로그, LOG(base, num)",
      mysql: "LN(num), LOG(num)  -- 자연로그, LOG(base, num)",
      oracle: "LN(num), LOG(base, num)",
      sqlite: "미지원",
      mssql: "LOG(num)  -- 자연로그, LOG(num, base)",
      vertica: "LN(num), LOG(num)  -- 자연로그, LOG10(num)",
      mariadb: "LN(num), LOG(num)  -- 자연로그, LOG(base, num)",
      redshift: "LN(num), LOG(num)  -- 자연로그",
      bigquery: "LN(num), LOG(num, base), LOG10(num)",
      snowflake: "LN(num), LOG(base, num)",
      hive: "LN(num), LOG(base, num), LOG2(num), LOG10(num)",
      presto: "LN(num), LOG(base, num), LOG2(num), LOG10(num)",
      clickhouse: "log(num) — 자연로그, log2(num), log10(num)",
      db2: "LN(num), LOG10(num)",
      teradata: "LN(num), LOG(num)  -- LOG는 상용로그(base 10)",
    },
    {
      name: '랜덤 (RANDOM)',
      postgresql: "RANDOM()  -- -2^63 ~ 2^63, RANDOM() * 100",
      mysql: "RAND()  -- 0~1",
      oracle: "DBMS_RANDOM.VALUE  -- 0~1",
      sqlite: "RANDOM()  -- -9223372036854775808 ~ 9223372036854775807",
      mssql: "RAND()  -- 0~1, NEWID() -- 랜덤 정렬",
      vertica: "RANDOM()  -- 0~1",
      mariadb: "RAND()  -- 0~1",
      redshift: "RANDOM()  -- 0~1",
      bigquery: "RAND()  -- 0~1",
      snowflake: "RANDOM()  -- 정수, UNIFORM(0::FLOAT, 1::FLOAT, RANDOM()) -- 0~1",
      hive: "RAND()  -- 0~1, RAND(seed)",
      presto: "RANDOM()  -- 0~1",
      clickhouse: "rand()  -- UInt32, rand64()  -- UInt64, randUniform(0, 1) -- 0~1 (23.x+)",
      db2: "RAND()  -- 0~1",
      teradata: "RANDOM(low, high)  -- 정수 범위, HASHROW(CURRENT_TIMESTAMP) -- 우회",
    },
  ],

  // ── Window 함수 ──
  window: [
    {
      name: 'ROW_NUMBER',
      postgresql: "ROW_NUMBER() OVER (PARTITION BY col ORDER BY col2)",
      mysql: "ROW_NUMBER() OVER (PARTITION BY col ORDER BY col2)  -- 8.0+",
      oracle: "ROW_NUMBER() OVER (PARTITION BY col ORDER BY col2)",
      sqlite: "ROW_NUMBER() OVER (PARTITION BY col ORDER BY col2)  -- 3.25+",
      mssql: "ROW_NUMBER() OVER (PARTITION BY col ORDER BY col2)",
      vertica: "ROW_NUMBER() OVER (PARTITION BY col ORDER BY col2)",
      mariadb: "ROW_NUMBER() OVER (PARTITION BY col ORDER BY col2)  -- 10.2+",
      redshift: "ROW_NUMBER() OVER (PARTITION BY col ORDER BY col2)",
      bigquery: "ROW_NUMBER() OVER (PARTITION BY col ORDER BY col2)",
      snowflake: "ROW_NUMBER() OVER (PARTITION BY col ORDER BY col2)",
      hive: "ROW_NUMBER() OVER (PARTITION BY col ORDER BY col2)",
      presto: "ROW_NUMBER() OVER (PARTITION BY col ORDER BY col2)",
      clickhouse: "ROW_NUMBER() OVER (PARTITION BY col ORDER BY col2)  -- 22.x+",
      db2: "ROW_NUMBER() OVER (PARTITION BY col ORDER BY col2)",
      teradata: "ROW_NUMBER() OVER (PARTITION BY col ORDER BY col2)",
    },
    {
      name: 'RANK / DENSE_RANK',
      postgresql: "RANK() OVER (...), DENSE_RANK() OVER (...)",
      mysql: "RANK() OVER (...), DENSE_RANK() OVER (...)  -- 8.0+",
      oracle: "RANK() OVER (...), DENSE_RANK() OVER (...)",
      sqlite: "RANK() OVER (...), DENSE_RANK() OVER (...)  -- 3.25+",
      mssql: "RANK() OVER (...), DENSE_RANK() OVER (...)",
      vertica: "RANK() OVER (...), DENSE_RANK() OVER (...)",
      mariadb: "RANK() OVER (...), DENSE_RANK() OVER (...)  -- 10.2+",
      redshift: "RANK() OVER (...), DENSE_RANK() OVER (...)",
      bigquery: "RANK() OVER (...), DENSE_RANK() OVER (...)",
      snowflake: "RANK() OVER (...), DENSE_RANK() OVER (...)",
      hive: "RANK() OVER (...), DENSE_RANK() OVER (...)",
      presto: "RANK() OVER (...), DENSE_RANK() OVER (...)",
      clickhouse: "RANK() OVER (...), DENSE_RANK() OVER (...)  -- 22.x+",
      db2: "RANK() OVER (...), DENSE_RANK() OVER (...)",
      teradata: "RANK() OVER (...), DENSE_RANK() OVER (...) — QUALIFY 절과 조합 권장",
    },
    {
      name: 'LAG / LEAD',
      postgresql: "LAG(col, 1) OVER (ORDER BY col2), LEAD(col, 1) OVER (...)",
      mysql: "LAG(col, 1) OVER (...), LEAD(col, 1) OVER (...)  -- 8.0+",
      oracle: "LAG(col, 1) OVER (...), LEAD(col, 1) OVER (...)",
      sqlite: "LAG(col, 1) OVER (...), LEAD(col, 1) OVER (...)  -- 3.25+",
      mssql: "LAG(col, 1) OVER (...), LEAD(col, 1) OVER (...)",
      vertica: "LAG(col, 1) OVER (...), LEAD(col, 1) OVER (...)",
      mariadb: "LAG(col, 1) OVER (...), LEAD(col, 1) OVER (...)  -- 10.2+",
      redshift: "LAG(col, 1) OVER (...), LEAD(col, 1) OVER (...)",
      bigquery: "LAG(col, 1) OVER (...), LEAD(col, 1) OVER (...)",
      snowflake: "LAG(col, 1) OVER (...), LEAD(col, 1) OVER (...)",
      hive: "LAG(col, 1) OVER (...), LEAD(col, 1) OVER (...)",
      presto: "LAG(col, 1) OVER (...), LEAD(col, 1) OVER (...)",
      clickhouse: "lagInFrame(col, 1) OVER (...), leadInFrame(col, 1) OVER (...)  -- 22.x+",
      db2: "LAG(col, 1) OVER (...), LEAD(col, 1) OVER (...)",
      teradata: "LAG(col, 1) OVER (...), LEAD(col, 1) OVER (...) — RESET WHEN 확장 가능",
    },
    {
      name: 'NTILE',
      postgresql: "NTILE(4) OVER (ORDER BY col)",
      mysql: "NTILE(4) OVER (ORDER BY col)  -- 8.0+",
      oracle: "NTILE(4) OVER (ORDER BY col)",
      sqlite: "NTILE(4) OVER (ORDER BY col)  -- 3.25+",
      mssql: "NTILE(4) OVER (ORDER BY col)",
      vertica: "NTILE(4) OVER (ORDER BY col)",
      mariadb: "NTILE(4) OVER (ORDER BY col)  -- 10.2+",
      redshift: "NTILE(4) OVER (ORDER BY col)",
      bigquery: "NTILE(4) OVER (ORDER BY col)",
      snowflake: "NTILE(4) OVER (ORDER BY col)",
      hive: "NTILE(4) OVER (ORDER BY col)",
      presto: "NTILE(4) OVER (ORDER BY col)",
      clickhouse: "NTILE(4) OVER (ORDER BY col)  -- 22.x+",
      db2: "NTILE(4) OVER (ORDER BY col)",
      teradata: "NTILE(4) OVER (ORDER BY col)  -- 14+, 이전: WIDTH_BUCKET 우회",
    },
    {
      name: '누적 합계 (Running Sum)',
      postgresql: "SUM(col) OVER (ORDER BY col2 ROWS UNBOUNDED PRECEDING)",
      mysql: "SUM(col) OVER (ORDER BY col2 ROWS UNBOUNDED PRECEDING)  -- 8.0+",
      oracle: "SUM(col) OVER (ORDER BY col2 ROWS UNBOUNDED PRECEDING)",
      sqlite: "SUM(col) OVER (ORDER BY col2 ROWS UNBOUNDED PRECEDING)  -- 3.25+",
      mssql: "SUM(col) OVER (ORDER BY col2 ROWS UNBOUNDED PRECEDING)",
      vertica: "SUM(col) OVER (ORDER BY col2 ROWS UNBOUNDED PRECEDING)",
      mariadb: "SUM(col) OVER (ORDER BY col2 ROWS UNBOUNDED PRECEDING)  -- 10.2+",
      redshift: "SUM(col) OVER (ORDER BY col2 ROWS UNBOUNDED PRECEDING)",
      bigquery: "SUM(col) OVER (ORDER BY col2 ROWS UNBOUNDED PRECEDING)",
      snowflake: "SUM(col) OVER (ORDER BY col2 ROWS UNBOUNDED PRECEDING)",
      hive: "SUM(col) OVER (ORDER BY col2 ROWS UNBOUNDED PRECEDING)",
      presto: "SUM(col) OVER (ORDER BY col2 ROWS UNBOUNDED PRECEDING)",
      clickhouse: "SUM(col) OVER (ORDER BY col2 ROWS UNBOUNDED PRECEDING)  -- 22.x+",
      db2: "SUM(col) OVER (ORDER BY col2 ROWS UNBOUNDED PRECEDING)",
      teradata: "SUM(col) OVER (ORDER BY col2 ROWS UNBOUNDED PRECEDING) 또는 CSUM(col, col2)",
    },
    {
      name: 'FIRST_VALUE / LAST_VALUE',
      postgresql: "FIRST_VALUE(col) OVER (...), LAST_VALUE(col) OVER (... ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)",
      mysql: "FIRST_VALUE(col) OVER (...), LAST_VALUE(col) OVER (...)  -- 8.0+",
      oracle: "FIRST_VALUE(col) OVER (...), LAST_VALUE(col) OVER (...)",
      sqlite: "FIRST_VALUE(col) OVER (...), LAST_VALUE(col) OVER (...)  -- 3.25+",
      mssql: "FIRST_VALUE(col) OVER (...), LAST_VALUE(col) OVER (...)",
      vertica: "FIRST_VALUE(col) OVER (...), LAST_VALUE(col) OVER (...)",
      mariadb: "FIRST_VALUE(col) OVER (...), LAST_VALUE(col) OVER (...)  -- 10.2+",
      redshift: "FIRST_VALUE(col) OVER (...), LAST_VALUE(col) OVER (...)",
      bigquery: "FIRST_VALUE(col) OVER (...), LAST_VALUE(col) OVER (...)",
      snowflake: "FIRST_VALUE(col) OVER (...), LAST_VALUE(col) OVER (...)",
      hive: "FIRST_VALUE(col) OVER (...), LAST_VALUE(col) OVER (...)",
      presto: "FIRST_VALUE(col) OVER (...), LAST_VALUE(col) OVER (...)",
      clickhouse: "first_value(col) OVER (...), last_value(col) OVER (...)  -- 22.x+",
      db2: "FIRST_VALUE(col) OVER (...), LAST_VALUE(col) OVER (...)",
      teradata: "FIRST_VALUE(col) OVER (...), LAST_VALUE(col) OVER (...)",
    },
    {
      name: '이동 평균 (Moving Average)',
      postgresql: "AVG(col) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)",
      mysql: "AVG(col) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)  -- 8.0+",
      oracle: "AVG(col) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)",
      sqlite: "AVG(col) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)  -- 3.25+",
      mssql: "AVG(col) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)",
      vertica: "AVG(col) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)",
      mariadb: "AVG(col) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)  -- 10.2+",
      redshift: "AVG(col) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)",
      bigquery: "AVG(col) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)",
      snowflake: "AVG(col) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)",
      hive: "AVG(col) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)",
      presto: "AVG(col) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)",
      clickhouse: "AVG(col) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)  -- 22.x+",
      db2: "AVG(col) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)",
      teradata: "MAVG(col, 7)  -- 전용 함수, 또는 AVG(col) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. QUERY_PATTERNS — 방언별 쿼리 패턴
// ─────────────────────────────────────────────────────────────────────────────

export const QUERY_PATTERNS = [
  {
    name: 'INNER JOIN',
    description: '두 테이블의 일치하는 행만 반환',
    universal: true,
    example: `SELECT o.id, c.name
FROM orders o
INNER JOIN customers c ON o.customer_id = c.id;`,
  },
  {
    name: 'LEFT JOIN',
    description: '왼쪽 테이블의 모든 행 + 오른쪽 일치 행',
    universal: true,
    example: `SELECT c.name, COUNT(o.id) AS order_count
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
GROUP BY c.name;`,
  },
  {
    name: 'FULL OUTER JOIN',
    description: '양쪽 테이블의 모든 행 반환',
    dialectNotes: {
      mysql: 'MySQL은 FULL OUTER JOIN 미지원. LEFT JOIN UNION RIGHT JOIN으로 대체:\nSELECT * FROM a LEFT JOIN b ON a.id=b.id\nUNION\nSELECT * FROM a RIGHT JOIN b ON a.id=b.id;',
      sqlite: 'SQLite 3.39 미만은 미지원. LEFT JOIN UNION으로 대체.',
      mariadb: 'MariaDB도 FULL OUTER JOIN 미지원. MySQL과 동일하게 LEFT+RIGHT JOIN UNION 사용.',
      clickhouse: 'ClickHouse는 FULL OUTER JOIN 미지원. LEFT JOIN UNION ALL RIGHT ANTI JOIN으로 대체.',
      hive: 'Hive FULL OUTER JOIN 지원하나 MapReduce 기반으로 성능 주의.',
    },
    example: `SELECT a.id, b.id
FROM table_a a
FULL OUTER JOIN table_b b ON a.key = b.key;`,
  },
  {
    name: 'SELF JOIN',
    description: '같은 테이블을 자기 자신과 조인 (계층, 비교)',
    universal: true,
    example: `-- 직원과 상사 이름 조회
SELECT e.name AS employee, m.name AS manager
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.id;`,
  },
  {
    name: '서브쿼리 (Subquery)',
    description: 'WHERE, FROM, SELECT 절에서 중첩 쿼리 사용',
    universal: true,
    example: `-- 평균 이상 주문 고객
SELECT name FROM customers
WHERE id IN (
  SELECT customer_id FROM orders
  GROUP BY customer_id
  HAVING SUM(amount) > (SELECT AVG(total) FROM order_summary)
);`,
  },
  {
    name: 'EXISTS / NOT EXISTS',
    description: '서브쿼리 존재 여부 확인 — 대량 데이터에서 IN보다 효율적',
    universal: true,
    example: `-- 주문이 있는 고객만
SELECT c.name FROM customers c
WHERE EXISTS (
  SELECT 1 FROM orders o WHERE o.customer_id = c.id
);`,
  },
  {
    name: 'CTE (Common Table Expression)',
    description: 'WITH 절로 임시 결과셋 정의 — 가독성 향상',
    dialectNotes: {
      mysql: 'MySQL 8.0+ 지원.',
      sqlite: 'SQLite 3.8.3+ 지원.',
      mariadb: 'MariaDB 10.2+ 지원.',
      clickhouse: 'ClickHouse 20.x+ WITH 절 지원. 단, CTE가 매번 물리적으로 실행됨(뷰처럼 인라인).',
      hive: 'Hive 0.13+ CTE 지원.',
    },
    example: `WITH monthly_sales AS (
  SELECT DATE_TRUNC('month', order_date) AS month,
         SUM(amount) AS total
  FROM orders
  GROUP BY 1
)
SELECT month, total,
       LAG(total) OVER (ORDER BY month) AS prev_month
FROM monthly_sales;`,
  },
  {
    name: '재귀 CTE (Recursive CTE)',
    description: '계층형 데이터 조회 (조직도, 카테고리 트리, BOM)',
    dialectNotes: {
      oracle: 'Oracle은 CONNECT BY도 가능: SELECT * FROM emp START WITH manager_id IS NULL CONNECT BY PRIOR id = manager_id;',
      redshift: 'Redshift는 재귀 CTE 미지원. 고정 깊이 셀프조인 또는 Python UDF로 우회.',
      hive: 'Hive는 재귀 CTE 미지원. 고정 깊이 셀프조인으로 대체.',
      presto: 'Presto/Trino는 재귀 CTE 미지원. 고정 깊이 조인 또는 Graph 커넥터 사용.',
      clickhouse: 'ClickHouse는 재귀 CTE 미지원. 딕셔너리 또는 arrayJoin + 반복으로 우회.',
      vertica: 'Vertica는 RECURSIVE 미지원. CONNECT BY 구문 사용:\nSELECT * FROM emp CONNECT BY PRIOR id = manager_id START WITH manager_id IS NULL;',
      db2: 'DB2는 RECURSIVE 키워드 없이 재귀 CTE 지원:\nWITH tree (id, name, lvl) AS (\n  SELECT id, name, 1 FROM emp WHERE mgr IS NULL\n  UNION ALL\n  SELECT e.id, e.name, t.lvl+1 FROM emp e, tree t WHERE e.mgr = t.id\n) SELECT * FROM tree;',
    },
    example: `WITH RECURSIVE org_tree AS (
  SELECT id, name, manager_id, 1 AS depth
  FROM employees WHERE manager_id IS NULL
  UNION ALL
  SELECT e.id, e.name, e.manager_id, t.depth + 1
  FROM employees e
  JOIN org_tree t ON e.manager_id = t.id
)
SELECT * FROM org_tree ORDER BY depth, name;`,
  },
  {
    name: 'Window 함수 — 순위',
    description: 'ROW_NUMBER, RANK, DENSE_RANK로 그룹 내 순위 매기기',
    example: `SELECT department, name, salary,
  ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) AS rn,
  RANK()       OVER (PARTITION BY department ORDER BY salary DESC) AS rnk,
  DENSE_RANK() OVER (PARTITION BY department ORDER BY salary DESC) AS drnk
FROM employees;`,
  },
  {
    name: 'Window 함수 — 이전/다음 행 비교',
    description: 'LAG/LEAD로 이전/다음 행 값과 비교',
    example: `SELECT order_date, amount,
  amount - LAG(amount) OVER (ORDER BY order_date) AS diff_from_prev,
  LEAD(amount) OVER (ORDER BY order_date) AS next_amount
FROM daily_sales;`,
  },
  {
    name: 'PIVOT (행→열 변환)',
    description: '행 데이터를 열로 피벗',
    dialectNotes: {
      postgresql: "PostgreSQL은 PIVOT 미지원. CASE + GROUP BY 또는 crosstab() 사용:\nSELECT year,\n  SUM(CASE WHEN quarter='Q1' THEN revenue END) AS q1,\n  SUM(CASE WHEN quarter='Q2' THEN revenue END) AS q2\nFROM sales GROUP BY year;",
      mysql: "MySQL은 PIVOT 미지원. CASE + GROUP BY 사용.",
      sqlite: "SQLite도 CASE + GROUP BY 사용.",
      oracle: "SELECT * FROM sales_data PIVOT (SUM(revenue) FOR quarter IN ('Q1','Q2','Q3','Q4'));",
      mssql: "SELECT * FROM sales_data PIVOT (SUM(revenue) FOR quarter IN ([Q1],[Q2],[Q3],[Q4])) AS pvt;",
      bigquery: "SELECT * FROM sales_data PIVOT (SUM(revenue) FOR quarter IN ('Q1','Q2','Q3','Q4'));  -- 네이티브 지원",
      snowflake: "SELECT * FROM sales_data PIVOT (SUM(revenue) FOR quarter IN ('Q1','Q2','Q3','Q4'));  -- 네이티브 지원",
      vertica: "Vertica는 PIVOT 미지원. CASE + GROUP BY 사용.",
      mariadb: "MariaDB는 PIVOT 미지원. CASE + GROUP BY 사용.",
      redshift: "Redshift는 PIVOT 미지원. CASE + GROUP BY 사용.",
      hive: "Hive는 PIVOT 미지원. CASE + GROUP BY 사용.",
      presto: "Presto/Trino는 PIVOT 미지원. CASE + GROUP BY 사용.",
      clickhouse: "ClickHouse는 PIVOT 미지원. CASE + GROUP BY 또는 -If 조합함수(sumIf) 사용.",
      db2: "DB2는 PIVOT 미지원. CASE + GROUP BY 또는 DECODE 사용.",
      teradata: "Teradata는 PIVOT 미지원. CASE + GROUP BY 사용.",
    },
    example: `-- 범용 CASE WHEN 방식 (모든 방언)
SELECT year,
  SUM(CASE WHEN quarter = 'Q1' THEN revenue ELSE 0 END) AS q1,
  SUM(CASE WHEN quarter = 'Q2' THEN revenue ELSE 0 END) AS q2,
  SUM(CASE WHEN quarter = 'Q3' THEN revenue ELSE 0 END) AS q3,
  SUM(CASE WHEN quarter = 'Q4' THEN revenue ELSE 0 END) AS q4
FROM quarterly_sales
GROUP BY year;`,
  },
  {
    name: 'UPSERT (INSERT or UPDATE)',
    description: '존재하면 업데이트, 없으면 삽입',
    dialectNotes: {
      postgresql: "INSERT INTO t (id, val) VALUES (1, 'a')\nON CONFLICT (id) DO UPDATE SET val = EXCLUDED.val;",
      mysql: "INSERT INTO t (id, val) VALUES (1, 'a')\nON DUPLICATE KEY UPDATE val = VALUES(val);",
      oracle: "MERGE INTO t USING (SELECT 1 AS id, 'a' AS val FROM dual) s\nON (t.id = s.id)\nWHEN MATCHED THEN UPDATE SET t.val = s.val\nWHEN NOT MATCHED THEN INSERT (id, val) VALUES (s.id, s.val);",
      sqlite: "INSERT INTO t (id, val) VALUES (1, 'a')\nON CONFLICT (id) DO UPDATE SET val = excluded.val;  -- 3.24+",
      mssql: "MERGE INTO t USING (VALUES (1, 'a')) AS s(id, val)\nON t.id = s.id\nWHEN MATCHED THEN UPDATE SET t.val = s.val\nWHEN NOT MATCHED THEN INSERT (id, val) VALUES (s.id, s.val);",
      vertica: "MERGE INTO t USING (SELECT 1 AS id, 'a' AS val) s\nON t.id = s.id\nWHEN MATCHED THEN UPDATE SET val = s.val\nWHEN NOT MATCHED THEN INSERT (id, val) VALUES (s.id, s.val);",
      mariadb: "INSERT INTO t (id, val) VALUES (1, 'a')\nON DUPLICATE KEY UPDATE val = VALUES(val);  -- MySQL 호환",
      redshift: "DELETE + INSERT 조합, 또는 MERGE (2023+ 지원):\nMERGE INTO t USING s ON t.id = s.id\nWHEN MATCHED THEN UPDATE SET val = s.val\nWHEN NOT MATCHED THEN INSERT VALUES (s.id, s.val);",
      bigquery: "MERGE INTO t USING (SELECT 1 AS id, 'a' AS val) s\nON t.id = s.id\nWHEN MATCHED THEN UPDATE SET val = s.val\nWHEN NOT MATCHED THEN INSERT (id, val) VALUES (s.id, s.val);",
      snowflake: "MERGE INTO t USING (SELECT 1 AS id, 'a' AS val) s\nON t.id = s.id\nWHEN MATCHED THEN UPDATE SET val = s.val\nWHEN NOT MATCHED THEN INSERT (id, val) VALUES (s.id, s.val);",
      hive: "MERGE INTO t USING s ON t.id = s.id\nWHEN MATCHED THEN UPDATE SET val = s.val\nWHEN NOT MATCHED THEN INSERT VALUES (s.id, s.val);  -- Hive 2.2+, ACID 테이블만",
      presto: "Presto/Trino UPSERT 미지원. 커넥터에 따라 DELETE+INSERT 우회.",
      clickhouse: "ClickHouse UPSERT 미지원. ReplacingMergeTree + INSERT로 최신 행 유지, FINAL로 조회.",
      db2: "MERGE INTO t USING (VALUES (1, 'a')) AS s(id, val)\nON t.id = s.id\nWHEN MATCHED THEN UPDATE SET val = s.val\nWHEN NOT MATCHED THEN INSERT (id, val) VALUES (s.id, s.val);",
      teradata: "MERGE INTO t USING (SELECT 1 AS id, 'a' AS val) s\nON t.id = s.id\nWHEN MATCHED THEN UPDATE SET val = s.val\nWHEN NOT MATCHED THEN INSERT (s.id, s.val);",
    },
    example: `-- PostgreSQL 예시
INSERT INTO products (sku, name, price)
VALUES ('ABC', '상품A', 10000)
ON CONFLICT (sku)
DO UPDATE SET name = EXCLUDED.name, price = EXCLUDED.price;`,
  },
  {
    name: 'MERGE',
    description: '조건부 INSERT/UPDATE/DELETE를 한 문장으로',
    dialectNotes: {
      postgresql: "PostgreSQL 15+: MERGE INTO 지원. 이전: ON CONFLICT 사용.",
      mysql: "MySQL은 MERGE 미지원. INSERT ... ON DUPLICATE KEY UPDATE 사용.",
      sqlite: "SQLite는 MERGE 미지원. INSERT ... ON CONFLICT 사용.",
      mariadb: "MariaDB는 MERGE 미지원. INSERT ... ON DUPLICATE KEY UPDATE 사용.",
      presto: "Presto/Trino MERGE 미지원 (일부 커넥터에서 제한적 지원).",
      clickhouse: "ClickHouse는 MERGE 미지원. CollapsingMergeTree 또는 ReplacingMergeTree 엔진으로 대체.",
    },
    example: `MERGE INTO target t
USING source s ON t.id = s.id
WHEN MATCHED AND s.deleted = 1 THEN DELETE
WHEN MATCHED THEN UPDATE SET t.val = s.val
WHEN NOT MATCHED THEN INSERT (id, val) VALUES (s.id, s.val);`,
  },
  {
    name: '페이지네이션 (Pagination)',
    description: '결과를 페이지 단위로 나누기',
    dialectNotes: {
      postgresql: "SELECT * FROM t ORDER BY id LIMIT 20 OFFSET 40;",
      mysql: "SELECT * FROM t ORDER BY id LIMIT 20 OFFSET 40;",
      oracle: "SELECT * FROM t ORDER BY id OFFSET 40 ROWS FETCH NEXT 20 ROWS ONLY;  -- 12c+\n이전: SELECT * FROM (SELECT t.*, ROWNUM rn FROM t WHERE ROWNUM <= 60) WHERE rn > 40;",
      sqlite: "SELECT * FROM t ORDER BY id LIMIT 20 OFFSET 40;",
      mssql: "SELECT * FROM t ORDER BY id OFFSET 40 ROWS FETCH NEXT 20 ROWS ONLY;  -- 2012+\n이전: SELECT TOP 20 * FROM (SELECT TOP 60 * FROM t ORDER BY id) sub ORDER BY id;",
      vertica: "SELECT * FROM t ORDER BY id LIMIT 20 OFFSET 40;",
      mariadb: "SELECT * FROM t ORDER BY id LIMIT 20 OFFSET 40;",
      redshift: "SELECT * FROM t ORDER BY id LIMIT 20 OFFSET 40;",
      bigquery: "SELECT * FROM t ORDER BY id LIMIT 20 OFFSET 40;",
      snowflake: "SELECT * FROM t ORDER BY id LIMIT 20 OFFSET 40;",
      hive: "OFFSET 미지원. ROW_NUMBER 우회:\nSELECT * FROM (SELECT *, ROW_NUMBER() OVER (ORDER BY id) rn FROM t) sub WHERE rn BETWEEN 41 AND 60;",
      presto: "SELECT * FROM t ORDER BY id OFFSET 40 LIMIT 20;",
      clickhouse: "SELECT * FROM t ORDER BY id LIMIT 20 OFFSET 40;",
      db2: "SELECT * FROM t ORDER BY id OFFSET 40 ROWS FETCH NEXT 20 ROWS ONLY;",
      teradata: "OFFSET 미지원. QUALIFY + ROW_NUMBER 사용:\nSELECT * FROM t QUALIFY ROW_NUMBER() OVER (ORDER BY id) BETWEEN 41 AND 60;\n또는 TOP/SAMPLE으로 근사.",
    },
    example: `-- 3페이지 (페이지당 20건)
SELECT * FROM products
ORDER BY created_at DESC
LIMIT 20 OFFSET 40;`,
  },
  {
    name: '임시 테이블 / 테이블 변수',
    description: '중간 결과를 임시 저장',
    dialectNotes: {
      postgresql: "CREATE TEMP TABLE tmp AS SELECT ...;\n-- 세션 종료 시 자동 삭제",
      mysql: "CREATE TEMPORARY TABLE tmp AS SELECT ...;",
      oracle: "CREATE GLOBAL TEMPORARY TABLE tmp (...) ON COMMIT PRESERVE ROWS;\nINSERT INTO tmp SELECT ...;",
      sqlite: "CREATE TEMP TABLE tmp AS SELECT ...;",
      mssql: "SELECT ... INTO #tmp FROM ...;\n-- 또는 DECLARE @tbl TABLE (id INT, val VARCHAR(50));",
      vertica: "CREATE LOCAL TEMP TABLE tmp ON COMMIT PRESERVE ROWS AS SELECT ...;",
      mariadb: "CREATE TEMPORARY TABLE tmp AS SELECT ...;",
      redshift: "CREATE TEMP TABLE tmp AS SELECT ...;\n-- 또는 CREATE TEMP TABLE tmp(LIKE source_table);",
      bigquery: "임시 테이블 미지원. WITH CTE 사용 또는 CREATE TABLE ... OPTIONS(expiration_timestamp=...) 설정.",
      snowflake: "CREATE TEMPORARY TABLE tmp AS SELECT ...;\n-- 또는 CREATE TRANSIENT TABLE (세션 간 유지).",
      hive: "CREATE TEMPORARY TABLE tmp AS SELECT ...;  -- Hive 0.14+",
      presto: "임시 테이블 미지원. WITH CTE 또는 커넥터별 CREATE TABLE 사용.",
      clickhouse: "임시 테이블 개념 없음. 세션 스코프: CREATE TABLE tmp ENGINE = Memory AS SELECT ...;\n-- Memory 엔진은 서버 재시작 시 소멸.",
      db2: "DECLARE GLOBAL TEMPORARY TABLE tmp (...) ON COMMIT PRESERVE ROWS;\nINSERT INTO SESSION.tmp SELECT ...;",
      teradata: "CREATE VOLATILE TABLE tmp (...) ON COMMIT PRESERVE ROWS;\n-- 세션 종료 시 자동 삭제. GLOBAL TEMPORARY도 지원.",
    },
    example: `-- PostgreSQL
CREATE TEMP TABLE active_users AS
SELECT id, name FROM users WHERE last_login_at > NOW() - INTERVAL '30 days';

SELECT au.name, COUNT(o.id)
FROM active_users au
JOIN orders o ON au.id = o.user_id
GROUP BY au.name;`,
  },
  {
    name: 'GROUPING SETS / ROLLUP / CUBE',
    description: '다중 레벨 집계를 한 쿼리로',
    dialectNotes: {
      sqlite: 'SQLite는 미지원 — 여러 GROUP BY + UNION ALL로 대체.',
      hive: 'Hive는 GROUPING SETS, ROLLUP, CUBE 모두 지원. GROUPING__ID 함수로 레벨 구분.',
      clickhouse: 'ClickHouse는 ROLLUP/CUBE 지원 (20.x+). GROUPING SETS는 미지원 — UNION ALL로 대체.',
      presto: 'Presto/Trino는 GROUPING SETS, ROLLUP, CUBE 모두 지원.',
    },
    example: `SELECT department, job_title, SUM(salary)
FROM employees
GROUP BY GROUPING SETS (
  (department, job_title),  -- 부서+직급별
  (department),              -- 부서별 소계
  ()                         -- 전체 합계
);`,
  },
  {
    name: '계층형 쿼리 (Hierarchical)',
    description: '트리 구조 데이터 탐색',
    dialectNotes: {
      oracle: "Oracle 전용 구문:\nSELECT LEVEL, id, name, manager_id\nFROM employees\nSTART WITH manager_id IS NULL\nCONNECT BY PRIOR id = manager_id\nORDER SIBLINGS BY name;",
      vertica: "Vertica도 CONNECT BY 지원:\nSELECT CONNECT_BY_ROOT name, LEVEL, name FROM emp\nSTART WITH manager_id IS NULL CONNECT BY PRIOR id = manager_id;",
      hive: "Hive는 재귀 CTE/CONNECT BY 미지원. 고정 깊이 셀프조인으로 구현.",
      clickhouse: "ClickHouse는 재귀 미지원. 미리 계산된 경로 컬럼 또는 딕셔너리 활용.",
    },
    example: `-- 범용 재귀 CTE 방식
WITH RECURSIVE tree AS (
  SELECT id, name, parent_id, name AS path, 0 AS depth
  FROM categories WHERE parent_id IS NULL
  UNION ALL
  SELECT c.id, c.name, c.parent_id,
         tree.path || ' > ' || c.name, tree.depth + 1
  FROM categories c JOIN tree ON c.parent_id = tree.id
)
SELECT * FROM tree ORDER BY path;`,
  },
  {
    name: 'INSERT ... SELECT',
    description: '조회 결과를 다른 테이블에 삽입',
    universal: true,
    example: `INSERT INTO archived_orders (id, customer_id, amount, order_date)
SELECT id, customer_id, amount, order_date
FROM orders
WHERE order_date < '2024-01-01';`,
  },
  {
    name: 'UPDATE with JOIN',
    description: '다른 테이블 참조하여 업데이트',
    dialectNotes: {
      postgresql: "UPDATE orders SET status = 'vip'\nFROM customers c WHERE orders.customer_id = c.id AND c.tier = 'gold';",
      mysql: "UPDATE orders o JOIN customers c ON o.customer_id = c.id\nSET o.status = 'vip' WHERE c.tier = 'gold';",
      oracle: "UPDATE orders SET status = 'vip'\nWHERE customer_id IN (SELECT id FROM customers WHERE tier = 'gold');",
      sqlite: "UPDATE orders SET status = 'vip'\nWHERE customer_id IN (SELECT id FROM customers WHERE tier = 'gold');",
      mssql: "UPDATE o SET o.status = 'vip'\nFROM orders o JOIN customers c ON o.customer_id = c.id\nWHERE c.tier = 'gold';",
      vertica: "UPDATE orders SET status = 'vip'\nFROM customers c WHERE orders.customer_id = c.id AND c.tier = 'gold';  -- PostgreSQL 방식",
      mariadb: "UPDATE orders o JOIN customers c ON o.customer_id = c.id\nSET o.status = 'vip' WHERE c.tier = 'gold';  -- MySQL 호환",
      redshift: "UPDATE orders SET status = 'vip'\nFROM customers c WHERE orders.customer_id = c.id AND c.tier = 'gold';  -- PostgreSQL 방식",
      bigquery: "UPDATE orders SET status = 'vip'\nFROM customers c WHERE orders.customer_id = c.id AND c.tier = 'gold';",
      snowflake: "UPDATE orders SET status = 'vip'\nFROM customers c WHERE orders.customer_id = c.id AND c.tier = 'gold';",
      hive: "Hive UPDATE는 ACID 테이블만 지원. JOIN UPDATE 미지원 — MERGE 또는 INSERT OVERWRITE로 대체.",
      presto: "Presto/Trino UPDATE 미지원 (대부분 커넥터). MERGE 또는 DELETE+INSERT 우회.",
      clickhouse: "ALTER TABLE orders UPDATE status='vip' WHERE customer_id IN\n(SELECT id FROM customers WHERE tier='gold');  -- 비동기 뮤테이션",
      db2: "UPDATE orders SET status = 'vip'\nWHERE customer_id IN (SELECT id FROM customers WHERE tier = 'gold');\n-- 또는 MERGE 사용",
      teradata: "UPDATE orders FROM customers c\nSET status = 'vip'\nWHERE orders.customer_id = c.id AND c.tier = 'gold';  -- Teradata 확장 구문",
    },
    example: `-- PostgreSQL
UPDATE orders
SET status = 'vip'
FROM customers c
WHERE orders.customer_id = c.id AND c.tier = 'gold';`,
  },
  {
    name: 'DELETE with JOIN / Subquery',
    description: '다른 테이블 조건으로 삭제',
    dialectNotes: {
      postgresql: "DELETE FROM orders USING customers c\nWHERE orders.customer_id = c.id AND c.is_deleted = true;",
      mysql: "DELETE o FROM orders o JOIN customers c ON o.customer_id = c.id\nWHERE c.is_deleted = true;",
      oracle: "DELETE FROM orders WHERE customer_id IN\n(SELECT id FROM customers WHERE is_deleted = 1);",
      sqlite: "DELETE FROM orders WHERE customer_id IN\n(SELECT id FROM customers WHERE is_deleted = 1);",
      mssql: "DELETE o FROM orders o JOIN customers c ON o.customer_id = c.id\nWHERE c.is_deleted = 1;",
      vertica: "DELETE FROM orders WHERE customer_id IN\n(SELECT id FROM customers WHERE is_deleted = true);",
      mariadb: "DELETE o FROM orders o JOIN customers c ON o.customer_id = c.id\nWHERE c.is_deleted = true;  -- MySQL 호환",
      redshift: "DELETE FROM orders USING customers c\nWHERE orders.customer_id = c.id AND c.is_deleted = true;  -- PostgreSQL 방식",
      bigquery: "DELETE FROM orders WHERE customer_id IN\n(SELECT id FROM customers WHERE is_deleted = true);",
      snowflake: "DELETE FROM orders USING customers c\nWHERE orders.customer_id = c.id AND c.is_deleted = true;",
      hive: "Hive DELETE는 ACID 테이블만 지원. JOIN DELETE 미지원 — WHERE IN 서브쿼리 또는 INSERT OVERWRITE로 대체.",
      presto: "Presto/Trino DELETE 제한적 (커넥터 의존). WHERE IN 서브쿼리 사용.",
      clickhouse: "ALTER TABLE orders DELETE WHERE customer_id IN\n(SELECT id FROM customers WHERE is_deleted = 1);  -- 비동기 뮤테이션",
      db2: "DELETE FROM orders WHERE customer_id IN\n(SELECT id FROM customers WHERE is_deleted = 1);",
      teradata: "DELETE FROM orders WHERE customer_id IN\n(SELECT id FROM customers WHERE is_deleted = 1);",
    },
    example: `-- 탈퇴 고객의 주문 삭제
DELETE FROM orders
WHERE customer_id IN (
  SELECT id FROM customers WHERE is_deleted = true
);`,
  },
  {
    name: 'LATERAL JOIN / CROSS APPLY',
    description: '행별로 서브쿼리 실행',
    dialectNotes: {
      postgresql: "SELECT d.name, t.* FROM departments d,\nLATERAL (SELECT * FROM employees e WHERE e.dept_id = d.id ORDER BY salary DESC LIMIT 3) t;",
      mysql: "SELECT d.name, t.* FROM departments d,\nLATERAL (SELECT * FROM employees e WHERE e.dept_id = d.id ORDER BY salary DESC LIMIT 3) t;  -- 8.0.14+",
      oracle: "SELECT d.name, t.* FROM departments d,\nLATERAL (SELECT * FROM employees e WHERE e.dept_id = d.id ORDER BY salary DESC FETCH FIRST 3 ROWS ONLY) t;",
      sqlite: "미지원 — 서브쿼리 또는 Window 함수로 대체",
      mssql: "SELECT d.name, t.* FROM departments d\nCROSS APPLY (SELECT TOP 3 * FROM employees e WHERE e.dept_id = d.id ORDER BY salary DESC) t;",
      vertica: "미지원 — Window 함수 + QUALIFY 또는 상관 서브쿼리로 대체.",
      mariadb: "미지원 — Window 함수(ROW_NUMBER + 서브쿼리)로 대체.",
      redshift: "미지원 — Window 함수(ROW_NUMBER)로 대체:\nSELECT * FROM (SELECT d.name, e.*, ROW_NUMBER() OVER (PARTITION BY e.dept_id ORDER BY salary DESC) rn\nFROM departments d JOIN employees e ON d.id = e.dept_id) sub WHERE rn <= 3;",
      bigquery: "미지원 — UNNEST(ARRAY) 패턴 또는 Window 함수로 대체.",
      snowflake: "LATERAL + FLATTEN 조합 가능:\nSELECT d.name, f.value FROM departments d,\nLATERAL FLATTEN(input => d.tags) f;\n-- 일반 LATERAL 서브쿼리도 지원.",
      hive: "미지원 — LATERAL VIEW EXPLODE는 배열/맵 전용. 일반 LATERAL 서브쿼리 미지원. Window 함수로 대체.",
      presto: "CROSS JOIN UNNEST(array) 패턴 지원. 일반 LATERAL 서브쿼리는 Trino 최신 버전에서 일부 지원.",
      clickhouse: "ARRAY JOIN 으로 배열 펼치기 가능. 일반 LATERAL 서브쿼리 미지원.",
      db2: "LATERAL 상관 서브쿼리 지원:\nSELECT d.name, t.* FROM departments d,\nLATERAL (SELECT * FROM employees e WHERE e.dept_id = d.id ORDER BY salary DESC FETCH FIRST 3 ROWS ONLY) t;",
      teradata: "미지원 — QUALIFY + ROW_NUMBER 또는 상관 서브쿼리로 대체.",
    },
    example: `-- 부서별 급여 TOP 3
SELECT d.name AS dept, t.name AS emp, t.salary
FROM departments d,
LATERAL (
  SELECT name, salary FROM employees e
  WHERE e.dept_id = d.id
  ORDER BY salary DESC LIMIT 3
) t;`,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 4. SCHEMA_EXAMPLES — 자주 쓰는 스키마 패턴
// ─────────────────────────────────────────────────────────────────────────────

export const SCHEMA_EXAMPLES = [
  {
    name: '사용자 관리',
    description: '사용자 계정, 역할, 프로필 관리',
    ddl: `CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) DEFAULT 'user',
  department VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_roles (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_name VARCHAR(50) NOT NULL,
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  granted_by INT REFERENCES users(id)
);

CREATE TABLE login_history (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN DEFAULT true
);`,
    sampleQuestions: [
      '최근 30일간 로그인하지 않은 활성 사용자 목록',
      '부서별 사용자 수와 관리자(admin) 비율',
      '로그인 실패가 5회 이상인 사용자',
      '역할이 2개 이상인 사용자와 그 역할 목록',
    ],
  },
  {
    name: '주문/결제',
    description: 'e커머스 주문, 주문상세, 결제 관리',
    ddl: `CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20),
  tier VARCHAR(20) DEFAULT 'standard',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES customers(id),
  order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'pending',
  total_amount DECIMAL(12,2) NOT NULL,
  shipping_address TEXT,
  notes TEXT
);

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INT NOT NULL,
  product_name VARCHAR(200),
  quantity INT NOT NULL CHECK(quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id),
  payment_method VARCHAR(30) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  paid_at TIMESTAMP,
  transaction_id VARCHAR(100)
);`,
    sampleQuestions: [
      '월별 매출 합계와 전월 대비 증감률',
      '가장 많이 주문한 고객 TOP 10',
      '결제 완료되었지만 배송되지 않은 주문',
      '상품별 매출 순위와 전체 매출 대비 비율',
      '평균 주문 금액 이상 주문한 고객과 주문 횟수',
    ],
  },
  {
    name: '재고 관리',
    description: '상품, 재고, 입출고 이력',
    ddl: `CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(100),
  unit_price DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id),
  warehouse_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  min_stock INT DEFAULT 10,
  last_restocked_at TIMESTAMP,
  UNIQUE(product_id, warehouse_id)
);

CREATE TABLE stock_movements (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id),
  warehouse_id INT NOT NULL,
  movement_type VARCHAR(10) NOT NULL CHECK(movement_type IN ('in','out','adjust')),
  quantity INT NOT NULL,
  reference_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT REFERENCES users(id)
);`,
    sampleQuestions: [
      '안전 재고(min_stock) 이하인 상품과 창고 목록',
      '최근 7일간 카테고리별 입출고 수량 합계',
      '재고 회전율이 가장 높은 상품 TOP 5',
      '지난 달 대비 재고 변동이 가장 큰 상품',
    ],
  },
  {
    name: '게시판/커뮤니티',
    description: '게시글, 댓글, 좋아요, 첨부파일',
    ddl: `CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  author_id INT NOT NULL REFERENCES users(id),
  board VARCHAR(50) NOT NULL DEFAULT 'general',
  title VARCHAR(300) NOT NULL,
  content TEXT NOT NULL,
  view_count INT DEFAULT 0,
  is_pinned BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  post_id INT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id INT NOT NULL REFERENCES users(id),
  parent_id INT REFERENCES comments(id),
  content TEXT NOT NULL,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE post_likes (
  post_id INT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE attachments (
  id SERIAL PRIMARY KEY,
  post_id INT REFERENCES posts(id) ON DELETE SET NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INT NOT NULL,
  mime_type VARCHAR(100),
  storage_path TEXT NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`,
    sampleQuestions: [
      '게시판별 글 수, 댓글 수, 평균 조회수',
      '좋아요 수 TOP 10 게시글과 작성자',
      '대댓글(답글)이 가장 많은 댓글 스레드',
      '이번 주 활동이 많은 사용자 (글+댓글 수)',
    ],
  },
  {
    name: '로그/이벤트',
    description: 'API 로그, 사용자 활동 로그, 감사 로그',
    ddl: `CREATE TABLE api_logs (
  id BIGSERIAL PRIMARY KEY,
  request_id UUID DEFAULT gen_random_uuid(),
  user_id INT REFERENCES users(id),
  method VARCHAR(10) NOT NULL,
  path VARCHAR(500) NOT NULL,
  status_code INT,
  response_time_ms INT,
  ip_address INET,
  user_agent TEXT,
  request_body JSONB,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id INT REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100),
  old_value JSONB,
  new_value JSONB,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_logs_created ON api_logs(created_at);
CREATE INDEX idx_api_logs_path ON api_logs(path);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);`,
    sampleQuestions: [
      '시간대별 API 호출 수와 평균 응답 시간',
      '에러율(status_code >= 400)이 높은 엔드포인트 TOP 10',
      '특정 사용자의 감사 로그에서 변경 이력 추적',
      '응답 시간 P99가 1초를 넘는 API 경로',
      '최근 24시간 5xx 에러와 관련 요청 정보',
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 5. OPTIMIZATION_TIPS — SQL 최적화 가이드
// ─────────────────────────────────────────────────────────────────────────────

export const OPTIMIZATION_TIPS = [
  {
    category: '인덱스 전략',
    tips: [
      {
        title: 'WHERE 절 컬럼에 인덱스 생성',
        description: '자주 필터링하는 컬럼에는 B-Tree 인덱스를 생성한다.',
        example: 'CREATE INDEX idx_orders_status ON orders(status);',
        caveat: '카디널리티가 낮은 컬럼(예: boolean, status 3가지)은 효과 적음. 복합 인덱스 고려.',
      },
      {
        title: '복합 인덱스 컬럼 순서',
        description: '선택도(cardinality)가 높은 컬럼을 앞에 배치. WHERE a=? AND b=? 순서와 일치시킨다.',
        example: 'CREATE INDEX idx_orders_customer_date ON orders(customer_id, order_date DESC);',
        caveat: '인덱스 앞부분 컬럼만 사용하는 쿼리도 활용 가능 (prefix 활용).',
      },
      {
        title: 'COVERING INDEX (커버링 인덱스)',
        description: 'SELECT 컬럼까지 인덱스에 포함하면 테이블 접근 없이 인덱스만으로 응답.',
        example: 'CREATE INDEX idx_orders_covering ON orders(customer_id, order_date) INCLUDE (total_amount);  -- PostgreSQL',
        caveat: '인덱스 크기 증가. 자주 조회하는 읽기 위주 쿼리에 적합.',
      },
      {
        title: '부분 인덱스 (Partial Index)',
        description: '특정 조건의 행만 인덱싱하여 크기와 성능 최적화.',
        example: "CREATE INDEX idx_active_users ON users(email) WHERE is_active = true;  -- PostgreSQL\n-- MySQL: 미지원, 생성 컬럼 + 일반 인덱스로 우회",
        caveat: 'PostgreSQL, SQLite 지원. MySQL, Oracle, MSSQL은 직접 미지원.',
      },
      {
        title: 'LIKE 패턴과 인덱스',
        description: "'abc%'는 인덱스 활용 가능, '%abc'는 불가능 (풀스캔).",
        example: "-- 인덱스 활용 O: WHERE name LIKE 'Kim%'\n-- 인덱스 활용 X: WHERE name LIKE '%Kim%'  → FULLTEXT 인덱스 검토",
        caveat: '중간/후방 일치가 필요하면 Full-Text Search 또는 trigram 인덱스(pg_trgm) 사용.',
      },
    ],
  },
  {
    category: 'EXPLAIN 읽는 법',
    tips: [
      {
        title: 'EXPLAIN 기본 사용법',
        description: '실행 계획을 확인하여 쿼리 최적화 포인트를 파악한다.',
        example: "EXPLAIN ANALYZE SELECT * FROM orders WHERE customer_id = 123;\n-- PostgreSQL: EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)\n-- MySQL: EXPLAIN SELECT ... 또는 EXPLAIN ANALYZE SELECT ...\n-- Oracle: EXPLAIN PLAN FOR SELECT ...; SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);\n-- MSSQL: SET STATISTICS IO ON; SET STATISTICS TIME ON;",
        caveat: 'EXPLAIN ANALYZE는 실제 실행하므로 INSERT/UPDATE/DELETE는 트랜잭션 안에서.',
      },
      {
        title: '주요 실행 계획 노드 (PostgreSQL)',
        description: '각 노드의 의미를 이해하면 병목을 찾을 수 있다.',
        example: "Seq Scan: 풀 테이블 스캔 → 인덱스 검토\nIndex Scan: 인덱스 사용 → 양호\nBitmap Index/Heap Scan: 다수 행 인덱스 조회 → 보통\nNested Loop: 소량 조인에 효율적\nHash Join: 중간 규모 조인\nMerge Join: 대량 정렬된 조인\nSort: 정렬 비용 확인 → work_mem 조정 검토",
        caveat: 'cost는 상대적 단위. actual time이 실제 ms. rows와 예측 rows 차이가 크면 통계 갱신(ANALYZE) 필요.',
      },
      {
        title: 'MySQL EXPLAIN 주요 컬럼',
        description: 'type, key, rows, Extra 컬럼을 중점적으로 확인.',
        example: "type: ALL(풀스캔) > index > range > ref > eq_ref > const\nkey: 사용된 인덱스 이름 (NULL이면 인덱스 미사용)\nrows: 예상 스캔 행 수\nExtra: Using index(커버링), Using filesort(정렬), Using temporary(임시테이블)",
        caveat: 'Using filesort, Using temporary가 있으면 최적화 대상.',
      },
    ],
  },
  {
    category: 'N+1 문제 방지',
    tips: [
      {
        title: 'N+1 쿼리 패턴 인식',
        description: '루프 안에서 개별 쿼리를 실행하는 대신 JOIN 또는 IN으로 한 번에 조회.',
        example: "-- N+1 (느림)\nFOR EACH customer:\n  SELECT * FROM orders WHERE customer_id = ?;\n\n-- 개선: JOIN\nSELECT c.*, o.* FROM customers c\nLEFT JOIN orders o ON c.id = o.customer_id;\n\n-- 개선: IN\nSELECT * FROM orders WHERE customer_id IN (1, 2, 3, ...);",
        caveat: 'ORM 사용 시 eager loading / preload 옵션 활용.',
      },
      {
        title: 'BATCH 처리',
        description: '대량 INSERT 시 개별 INSERT 대신 VALUES 목록 또는 COPY 사용.',
        example: "-- 느림: 1000번 INSERT\nINSERT INTO t VALUES (1); INSERT INTO t VALUES (2); ...\n\n-- 빠름: 한 번에 INSERT\nINSERT INTO t VALUES (1), (2), (3), ...;\n\n-- 최고: COPY (PostgreSQL)\nCOPY t FROM '/path/to/data.csv' CSV HEADER;",
        caveat: '한 번에 너무 많은 행을 삽입하면 트랜잭션 로그 부담. 1000~5000행씩 청크.',
      },
    ],
  },
  {
    category: '파티셔닝 가이드',
    tips: [
      {
        title: 'RANGE 파티셔닝',
        description: '날짜 기반 대량 테이블을 월/년 단위로 분할하여 쿼리 성능 향상.',
        example: "-- PostgreSQL\nCREATE TABLE logs (id BIGSERIAL, created_at TIMESTAMP, ...)\nPARTITION BY RANGE (created_at);\n\nCREATE TABLE logs_2024_01 PARTITION OF logs\n  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');\nCREATE TABLE logs_2024_02 PARTITION OF logs\n  FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');",
        caveat: '파티션 키가 WHERE 절에 포함되어야 파티션 프루닝(pruning) 발동.',
      },
      {
        title: 'LIST 파티셔닝',
        description: '카테고리, 지역 등 이산 값으로 분할.',
        example: "CREATE TABLE orders (...) PARTITION BY LIST (region);\nCREATE TABLE orders_asia PARTITION OF orders FOR VALUES IN ('KR','JP','CN');\nCREATE TABLE orders_eu PARTITION OF orders FOR VALUES IN ('DE','FR','GB');",
        caveat: '값 목록이 자주 변경되면 관리 비용 증가.',
      },
      {
        title: '파티셔닝 적용 기준',
        description: '테이블이 수천만 행 이상이고, 쿼리가 특정 범위만 조회할 때 효과적.',
        example: "적용 권장:\n- 로그 테이블 (날짜 범위 조회)\n- 이벤트 테이블 (최근 N일만 조회)\n- 대량 이력 테이블 (아카이빙)\n\n적용 비권장:\n- 전체 데이터를 자주 조회하는 테이블\n- 행 수가 수백만 이하인 테이블",
        caveat: '파티셔닝 후 UNIQUE 제약조건은 파티션 키를 포함해야 함.',
      },
    ],
  },
  {
    category: '쿼리 작성 팁',
    tips: [
      {
        title: 'SELECT * 지양',
        description: '필요한 컬럼만 명시하여 I/O와 네트워크 비용 절감.',
        example: "-- 느림\nSELECT * FROM orders;\n\n-- 빠름\nSELECT id, customer_id, total_amount, order_date FROM orders;",
        caveat: '개발/디버깅 시에는 * 사용 가능하지만, 프로덕션 쿼리에서는 지양.',
      },
      {
        title: 'WHERE 절에서 함수 사용 주의',
        description: '컬럼에 함수를 적용하면 인덱스를 사용할 수 없다.',
        example: "-- 인덱스 무효화\nSELECT * FROM orders WHERE YEAR(order_date) = 2024;\n\n-- 인덱스 활용\nSELECT * FROM orders WHERE order_date >= '2024-01-01' AND order_date < '2025-01-01';",
        caveat: '함수 기반 인덱스(expression index)로 해결 가능하지만, 범위 변환이 우선.',
      },
      {
        title: 'IN vs EXISTS 선택',
        description: '서브쿼리 결과가 소량이면 IN, 대량이면 EXISTS가 효율적.',
        example: "-- 소량 서브쿼리 → IN\nSELECT * FROM orders WHERE customer_id IN (SELECT id FROM vip_customers);\n\n-- 대량 서브쿼리 → EXISTS\nSELECT * FROM orders o WHERE EXISTS (\n  SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.quantity > 100\n);",
        caveat: '최신 옵티마이저는 IN을 세미조인으로 변환하므로 큰 차이 없을 수 있음.',
      },
      {
        title: 'UNION vs UNION ALL',
        description: 'UNION은 중복 제거(정렬 비용), UNION ALL은 그대로 합침.',
        example: "-- 느림 (중복 제거 정렬)\nSELECT name FROM customers UNION SELECT name FROM leads;\n\n-- 빠름 (중복 허용)\nSELECT name FROM customers UNION ALL SELECT name FROM leads;",
        caveat: '중복이 없다고 확신하면 UNION ALL 사용.',
      },
      {
        title: 'COUNT 최적화',
        description: '전체 건수만 필요하면 COUNT(*)가 가장 빠르다.',
        example: "-- 빠름\nSELECT COUNT(*) FROM orders;\n\n-- 불필요하게 느림\nSELECT COUNT(id) FROM orders;  -- NULL 체크 추가\nSELECT COUNT(DISTINCT customer_id) FROM orders;  -- 필요할 때만",
        caveat: 'PostgreSQL에서 큰 테이블 COUNT(*)는 MVCC 특성상 느릴 수 있음. pg_stat 활용 검토.',
      },
      {
        title: '대량 데이터 삭제',
        description: '한 번에 DELETE하면 잠금과 로그 부담. 배치로 나누어 삭제.',
        example: "-- 한 번에 삭제 (위험)\nDELETE FROM logs WHERE created_at < '2023-01-01';\n\n-- 배치 삭제 (권장)\nDELETE FROM logs WHERE id IN (\n  SELECT id FROM logs WHERE created_at < '2023-01-01' LIMIT 10000\n);\n-- 반복 실행",
        caveat: '파티셔닝되어 있으면 파티션 DROP이 가장 빠름.',
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 6. SYSTEM_PROMPT_BUILDER — 시스템 프롬프트 빌드 헬퍼
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 선택된 방언의 함수 매핑을 문자열로 포맷
 */
export function formatFunctionMapping(dialectId) {
  const lines = [];
  for (const [category, mappings] of Object.entries(FUNCTION_MAPPING)) {
    lines.push(`\n### ${category} 함수`);
    for (const fn of mappings) {
      const dialectValue = fn[dialectId];
      if (dialectValue) {
        lines.push(`- ${fn.name}: ${dialectValue}`);
      }
    }
  }
  return lines.join('\n');
}

/**
 * 선택된 방언의 쿼리 패턴을 문자열로 포맷
 */
export function formatQueryPatterns(dialectId) {
  const lines = [];
  for (const pattern of QUERY_PATTERNS) {
    lines.push(`\n#### ${pattern.name}`);
    lines.push(pattern.description);
    if (pattern.dialectNotes?.[dialectId]) {
      lines.push(`[${dialectId} 주의] ${pattern.dialectNotes[dialectId]}`);
    }
    if (pattern.example) {
      lines.push(`예시:\n${pattern.example}`);
    }
  }
  return lines.join('\n');
}

/**
 * 최적화 팁을 문자열로 포맷
 */
export function formatOptimizationTips() {
  const lines = [];
  for (const section of OPTIMIZATION_TIPS) {
    lines.push(`\n## ${section.category}`);
    for (const tip of section.tips) {
      lines.push(`\n### ${tip.title}`);
      lines.push(tip.description);
      if (tip.example) {
        lines.push(`예시:\n${tip.example}`);
      }
      if (tip.caveat) {
        lines.push(`주의: ${tip.caveat}`);
      }
    }
  }
  return lines.join('\n');
}

/**
 * 스키마 예시를 문자열로 포맷
 */
export function formatSchemaExamples() {
  const lines = [];
  for (const schema of SCHEMA_EXAMPLES) {
    lines.push(`\n## ${schema.name} (${schema.description})`);
    lines.push(`DDL:\n${schema.ddl}`);
    lines.push('자주 묻는 질문:');
    for (const q of schema.sampleQuestions) {
      lines.push(`  - ${q}`);
    }
  }
  return lines.join('\n');
}

/**
 * 방언 정보를 문자열로 포맷
 */
export function formatDialectInfo(dialectId) {
  const dialect = DIALECTS.find((d) => d.id === dialectId);
  if (!dialect) return '';
  return [
    `SQL 방언: ${dialect.name} (${dialect.version})`,
    `설명: ${dialect.description}`,
    `주요 기능: ${dialect.features.join(', ')}`,
    `제약사항: ${dialect.limitations.join(', ')}`,
  ].join('\n');
}
