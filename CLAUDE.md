# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 명령어

```bash
npm install
npm run dev        # 개발 서버. base=/ 로 5173 고정, 브라우저 자동 실행
npm run build      # tsc -b (타입 검사) 후 vite build → dist/
npm run typecheck  # 타입 검사만
npm run preview    # 빌드 결과를 4173 에서 서비스
```

테스트 러너는 없다. 변경을 확인할 때는 `npm run build` 로 타입 검사를 통과시키고,
브라우저에서 실제 동작을 본다. UI 회귀는 Playwright 로 임시 스크립트를 써서 확인해 왔다
(제공사 API 는 `page.route` 로 가짜 응답을 물려 놓고 흐름만 검증).

빌드 시 `base` 가 세 갈래다. 개발은 `/`, 기본 빌드는 `/oilpendrawing/`(GitHub Pages 하위 경로),
`VITE_BASE=/` 를 주면 루트(커스텀 도메인용). `VITE_PREVIEW=1` 로 빌드하면 미리보기 모드가 켜진다.

## 앱의 목적

**드로잉 초보자가 사진을 보고 스케치북에 오일펜으로 직접 그릴 때 옆에 두는 참고서**다.
AI 결과물은 완성작이 아니라 "따라 그릴 목표"이고, 앱의 핵심 가치는 그 목표에 이르는
단계를 보여 주는 데 있다. 기능을 더할 때 이 관점을 기준으로 판단한다.

UI 문구는 모두 한국어이고, 코드 주석도 한국어로 쓴다.

## 구조

### 두 가지 모드

`App.tsx` 가 모든 상태를 들고 있고 `mode` 가 `'draw' | 'guide'` 로 갈린다.
`Stage` 는 `guide` prop 이 오면 자기 내용 대신 그것을 렌더한다 — 즉 모드 분기는
`App` 한 곳에만 있고 뷰어 컴포넌트는 그 사실을 모른다.

- **draw**: 원본/결과 분할 비교. `view` 가 `'compare' | 'result' | 'original'`.
- **guide**: 구도 → 큰 형태 → 명암 → 완성 참고 4단계 (`GuideStep`).

`FullscreenView` 는 같은 두 모드를 전체화면으로 다시 그린다. 단계별 이미지 계산을
중복하지 않으려고 `useGuideImage` 훅으로 뽑아 두었으니, 표시 이미지를 바꿀 때는
`GuideView` 와 `FullscreenView` 양쪽이 아니라 그 훅을 고친다.

### API 비용이 드는 곳과 안 드는 곳

기본 경로는 전부 브라우저 계산이다. 가이드 1~3단계는 `guide.ts` 의 `edgeMap`, `valueMap`,
"드로잉 만들기"는 `render.ts` 의 `renderDrawing`, 견본 분석은 `sampleStyle.ts` 의 `analyzeSample`.
뒤의 둘은 순수 함수(DOM 없음)라 `render.worker.ts` 에서 돌고, `local.ts` 가 Blob ↔ ImageData 변환과
워커 호출을 맡는다. API 를 쓰는 건 "AI로 그리기"와 "과정 그림 만들기" 두 가지뿐이고 둘 다 키가 있어야 켜진다.
이 경계를 흐리지 않는다.

### 로컬 렌더러와 견본 분석

`StrokeProfile`(`types.ts`)이 렌더러의 전부다: 채우기 방식, 톤 단계, 여백, 선 굵기, 윤곽선 밀도,
해칭 각도·간격, 손떨림, 가장자리 여백(vignette), 종이·잉크색. 렌더는 밝기 → 톤 단계 →
단계별 해칭 층(`hatchLayer`, 토막·각도·필압이 난수로 흔들리되 seed 고정) → 색 그라디언트 윤곽선(세 채널 Sobel 제곱합, 밝기가 같은 색 경계도 잡음) 팽창 →
가장자리 흐림 → 종이색 위 합성 순서다.

채우기 `sketch`(어반 스케치)가 기본이다. `orientationField` 가 구조 텐서로 면의 방향장을 만들고
`sketchLayer` 가 그 방향으로 짧은 획을 잇는다(방향이 없는 하늘은 `hatchAngle` 의 긴 사선). `textureMask` 로
잡은 잔결 영역(나뭇잎)은 획 대신 고리 선으로 채운다. 짝수 층은 방향을 90도 돌려 그림자에 교차 해칭이 생기고,
톤이 5단계 이상이면 가장 어두운 단계를 먹으로 채운다.

프리셋은 `RICHEON_STROKES`(기본, instagram @richeons_drawing_journey — 이 앱 주인의 드로잉)와
`FINE_STROKES`(세밀 펜화. 참고한 작가의 이름은 UI·문서에 쓰지 않는다). 화풍(`PenStyle`) `richeon`·`fineink` 를 고르면 `App.patchParams` 가
프리셋 전체를 `strokes` 에 넣고, 다른 화풍은 `FILL_FOR_STYLE` 로 채우기 방식만 바꾼다. 숙련도 기본값
`strokesForLevel` 도 리천 프리셋을 단순화한 것이다. 새 작가를 추가할 때는 이 넷(프리셋, `PenStyle`,
`STYLE_TEXT`, `STYLE_TIP`)을 함께 넣는다. 옛 ID `parkyongsoon` 은 `mergeParams` 가 `fineink` 로 바꾼다.

### 낙관·사인

`stamps.ts`. 등록 항목(`StampItem`, 투명 PNG data URL)과 배치(`PlacedStamp`, 그림에 대한 상대 좌표 0~1과 폭 비율)를
localStorage `oilpen.stamps.v1` 에 둔다. 낙관 2개·사인 3개 한도. `Drawing.base` 가 찍기 전 결과이고 `result` 는 배치를
구워 넣은 것이라, 전체화면·가이드·저장은 `result` 를 그대로 쓴다. `Stage` 는 끌기 중 부드럽게 보이도록 `base` 위에
DOM 오버레이(`StampLayer`)로 그리고, 놓는 순간 `App.rebake` 가 `compositeStamps` 로 다시 굽는다.

견본을 올리면 `analyzeSample` 이 프로필을 재고, `App` 이 `blendStrokes(strokesForLevel(level), measured, referenceWeight)` 로
슬라이더를 채운다. 측정은 근사치이므로 **슬라이더가 항상 최종 권한**이다. 숙련도·견본·반영도가 바뀌면 슬라이더가
다시 채워지고, 이력에서 불러올 때만 `keepStrokesRef` 로 그 재설정을 한 번 건너뛴다.
로컬 결과가 떠 있는 상태에서 선·톤이나 색을 바꾸면 350ms 뒤 자동으로 다시 그려 같은 이력 항목을 갱신한다.

측정 방법: 큰 블러로 나눠 조명 평탄화 → Otsu 로 잉크 마스크 → 16px 블록 밀도로 여백·톤 단계·해칭 영역 →
침식 횟수로 선 굵기 → 그래디언트 방향 히스토그램으로 각도·집중도(손떨림)·2차 봉우리(교차) →
해칭에 수직인 선을 따라 잉크 시작 횟수로 간격, 잉크 위에서 출발해 선을 따라간 길이로 점묘 여부.

### 제공사 (BYOK)

`providers/` 아래 세 곳이 `ImageProvider` 인터페이스(`common.ts`)를 구현한다.
`EDITS_INPUT`(`providers/index.ts`)이 중요한 갈림길이다.

- **gemini, openai**: 사진을 직접 편집한다. 원본 구도가 유지된다.
- **xai**: 이미지 편집 API 가 없어 **비전 모델로 사진을 묘사 → 그 글로 새로 생성**하는
  2단계다. 구도 재현이 덜 정확하고, UI 가 이 사실을 사용자에게 알려 준다.

모델 ID 와 기본 URL 은 사용자가 설정 화면에서 바꿀 수 있다 — 제공사가 모델 이름을 바꾸거나
CORS 로 막을 때 코드 수정 없이 대응하기 위한 것이므로, 모델 ID 를 코드에 못박지 않는다.

`callApi`(`common.ts`)가 네트워크/HTTP 오류를 한국어 메시지 + 힌트로 바꾼다.
새 제공사를 붙일 때도 이걸 거쳐야 오류 표시가 일관된다.

### 빛의 방향

`DrawingParams.lightAuto`. 사진을 올리면 `estimateLight`(`image.ts`)가 뭉갠 밝기의 평균 기울기로 8방향 중 하나를 골라
다이얼에 넣는다. 사용자가 다이얼을 돌리면 `lightAuto=false` 가 되고, `prepareInput` 의 `relight` 가 사진에 그 방향의
밝기 기울기(multiply + screen)를 입힌다. 편집형 제공사와 로컬 렌더러 모두 글이 아니라 사진의 명암을 따르므로
빛 방향은 이렇게 **사진을 바꿔서** 전달한다. 지시문은 자동이면 "사진의 조명을 유지", 수동이면 "다시 조명된 사진을 따르라"고 쓴다.
실시간 재렌더는 빛이 바뀌면 원본 `File` 에서 다시 준비하므로, 이력에서 불러온(원본 파일이 없는) 결과에는 적용되지 않는다.

### 지시문 조립

`prompt.ts` 의 `buildPrompt` 가 `DrawingParams` 를 문장들로 조립한다. 순서가 의미를 갖는다:

```
기본 지시 → 화풍(STYLE_TEXT) → 선·톤(strokesText) → 화가(artistText) → 숙련도(LEVEL_TEXT)
→ 강도 → 색 → 빛 방향 → 톤 → 종이 질감 → (견본이 있으면) 견본 반영
```

`strokesText` 는 로컬 렌더러의 `StrokeProfile` 을 문장으로 옮긴 것이라 두 경로가 같은 설정을 본다.
`buildPrompt` 의 두 번째 인자 `RefKind` 가 두 번째 이미지의 정체다: `sample`(올린 견본) 또는 `local`(같은 사진의 로컬 결과,
`DrawingParams.aiRefFromLocal` 이 켜져 있고 로컬 결과가 떠 있을 때 `App.drawAi` 가 `current.base` 를 보냄). 로컬을 보낼 때는
"손으로 다시 그리되 기계적 규칙성은 베끼지 말라"고 덧붙인다.

화풍(`PenStyle`, 13종)은 기법이고, 화가(`ArtistId`, `artists.ts`, 10명)는 그 위에 얹는
해석이다. 둘은 곱해서 쓴다. 화가 목록은 **사후 60년 이상 지난 작가만** 넣는다 —
저작권 문제와 이미지 생성 API 의 이름 거부를 함께 피하기 위해서다. 각 항목이 이름뿐 아니라
선·명암 기법 서술(`prompt` 필드)을 갖는 이유도 모델이 이름을 몰라도 특징이 남게 하기 위함이다.

`buildProcessPrompt` 는 4단계 과정을 2×2 한 장으로 그려 달라는 별도 지시문이다.

### 데이터 보관

- 설정·API 키: `storage.ts` → `localStorage`(기억하기 켬) 또는 `sessionStorage`(끔).
  **서버로 보내지 않는다.** 요청은 브라우저에서 제공사로 직접 간다.
- 이력: IndexedDB 에 최근 30개 (`Drawing` 레코드에 입력·견본·결과·과정 그림 Blob 포함).

이력에서 불러온 `params` 는 `mergeParams` 로 기본값과 병합한다(`strokes` 는 한 단계 더 깊게) —
필드를 새로 추가하면 옛 레코드에 그 값이 없기 때문이다. `Drawing.engine` 이 없으면 옛 AI 레코드다.

### 미리보기 모드

`env.ts` 의 `IS_PREVIEW`. 단일 HTML 로 묶어 Artifact 로 올린 빌드에서는 외부 API 호출이
차단되므로, 배너와 안내를 띄우고 키 없이도 화면을 둘러볼 수 있게 한다.

## 배포

`.github/workflows/deploy.yml` 이 main 또는 작업 브랜치 푸시에 Pages 로 배포한다.
저장소 변수 `PAGES_DOMAIN` 이 있으면 CNAME 을 쓰고 `VITE_BASE=/` 로 빌드한다.
Pages 는 공개 저장소에서만 동작하고, Source 를 "GitHub Actions" 로 두어야 한다.

Windows 사용자는 `start.bat` 더블클릭으로 실행, `update.bat` 으로 갱신한다.

## 문서

- `docs/design-proposal.md` — 파라미터 정의, 화풍·화가 목록, 숙련도 3단계의 근거
- `design/*.dc.html` — 초기 화면 목업 (기본안과 대안 B·C). 현재 UI 는 대안 B 를 구현한 것
