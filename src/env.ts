/** 미리보기(단일 파일 아티팩트) 빌드인지. 그 페이지는 외부 API 호출과 파일 다운로드가 차단됩니다. */
export const IS_PREVIEW = import.meta.env.VITE_PREVIEW === '1';
export const PREVIEW_NOTE =
  '미리보기 페이지에서는 보안 정책으로 외부 API 호출이 차단됩니다. 화면·그리기 가이드·격자는 그대로 써 볼 수 있고, ' +
  'AI 드로잉 생성과 PNG 저장은 GitHub Pages 배포판이나 로컬 실행(npm run dev)에서 동작합니다.';
