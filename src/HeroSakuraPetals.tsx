import "./HeroSakuraPetals.css";

const PETAL_COUNT = 18;

export function HeroSakuraPetals() {
  return (
    <div className="hero-sakura-petals" aria-hidden>
      {Array.from({ length: PETAL_COUNT }, (_, index) => (
        <span key={index} className="hero-sakura-petals__petal" />
      ))}
    </div>
  );
}
