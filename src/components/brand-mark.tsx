import Image from "next/image";
import eraneosMark from "../../public/brand/eraneos-mark.png";

type BrandMarkProps = {
  compact?: boolean;
};

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <div
      className={`brand-lockup${compact ? " brand-lockup-compact" : ""}`}
      aria-label="eraneos Transformation Cockpit, part of OET AI Suite"
    >
      <span className="eraneos-mark" aria-hidden="true">
        <Image src={eraneosMark} alt="" width={22} height={22} priority />
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
