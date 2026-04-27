# 웨딩별 데이터 (`public/weddings/{id}/`)

- URL: `{사이트 base}/{id}` — 예: 로컬 `http://localhost:5173/sample01`, GitHub Pages는 `/저장소명/sample01`
- 루트 `/`는 기본 id `sample01`로 리다이렉트됩니다.

## 폴더 구조 (각 id마다 동일)

- `wedding-data.txt` — 기존과 동일 형식 (# 주석 + JSON)
- `title-couple.png` — 히어로 커플 사진
- `hero.jpg` 등 — `wedding.heroImage`에 파일명을 넣으면 본문 맨 위에 고정 풀블리드로 표시(스크롤 시 본문이 덮음). 생략 가능.
- `gallery-thumbnail.png` — 갤러리 썸네일
- `directions-map.png` — 오시는 길 지도 이미지
- `static/Our Story/` — 챕터 폴더·`our-story-pages.txt`·`backgroundbgm.mp3` 등 (빌드 시 `_chapters.json` 생성)

공용 정적 파일(지도 앱 로고, 인트로 탭 힌트 SVG 등)은 `public/static/`에 그대로 둡니다.

새 청첩장: `sample01` 폴더 전체를 복사해 새 id(영문·숫자·`_`·`-`만)로 이름을 바꾼 뒤 `wedding-data.txt`·이미지·`static/Our Story/`만 교체하면 됩니다. 빌드 전 `npm run build`가 각 id의 `_chapters.json`을 갱신합니다.

GitHub Pages 등 정적 호스팅: 직접 URL `/저장소명/sample01`로 들어가려면 SPA용 `404.html` → `index.html` 복사 트릭 또는 호스팅 측 rewrite가 필요할 수 있습니다. 루트 `/`만 쓰면 리다이렉트로 동작합니다.

예약 경로: 앱에서 `/wedding-load-error` 는 데이터 없음·로드 실패 안내용이므로, 웨딩 id로 `wedding-load-error` 는 쓰지 마세요.
