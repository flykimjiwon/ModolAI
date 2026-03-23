# Learnings

## 2026-03-18 Session: ses_301c0ad3fffe7VA8peNPh0Ykvo

### 코드베이스 패턴
- saveCustomInstruction: page.js/chat1/chat2/chat3 4곳에 동일 패턴 존재
- useChat 훅: { rooms, currentRoom, loadRooms } 반환
- PATCH /api/webapp-chat/room/[id]: customInstruction, customInstructionActive 필드 지원
- chat1은 techai/web page.js 복사본 (1522줄), chat2/3은 자체 인라인 디자인
- useChatSender: customInstruction, customInstructionActive params 지원 (ref 패턴)

### 아이콘 시스템
- @/components/icons/index.jsx — Phosphor Icons 래퍼
- lucide-react 미사용 (모두 교체 완료)

### 템플릿 시스템
- localStorage._chatTemplate: 캐시 키
- /api/public/settings: chatTemplate 반환
- page.js: 인증 후 chatTemplate 체크 → redirect

### 주의사항
- chat2는 getStyles(isDark) 함수로 인라인 스타일 생성 — dark: 클래스 아님
- chat3는 인라인 style= 속성으로 색상 하드코딩
