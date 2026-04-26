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

function IconTmap() {
  return (
    <span className="directions-nav__icon directions-nav__icon--tmap" aria-hidden>
      <img
        className="directions-nav__icon-img directions-nav__icon-img--tmap"
        src="/static/tmap-logo.png"
        alt=""
        width={28}
        height={28}
        decoding="async"
      />
    </span>
  );
}

function IconKakaoNavi() {
  return (
    <span className="directions-nav__icon directions-nav__icon--kakao" aria-hidden>
      <img
        className="directions-nav__icon-img directions-nav__icon-img--kakao"
        src="/static/kakao-navi-logo.png"
        alt=""
        width={28}
        height={28}
        decoding="async"
      />
    </span>
  );
}

function IconNaverMap() {
  return (
    <span className="directions-nav__icon directions-nav__icon--naver" aria-hidden>
      <img
        className="directions-nav__icon-img directions-nav__icon-img--naver"
        src="/static/naver-map-logo.png"
        alt=""
        width={28}
        height={28}
        decoding="async"
      />
    </span>
  );
}

export function DirectionsNavLinks({ wedding }: Props) {
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
        <IconTmap />
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
