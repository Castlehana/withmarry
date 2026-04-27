import { type DependencyList, type RefObject, useLayoutEffect } from "react";

/**
 * `main.content` 안에서 스크롤 인뷰 시 등장시킬 노드를 자동 등록합니다.
 *
 * 대상 (앞으로 블록 추가 시 아래만 맞추면 동일 효과):
 * - `main`의 직계 자식 `section.section` (히어로 `#main`은 `hero`만 쓰고 `.section`을 붙이지 않음)
 * - `main`의 직계 자식 `footer.site-credit`
 * - 히어로 안 `#main [data-scroll-reveal]` — 예: 신랑·신부·혼주. 선택적으로 `data-scroll-reveal-delay-ms` (숫자 ms)
 * - `main`의 직계 `.audio-hint-block` — 이어폰 안내(Our Story 앞)
 *
 * `scrollRootRef`: 스크롤이 `window`가 아니라 이 요소 안에서만 일어날 때(예: `phone-shell--wedding-hero`) IO `root`로 넘겨야 섹션 등장이 맞음.
 */
const SCROLL_REVEAL_SELECTOR =
  ":scope > section.section, :scope > footer.site-credit, :scope > .audio-hint-block, :scope section#main [data-scroll-reveal]";

function isScrollableOverflowY(el: HTMLElement): boolean {
  const y = getComputedStyle(el).overflowY;
  return y === "auto" || y === "scroll" || y === "overlay";
}

export function useScrollRevealRoot(
  containerRef: RefObject<HTMLElement | null>,
  deps: DependencyList = [],
  scrollRootRef?: RefObject<HTMLElement | null>
) {
  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const scrollRootEl = scrollRootRef?.current ?? null;
    const ioRoot: HTMLElement | null =
      scrollRootEl &&
      scrollRootEl.contains(root) &&
      isScrollableOverflowY(scrollRootEl) &&
      scrollRootEl.scrollHeight > scrollRootEl.clientHeight + 2
        ? scrollRootEl
        : null;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    /** 스크롤 컨테이너에 실질 스크롤이 없으면 한꺼번에 보이게 */
    const noScrollReveal =
      reduce ||
      (ioRoot
        ? ioRoot.scrollHeight <= ioRoot.clientHeight + 2
        : root.scrollHeight <= root.clientHeight + 2);
    const elements = Array.from(root.querySelectorAll<HTMLElement>(SCROLL_REVEAL_SELECTOR));

    for (const el of elements) {
      el.classList.add("scroll-reveal");
      const ms = el.dataset.scrollRevealDelayMs;
      if (ms && /^\d+$/.test(ms)) {
        el.style.setProperty("--scroll-reveal-delay", `${ms}ms`);
      }
      if (reduce || noScrollReveal) el.classList.add("scroll-reveal--visible");
    }

    const teardownClasses = () => {
      for (const el of elements) {
        el.classList.remove("scroll-reveal", "scroll-reveal--visible");
        el.style.removeProperty("--scroll-reveal-delay");
      }
    };

    if (reduce || noScrollReveal) {
      return teardownClasses;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).classList.add("scroll-reveal--visible");
          io.unobserve(entry.target);
        }
      },
      { root: ioRoot, rootMargin: "0px 0px -6% 0px", threshold: 0.1 }
    );

    for (const el of elements) io.observe(el);

    return () => {
      io.disconnect();
      teardownClasses();
    };
  }, deps);
}
