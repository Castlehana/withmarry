/** 갤러리 3D 슬라이드별 카피 (01~10) */
export type WeddingGallerySlideCopy = {
  catalogue: string;
  titleLine1: string;
  titleLine2: string;
  description: string;
  meta: { label: string; value: string }[];
};

export const WEDDING_GALLERY_SLIDES: readonly WeddingGallerySlideCopy[] = [
  {
    catalogue: "01 / Collection",
    titleLine1: "빛에",
    titleLine2: "닿다",
    description:
      "이른 아침 부드러운 빛 속에서 현실과 추상의 경계를 탐합니다. 단순함 안에 숨은 겹겹의 이야기를 천천히 발견해 보세요.",
    meta: [
      { label: "Year", value: "2026" },
      { label: "Medium", value: "Digital Print" },
    ],
  },
  {
    catalogue: "02 / Collection",
    titleLine1: "고요한",
    titleLine2: "선",
    description:
      "정밀함과 균형의 연구입니다. 유기적인 혼란을 덜어내고, 자연 아래 깔린 조용한 수학적 순수함을 드러냅니다.",
    meta: [
      { label: "Year", value: "2026" },
      { label: "Medium", value: "Archival Ink" },
    ],
  },
  {
    catalogue: "03 / Collection",
    titleLine1: "스미는",
    titleLine2: "지평선",
    description:
      "지평선은 늘 보이지만 닿을 수 없는 미래에 대한 은유입니다. 번지는 색은 기억의 유동성과 시간의 흐름을 떠올리게 합니다.",
    meta: [
      { label: "Year", value: "2026" },
      { label: "Medium", value: "Pigment Print" },
    ],
  },
  {
    catalogue: "04 / Collection",
    titleLine1: "빈",
    titleLine2: "공간",
    description:
      "비움 속에서 의미를 찾도록 초대합니다. 캔버스의 질감이 주인공이 되어, 시각적 방해 없이 촉각적 시선에 집중합니다.",
    meta: [
      { label: "Year", value: "2026" },
      { label: "Medium", value: "Mixed Media" },
    ],
  },
  {
    catalogue: "05 / Collection",
    titleLine1: "숨",
    titleLine2: "결",
    description:
      "한 장면 안에 담긴 호흡과 리듬. 은은한 대비가 관람자의 시선을 천천히 이끕니다.",
    meta: [
      { label: "Year", value: "2026" },
      { label: "Medium", value: "Fine Art Paper" },
    ],
  },
  {
    catalogue: "06 / Collection",
    titleLine1: "결혼식",
    titleLine2: "전야",
    description:
      "준비의 설렘과 잔잔한 긴장이 공존하는 순간을 담았습니다. 따뜻한 톤이 마음의 온도를 옮겨 놓습니다.",
    meta: [
      { label: "Year", value: "2026" },
      { label: "Medium", value: "Photograph" },
    ],
  },
  {
    catalogue: "07 / Collection",
    titleLine1: "약속",
    titleLine2: "의 날",
    description:
      "두 사람이 같은 방향을 바라보는 시간. 프레임 밖으로 흘러나오는 빛이 이야기의 여운을 남깁니다.",
    meta: [
      { label: "Year", value: "2026" },
      { label: "Medium", value: "Photograph" },
    ],
  },
  {
    catalogue: "08 / Collection",
    titleLine1: "손을",
    titleLine2: "잡고",
    description:
      "작은 제스처가 만드는 큰 진심. 관계의 언어를 조용히 번역한 한 컷입니다.",
    meta: [
      { label: "Year", value: "2026" },
      { label: "Medium", value: "Photograph" },
    ],
  },
  {
    catalogue: "09 / Collection",
    titleLine1: "축복",
    titleLine2: "의 순간",
    description:
      "주변의 시선과 빛이 한데 모여 축복이 되는 장면. 겹치는 레이어가 공간의 깊이를 만듭니다.",
    meta: [
      { label: "Year", value: "2026" },
      { label: "Medium", value: "Photograph" },
    ],
  },
  {
    catalogue: "10 / Collection",
    titleLine1: "오래",
    titleLine2: "남을",
    description:
      "시간이 지나도 옅어지지 않는 온기. 액자 너머로 전해지는 마음의 질감을 담았습니다.",
    meta: [
      { label: "Year", value: "2026" },
      { label: "Medium", value: "Museum Print" },
    ],
  },
] as const;

export const WEDDING_GALLERY_IMAGE_IDS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"] as const;
