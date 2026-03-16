# Git Worktree + Claude Code 병렬 작업 가이드

> 이 문서는 다중 작업 시 Claude Code가 참조·추천하는 지침입니다.

---

## 언제 Worktree를 추천하는가

아래 조건 중 **2개 이상** 해당되면 Worktree 전략을 제안한다.

| 조건 | 예시 |
|------|------|
| 독립적인 작업이 2개 이상 동시 존재 | "PatchNotesModal 포팅 + 역할 드롭다운 포팅" |
| 작업끼리 파일 충돌 가능성 낮음 | 서로 다른 컴포넌트/페이지 수정 |
| 각각 별도 PR로 나가야 함 | 기능별 리뷰 필요 |
| main 브랜치를 안전하게 유지해야 함 | 실험적 변경, 대규모 리팩토링 |
| 리뷰와 개발을 동시에 해야 함 | PR 리뷰하면서 다른 작업 계속 |

### 추천하지 않는 경우

- 작업이 1개뿐일 때 (그냥 브랜치 하나 쓰면 됨)
- 작업들이 같은 파일을 수정할 때 (충돌 위험)
- 빠른 수정 하나 (stash + checkout이 더 빠름)

---

## 개념 (한 줄)

> **같은 Git 저장소에서 브랜치마다 독립 폴더를 만들어, Claude Code 여러 개를 동시에 돌리는 것.**

```
ModolAI/                  ← main (원본 그대로, 안전)
ModolAI-작업A/             ← feature-a 브랜치 (별도 폴더)
ModolAI-작업B/             ← feature-b 브랜치 (별도 폴더)
```

각 폴더에서 터미널을 열고 `claude`를 실행하면 독립적으로 작업. 서로 간섭 없음.

---

## 명령어

### 생성

```bash
# 새 브랜치 + worktree 동시 생성
git worktree add -b <브랜치명> <폴더경로> <기준브랜치>

# 예시: main 기준으로 포팅 작업 브랜치 생성
git worktree add -b port/patch-notes ../ModolAI-port-patch-notes main
git worktree add -b port/role-dropdown ../ModolAI-port-role-dropdown main
```

### 확인

```bash
git worktree list
```

### 각 worktree에서 의존성 설치

```bash
cd ../ModolAI-port-patch-notes && npm install
cd ../ModolAI-port-role-dropdown && npm install
```

### 작업 완료 후 정리

```bash
git worktree remove ../ModolAI-port-patch-notes
git worktree remove ../ModolAI-port-role-dropdown
```

---

## Claude Code 병렬 작업 패턴

### 패턴 1: 터미널 탭 분리

```bash
# 탭 1
cd ~/Desktop/kimjiwon/ModolAI-port-patch-notes
claude   # ← 이 세션은 patch-notes 포팅만 담당

# 탭 2
cd ~/Desktop/kimjiwon/ModolAI-port-role-dropdown
claude   # ← 이 세션은 role-dropdown 포팅만 담당
```

### 패턴 2: 실험 + 안정 분리

```bash
# main은 건드리지 않음
git worktree add -b experiment/new-theme ../ModolAI-experiment main

# 실험 성공 → main에 머지
# 실험 실패 → worktree 삭제. main은 깨끗.
```

### 패턴 3: 리뷰 + 개발 동시

```bash
# 리뷰할 PR 브랜치를 worktree로
git worktree add ../ModolAI-review origin/pr-branch

# main에서는 다른 작업 계속
```

---

## 실전 예시: techai → ModolAI 포팅

TECHAI_SYNC.md의 포팅 대상을 worktree로 병렬 처리:

```bash
cd ~/Desktop/kimjiwon/ModolAI

# 1. 포팅 항목별 worktree 생성
git worktree add -b port/patch-notes-modal ../ModolAI-port-patch-notes main
git worktree add -b port/role-dropdown ../ModolAI-port-role-dropdown main
git worktree add -b port/manager-sidebar ../ModolAI-port-manager-sidebar main

# 2. 각 worktree에서 npm install
for dir in ../ModolAI-port-*; do (cd "$dir" && npm install); done

# 3. 각 터미널에서 claude 실행 → 독립 작업 → 커밋

# 4. 각 브랜치에서 PR 생성
cd ../ModolAI-port-patch-notes && gh pr create --title "port: PatchNotesModal from techai"
cd ../ModolAI-port-role-dropdown && gh pr create --title "port: role inline dropdown from techai"
cd ../ModolAI-port-manager-sidebar && gh pr create --title "port: manager sidebar access from techai"

# 5. 머지 후 정리
cd ~/Desktop/kimjiwon/ModolAI
git worktree remove ../ModolAI-port-patch-notes
git worktree remove ../ModolAI-port-role-dropdown
git worktree remove ../ModolAI-port-manager-sidebar
```

---

## 주의사항

| 항목 | 설명 |
|------|------|
| 같은 브랜치 중복 불가 | 하나의 브랜치는 하나의 worktree에서만 체크아웃 가능 |
| node_modules 별도 | 각 worktree마다 `npm install` 필요 (disk 사용 증가) |
| .git은 공유 | 커밋 히스토리, remote, config은 원본과 공유 |
| stash 공유 | 모든 worktree가 같은 stash pool 사용 (혼동 주의) |
| .env 파일 | 원본에서 복사 필요: `cp .env.local ../ModolAI-work/.env.local` |

---

## 비교표

| 방법 | 동시 작업 | 속도 | 디스크 | main 안전 |
|------|:--------:|:----:|:------:|:---------:|
| **git worktree** | O | 빠름 | .git 공유 | O |
| git clone 별도 | O | 느림 | .git 중복 | O |
| git stash + checkout | X | 빠름 | 최소 | 위험 |
| git branch만 | X | 빠름 | 최소 | 위험 |

---

## Claude Code 자동 추천 기준

이 프로젝트에서 사용자가 다음과 같은 요청을 할 때 worktree를 제안:

1. **"A랑 B 동시에 해줘"** → 독립 작업이면 worktree 추천
2. **"이거 실험적으로 해볼래"** → experiment worktree 추천
3. **"포팅 항목 전부 처리해줘"** → 항목별 worktree 추천
4. **"PR 리뷰하면서 다른 것도 해줘"** → 리뷰 worktree 추천
5. **TECHAI_SYNC.md 포팅 대상이 3개 이상일 때** → worktree 일괄 생성 추천
