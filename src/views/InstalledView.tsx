import { useMemo, useState } from "react";
import { ViewShell } from "../components/shell/ViewShell";
import {
  Badge,
  Button,
  EmptyState,
  IconButton,
  SearchInput,
  Segmented,
  type SegmentedOption,
} from "../components/ui";
import { Icon } from "../components/ui/Icon";
import { PackageRow, VersionFlow } from "../components/package/PackageRow";
import { PackageListSkeleton } from "../components/package/PackageListSkeleton";
import { useBrewData } from "../data/BrewDataProvider";
import { usePackageActions } from "../hooks/usePackageActions";
import { useDetail } from "../components/package/DetailProvider";
import { cleanVersion } from "../lib/format";
import type { KindFilter } from "../lib/types";
import "./views.css";

export function InstalledView() {
  const { installed } = useBrewData();
  const actions = usePackageActions();
  const detail = useDetail();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const all = installed.data ?? [];

  const counts = useMemo(
    () => ({
      all: all.length,
      formula: all.filter((p) => p.kind === "formula").length,
      cask: all.filter((p) => p.kind === "cask").length,
    }),
    [all],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((p) => {
      if (kind !== "all" && p.kind !== kind) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || (p.desc?.toLowerCase().includes(q) ?? false);
    });
  }, [all, query, kind]);

  const segments: SegmentedOption<KindFilter>[] = [
    { value: "all", label: "All", count: counts.all },
    { value: "formula", label: "Formulae", count: counts.formula },
    { value: "cask", label: "Casks", count: counts.cask },
  ];

  async function runItem(name: string, fn: () => Promise<unknown>) {
    setBusy((b) => ({ ...b, [name]: true }));
    await fn();
    setBusy((b) => {
      const next = { ...b };
      delete next[name];
      return next;
    });
  }

  const outdatedCount = all.filter((p) => p.outdated).length;

  return (
    <ViewShell
      eyebrow="Library"
      title="Installed"
      subtitle={
        installed.initial
          ? "Loading your library…"
          : `${counts.all} packages${outdatedCount ? ` · ${outdatedCount} need updating` : ""}`
      }
      actions={
        <IconButton
          icon="refresh"
          label="Refresh library"
          onClick={() => void installed.reload()}
        />
      }
    >
      {installed.error && (
        <div className="error-banner">
          <Icon name="alert" size={16} />
          {installed.error}
        </div>
      )}

      {installed.initial && installed.loading ? (
        <PackageListSkeleton rows={7} />
      ) : all.length === 0 ? (
        <EmptyState
          icon="box"
          title="No packages installed"
          description="Head to Discover to search Homebrew's catalog and install your first formula or cask."
        />
      ) : (
        <>
          <div className="view-toolbar">
            <SearchInput
              small
              value={query}
              onValueChange={setQuery}
              placeholder="Filter installed packages…"
              style={{ minWidth: 260 }}
            />
            <Segmented options={segments} value={kind} onChange={setKind} />
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon="search"
              title="No matches"
              description={`Nothing installed matches “${query}”.`}
            />
          ) : (
            <div className="surface pkg-list stagger">
              {filtered.map((pkg, i) => (
                <PackageRow
                  key={`${pkg.kind}:${pkg.name}`}
                  kind={pkg.kind}
                  name={pkg.name}
                  desc={pkg.desc}
                  busy={busy[pkg.name]}
                  onOpen={() => detail.open(pkg.name, pkg.kind)}
                  style={{ animationDelay: `${Math.min(i, 14) * 18}ms` }}
                  sub={pkg.tap ? <span className="mono">{pkg.tap}</span> : undefined}
                  badges={
                    <>
                      {pkg.outdated && (
                        <Badge tone="amber" icon="arrowUp">
                          Update
                        </Badge>
                      )}
                      {pkg.pinned && (
                        <Badge tone="info" icon="pin">
                          Pinned
                        </Badge>
                      )}
                      {pkg.deprecated && (
                        <Badge tone="danger" icon="alert">
                          Deprecated
                        </Badge>
                      )}
                    </>
                  }
                  meta={
                    pkg.outdated ? (
                      <VersionFlow from={pkg.installedVersion} to={pkg.latestVersion} />
                    ) : (
                      <span className="ver-pill mono">{cleanVersion(pkg.installedVersion)}</span>
                    )
                  }
                  actions={
                    <>
                      {pkg.outdated && (
                        <Button
                          size="sm"
                          variant="soft"
                          iconLeft="arrowUp"
                          loading={busy[pkg.name]}
                          onClick={() => runItem(pkg.name, () => actions.upgrade(pkg.name, pkg.kind))}
                        >
                          Update
                        </Button>
                      )}
                      {pkg.kind === "formula" && (
                        <IconButton
                          icon="pin"
                          label={pkg.pinned ? "Unpin" : "Pin to current version"}
                          onClick={() => runItem(pkg.name, () => actions.setPinned(pkg.name, !pkg.pinned))}
                          style={pkg.pinned ? { color: "var(--info)" } : undefined}
                        />
                      )}
                      <IconButton
                        icon="trash"
                        label={`Uninstall ${pkg.name}`}
                        onClick={() => runItem(pkg.name, () => actions.uninstall(pkg.name, pkg.kind))}
                      />
                    </>
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
    </ViewShell>
  );
}
