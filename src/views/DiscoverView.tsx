import { useEffect, useRef, useState } from "react";
import { ViewShell } from "../components/shell/ViewShell";
import {
  Badge,
  Button,
  EmptyState,
  SearchInput,
  Segmented,
  Spinner,
  type SegmentedOption,
} from "../components/ui";
import { Icon } from "../components/ui/Icon";
import { PackageRow } from "../components/package/PackageRow";
import { PackageListSkeleton } from "../components/package/PackageListSkeleton";
import { api } from "../lib/api";
import { cleanVersion, compact, errorMessage, timeAgo } from "../lib/format";
import { usePackageActions } from "../hooks/usePackageActions";
import { useDetail } from "../components/package/DetailProvider";
import { useBrewData } from "../data/BrewDataProvider";
import type { KindFilter, SearchResult } from "../lib/types";
import "./views.css";

const POPULAR = ["wget", "git", "node", "python", "ripgrep", "htop", "ffmpeg", "docker", "go", "neovim"];

interface CatalogState {
  state: "loading" | "ready" | "error";
  count: number;
  updatedAt: number | null;
  error?: string;
}

export function DiscoverView() {
  const actions = usePackageActions();
  const detail = useDetail();
  const { installed } = useBrewData();
  const [catalog, setCatalog] = useState<CatalogState>({
    state: "loading",
    count: 0,
    updatedAt: null,
  });
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function loadCatalog(force: boolean) {
    try {
      const status = await api.ensureCatalog(force);
      if (alive.current) {
        setCatalog({ state: "ready", count: status.catalogCount, updatedAt: status.catalogUpdatedAt });
      }
    } catch (err) {
      if (alive.current) {
        setCatalog({ state: "error", count: 0, updatedAt: null, error: errorMessage(err) });
      }
    }
  }

  useEffect(() => {
    void loadCatalog(false);
  }, []);

  // Debounced catalog search.
  useEffect(() => {
    if (catalog.state !== "ready") return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const id = window.setTimeout(async () => {
      try {
        const found = await api.searchCatalog(q, kind, 60);
        if (alive.current) setResults(found);
      } catch {
        if (alive.current) setResults([]);
      } finally {
        if (alive.current) setSearching(false);
      }
    }, 180);
    return () => window.clearTimeout(id);
  }, [query, kind, catalog.state]);

  // Re-flag installed state in current results after an install/uninstall.
  useEffect(() => {
    if (!installed.data) return;
    const installedKeys = new Set(installed.data.map((p) => `${p.kind}:${p.name}`));
    setResults((prev) =>
      prev.map((r) => {
        const isInstalled = installedKeys.has(`${r.kind}:${r.name}`);
        return isInstalled === r.installed ? r : { ...r, installed: isInstalled };
      }),
    );
  }, [installed.data]);

  async function runItem(name: string, fn: () => Promise<unknown>) {
    setBusy((b) => ({ ...b, [name]: true }));
    await fn();
    setBusy((b) => {
      const next = { ...b };
      delete next[name];
      return next;
    });
  }

  const segments: SegmentedOption<KindFilter>[] = [
    { value: "all", label: "All" },
    { value: "formula", label: "Formulae" },
    { value: "cask", label: "Casks" },
  ];

  if (catalog.state === "loading") {
    return (
      <ViewShell eyebrow="Catalog" title="Discover">
        <div className="discover-prep">
          <Spinner size={30} />
          <div className="discover-prep__title">Preparing the catalog</div>
          <p className="discover-prep__desc">
            Fetching the full list of formulae and casks from formulae.brew.sh. This happens once a
            day and powers instant search.
          </p>
        </div>
      </ViewShell>
    );
  }

  if (catalog.state === "error") {
    return (
      <ViewShell eyebrow="Catalog" title="Discover">
        <div className="error-banner">
          <Icon name="alert" size={16} />
          {catalog.error}
        </div>
        <Button
          variant="secondary"
          iconLeft="refresh"
          onClick={() => {
            setCatalog((c) => ({ ...c, state: "loading" }));
            void loadCatalog(true);
          }}
        >
          Try again
        </Button>
      </ViewShell>
    );
  }

  const hasQuery = query.trim().length > 0;

  return (
    <ViewShell
      eyebrow="Catalog"
      title="Discover"
      subtitle={`Search ${compact(catalog.count)} formulae & casks`}
    >
      <div className="discover-toolbar">
        <SearchInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search for anything — ripgrep, docker, fonts…"
          autoFocus
        />
        <Segmented options={segments} value={kind} onChange={setKind} />
      </div>

      {!hasQuery ? (
        <>
          <div className="suggest">
            <div className="section-label">Popular picks</div>
            <div className="suggest__chips">
              {POPULAR.map((name) => (
                <button key={name} className="suggest__chip" onClick={() => setQuery(name)}>
                  <Icon name="search" size={14} />
                  {name}
                </button>
              ))}
            </div>
          </div>
          <div className="catalog-foot">
            <Icon name="clock" size={13} />
            Catalog updated {timeAgo(catalog.updatedAt)}
            <button
              className="drawer__link"
              onClick={async () => {
                setRefreshing(true);
                await loadCatalog(true);
                if (alive.current) setRefreshing(false);
              }}
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="view-toolbar">
            <span className="result-count">
              {searching ? (
                "Searching…"
              ) : (
                <>
                  <strong>{results.length}</strong> result{results.length === 1 ? "" : "s"} for “
                  {query.trim()}”
                </>
              )}
            </span>
            {searching && <Spinner size={14} />}
          </div>

          {searching && results.length === 0 ? (
            <PackageListSkeleton rows={5} />
          ) : results.length === 0 ? (
            <EmptyState
              icon="search"
              title="No packages found"
              description={`Nothing in the catalog matches “${query.trim()}”. Try a different term or check the spelling.`}
            />
          ) : (
            <div className="surface pkg-list stagger">
              {results.map((pkg, i) => (
                <PackageRow
                  key={`${pkg.kind}:${pkg.name}`}
                  kind={pkg.kind}
                  name={pkg.name}
                  desc={pkg.desc}
                  busy={busy[pkg.name]}
                  onOpen={() => detail.open(pkg.name, pkg.kind)}
                  style={{ animationDelay: `${Math.min(i, 12) * 20}ms` }}
                  sub={pkg.tap ? <span className="mono">{pkg.tap}</span> : undefined}
                  badges={
                    <>
                      <Badge tone={pkg.kind === "cask" ? "copper" : "amber"}>
                        {pkg.kind === "cask" ? "Cask" : "Formula"}
                      </Badge>
                      {pkg.deprecated && (
                        <Badge tone="danger" icon="alert">
                          Deprecated
                        </Badge>
                      )}
                    </>
                  }
                  meta={
                    pkg.version ? <span className="ver-pill mono">{cleanVersion(pkg.version)}</span> : undefined
                  }
                  actions={
                    pkg.installed ? (
                      <span className="installed-badge">
                        <Icon name="checkCircle" size={15} />
                        Installed
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="primary"
                        iconLeft="download"
                        loading={busy[pkg.name]}
                        onClick={() => runItem(pkg.name, () => actions.install(pkg.name, pkg.kind))}
                      >
                        Install
                      </Button>
                    )
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
