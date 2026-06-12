import { Button } from "../ui";
import { Icon } from "../ui/Icon";
import { PackageIcon } from "./PackageIcon";
import { compact, cleanVersion } from "../../lib/format";
import type { PackageKind } from "../../lib/types";
import "./appstore.css";

interface AppCardProps {
  kind: PackageKind;
  name: string;
  desc?: string | null;
  version?: string;
  /** Enables a real app icon for casks. */
  homepage?: string | null;
  installed: boolean;
  /** Install count to show in the stat (year for top charts, 30d for trending). */
  downloads?: number;
  /** Chart position; renders a rank badge (top charts only). */
  rank?: number;
  /** Trending variant: flame stat + "last 30 days" wording, no rank badge. */
  trending?: boolean;
  busy?: boolean;
  onOpen: () => void;
  onInstall: () => void;
}

export function AppCard({
  kind,
  name,
  desc,
  version,
  homepage,
  installed,
  downloads,
  rank,
  trending = false,
  busy = false,
  onOpen,
  onInstall,
}: AppCardProps) {
  const kindLabel = kind === "cask" ? "Cask" : "Formula";
  const rankClass = rank && rank <= 3 ? ` app-card__rank--${rank}` : "";

  // A single, descriptive accessible name for the card (rank, kind, version, desc).
  const cardLabel = [
    rank ? `No. ${rank}` : null,
    name,
    kindLabel,
    version ? `version ${cleanVersion(version)}` : null,
    desc || null,
  ]
    .filter(Boolean)
    .join(", ");

  const statText =
    downloads !== undefined
      ? `${downloads.toLocaleString()} installs in the ${trending ? "last 30 days" : "past year"}`
      : undefined;

  return (
    <div className={`app-card${busy ? " app-card--busy" : ""}`}>
      <button type="button" className="app-card__hit" onClick={onOpen} aria-label={cardLabel}>
        <span className="app-card__iconwrap">
          <PackageIcon kind={kind} homepage={homepage} size={56} />
          {rank !== undefined && <span className={`app-card__rank${rankClass}`}>{rank}</span>}
        </span>
        <span className="app-card__info">
          <span className="app-card__name">{name}</span>
          <span className="app-card__meta">
            {kindLabel}
            {version ? ` · v${cleanVersion(version)}` : ""}
          </span>
          <span className="app-card__desc">{desc || "No description available."}</span>
        </span>
      </button>

      <div className="app-card__foot">
        {downloads !== undefined ? (
          <span
            className={`app-card__stat${trending ? " app-card__stat--trending" : ""}`}
            aria-label={statText}
            title={statText}
          >
            <Icon name={trending ? "flame" : "download"} size={13} />
            {compact(downloads)}
          </span>
        ) : (
          <span className="app-card__stat muted">{kindLabel}</span>
        )}

        {installed ? (
          <span className="installed-badge" aria-label={`${name} is installed`}>
            <Icon name="checkCircle" size={15} />
            Installed
          </span>
        ) : (
          <Button
            size="sm"
            variant="primary"
            iconLeft="download"
            loading={busy}
            aria-label={`Get ${name}`}
            onClick={onInstall}
          >
            Get
          </Button>
        )}
      </div>
    </div>
  );
}
