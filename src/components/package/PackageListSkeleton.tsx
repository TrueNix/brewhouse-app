import { Skeleton } from "../ui";
import "./package.css";

export function PackageListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="surface pkg-list" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="pkg-row" key={i}>
          <Skeleton width={38} height={38} radius={10} />
          <div className="pkg-body" style={{ display: "grid", gap: 8 }}>
            <Skeleton width={`${38 + ((i * 7) % 32)}%`} height={13} radius={6} />
            <Skeleton width={`${60 + ((i * 11) % 25)}%`} height={11} radius={6} />
          </div>
          <Skeleton width={70} height={22} radius={999} />
          <Skeleton width={84} height={30} radius={8} />
        </div>
      ))}
    </div>
  );
}
