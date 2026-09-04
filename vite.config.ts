import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages는 /<repo>/ 하위 경로로 서비스되므로 base를 저장소 이름에 맞춥니다.
// 다른 곳에 배포하면 VITE_BASE=/ 로 덮어쓰세요.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/oilpendrawing/',
});
