import { useState } from "react";
import { Icon } from "../ui/Icon";
import { hostOf } from "../../lib/format";
import type { PackageKind } from "../../lib/types";
import "./package.css";

interface PackageIconProps {
  kind: PackageKind;
  /** Used to derive a real app icon for casks. */
  homepage?: string | null;
  size?: number;
}

/**
 * Shows a real app icon for casks (fetched from the homepage's domain) and
 * falls back to the kind glyph for formulae, missing homepages, or load errors.
 */
export function PackageIcon({ kind, homepage, size = 38 }: PackageIconProps) {
  const [failed, setFailed] = useState(false);
  // Only casks have meaningful app icons; CLI formulae keep the typographic glyph.
  const host = kind === "cask" ? hostOf(homepage ?? null) : null;
  const showReal = Boolean(host) && !failed;

  return (
    <span
      className={`pkg-icon pkg-icon--${kind}${showReal ? " pkg-icon--real" : ""}`}
      style={{ width: size, height: size }}
    >
      {showReal ? (
        <img
          src={`https://icons.duckduckgo.com/ip3/${host}.ico`}
          alt=""
          loading="lazy"
          draggable={false}
          onError={() => setFailed(true)}
        />
      ) : (
        <Icon name={kind === "cask" ? "layers" : "box"} size={Math.round(size * 0.46)} />
      )}
    </span>
  );
}
