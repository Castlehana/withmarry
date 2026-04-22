import { useEffect, useRef } from "react";
import { initGuestbookFlock } from "./guestbook/guestbookFlock";

type GuestbookSectionProps = {
  flockReady: boolean;
};

export function GuestbookSection({ flockReady }: GuestbookSectionProps) {
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!flockReady) return;
    const el = frameRef.current;
    if (!el) return;
    return initGuestbookFlock(el);
  }, [flockReady]);

  return (
    <section id="guestbook" className="section guestbook" aria-labelledby="guestbook-heading">
      <h2 id="guestbook-heading">방명록</h2>
      <div className="guestbook__frame" ref={frameRef} role="img" aria-label="방명록 애니메이션" />
    </section>
  );
}
