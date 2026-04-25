/** wedding-data.txt(JSON) 파싱 결과 타입 — 필요한 필드만 유지하고, 섹션 추가 시 여기와 JSON을 함께 늘리면 됩니다. */

/** `wedding-data.txt`의 `wedding.date` — 로드 시 `dateTimeISO`·`saveTheDateNums`가 이 값에서 파생됩니다. */
export type WeddingDateInput = {
  year: number;
  /** 1–12 */
  month: number;
  /** 1–31 */
  day: number;
};

/** 혼주 연락 한 줄 — `phone` 없으면 전화·문자 아이콘은 표시되지 않습니다. */
export type ParentContactRow = {
  role: string;
  name: string;
  /** 하이픈 포함 가능 — 링크에는 숫자만 사용됩니다. */
  phone?: string;
};

/** 히어로「신랑·신부 소개」아래 — `couple.parentsContact` */
export type ParentsContactBlock = {
  title: string;
  groomSideLabel: string;
  brideSideLabel: string;
  groomParents: ParentContactRow[];
  brideParents: ParentContactRow[];
};

/** 혼주 연락 아래「참석 여부 전달하기」— 인트로 편지 버튼·모달 (`RsvpAttendanceSection.tsx`) */
export type RsvpAttendanceBlock = {
  /** 예비용 — 현재 모달 상단 안내 문구에는 사용하지 않습니다. */
  message?: string;
  /** 외부 폼·카카오 등 — 있으면 모달에 버튼으로 표시 */
  formUrl?: string;
  /** `formUrl` 버튼 문구 — 없으면 `참석 여부 입력하기` */
  formLabel?: string;
};

/** `wedding.heartAccounts` — 한 사람(신랑·아버지·어머니 등) */
export type HeartAccountEntry = {
  label: string;
  bank: string;
  number: string;
  holder: string;
  kakaoPayUrl?: string;
};

export type HeartAccountsSide = {
  self?: HeartAccountEntry;
  father?: HeartAccountEntry;
  mother?: HeartAccountEntry;
};

/** `wedding.directionsTransport` — 한 교통수단(버스, 지하철, 자차 등) */
export type DirectionsTransportSection = {
  id: string;
  title: string;
  /** 본문 불릿(노선 그룹·노선 안내 등) */
  bullets?: string[];
  /** 불릿 아래 부가 안내(한 문단) */
  note?: string;
  /** true면 각 bullet을 네이버지도 `검색` 링크로 표시(자차 등) */
  mapSearchBullets?: boolean;
};

export type DirectionsTransportBlock = {
  sections: DirectionsTransportSection[];
};

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
      /** 하이픈 포함 가능 — `tel:` 링크에는 숫자만 사용. 없으면 히어로 통화 아이콘 숨김 */
      phone?: string;
      mbtiLine: string;
      tagAccent: string;
      description: string;
    };
    bride: {
      성이름: string;
      이름: string;
      /** 하이픈 포함 가능 — `tel:` 링크에는 숫자만 사용. 없으면 히어로 통화 아이콘 숨김 */
      phone?: string;
      mbtiLine: string;
      tagAccent: string;
      description: string;
    };
    /** 메인 히어로 신랑 열 하단 — `아버지·어머니 의 장남` 형태로 합쳐 표시 */
    groomFatherName: string;
    groomMotherName: string;
    /** 장남·장녀·차남 등 */
    groomFamilyChildLine: string;
    /** 메인 히어로 신부 열 하단 */
    brideFatherName: string;
    brideMotherName: string;
    brideFamilyChildLine: string;
    /** 없으면 해당 UI 블록을 렌더하지 않습니다. */
    parentsContact?: ParentsContactBlock;
    /** 없으면 기본 문구만 사용합니다. */
    rsvpAttendance?: RsvpAttendanceBlock;
  };
  wedding: {
    /** `wedding-data.txt`에만 기입(년/월/일) — `dateTimeISO`·`saveTheDateNums`·캘린더는 `wedding-data.ts`에서 자동 생성 */
    date: WeddingDateInput;
    /** KST, 식 시각은 내부적으로 오후 1시(13:00) 고정. `wedding.ceremonyTimeLabel`과 맞출 것 */
    dateTimeISO: string;
    /** `date`로부터 (예: `26 · 6 · 27`) */
    saveTheDateNums: string;
    ceremonyTimeLabel: string;
    venueName: string;
    venueHall: string;
    /** 오시는 길 등에서 쓸 예정이면 JSON에 유지해 두세요. */
    venueAddress?: string;
    /** 네이버·카카오 등 지도 링크 (없으면 버튼 숨김) */
    mapUrl?: string;
    /** 주차·셔틀 등 안내 (줄바꿈 `\n` 가능) */
    directionsNote?: string;
    /**
     * 지도·길찾기 버튼 아래 — 교통수단별 안내(접기/펼치기).
     * `details[name]`으로 한 번에 한 섹션만 펼침(브라우저 지원 시).
     */
    directionsTransport?: DirectionsTransportBlock;
    /** 오시는 길 위 `마음 전하실 곳` — 신랑/신부·혼주 계좌(토글). `kakaoPayUrl` 있을 때만 버튼 표시. */
    heartAccounts?: {
      title?: string;
      /** 상단 토글 버튼 문구 (없으면 `신랑측`) */
      groomToggleLabel?: string;
      /** 상단 토글 버튼 문구 (없으면 `신부측`) */
      brideToggleLabel?: string;
      groom: HeartAccountsSide;
      bride: HeartAccountsSide;
    };
  };
}
