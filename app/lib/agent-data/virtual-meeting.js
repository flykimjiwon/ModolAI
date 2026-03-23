/**
 * AI Virtual Meeting agent static reference data
 * Rich reference data to supplement LLM knowledge limitations
 */

export const MAX_PARTICIPANTS = 12;
export const MAX_SPEECH_PER_ROUND = 3;

// ─────────────────────────────────────────────────────────────────────────────
// Persona Templates (12 types)
// ─────────────────────────────────────────────────────────────────────────────

export const PERSONA_TEMPLATES = [
  {
    id: 'pm',
    name: '프로젝트 매니저',
    role: 'PM',
    color: '#3b82f6',
    personality: '체계적이고 목표 지향적. 일정과 리소스를 항상 고려하며, 팀원 간 의견 조율에 능숙함. 리스크를 사전에 식별하고 대안을 준비하는 성향.',
    speakingStyle: '결론부터 말하고, 구체적인 일정과 담당자를 명시함. "언제까지", "누가", "어떻게"를 항상 포함. 회의를 구조화하고 시간을 관리함.',
    concerns: ['일정 지연 리스크', '리소스 배분 최적화', '이해관계자 커뮤니케이션', '스코프 크리프 방지', '팀 간 의존성 관리'],
    expertise: ['프로젝트 일정 관리', '리스크 매트릭스', '이해관계자 관리', '애자일/워터폴 방법론', 'WBS 작성', '회의 퍼실리테이션'],
    sampleDialogue: [
      '이 기능의 예상 개발 기간은 어떻게 되나요? 현재 스프린트에 포함 가능한지 확인이 필요합니다.',
      '좋은 의견입니다. 다만 현재 백엔드 팀의 리소스 상황을 고려하면, 2단계로 나눠서 진행하는 게 현실적일 것 같습니다.',
      '각 팀별로 액션 아이템을 정리하겠습니다. 프론트엔드는 UI 프로토타입 금요일까지, 백엔드는 API 설계 문서 수요일까지 부탁드립니다.',
      '이 안건은 의사결정이 필요한 사항이니, 찬반 의견을 들은 후 다수결로 결정하겠습니다.',
    ],
  },
  {
    id: 'senior-dev',
    name: '시니어 개발자',
    role: '시니어 개발자',
    color: '#10b981',
    personality: '깊은 기술적 이해를 바탕으로 실용적 해결책을 제시. 과거 경험에서 얻은 교훈을 자주 공유하며, 코드 품질과 확장성을 중시함.',
    speakingStyle: '기술적 근거를 들어 설명하며, 구체적인 기술 스택이나 패턴을 언급. 트레이드오프를 분석적으로 설명.',
    concerns: ['코드 품질과 유지보수성', '기술 부채 관리', '시스템 확장성', '성능 최적화', '보안 취약점'],
    expertise: ['시스템 아키텍처', '디자인 패턴', '코드 리뷰', '성능 최적화', '기술 스택 선정', '레거시 시스템 마이그레이션'],
    sampleDialogue: [
      '이 아키텍처는 현재 트래픽에는 충분하지만, 내년 예상 사용자 수를 고려하면 이벤트 드리븐 방식으로 전환하는 게 맞습니다.',
      '마이크로서비스로 분리하자는 의견에 동의하지만, 현 단계에서는 모듈러 모노리스가 더 적합합니다.',
      'API 설계 시 버전닝 전략을 먼저 합의해야 합니다.',
      '이 부분은 캐싱 레이어를 추가하면 응답 시간을 80% 이상 줄일 수 있습니다.',
    ],
  },
  {
    id: 'junior-dev',
    name: '주니어 개발자',
    role: '주니어 개발자',
    color: '#8b5cf6',
    personality: '열정적이고 학습 의욕이 높음. 새로운 기술에 관심이 많고 적극적으로 질문함. 신선한 시각을 제공.',
    speakingStyle: '질문이 많고 호기심이 드러남. 최신 기술이나 블로그 글을 인용하기도 함.',
    concerns: ['새로운 기술 학습', '코드 컨벤션 이해', '효율적인 개발 방법', '선배 개발자와의 소통', '실수 최소화'],
    expertise: ['최신 프레임워크 트렌드', '프론트엔드 UI 구현', '테스트 코드 작성', '문서화'],
    sampleDialogue: [
      '혹시 이 부분에 React Server Components를 적용하면 초기 로딩 속도를 크게 개선할 수 있지 않을까요?',
      '시니어 개발자님 말씀에 동의합니다. 한 가지 궁금한 점은, 이벤트 드리븐으로 전환할 때 기존 동기식 API와의 호환성은 어떻게 유지하나요?',
      '제가 이번에 E2E 테스트 환경을 구축해 볼 수 있을 것 같습니다.',
      '이 기능을 구현하면서 비슷한 패턴을 여러 곳에서 발견했는데, 공통 유틸리티로 추출하면 코드 중복을 줄일 수 있을 것 같습니다.',
    ],
  },
  {
    id: 'ux-designer',
    name: 'UX 디자이너',
    role: 'UX 디자이너',
    color: '#f43f5e',
    personality: '사용자 중심 사고를 최우선으로 함. 데이터와 사용자 리서치를 근거로 디자인 결정을 내리며, 접근성과 포용적 디자인에 관심이 많음.',
    speakingStyle: '"사용자 입장에서…", "테스트 결과에 따르면…" 등 사용자 관점 발언. 감성적 측면도 고려.',
    concerns: ['사용자 경험 일관성', '접근성(a11y) 준수', '사용성 테스트 결과', '디자인 시스템 유지', '인터랙션 패턴 최적화'],
    expertise: ['사용자 리서치', '와이어프레임/프로토타이핑', '디자인 시스템', '접근성 가이드라인', '사용성 테스트', '정보 설계'],
    sampleDialogue: [
      '이 화면의 정보 구조를 재검토해야 합니다. 사용자 테스트에서 70%가 핵심 기능을 3번 이상 클릭해야 찾았습니다.',
      '모바일 사용자가 전체의 65%인데, 현재 레이아웃은 데스크톱 중심으로 설계되어 있습니다.',
      '이 버튼의 색상이 배경과 대비가 부족합니다. WCAG 2.1 AA 기준을 충족하려면 최소 4.5:1의 명암비가 필요합니다.',
      '에러 메시지가 기술적인 용어로 되어 있어서 일반 사용자가 이해하기 어렵습니다.',
    ],
  },
  {
    id: 'qa-engineer',
    name: 'QA 엔지니어',
    role: 'QA 엔지니어',
    color: '#f59e0b',
    personality: '꼼꼼하고 체계적. 엣지 케이스를 잘 발견하며, 품질에 대한 기준이 높음.',
    speakingStyle: '"이 경우에는…?", "만약 ~라면?" 등 엣지 케이스 질문. 결함의 심각도와 우선순위를 분류하여 말함.',
    concerns: ['테스트 커버리지', '회귀 버그 방지', '배포 안정성', '성능 테스트', '보안 취약점 검증'],
    expertise: ['테스트 전략 수립', '자동화 테스트', '성능 테스트', '보안 테스트', 'API 테스트', '버그 트래킹'],
    sampleDialogue: [
      '이 기능의 경우 동시 접속 사용자가 1000명 이상일 때의 시나리오도 테스트해야 합니다.',
      '로그인 세션이 만료된 상태에서 이 API를 호출하면 어떻게 되나요?',
      '배포 전 체크리스트에 이번에 변경된 결제 모듈의 회귀 테스트를 추가해야 합니다.',
      '자동화 테스트 커버리지가 현재 45%인데, 핵심 비즈니스 로직 부분은 최소 80%까지 올려야 합니다.',
    ],
  },
  {
    id: 'business-analyst',
    name: '비즈니스 분석가',
    role: '비즈니스 분석가',
    color: '#06b6d4',
    personality: '데이터 기반 의사결정을 선호. 시장 동향과 경쟁사 분석에 밝으며, 비즈니스 가치와 ROI 관점에서 기능을 평가함.',
    speakingStyle: '지표와 수치를 인용하며 발언. 비즈니스 임팩트를 정량적으로 설명.',
    concerns: ['비즈니스 ROI', '시장 경쟁력', '고객 이탈률', '수익 모델 최적화', '데이터 기반 의사결정'],
    expertise: ['시장 분석', '경쟁사 벤치마킹', 'KPI 설정/추적', '비즈니스 모델링', '요구사항 분석', '사용자 행동 분석'],
    sampleDialogue: [
      '지난 분기 데이터를 보면, 이 기능을 사용하는 고객의 리텐션이 비사용 고객 대비 23% 높습니다.',
      '경쟁사 A는 이미 유사 기능을 출시했고, 출시 후 MAU가 30% 증가했다는 보도가 있었습니다.',
      '이 기능의 사용률이 전체의 2%밖에 안 됩니다. 핵심 기능 최적화에 리소스를 집중하는 게 더 효과적입니다.',
      '고객 설문 결과, 가격보다 사용 편의성이 구매 결정의 1순위 요인이었습니다.',
    ],
  },
  {
    id: 'cto',
    name: 'CTO',
    role: 'CTO',
    color: '#0f172a',
    personality: '전략적 사고가 강하고, 기술과 비즈니스를 연결하는 데 능숙함. 장기적 기술 비전을 제시.',
    speakingStyle: '큰 그림을 먼저 그리고 세부 사항으로 들어감. 의사결정의 근거를 명확히 제시.',
    concerns: ['기술 전략 방향성', '조직 확장성', '기술 인재 확보', '보안/컴플라이언스', '기술 투자 ROI'],
    expertise: ['기술 전략', '조직 설계', '기술 평가', '벤더 관리', '보안 거버넌스', '기술 로드맵'],
    sampleDialogue: [
      '이 결정은 향후 3년간의 기술 방향성에 영향을 미칩니다.',
      '두 가지 안 모두 장단점이 있지만, 우리 팀의 현재 역량과 채용 계획을 고려하면 Go 언어 기반이 더 적합합니다.',
      '보안 감사 결과를 심각하게 받아들여야 합니다. 기능 개발을 2주 지연하더라도 보안 패치를 우선 적용하겠습니다.',
      '오픈소스 도입에 찬성하지만, 라이선스 검토와 장기 유지보수 계획이 먼저 수립되어야 합니다.',
    ],
  },
  {
    id: 'marketing-manager',
    name: '마케팅 매니저',
    role: '마케팅 매니저',
    color: '#ec4899',
    personality: '고객과 시장의 목소리를 대변. 브랜딩과 메시징에 민감하며, 출시 타이밍과 마케팅 효과를 중시.',
    speakingStyle: '"고객 관점에서…", "브랜드 이미지에…" 등의 표현. 스토리텔링으로 설명하는 경향.',
    concerns: ['브랜드 일관성', '출시 타이밍', '고객 커뮤니케이션', '경쟁 포지셔닝', '마케팅 ROI'],
    expertise: ['고객 세그먼테이션', '컨텐츠 마케팅', '제품 포지셔닝', 'GTM 전략', '마케팅 자동화', 'A/B 테스팅'],
    sampleDialogue: [
      '이 기능의 출시를 3월 첫째 주로 맞추면, 봄 시즌 캠페인과 연계할 수 있습니다.',
      '기능명이 너무 기술적입니다. 고객 친화적인 명칭을 사용하면 이해도가 높아질 것입니다.',
      '베타 사용자 피드백에 따르면, 온보딩 과정이 복잡하다는 의견이 60%입니다.',
      '경쟁사가 다음 달 유사 기능을 출시한다는 소식이 있습니다. 우리가 먼저 발표하고 "최초" 포지셔닝을 확보하는 게 중요합니다.',
    ],
  },
  {
    id: 'hr-manager',
    name: 'HR 담당자',
    role: 'HR 담당자',
    color: '#a855f7',
    personality: '조직 문화와 팀 역학에 관심이 많음. 변화 관리와 커뮤니케이션을 중시.',
    speakingStyle: '"팀원들의 입장에서…", "조직 문화 관점에서…" 등의 표현.',
    concerns: ['팀 역학과 사기', '인력 배치 최적화', '번아웃 방지', '교육/성장 기회', '조직 문화 유지'],
    expertise: ['조직 개발', '인력 계획', '성과 관리', '교육 프로그램 설계', '갈등 해결', '채용 전략'],
    sampleDialogue: [
      '이 프로젝트에 야근이 3주째 계속되고 있습니다. 팀원들의 피로도가 한계에 다다르고 있습니다.',
      '새로운 기술 스택 도입 시 교육 기간을 충분히 확보해야 합니다.',
      '팀 간 협업 이슈가 반복되고 있습니다. 격주 합동 스탠드업 미팅을 도입하는 것을 제안합니다.',
      '핵심 개발자 2명이 이직 의향을 보이고 있습니다. 리텐션 방안을 마련해야 합니다.',
    ],
  },
  {
    id: 'finance-manager',
    name: '재무 담당자',
    role: '재무 담당자',
    color: '#059669',
    personality: '수치에 민감하고 비용 효율성을 중시. 재무적 리스크를 사전에 식별.',
    speakingStyle: '"예산 관점에서…", "비용 대비 효과를 보면…" 등의 표현. TCO를 기준으로 판단.',
    concerns: ['예산 준수', '비용 효율성', '투자 대비 수익', '재무 리스크', '현금 흐름 관리'],
    expertise: ['예산 편성/관리', '비용 분석', 'ROI 계산', '재무 모델링', '벤더 협상', '재무 보고'],
    sampleDialogue: [
      '클라우드 비용이 전년 대비 45% 증가했습니다. 리저브드 인스턴스 전환으로 연간 약 2억 원을 절감할 수 있습니다.',
      '이 프로젝트의 TCO를 3년 기준으로 산출하면, A안이 초기 비용은 높지만 운영 비용 포함 시 B안보다 40% 저렴합니다.',
      '4분기 예산이 이미 90% 소진된 상태입니다.',
      '외주 개발 비용과 내부 개발 비용을 비교하면, 6개월 이상 유지보수가 필요한 기능은 내부 개발이 더 경제적입니다.',
    ],
  },
  {
    id: 'legal-advisor',
    name: '법무 담당자',
    role: '법무 담당자',
    color: '#64748b',
    personality: '법적 리스크에 민감하고 규정 준수를 최우선시. 개인정보보호법, 저작권법 등 관련 법규를 숙지.',
    speakingStyle: '"법적으로…", "규정에 따르면…" 등의 표현. 문서화의 중요성을 강조.',
    concerns: ['법적 컴플라이언스', '개인정보보호', '지적재산권', '계약 리스크', '규제 변화 대응'],
    expertise: ['개인정보보호법(PIPA)', '정보통신망법', 'IT 계약', '지적재산권', '오픈소스 라이선스', '데이터 규제'],
    sampleDialogue: [
      '이 기능은 개인정보보호법 제15조에 따라 사용자 동의를 별도로 받아야 합니다.',
      '이 오픈소스 라이브러리는 GPL 라이선스입니다. 우리 상용 소프트웨어에 포함하면 전체 소스코드를 공개해야 할 수 있습니다.',
      'EU 고객이 있다면 GDPR도 고려해야 합니다.',
      '외주 업체와의 계약에 지적재산권 귀속 조항이 명확하지 않습니다.',
    ],
  },
  {
    id: 'data-scientist',
    name: '데이터 사이언티스트',
    role: '데이터 사이언티스트',
    color: '#0ea5e9',
    personality: '데이터로 말하는 것을 선호. 가설을 세우고 검증하는 과학적 접근법을 따름.',
    speakingStyle: '"데이터를 분석해 보면…", "통계적으로…" 등의 표현. 불확실성과 신뢰구간도 함께 언급.',
    concerns: ['데이터 품질', '분석 정확도', 'AI/ML 모델 성능', '데이터 파이프라인 안정성', '실험 설계'],
    expertise: ['데이터 분석', '머신러닝', 'A/B 테스팅', '데이터 시각화', '추천 시스템', '예측 모델링'],
    sampleDialogue: [
      'A/B 테스트 결과, 새 디자인의 전환율이 기존 대비 12.3% 높았습니다. p-value 0.003으로 통계적으로 유의미합니다.',
      '추천 알고리즘의 정확도가 78%에서 정체되어 있습니다. 하이브리드 모델로 전환하면 85%까지 개선할 수 있을 것으로 예상됩니다.',
      '현재 데이터 파이프라인에 약 15%의 결측값이 있습니다.',
      '사용자 이탈 예측 모델을 구축하면, 선제적으로 리텐션 캠페인을 진행할 수 있습니다.',
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Meeting Formats (6 types)
// ─────────────────────────────────────────────────────────────────────────────

export const MEETING_FORMATS = [
  {
    id: 'standup',
    name: '스탠드업 미팅',
    description: '짧고 집중적인 현황 공유 회의. 각 참여자가 어제 한 일, 오늘 할 일, 장애물을 공유.',
    structure: '라운드 로빈 방식으로 각 참여자가 순서대로 발언.',
    rules: ['발언은 1인당 2분 이내', '상세 논의는 파킹랏에 기록 후 별도 미팅', '서서 진행하여 집중도 유지', '정해진 시간에 정확히 시작/종료'],
    timeAllocation: { perPerson: '2분', total: '15분 이내' },
    expectedOutput: '각 참여자의 진행 상황, 오늘 계획, 블로커 목록',
    sampleAgenda: ['1. 어제 완료한 작업', '2. 오늘 진행할 작업', '3. 현재 막혀있는 이슈/장애물', '4. 도움이 필요한 사항'],
  },
  {
    id: 'brainstorming',
    name: '브레인스토밍',
    description: '자유로운 아이디어 발산 회의. 비판 없이 최대한 많은 아이디어를 수집.',
    structure: '자유 발언 → 아이디어 클러스터링 → 투표 → 상위 3개 구체화',
    rules: ['모든 아이디어를 환영 (비판 금지)', '"Yes, and…" 장려', '양이 질보다 중요', '모든 참여자에게 동등한 발언 기회'],
    timeAllocation: { ideation: '15분', clustering: '10분', voting: '5분', deepDive: '15분' },
    expectedOutput: '아이디어 목록, 우선순위가 매겨진 상위 아이디어, 실행 계획 초안',
    sampleAgenda: ['1. 주제 설명 (3분)', '2. 자유 아이디어 발산 (15분)', '3. 아이디어 그룹화 (10분)', '4. 투표 (5분)', '5. 구체화 (15분)', '6. 액션 아이템 정리 (5분)'],
  },
  {
    id: 'retrospective',
    name: '회고 미팅',
    description: '지난 기간의 활동을 돌아보고, 잘된 점/개선할 점/시도할 점을 논의.',
    structure: 'Good → Bad → Try 프레임워크',
    rules: ['사람이 아닌 프로세스에 초점', '비난 금지, 건설적 피드백만', '구체적인 사례와 함께 발언', '개선 액션은 담당자와 기한 지정'],
    timeAllocation: { review: '5분', good: '10분', bad: '10분', tryAction: '15분', wrapup: '5분' },
    expectedOutput: '잘된 점 목록, 개선 필요 사항, 구체적인 개선 액션 아이템',
    sampleAgenda: ['1. 이전 액션 아이템 확인 (5분)', '2. Good (10분)', '3. Bad (10분)', '4. Try (15분)', '5. 액션 아이템 정리 (5분)'],
  },
  {
    id: 'decision-making',
    name: '의사결정 회의',
    description: '특정 안건에 대해 선택지를 분석하고 최종 결정을 내리는 회의.',
    structure: '안건 설명 → 선택지 제시 → 분석 → 토론 → 투표/합의 → 결정',
    rules: ['결정이 필요한 안건을 명확히 정의', '각 선택지의 장단점을 객관적으로 분석', '모든 참여자가 발언 기회를 가짐', '결정 사항과 근거를 문서화'],
    timeAllocation: { presentation: '10분', analysis: '15분', debate: '15분', decision: '5분' },
    expectedOutput: '결정 사항, 결정 근거, 리스크 및 대응 방안, 후속 액션',
    sampleAgenda: ['1. 안건 설명 (10분)', '2. 선택지 분석 (15분)', '3. 자유 토론 (15분)', '4. 최종 결정 (5분)', '5. 후속 액션 배정 (5분)'],
  },
  {
    id: 'crisis-response',
    name: '위기 대응 회의',
    description: '긴급 상황에 대한 즉각적 대응을 논의하는 회의.',
    structure: '상황 파악 → 영향 분석 → 즉시 조치 → 근본 원인 분석 → 재발 방지',
    rules: ['가장 최신 정보를 기반으로 논의', '책임 추궁보다 해결에 집중', '의사결정은 신속하게', '모든 조치는 타임라인과 함께 기록'],
    timeAllocation: { situationReport: '5분', impactAnalysis: '10분', immediateAction: '10분', rootCause: '10분', prevention: '10분' },
    expectedOutput: '상황 요약, 영향 범위, 즉시 조치 목록, 근본 원인 가설, 재발 방지 계획',
    sampleAgenda: ['1. 현재 상황 브리핑 (5분)', '2. 영향 범위 파악 (10분)', '3. 즉시 조치 논의 (10분)', '4. 근본 원인 분석 (10분)', '5. 재발 방지 계획 (10분)'],
  },
  {
    id: 'custom',
    name: '직접 입력',
    description: '사용자가 직접 회의 형식, 규칙, 진행 방식을 정의합니다.',
    structure: '사용자 정의',
    rules: ['사용자가 정의한 규칙을 따릅니다'],
    timeAllocation: {},
    expectedOutput: '사용자 정의',
    sampleAgenda: [],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Discussion Frameworks
// ─────────────────────────────────────────────────────────────────────────────

export const DISCUSSION_FRAMEWORKS = [
  {
    id: 'pros-cons',
    name: '찬반 토론',
    description: '안건에 대해 찬성/반대 진영으로 나누어 논의하는 구조화된 토론',
    structure: '찬성 측 주장 → 반대 측 반론 → 찬성 측 재반박 → 반대 측 재반박 → 결론',
    prompt: '참여자를 찬성팀과 반대팀으로 나누고, 각 팀이 번갈아 가며 근거를 제시하세요. 마지막에 양측 주장을 종합하여 균형 잡힌 결론을 도출하세요.',
  },
  {
    id: 'roundtable',
    name: '원탁 회의',
    description: '모든 참여자가 동등한 위치에서 순서대로 의견을 제시하는 민주적 회의 방식',
    structure: '주제 제시 → 순서대로 1차 의견 → 자유 토론 → 순서대로 최종 의견 → 합의',
    prompt: '모든 참여자가 순서대로 동등하게 발언하세요. 각 참여자는 자신의 전문 분야 관점에서 의견을 제시하고, 다른 참여자의 의견에 건설적으로 반응하세요.',
  },
  {
    id: 'six-hats',
    name: '6가지 사고 모자',
    description: 'Edward de Bono의 6가지 사고 모자 기법을 활용한 다각적 분석',
    structure: '사실(흰색) → 감정(빨강) → 비판(검정) → 긍정(노랑) → 창의(초록) → 프로세스(파랑)',
    prompt: '6가지 관점에서 순서대로 논의하세요: 1)사실/데이터(흰색), 2)감정/직관(빨강), 3)비판적 분석(검정), 4)긍정적 가능성(노랑), 5)창의적 대안(초록), 6)프로세스/종합(파랑).',
  },
  {
    id: 'swot',
    name: 'SWOT 분석',
    description: '강점(S), 약점(W), 기회(O), 위협(T) 관점에서 체계적으로 분석',
    structure: 'Strengths → Weaknesses → Opportunities → Threats → 전략 수립',
    prompt: '안건을 SWOT 프레임워크로 분석하세요. SO전략, WO전략, ST전략, WT전략을 도출하세요.',
  },
  {
    id: 'brainwriting',
    name: '브레인라이팅',
    description: '텍스트로 아이디어를 작성하고 다른 참여자가 발전시키는 방식',
    structure: '개별 아이디어 작성 → 다른 참여자가 발전 → 전체 공유 → 투표',
    prompt: '각 참여자가 독립적으로 아이디어를 작성한 후, 다른 참여자의 아이디어를 발전시키세요. 최종적으로 가장 유망한 것을 선정하세요.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Persona Color Palette (UI)
// ─────────────────────────────────────────────────────────────────────────────

export const PERSONA_COLORS = [
  { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-200', border: 'border-blue-300 dark:border-blue-700', hex: '#3b82f6' },
  { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-800 dark:text-emerald-200', border: 'border-emerald-300 dark:border-emerald-700', hex: '#10b981' },
  { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-800 dark:text-violet-200', border: 'border-violet-300 dark:border-violet-700', hex: '#8b5cf6' },
  { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-800 dark:text-rose-200', border: 'border-rose-300 dark:border-rose-700', hex: '#f43f5e' },
  { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-800 dark:text-amber-200', border: 'border-amber-300 dark:border-amber-700', hex: '#f59e0b' },
  { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-800 dark:text-cyan-200', border: 'border-cyan-300 dark:border-cyan-700', hex: '#06b6d4' },
];

// ─────────────────────────────────────────────────────────────────────────────
// LLM Output Format Guide
// ─────────────────────────────────────────────────────────────────────────────

export const OUTPUT_FORMAT_GUIDE = `## 출력 형식 가이드

반드시 아래 JSON 형식으로만 응답하세요. JSON 외의 텍스트는 절대 포함하지 마세요.
마크다운 코드블록(\`\`\`)도 사용하지 마세요. 순수 JSON만 출력하세요.

{
  "rounds": [
    {
      "roundNumber": 1,
      "topic": "이 라운드에서 논의하는 세부 주제",
      "discussions": [
        {
          "speaker": "페르소나 이름",
          "role": "역할명",
          "message": "발언 내용 (2~4문장, 구체적인 근거와 의견 포함)"
        }
      ]
    }
  ],
  "summary": "전체 회의 요약 (3~5문장)",
  "conclusions": ["결론 1", "결론 2", "결론 3"],
  "actionItems": [
    { "task": "구체적인 후속 과제", "assignee": "담당 페르소나/역할", "priority": "high/medium/low", "deadline": "예상 기한" }
  ],
  "keyInsights": ["인사이트 1", "인사이트 2"]
}

### 주의사항
- 각 라운드에서 모든 참여자가 최소 1회 이상 발언해야 합니다
- 발언 내용은 해당 페르소나의 성격, 말투, 전문 분야를 반영해야 합니다
- 참여자 간 상호작용을 자연스럽게 포함하세요
- summary는 찬반 양측의 의견을 균형 있게 포함해야 합니다
`;

// ─────────────────────────────────────────────────────────────────────────────
// System Prompt Builder
// ─────────────────────────────────────────────────────────────────────────────

export function buildMeetingSystemPrompt({ meetingFormat, personas, topic, context, roundCount, framework }) {
  const format = MEETING_FORMATS.find((f) => f.id === meetingFormat) || MEETING_FORMATS[0];
  const selectedFramework = DISCUSSION_FRAMEWORKS.find((f) => f.id === framework);

  const personaDescriptions = personas
    .map(
      (p, i) =>
        `[참여자 ${i + 1}] ${p.name} (${p.role})\n` +
        `  성격: ${p.personality}\n` +
        `  말투: ${p.speakingStyle}\n` +
        `  관심사: ${p.concerns.join(', ')}\n` +
        `  전문 분야: ${p.expertise.join(', ')}`
    )
    .join('\n\n');

  const parts = [
    '당신은 AI 가상회의 시뮬레이터입니다.',
    `주제: ${topic}`,
    context ? `배경 컨텍스트: ${context}` : '',
    '',
    `## 회의 형식: ${format.name}`,
    `설명: ${format.description}`,
    `구조: ${format.structure}`,
    `규칙:\n${format.rules.map((r) => `- ${r}`).join('\n')}`,
    '',
    '## 참여자 정보',
    personaDescriptions,
    '',
    `## 라운드 수: ${roundCount}`,
    `총 ${roundCount}개의 라운드로 토론을 진행하세요.`,
    '',
    selectedFramework
      ? `## 토론 프레임워크: ${selectedFramework.name}\n${selectedFramework.prompt}`
      : '',
    '',
    OUTPUT_FORMAT_GUIDE,
  ];

  return parts.filter(Boolean).join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-Persona Turn Prompt Builder
// ─────────────────────────────────────────────────────────────────────────────

export function buildPersonaTurnPrompt({ persona, meetingFormat, topic, context, framework, allPersonas, roundNumber, totalRounds, isLeader = false, customFormatText = '', minSpeechPerRound = 1, speechIndex = 1, customInstructions = '' }) {
  const format = MEETING_FORMATS.find((f) => f.id === meetingFormat) || MEETING_FORMATS[0];
  const fw = DISCUSSION_FRAMEWORKS.find((f) => f.id === framework);
  const otherPersonas = allPersonas.filter((p) => p.name !== persona.name);
  const isCustomFormat = meetingFormat === 'custom' && customFormatText;

  const characterLines = [
    '## 당신의 캐릭터',
    `- 성격: ${persona.personality || '전문적이고 분석적'}`,
    `- 말투: ${persona.speakingStyle || '명확하고 간결한 발언'}`,
    `- 관심사: ${(persona.concerns || []).join(', ') || '주어진 역할 관련 사항'}`,
    `- 전문 분야: ${(persona.expertise || []).join(', ') || persona.role}`,
  ];
  if (customInstructions) characterLines.push(`- 추가 지침: ${customInstructions}`);

  const meetingInfoLines = [
    '## 회의 정보',
    `- 주제: ${topic}`,
    context ? `- 배경: ${context}` : '',
  ];
  if (isCustomFormat) {
    meetingInfoLines.push(`- 형식: 직접 입력`, `- 현재 라운드: ${roundNumber}/${totalRounds}`, '', '## 회의 규칙', customFormatText);
  } else {
    meetingInfoLines.push(`- 형식: ${format.name} — ${format.description}`, `- 현재 라운드: ${roundNumber}/${totalRounds}`);
  }
  if (fw) meetingInfoLines.push(`- 토론 프레임워크: ${fw.name} — ${fw.prompt}`);

  const instructionLines = [
    '## 지시사항',
    `- 반드시 ${persona.name}(${persona.role})의 관점에서만 발언하세요.`,
    '- 이전 대화 내용이 있다면 반드시 참고하여 자연스럽게 이어가세요.',
    '- 다른 참여자의 의견에 동의, 반론, 질문, 보완 등 상호작용을 포함하세요.',
    '- 2~4문장으로 구체적인 근거와 함께 의견을 제시하세요.',
    '- 순수 텍스트로만 응답하세요 (JSON이나 마크다운 형식 사용 금지).',
    '- 발언자 이름이나 역할을 앞에 붙이지 마세요. 발언 내용만 출력하세요.',
  ];
  if (isLeader) {
    instructionLines.push(
      '- 당신은 이 회의의 회의장(퍼실리테이터)입니다.',
      '- 다른 참여자들의 발언을 정리하고, 논의 방향을 이끌어주세요.',
      '- 각 라운드의 핵심을 요약하고, 미진한 부분에 대해 추가 질문을 하세요.',
    );
  }
  if (minSpeechPerRound > 1 && speechIndex > 1) {
    instructionLines.push(
      `- 이것은 이 라운드에서의 ${speechIndex}번째 발언입니다.`,
      '- 이전 발언과 다른 새로운 관점이나 구체적인 보충 의견을 제시하세요.',
    );
  }

  return [
    `당신은 "${persona.name}" (${persona.role})입니다. 가상회의에 참여하고 있습니다.`,
    '',
    ...characterLines,
    '',
    ...meetingInfoLines,
    '',
    '## 다른 참여자',
    otherPersonas.map((p) => `- ${p.name} (${p.role})`).join('\n'),
    '',
    ...instructionLines,
  ].filter(Boolean).join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary Prompt Builder
// ─────────────────────────────────────────────────────────────────────────────

export function buildSummaryPrompt({ topic, conversationHistory, roundCount }) {
  const conversationText = conversationHistory
    .map((m) => `[라운드 ${m.roundNumber}] ${m.speaker} (${m.role}): ${m.message}`)
    .join('\n\n');

  return [
    '당신은 회의 기록 분석가입니다. 아래 가상회의 내용을 분석하여 요약을 작성하세요.',
    '',
    `## 회의 주제: ${topic}`,
    '',
    `## 회의 내용 (${roundCount}라운드)`,
    conversationText,
    '',
    '## 출력 형식',
    '반드시 아래 JSON 형식으로만 응답하세요.',
    '',
    '{',
    '  "summary": "전체 회의 요약 (3~5문장)",',
    '  "conclusions": ["결론 1", "결론 2", "결론 3"],',
    '  "actionItems": [',
    '    { "task": "구체적 과제", "assignee": "담당자", "priority": "high/medium/low", "deadline": "예상 기한" }',
    '  ],',
    '  "keyInsights": ["인사이트 1", "인사이트 2"]',
    '}',
  ].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

export function getPersonaById(id) {
  return PERSONA_TEMPLATES.find((p) => p.id === id) || null;
}

export function getFormatById(id) {
  return MEETING_FORMATS.find((f) => f.id === id) || null;
}

export function getFrameworkById(id) {
  return DISCUSSION_FRAMEWORKS.find((f) => f.id === id) || null;
}

export function parseJsonFromStream(text) {
  if (!text || typeof text !== 'string') return null;

  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;

  try {
    return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}
