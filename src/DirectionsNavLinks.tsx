import { useId } from "react";
import type { WeddingData } from "./wedding-data.types";
import {
  directionsDestinationQuery,
  kakaoMapSearchUrl,
  naverMapSearchUrl,
  tmapMobileSearchUrl,
} from "./directionsNavUrls";

type Props = {
  wedding: WeddingData["wedding"];
};

function IconTmap({ gradId }: { gradId: string }) {
  return (
    <span className="directions-nav__icon directions-nav__icon--tmap" aria-hidden>
      <svg viewBox="0 0 32 32" width="28" height="28" role="presentation">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff6b9d" />
            <stop offset="50%" stopColor="#c471ed" />
            <stop offset="100%" stopColor="#12c2e9" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="8" fill="#fff" />
        <path fill={`url(#${gradId})`} d="M10 8h12v3H19v15h-6V11h-3V8z" />
      </svg>
    </span>
  );
}

function IconKakaoNavi() {
  return (
    <span className="directions-nav__icon directions-nav__icon--kakao" aria-hidden>
      <svg viewBox="0 0 32 32" width="28" height="28" role="presentation">
        <rect width="32" height="32" rx="8" fill="#FEE500" />
        <circle cx="16" cy="16" r="8.5" fill="#3184FF" />
        <path
          fill="#fff"
          d="M13.2 11.5h5.6c1.9 0 3.2 1.2 3.2 2.9 0 1.1-.6 2-1.6 2.5l2.1 3.6h-3l-1.7-3h-1.4V20h-2.7v-8.5zm2.7 2.2v2.4h2.4c.8 0 1.3-.4 1.3-1.2s-.5-1.2-1.3-1.2h-2.4z"
        />
      </svg>
    </span>
  );
}

function IconNaverMap() {
  return (
    <span className="directions-nav__icon directions-nav__icon--naver" aria-hidden>
      <svg viewBox="0 0 32 32" width="28" height="28" role="presentation">
        <path
          fill="#03C75A"
          d="M16 4C10.5 4 6 8.5 6 14c0 5.5 4.5 10 10 10s10-4.5 10-10c0-5.5-4.5-10-10-10z"
        />
        <path
          fill="#fff"
          d="M13.5 10h2.6l3.4 5.2V10h2.1v12h-2.5l-3.5-5.3V22h-2.1V10z"
        />
      </svg>
    </span>
  );
}

export function DirectionsNavLinks({ wedding }: Props) {
  const tmapGradId = useId().replace(/:/g, "");
  const q = directionsDestinationQuery(wedding);
  if (!q) return null;

  return (
    <div className="directions-nav" role="group" aria-label="길찾기 앱에서 열기">
      <a
        className="directions-nav__btn"
        href={tmapMobileSearchUrl(q)}
        target="_blank"
        rel="noopener noreferrer"
      >
        <IconTmap gradId={tmapGradId} />
        <span className="directions-nav__label">티맵</span>
      </a>
      <a
        className="directions-nav__btn"
        href={kakaoMapSearchUrl(q)}
        target="_blank"
        rel="noopener noreferrer"
      >
        <IconKakaoNavi />
        <span className="directions-nav__label">카카오내비</span>
      </a>
      <a
        className="directions-nav__btn"
        href={naverMapSearchUrl(q)}
        target="_blank"
        rel="noopener noreferrer"
      >
        <IconNaverMap />
        <span className="directions-nav__label">네이버지도</span>
      </a>
    </div>
  );
}
