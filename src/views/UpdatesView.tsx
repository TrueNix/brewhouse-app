import { useState } from "react";
import { ViewShell } from "../components/shell/ViewShell";
import { Badge, Button, EmptyState } from "../components/ui";
import { Icon } from "../components/ui/Icon";
import { PackageRow, VersionFlow } from "../components/package/PackageRow";
import { PackageListSkeleton } from "../components/package/PackageListSkeleton";
import { useBrewData } from "../data/BrewDataProvider";
import { usePackageActions } from "../hooks/usePackageActions";
import { useDetail } from "../components/package/DetailProvider";
import "./views.css";

export function UpdatesView() {
  const { outdated } = useBrewData();
  const actions = usePackageActions();
  const detail = useDetail();
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [checking, setChecking] = useState(false);
  const [upgradingAll, setUpgradingAll] = useState(false);

  const data = outdated.data ?? [];
  const formulae = data.filter((p) => p.kind === "formula").length;
  const casks = data.filter((p) => p.kind === "cask").length;
  const hasUpdates = data.length > 0;

  async function runItem(name: string, fn: () => Promise<unknown>) {
    setBusy((b) => ({ ...b, [name]: true }));
    await fn();
    setBusy((b) => {
      const next = { ...b };
      delete next[name];
      return next;
    });
  }

  const headerActions = (
    <>
      <Button
        variant="secondary"
        iconLeft="refresh"
        loading={checking}
        onClick={async () => {
          setChecking(true);
          await actions.update();
          setChecking(false);
        }}
      >
        Check
      </Button>
      <Button
        variant="primary"
        iconLeft="arrowUp"
        disabled={!hasUpdates || upgradingAll}
        loading={upgradingAll}
        onClick={async () => {
          setUpgradingAll(true);
          await actions.upgradeAll();
          setUpgradingAll(false);
        }}
      >
        Update all
      </Button>
    </>
  );

  return (
    <ViewShell
      eyebrow="Maintenance"
      title="Updates"
      subtitle={
        outdated.initial
          ? "Checking for updates…"
          : hasUpdates
            ? `${data.length} package${data.length === 1 ? "" : "s"} can be upgraded`
            : "Your packages are up to date"
      }
      actions={headerActions}
    >
      {outdated.error && (
        <div className="error-banner">
          <Icon name="alert" size={16} />
          {outdated.error}
        </div>
      )}

      {outdated.initial && outdated.loading ? (
        <PackageListSkeleton rows={5} />
      ) : !hasUpdates ? (
        <EmptyState
          icon="sparkles"
          title="You're all caught up"
          description="Every installed formula and cask is on its latest version. Check again any time to refresh Homebrew's metadata."
        >
          <Button
            variant="soft"
            iconLeft="refresh"
            loading={checking}
            onClick={async () => {
              setChecking(true);
              await actions.update();
              setChecking(false);
            }}
          >
            Check for updates
          </Button>
        </EmptyState>
      ) : (
        <>
          <div className="update-hero">
            <div>
              <div className="update-hero__num">{data.length}</div>
              <div className="update-hero__label">
                update{data.length === 1 ? "" : "s"} available
              </div>
              <div className="update-hero__split">
                {formulae > 0 && <Badge tone="amber">{formulae} formulae</Badge>}
                {casks > 0 && <Badge tone="copper">{casks} casks</Badge>}
              </div>
            </div>
            <div className="update-hero__actions">
              <Button
                variant="primary"
                size="lg"
                iconLeft="arrowUp"
                loading={upgradingAll}
                onClick={async () => {
                  setUpgradingAll(true);
                  await actions.upgradeAll();
                  setUpgradingAll(false);
                }}
              >
                Update all
              </Button>
            </div>
          </div>

          <div className="surface pkg-list stagger">
            {data.map((pkg, i) => (
              <PackageRow
                key={`${pkg.kind}:${pkg.name}`}
                kind={pkg.kind}
                name={pkg.name}
                busy={busy[pkg.name]}
                onOpen={() => detail.open(pkg.name, pkg.kind)}
                style={{ animationDelay: `${Math.min(i, 12) * 22}ms` }}
                badges={
                  pkg.pinned ? (
                    <Badge tone="info" icon="pin">
                      Pinned
                    </Badge>
                  ) : undefined
                }
                meta={
                  <VersionFlow from={pkg.installedVersions[0] ?? "—"} to={pkg.currentVersion} />
                }
                actions={
                  <Button
                    size="sm"
                    variant={pkg.pinned ? "ghost" : "soft"}
                    iconLeft="arrowUp"
                    disabled={pkg.pinned}
                    loading={busy[pkg.name]}
                    title={pkg.pinned ? "Unpin to upgrade" : undefined}
                    onClick={() => runItem(pkg.name, () => actions.upgrade(pkg.name, pkg.kind))}
                  >
                    Update
                  </Button>
                }
              />
            ))}
          </div>
        </>
      )}
    </ViewShell>
  );
}
