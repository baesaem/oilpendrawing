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
"그리기 시작"은 `render.ts` 의 `renderDrawing`, 견본 분석은 `sampleStyle.ts` 의 `analyzeSample`.
뒤의 둘은 순수 함수(DOM 없음)라 `render.worker.ts` 에서 돌고, `local.ts` 가 Blob ↔ ImageData 변환과
워커 호출을 맡는다. 워커 스크립트를 못 불러오거나 워커가 죽으면(`onerror`) 콘솔에 위치를 찍고 `workerBroken` 을 세워
그 뒤로는 화면 스레드에서 같은 함수를 직접 돈다 — 그래서 "그리기 시작"은 어떤 환경에서도 결과를 낸다. API 를 쓰는 건 "AI로 그리기"와 "과정 그림 만들기" 두 가지뿐이고 둘 다 키가 있어야 켜진다.
이 경계를 흐리지 않는다.

### 로컬 엔진 (Dynamic Auto-Painter 방식)

`render.ts` 하나가 엔진이고 `PaintProfile`(`types.ts`)이 엔진이 보는 값의 전부다: 붓(`brush`), 층 수, 획 크기, 세밀함, 정밀도,
획 길이, 형태 따라가기, 기준 각도, 무작위성, 선 굵기, 잉크 농도, 여백, 윤곽선, 가장자리 여백, 종이·잉크색.
DAP(Hertzmann 의 "여러 크기의 굽은 획" 페인팅)를 펜에 맞게 구현한 것이라 흐름이 DAP 와 같다:

1. **목표** — 밝기에서 어둡기 지도 `target` 을 만든다. `paperKeep` 위는 종이(0), 나머지는 감마를 두어 사진보다 옅게, 잔결 영역은 더 옅게.
2. **층(pass)** — `passSizes` 가 획 크기를 `brushSize`(첫 층)에서 `detail`(마지막 층)까지 등비로 줄인다. 층마다 목표를 획 크기의 절반만큼
   뭉갠 참조 `ref` 를 보고(큰 획은 큰 형태만), `sweep` 이 캔버스를 격자(`max(선굵기×2.2, R×0.3)`)로 나눠 **아직 목표보다 밝은 칸**만
   골라(칸 평균 오차 > `T`, `T` 는 정밀도에서) 가장 차이가 큰 자리에 획을 놓는다. 칸 순서는 무작위.
3. **획** — `penStroke` 는 씨앗에서 양쪽으로 뻗으며 `dirAt`(형태 따라가기 × 방향장 확실성으로 기준 각도와 두 배 각 혼합)을 조금씩 따라
   굽고, 목표가 `tol` 만큼 밝아지는 곳(다른 면)이나 캔버스가 이미 충분히 어두운 곳에서 멈춘다 — Hertzmann 의 정지 조건.
   붓별 훑기 구성은 `sweepsFor`: pen 은 [기본, 그림자에만 90°], hatch 는 [기본, 반 칸 어긋난 기본], cross 는 [0°, 90°, 그림자에 45°],
   contour 는 깊은 그림자만 성글게, scribble 은 `scribbleStroke`(곡률 무작위 고리), stipple 은 부족한 만큼 점을 흩뿌림.
   pen 붓은 잔결(`texture` > 0.6)에서 획 대신 `loopStroke`(나뭇잎 고리선). 잉크 농도 85 이상이면 가장 깊은 그림자를 먹으로 채운다.
4. **윤곽** — `edgePass` 가 색 경계(세 채널 Sobel 제곱합)가 센 자리에서 출발해 방향장 접선을 따라 양쪽으로 긋고, 지나간 자리는
   획 번호로 표시해 같은 경계를 두 번 긋지 않는다 (자기 자국에 막히지 않도록 번호를 비교한다). 잔결 영역은 0.85 만큼 누른다.
5. **담채**(`brush: 'wash'`) 는 DAP 그대로다: `washTarget`(사진 색을 뭉개고 물감처럼 띄워 종이에 곱한 목표 색)과 캔버스의 RGB 차이가
   큰 칸에만 붓 크기 R 의 붓 자국(`Canvas.dab`)을 방향장을 따라 얹고, 다른 면으로 넘어가면 멈춘다. 그 위에 펜은 깊은 그림자와 윤곽만.
6. `applyVignette` 로 가장자리 미완성 처리 뒤 `Canvas.toImage` 로 종이 결을 섞어 내보낸다.

`Canvas` 는 색 버퍼 + 어둡기 누적 버퍼다. 획 하나는 `dot()`/`dab()` 들을 모아 `end(alpha, col)` 에서 한 번에 얹는다 — 한 획이 같은 화소를
두 번 칠하지 않도록 화소별 최대 덮임만 남기고, 획끼리는 screen 방식으로 진해진다. 컬러 모드의 획 색은 사진 색을 잉크색과 섞어 누른 것.

**진행 표시**: `renderDrawing` 의 `onProgress` 가 층이 끝날 때와 도중 0.2초마다 중간 그림을 내보낸다. 워커는 이를 `progress` 메시지로
보내고(`render.worker.ts`), `local.ts` 가 콜백으로 넘기고, `App` 이 `progress` 상태로 들고 `Stage` 의 `LiveCanvas` 가 캔버스에 바로 찍는다
(Blob 인코딩 없음). 툴바 "중단" 버튼에도 퍼센트가 뜬다. 화면 스레드 대체 경로에서는 중간 그림이 없다.

방향장 `orientationField` 는 세 채널 구조 텐서(반경 7, 없으면 28)로 면의 방향을 구하고, 잔결(`textureMap` = 색 경계 화소 밀도)에서는
확실성을 눌러 기준 각도로 돌아가게 한다. 지시선(`manualField`)이 가까우면 그 방향으로 끌어당기고 `man` 가중치를 함께 내보내
형태 따라가기 값과 무관하게 먹게 한다.

순수 DAP 방식으로 "필요한 곳에만 짧은 획"을 놓으면 펜 선이 노이즈가 된 적이 있다(옛 엔진 시절 시험). 지금 엔진이 해칭으로 읽히는 이유는
(1) 격자 간격이 선 굵기에 묶여 이웃 획이 일정 간격으로 놓이고, (2) 한 층 안에서 방향이 `dirAt` 으로 매끈하게 이어지고,
(3) 획이 길고(획 크기 × 획 길이) 다른 면에서만 멈추기 때문이다. 이 셋을 흔들면 다시 노이즈가 된다.

화풍(`PenStyle`) 16종마다 `PAINT_FOR_STYLE` 에 완전한 설정이 있다 (DAP 의 프리셋). 갤러리나 드롭다운에서 화풍을 고르면 `App` 의 효과가
`paintForLevel(level, PAINT_FOR_STYLE[style])` 로 숙련도에 맞게 단순화(초급은 층·세밀함↓ 굵은 펜)해 `params.paint` 에 넣고,
견본이 있으면 `blendPaint(base, measured, referenceWeight)` 로 섞는다. 이력에서 불러올 때만 `keepStrokesRef` 로 그 재설정을 한 번 건너뛴다.
새 화풍을 추가할 때는 `PenStyle`, `PAINT_FOR_STYLE`, `STYLE_LABEL`·`STYLE_DESC`, `STYLE_TEXT`, `STYLE_TIP`, `public/presets/<style>.jpg` 를 함께 넣는다.
옛 ID `parkyongsoon` 은 `mergeParams` 가 `fineink` 로 바꾸고, 옛 레코드의 `strokes`(StrokeProfile)는 `migrateStrokes` 가 `paint` 로 옮긴다.

### 견본 분석

`sampleStyle.ts` 의 `analyzeSample` 이 견본 드로잉을 재어 `PaintProfile` 로 돌려준다. 측정은 근사치이므로 **슬라이더가 항상 최종 권한**이다.
측정 방법: 큰 블러로 나눠 조명 평탄화 → Otsu 로 잉크 마스크 → 16px 블록 밀도로 여백·톤 단계(→ 층 수)·해칭 영역 →
침식 횟수로 선 굵기 → 그래디언트 방향 히스토그램으로 각도(→ 기준 각도)·집중도(→ 무작위성)·2차 봉우리(→ 교차 붓) →
해칭에 수직인 선을 따라 잉크 시작 횟수로 간격(→ 세밀함), 잉크 위에서 출발해 선을 따라간 길이로 획 길이와 점묘 여부.
형태 따라가기·정밀도는 견본 한 장으로 재기 어려워 기본값을 둔다.
로컬 결과가 떠 있는 상태에서 그리기 설정이나 색을 바꾸면 350ms 뒤 자동으로 다시 그려 같은 이력 항목을 갱신한다.

### 해칭 방향 지시선 (DAP 의 수동 Feature Follow)

`DrawingParams.guides`(`DirectionGuide[]`, 그림 상대 좌표 0~1)와 `guideRadius`(짧은 변의 %). 툴바 "방향 지시"를 켜면
`Stage` 의 `DirectionLayer` 가 원본 위에서 포인터로 선을 받는다. 해칭선은 양쪽으로 뻗으므로 화살표는 없다.
엔진(`render.ts`)의 `manualField` 가 지시선을 4px 격자에서 거리 가중(가우시안, σ = radius·짧은 변·0.5)한 방향장으로 바꾸고,
`orientationField` 가 두 배 각 벡터로 자동 방향장과 섞는다 — 가까울수록 지시선을, 멀어질수록 자동 방향을 따르고
`coh` 와 `man` 을 함께 끌어올려 평탄한 곳(하늘·벽)에서도, 형태 따라가기가 0 이어도 지시가 먹는다. 모든 붓의 획이 방향장을 따르므로
붓에 따른 예외는 없다.
지시선은 사진이 바뀌면 비워지고, 실시간 재렌더의 비교 대상에 포함되며, `Drawing.params` 에 저장돼 이력에서도 재현된다.

### 화풍 프리셋 갤러리 (DAP 의 프리셋 탭)

`presetGallery.ts` + `public/presets/<style>.jpg`. `StylePanel` 맨 위 `.gallery` 격자가 화풍마다 예시 그림을 보여 주고,
누르면 `onParams({ style })` 만 한다 — 화풍이 바뀌면 `App` 의 효과가 `PAINT_FOR_STYLE` 의 완전한 그리기 설정을 넣는다 (위 로컬 엔진 절).
예시 그림 16장은 같은 사진(컵과 배)을 이 앱의 로컬 렌더러로 화풍마다 그린 것(480px JPEG, 수채만 컬러)이라 화풍끼리
차이가 비교된다. 새 화풍을 추가하면 같은 이름의 예시 그림도 넣는다. AI 로 그릴 때 견본도 로컬 결과도 없고
`DrawingParams.aiRefFromPreset` 이 켜져 있으면(기본) `fetchPresetImage` 로 그 예시 그림을 두 번째 이미지로 보내고
`RefKind` `preset` 으로 "다른 사진이니 기법만 따르라"고 지시한다. 못 가져오면(오프라인·미리보기) 견본 없이 그린다.

### 즐겨찾기 프리셋

`presets.ts`. 현재 `PaintProfile` 을 이름 붙여 localStorage `oilpen.presets.v2` 에 둔다(최대 24개). v1(옛 선·톤 프로필)은 불러올 때
`migrateStrokes` 로 옮긴다. `PaintPanel` 이 저장·적용·삭제 UI 를 갖고, 현재 값과 같은 프리셋(내장 3개 포함)을 `samePaint` 로 표시한다.
적용은 `patchPaint` 로 `paint` 만 바꾸므로 화풍(`PenStyle`)은 그대로다.

### 외부 결과 불러오기

`Engine` 에 `'external'`. 입력 패널 "외부 결과" 칸에 넣은 파일(Dynamic Auto-Painter 등 다른 프로그램의 결과)을
`App.importExternal` 이 이 사진의 완성 참고로 `commit` 한다. 로컬 결과와 같은 자격이라 비교·가이드·전체화면·낙관·저장이
그대로 되고, `aiRefFromLocal` 이 켜져 있으면 AI 에 견본으로도 간다. 웹 앱은 PC 프로그램을 직접 부를 수 없으므로
DAP 연동은 이 방식만 있다 (`docs/dap-workflow.md`). 실시간 재렌더는 `engine === 'local'` 에만 붙는다.

### 낙관·사인

`stamps.ts`. 등록 항목(`StampItem`, 투명 PNG data URL)과 배치(`PlacedStamp`, 그림에 대한 상대 좌표 0~1과 폭 비율)를
localStorage `oilpen.stamps.v1` 에 둔다. 낙관 2개·사인 3개 한도. `Drawing.base` 가 찍기 전 결과이고 `result` 는 배치를
구워 넣은 것이라, 전체화면·가이드·저장은 `result` 를 그대로 쓴다. `Stage` 는 끌기 중 부드럽게 보이도록 `base` 위에
DOM 오버레이(`StampLayer`)로 그리고, 놓는 순간 `App.rebake` 가 `compositeStamps` 로 다시 굽는다.

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
기본 지시 → 화풍(STYLE_TEXT) → 그리기 설정(paintText) → 화가(artistText) → 숙련도(LEVEL_TEXT)
→ 강도 → 색 → 빛 방향 → 톤 → 종이 질감 → (견본이 있으면) 견본 반영
```

`paintText` 는 로컬 엔진의 `PaintProfile` 을 문장으로 옮긴 것이라 두 경로가 같은 설정을 본다.
`buildPrompt` 의 두 번째 인자 `RefKind` 가 두 번째 이미지의 정체다: `sample`(올린 견본), `local`(같은 사진의 로컬 결과,
`DrawingParams.aiRefFromLocal` 이 켜져 있고 로컬 결과가 떠 있을 때 `App.drawAi` 가 `current.base` 를 보냄), `preset`(둘 다 없을 때
고른 화풍의 갤러리 예시 그림). 우선순위는 local → sample → preset. 로컬을 보낼 때는
"손으로 다시 그리되 기계적 규칙성은 베끼지 말라", 프리셋은 "다른 사진이니 주제는 무시하고 기법만 따르라"고 덧붙인다.

화풍(`PenStyle`, 16종)은 기법이고, 화가(`ArtistId`, `artists.ts`, 10명)는 그 위에 얹는
해석이다. 둘은 곱해서 쓴다. 화가 목록은 **사후 60년 이상 지난 작가만** 넣는다 —
저작권 문제와 이미지 생성 API 의 이름 거부를 함께 피하기 위해서다. 각 항목이 이름뿐 아니라
선·명암 기법 서술(`prompt` 필드)을 갖는 이유도 모델이 이름을 몰라도 특징이 남게 하기 위함이다.

`buildProcessPrompt` 는 4단계 과정을 2×2 한 장으로 그려 달라는 별도 지시문이다.

### 데이터 보관

- 설정·API 키: `storage.ts` → `localStorage`(기억하기 켬) 또는 `sessionStorage`(끔).
  **서버로 보내지 않는다.** 요청은 브라우저에서 제공사로 직접 간다.
- 이력: IndexedDB 에 최근 30개 (`Drawing` 레코드에 입력·견본·결과·과정 그림 Blob 포함).

이력에서 불러온 `params` 는 `mergeParams` 로 기본값과 병합한다(`paint` 는 화풍 프리셋 위에 덧씌우고, 옛 `strokes` 는 `migrateStrokes` 로 옮긴다) —
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
