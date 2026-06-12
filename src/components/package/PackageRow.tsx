import type { CSSProperties, ReactNode } from "react";
import { Icon } from "../ui/Icon";
import { cleanVersion } from "../../lib/format";
import type { PackageKind } from "../../lib/types";
import "./package.css";

interface PackageRowProps {
  kind: PackageKind;
  name: string;
  desc?: string | null;
  sub?: ReactNode;
  badges?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  onOpen?: () => void;
  busy?: boolean;
  style?: CSSProperties;
}

export function PackageRow({
  kind,
  name,
  desc,
  sub,
  badges,
  meta,
  actions,
  onOpen,
  busy = false,
  style,
}: PackageRowProps) {
  const clickable = Boolean(onOpen);
  const main = (
    <>
      <span className={`pkg-glyph pkg-glyph--${kind}`}>
        <Icon name={kind === "cask" ? "layers" : "box"} size={19} />
      </span>
      <span className="pkg-body">
        <span className="pkg-head">
          <span className="pkg-name">{name}</span>
          {badges}
        </span>
        {desc && <span className="pkg-desc">{desc}</span>}
        {sub && <span className="pkg-sub">{sub}</span>}
      </span>
    </>
  );

  return (
    <div className={`pkg-row${busy ? " pkg-row--busy" : ""}`} style={style}>
      {clickable ? (
        <button
          type="button"
          className="pkg-row__main pkg-row__main--clickable"
          onClick={onOpen}
          aria-label={`View details for ${name}`}
        >
          {main}
        </button>
      ) : (
        <div className="pkg-row__main">{main}</div>
      )}
      {/* meta + actions are siblings of the clickable region, never nested in it */}
      {meta && <div className="pkg-meta">{meta}</div>}
      {actions && <div className="pkg-actions">{actions}</div>}
    </div>
  );
}

/** Installed → latest version display. */
export function VersionFlow({ from, to }: { from: string; to: string }) {
  return (
    <span className="verflow">
      <span className="verflow__from mono">{cleanVersion(from)}</span>
      <Icon name="arrowRight" size={13} />
      <span className="verflow__to mono">{cleanVersion(to)}</span>
    </span>
  );
}
