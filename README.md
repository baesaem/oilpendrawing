# 오일펜 드로잉 (Oil Pen Drawing)

사진(컬러/흑백)을 AI로 **오일펜 드로잉**으로 바꿔 주는 웹 앱입니다.
서버 없이 브라우저에서만 동작하며, 사용자가 직접 입력한 API 키(BYOK)로 제공사 API를 호출합니다.

## 기능

- 원본 사진 업로드 (컬러/흑백 자동 감지, 흑백 변환 옵션)
- 견본 드로잉 업로드 + 반영도 조절 (선택)
- 표현 설정: 화풍(10종), 숙련도(초급·중급·상급), 강도, 색 표현(컬러·흑백·세피아), 빛의 방향(8방향), 밝기, 대비
- 원본·결과 분할 비교, 스페이스바 전환, PNG 저장, 최근 30개 이력(브라우저 IndexedDB)
- 제공사: Google Gemini, OpenAI(GPT 이미지), xAI(Grok) — 모델 ID와 기본 URL은 설정에서 변경 가능

## 개발

```bash
npm install
npm run dev        # http://localhost:5173/oilpendrawing/
npm run build      # 타입 검사 + dist/ 빌드
VITE_BASE=/ npm run build   # 루트 경로에 배포할 때
```

## 배포

`main`에 푸시하면 `.github/workflows/deploy.yml`이 GitHub Pages로 배포합니다.
저장소 **Settings → Pages → Source**를 "GitHub Actions"로 설정하세요.

## 제공사 메모

| 제공사 | 방식 | 기본 모델 ID |
|---|---|---|
| Google Gemini | `generateContent`에 사진(+견본)을 inline 이미지로 첨부해 편집 | `gemini-2.5-flash-image` |
| OpenAI | `POST /v1/images/edits` 멀티파트, `image[]`에 사진(+견본) | `gpt-image-1` |
| xAI | 사진을 비전 모델로 묘사 → `POST /v1/images/generations`로 새로 그림 | `grok-2-image` (비전: `grok-4`) |

xAI는 입력 이미지를 직접 편집하는 API가 없어 2단계로 동작하며 원본 구도 재현 정확도가 낮습니다.
모델 ID는 제공사가 바꿀 수 있으므로 오류가 나면 **API 키 설정 → 고급**에서 최신 ID로 바꾸세요.
브라우저 직접 호출(CORS)을 막는 제공사가 있으면 같은 곳에서 기본 URL을 CORS 프록시 주소로 바꿉니다.

## 문서

- `docs/design-proposal.md` — 시안 제안서(사용 흐름, 파라미터 정의, 기술 구성안)
- `design/` — 초기 화면 목업 원본(`*.dc.html`)과 캔버스 배치
