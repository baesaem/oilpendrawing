import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const PAGES_BASE = '/oilpendrawing/';

/** 개발 서버에서 /oilpendrawing/ 으로 들어와도 열리게 루트로 돌려보냅니다. */
function redirectPagesBase(): Plugin {
  return {
    name: 'redirect-pages-base',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith(PAGES_BASE)) {
          res.statusCode = 302;
          res.setHeader('Location', req.url.slice(PAGES_BASE.length - 1) || '/');
          res.end();
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig(({ command, isPreview }) => ({
  plugins: [react(), redirectPagesBase()],
  // 개발 중에는 루트(/)에서 서비스하고, 배포 빌드만 GitHub Pages 하위 경로(/oilpendrawing/)를 씁니다.
  // 다른 곳에 배포하면 VITE_BASE=/ 로 덮어쓰세요.
  // vite preview 도 command 가 'serve' 이므로 isPreview 로 구분해야 dist 의 /oilpendrawing/ 경로와 맞는다
  base: command === 'serve' && !isPreview ? '/' : (process.env.VITE_BASE ?? PAGES_BASE),
  server: {
    host: true,        // localhost, 127.0.0.1, 같은 네트워크의 태블릿에서도 접속 가능
    port: 5173,
    strictPort: true,  // 5173이 막혀 있으면 다른 포트로 바꾸지 않고 오류를 알려 줌
    open: true,        // 브라우저 자동 실행
  },
  preview: { host: true, port: 4173, strictPort: true },
}));
