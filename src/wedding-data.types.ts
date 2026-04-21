/** wedding-data.txt(JSON) 파싱 결과 타입 */

export type InterviewBlock =
  | { kind: "speaker"; emoji: string; name: string }
  | { kind: "text"; content: string };

export interface InterviewItem {
  question: string;
  blocks: InterviewBlock[];
}

export interface AccountRow {
  role: string;
  number: string;
  bankLine: string;
}

export interface GreetingParagraph {
  segments: [string, boolean][]; // [텍스트, 굵게 여부] 를 순서대로 이어 붙임
}

export interface WeddingData {
  meta: {
    documentTitle: string;
    introTypingLine: string;
  };
  couple: {
    topBarTitle: string;
    groom: {
      fullName: string;
      shortName: string;
      mbtiLine: string;
      tagAccent: string;
      description: string;
    };
    bride: {
      fullName: string;
      shortName: string;
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
    venueAddress: string;
  };
  calendar: {
    caption: string;
    year: number;
    month: number;
    weddingDay: number;
    ceremonyNote: string;
  };
  countdown: {
    headUntil: string;
    headPast: string;
    headToday: string;
    valueToday: string;
    tailUntil: string;
    tailPast: string;
    tailToday: string;
  };
  greeting: {
    heading: string;
    paragraphs: GreetingParagraph[];
  };
  poem: {
    lines: string[];
    attribution: string;
  };
  interview: InterviewItem[];
  map: {
    venueName: string;
    hallLine: string;
    address: string;
    links: { label: string; href: string }[];
    transport: { title: string; lines: string[] }[];
  };
  reception: {
    title: string;
    paragraphs: string[];
    signLine: string;
    boxAddressLine: string;
    boxWhenLine: string;
  };
  rsvp: {
    intro: string;
  };
  accounts: {
    intro: string;
    groomSideTitle: string;
    brideSideTitle: string;
    groomSide: AccountRow[];
    brideSide: AccountRow[];
  };
  contact: {
    groomSideHeading: string;
    brideSideHeading: string;
    groomFather: string;
    groomMother: string;
    brideFather: string;
    brideMother: string;
  };
  footer: {
    copyright: string;
    creditBefore: string;
    creditLinkLabel: string;
    creditLinkHref: string;
    creditAfter: string;
  };
}
