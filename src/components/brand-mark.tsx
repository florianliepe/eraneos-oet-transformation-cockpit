type BrandMarkProps = {
  compact?: boolean;
  surface?: "dark" | "light";
};

export function BrandMark({ compact = false, surface = "dark" }: BrandMarkProps) {
  return (
    <div
      className={`brand-lockup brand-lockup-${surface}${compact ? " brand-lockup-compact" : ""}`}
      aria-label="eraneos Transformation Cockpit, part of OET AI Suite"
    >
      <span className="eraneos-mark" aria-hidden="true">
        {/* A relative public URL works at both / and the GitHub Pages project base path. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="brand/eraneos-mark.png" alt="" width="22" height="22" />
        <b>eraneos</b>
      </span>
      {!compact && (
        <span className="product-lockup" aria-hidden="true">
          <b>Transformation Cockpit</b>
          <small>part of OET AI Suite</small>
        </span>
      )}
    </div>
  );
}
