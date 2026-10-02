import Link from "next/link";

export type VisitTarget = { id: string; name: string; tone: "lilac" | "peach" | "mint" };

export function VisitPills({ targets }: { targets: VisitTarget[] }) {
  return (
    <div className="shopVisit">
      <span className="shopVisitLabel">Pay a visit to:</span>
      {targets.map((target) => (
        <Link
          key={target.id}
          href={`/store/market/${target.id}`}
          className={`shopPill shopPill--${target.tone}`}
        >
          {target.name}
        </Link>
      ))}
    </div>
  );
}
