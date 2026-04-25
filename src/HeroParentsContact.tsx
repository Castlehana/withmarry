import type { ParentContactRow, ParentsContactBlock } from "./wedding-data.types";

function digitsOnly(phone: string) {
  return phone.replace(/\D/g, "");
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EnvelopeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22 6 12 13 2 6"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ParentRows({ rows, tone }: { rows: ParentContactRow[]; tone: "groom" | "bride" }) {
  return (
    <div className="hero-parents-contact__person-list">
      {rows.map((row, i) => {
        const digits = row.phone ? digitsOnly(row.phone) : "";
        const label = `${row.role} ${row.name}`;
        return (
          <div key={`${row.role}-${row.name}-${i}`} className="hero-parents-contact__person">
            <p className="hero-parents-contact__name-line">
              <span className={`hero-parents-contact__role hero-parents-contact__role--${tone}`}>{row.role}</span>{" "}
              <span className="hero-parents-contact__name">{row.name}</span>
            </p>
            {digits ? (
              <div className={`hero-parents-contact__actions hero-parents-contact__actions--${tone}`}>
                <a className="hero-parents-contact__icon-btn" href={`tel:${digits}`} aria-label={`${label}에게 전화`}>
                  <PhoneIcon />
                </a>
                <a className="hero-parents-contact__icon-btn" href={`sms:${digits}`} aria-label={`${label}에게 문자`}>
                  <EnvelopeIcon />
                </a>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

type Props = {
  block: ParentsContactBlock;
};

export function HeroParentsContact({ block }: Props) {
  return (
    <div id="hero-parents-contact" className="hero-parents-contact" aria-labelledby="hero-parents-contact-heading">
      <h2 id="hero-parents-contact-heading" className="hero-parents-contact__title">
        {block.title}
      </h2>
      <div className="hero-parents-contact__grid">
        <div className="hero-parents-contact__col hero-parents-contact__col--groom">
          <p className="hero-parents-contact__side-label hero-parents-contact__side-label--groom">{block.groomSideLabel}</p>
          <ParentRows rows={block.groomParents} tone="groom" />
        </div>
        <div className="hero-parents-contact__col hero-parents-contact__col--bride">
          <p className="hero-parents-contact__side-label hero-parents-contact__side-label--bride">{block.brideSideLabel}</p>
          <ParentRows rows={block.brideParents} tone="bride" />
        </div>
      </div>
    </div>
  );
}
