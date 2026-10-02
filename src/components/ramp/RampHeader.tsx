import Link from "next/link";

export function RampHeader() {
  return (
    <header className="rampHeader">
      <Link href="/ramp" className="rampLogo" aria-label="Ramp">
        {/* Exported from the design; the two glyphs are offset vertically. */}
        <img className="rampLogoWordmark" src="/ramp/logo-wordmark.svg" alt="" />
        <img className="rampLogoMark" src="/ramp/logo-mark.svg" alt="" />
      </Link>
    </header>
  );
}
