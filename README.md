# BRIEFMAKER

이슈 대응·성과 보고서 초안 생성기입니다. 키워드 또는 기사 본문을 입력하고, 검색 조건과 문서 양식을 바탕으로 보고서 초안을 생성합니다.

## 주요 기능

- OpenAI Web Search와 Gemini Google Search Grounding 병렬 호출
- HWP/HWPX/DOCX/PDF/XLSX/XLS 문서 양식 분석
- 분석된 제목·항목·문단·표 구조를 보고서 생성 프롬프트에 반영
- 출처 URL 정규화·중복 제거 및 참고 출처 표시
- API 키를 브라우저 탭의 `sessionStorage`에만 저장

## 실행

```bash
pnpm install
pnpm run build
pnpm run dev
```

브라우저에서 `http://localhost:4173`을 엽니다.

## 보안

API 키는 서버 환경변수나 저장소에 포함하지 않습니다. 사용자가 화면에서 입력한 키는 현재 브라우저 세션 동안 요청 본문으로만 전달됩니다. `.env*` 파일과 `.vercel`은 Git에 커밋되지 않습니다.

## 구조

- `src/main.js`: 브라우저 UI와 상태 관리
- `app/api/search/route.js`: OpenAI·Gemini 검색 Route Handler
- `app/api/template/route.js`: kordoc 문서 양식 분석 Route Handler
- `server.js`: 로컬 Node.js 서버 및 Route Handler 연결
