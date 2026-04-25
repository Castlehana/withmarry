import type { WeddingData } from "./wedding-data.types";

/** 네이버·카카오·티맵 검색/길찾기 진입용 문자열 (주소 우선, 없으면 홀명까지 합침) */
export function directionsDestinationQuery(w: WeddingData["wedding"]): string {
  const addr = w.venueAddress?.trim();
  if (addr) return addr;
  return `${w.venueName} ${w.venueHall}`.trim();
}

export function naverMapSearchUrl(query: string): string {
  return `https://map.naver.com/p/search/${encodeURIComponent(query)}`;
}

/** 카카오맵 검색(모바일에서 앱 연동 후 길찾기·내비 전환 가능) */
export function kakaoMapSearchUrl(query: string): string {
  return `https://map.kakao.com/link/search/${encodeURIComponent(query)}`;
}

/**
 * 티맵 모바일 웹 검색(목적지 키워드). 앱 설치 시 앱으로 이어지는 경우가 많습니다.
 * 좌표 고정 링크가 필요하면 웨딩 데이터에 별도 공유 URL 필드를 두는 편이 좋습니다.
 */
export function tmapMobileSearchUrl(query: string): string {
  return `https://tmap.co.kr/tmap3/mobile/search.jsp?searchKeyword=${encodeURIComponent(query)}`;
}
