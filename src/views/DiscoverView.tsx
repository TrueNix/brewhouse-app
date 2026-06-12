import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ViewShell } from "../components/shell/ViewShell";
import {
  Button,
  EmptyState,
  SearchInput,
  Segmented,
  Skeleton,
  Spinner,
  type SegmentedOption,
} from "../components/ui";
import { Icon } from "../components/ui/Icon";
import { AppCard } from "../components/package/AppCard";
import { api } from "../lib/api";
import { compact, errorMessage, timeAgo } from "../lib/format";
import { usePackageActions } from "../hooks/usePackageActions";
import { useDetail } from "../components/package/DetailProvider";
import { useBrewData } from "../data/BrewDataProvider";
import type { KindFilter, SearchResult, TopCharts, TopPackage } from "../lib/types";
import "./views.css";

interface CatalogState {
  state: "loading" | "ready" | "error";
  count: number;
  updatedAt: number | null;
  error?: string;
}

const keyOf = (p: { kind: string; name: string }) => `${p.kind}:${p.name}`;

function CardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="app-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className="app-card" key={i} style={{ padding: "var(--space-4)" }}>
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <Skeleton width={58} height={58} radius={14} />
            <div style={{ flex: 1, display: "grid", gap: 8, paddingTop: 4 }}>
              <Skeleton width="55%" height={13} radius={6} />
              <Skeleton width="35%" height={10} radius={6} />
              <Skeleton width="92%" height={10} radius={6} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
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
  const [charts, setCharts] = useState<TopCharts | null>(null);
  const [chartsError, setChartsError] = useState<string | null>(null);
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
      if (alive.current) setCatalog({ state: "error", count: 0, updatedAt: null, error: errorMessage(err) });
    }
  }

  async function loadCharts(force = false) {
    setChartsError(null);
    try {
      const c = await api.topDownloaded(40, force);
      if (alive.current) setCharts(c);
    } catch (err) {
      if (alive.current) setChartsError(errorMessage(err));
    }
  }

  useEffect(() => {
    void loadCatalog(false);
  }, []);

  // Once the catalog is ready, pull the download + trending charts.
  useEffect(() => {
    if (catalog.state === "ready" && !charts) void loadCharts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog.state]);

  // Debounced catalog search with a latest-request guard so a slow older
  // response can't overwrite a newer one.
  useEffect(() => {
    if (catalog.state !== "ready") return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearching(false);
      return;
    }
    let current = true;
    setSearching(true);
    const id = window.setTimeout(async () => {
      try {
        const found = await api.searchCatalog(q, kind, 60);
        if (alive.current && current) setResults(found);
      } catch {
        if (alive.current && current) setResults([]);
      } finally {
        if (alive.current && current) setSearching(false);
      }
    }, 180);
    return () => {
      current = false;
      window.clearTimeout(id);
    };
  }, [query, kind, catalog.state]);

  // Live installed lookup so cards reflect installs/uninstalls authoritatively.
  const installedKeys = useMemo(
    () => new Set((installed.data ?? []).map(keyOf)),
    [installed.data],
  );
  const installedReady = installed.data != null;
  const isInstalled = (pkg: TopPackage | SearchResult) =>
    installedReady ? installedKeys.has(keyOf(pkg)) : pkg.installed;

  async function runItem(key: string, fn: () => Promise<unknown>) {
    setBusy((b) => ({ ...b, [key]: true }));
    await fn();
    if (!alive.current) return;
    setBusy((b) => {
      const next = { ...b };
      delete next[key];
      return next;
    });
  }

  function renderCard(
    pkg: TopPackage | SearchResult,
    opts: { rank?: number; downloads?: number; trending?: boolean },
  ) {
    const k = keyOf(pkg);
    return (
      <AppCard
        key={k}
        kind={pkg.kind}
        name={pkg.name}
        desc={pkg.desc}
        version={pkg.version}
        homepage={pkg.homepage}
        rank={opts.rank}
        downloads={opts.downloads}
        trending={opts.trending}
        installed={isInstalled(pkg)}
        busy={busy[k]}
        onOpen={() => detail.open(pkg.name, pkg.kind)}
        onInstall={() => runItem(k, () => actions.install(pkg.name, pkg.kind))}
      />
    );
  }

  function section(
    title: string,
    sub: string,
    items: TopPackage[],
    variant: "top" | "trending",
  ): ReactNode {
    if (items.length === 0) return null;
    return (
      <div className="chart-section">
        <div className="chart-head">
          {variant === "trending" && (
            <span className="chart-head__flame">
              <Icon name="flame" size={18} />
            </span>
          )}
          <span className="chart-head__title">{title}</span>
          <span className="chart-head__kind">{sub}</span>
        </div>
        <div className="app-grid">
          {items.map((p) =>
            variant === "trending"
              ? renderCard(p, { downloads: p.downloads, trending: true })
              : renderCard(p, { rank: p.rank, downloads: p.downloads }),
          )}
        </div>
      </div>
    );
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
            day and powers instant search and the download charts.
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

  // Browse sections by filter.
  function browseSections(): ReactNode {
    if (!charts) return null;
    if (kind === "formula") {
      return (
        <>
          {section("Trending", "gaining now · 30d", charts.trendingFormulae.slice(0, 12), "trending")}
          {section("Top Downloaded", "most installed · 1y", charts.formulae, "top")}
        </>
      );
    }
    if (kind === "cask") {
      return (
        <>
          {section("Trending", "gaining now · 30d", charts.trendingCasks.slice(0, 12), "trending")}
          {section("Top Downloaded", "most installed · 1y", charts.casks, "top")}
        </>
      );
    }
    // "all": a mixed trending row, then per-kind top charts.
    const trendingMix = [
      ...charts.trendingFormulae.slice(0, 4),
      ...charts.trendingCasks.slice(0, 4),
    ];
    return (
      <>
        {section("Trending now", "gaining the most installs this month", trendingMix, "trending")}
        {section("Top Formulae", "most installed · 1y", charts.formulae.slice(0, 12), "top")}
        {section("Top Casks", "most installed · 1y", charts.casks.slice(0, 12), "top")}
      </>
    );
  }

  return (
    <ViewShell
      eyebrow="Catalog"
      title="Discover"
      subtitle={
        hasQuery
          ? `Searching ${compact(catalog.count)} packages`
          : "What's trending and most installed across Homebrew"
      }
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

      {hasQuery ? (
        <>
          <div className="view-toolbar">
            <span className="result-count" role="status" aria-live="polite">
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
            <CardGridSkeleton count={6} />
          ) : results.length === 0 ? (
            <EmptyState
              icon="search"
              title="No packages found"
              description={`Nothing in the catalog matches “${query.trim()}”. Try a different term or check the spelling.`}
            />
          ) : (
            <div className="app-grid">{results.map((p) => renderCard(p, {}))}</div>
          )}
        </>
      ) : chartsError ? (
        <>
          <div className="error-banner">
            <Icon name="alert" size={16} />
            {chartsError}
          </div>
          <Button variant="secondary" iconLeft="refresh" onClick={() => void loadCharts(true)}>
            Retry charts
          </Button>
        </>
      ) : !charts ? (
        <CardGridSkeleton count={8} />
      ) : (
        <>
          {browseSections()}

          <div className="catalog-foot">
            <Icon name="clock" size={13} />
            Charts &amp; catalog updated {timeAgo(charts.updatedAt)}
            <button
              className="drawer__link"
              onClick={async () => {
                setRefreshing(true);
                await loadCatalog(true);
                await loadCharts(true);
                if (alive.current) setRefreshing(false);
              }}
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </>
      )}
    </ViewShell>
  );
}
