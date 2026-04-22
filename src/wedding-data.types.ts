/** wedding-data.txt(JSON) 파싱 결과 타입 — 필요한 필드만 유지하고, 섹션 추가 시 여기와 JSON을 함께 늘리면 됩니다. */

export interface WeddingData {
  meta: {
    documentTitle: string;
    introTypingLine: string;
  };
  couple: {
    /** 상단바 등 — `{{groom.이름}} · {{bride.이름}}` 형태로 비워 두면 로드 시 자동 생성 */
    topBarTitle?: string;
    groom: {
      성이름: string;
      이름: string;
      mbtiLine: string;
      tagAccent: string;
      description: string;
    };
    bride: {
      성이름: string;
      이름: string;
      mbtiLine: string;
      tagAccent: string;
      description: string;
    };
    groomParentsLine: string;
    brideParentsLine: string;
  };
  wedding: {
    saveTheDateNums: string;
    dateTimeISO: string;
    ceremonyTimeLabel: string;
    venueName: string;
    venueHall: string;
    /** 오시는 길 등에서 쓸 예정이면 JSON에 유지해 두세요. */
    venueAddress?: string;
    /** 네이버·카카오 등 지도 링크 (없으면 버튼 숨김) */
    mapUrl?: string;
    /** 주차·셔틀 등 안내 (줄바꿈 `\n` 가능) */
    directionsNote?: string;
    /** 마음 전하실 곳 — 계좌 행 */
    accounts?: {
      label: string;
      bank: string;
      number: string;
      holder: string;
    }[];
  };
}
