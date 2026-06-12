//! The package catalog: the full list of installable formulae and casks from
//! formulae.brew.sh, cached on disk and searched in-memory for instant results.

use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Deserialize;

use crate::models::{CatalogPackage, SearchResult, TopPackage};

const FORMULA_URL: &str = "https://formulae.brew.sh/api/formula.json";
const CASK_URL: &str = "https://formulae.brew.sh/api/cask.json";
const TTL_SECS: u64 = 24 * 60 * 60;
const DEFAULT_LIMIT: usize = 60;

pub struct Catalog {
    pub packages: Vec<CatalogPackage>,
    /// Unix epoch seconds of the cached data.
    pub updated_at: u64,
}

// Minimal shapes; serde ignores the many fields we don't need, keeping the
// 44MB of catalog JSON from ballooning into a serde_json::Value tree.
#[derive(Deserialize)]
struct FormulaIn {
    name: String,
    full_name: Option<String>,
    desc: Option<String>,
    homepage: Option<String>,
    tap: Option<String>,
    versions: VersionsIn,
    #[serde(default)]
    deprecated: bool,
}

#[derive(Deserialize)]
struct VersionsIn {
    stable: Option<String>,
}

#[derive(Deserialize)]
struct CaskIn {
    token: String,
    full_token: Option<String>,
    desc: Option<String>,
    homepage: Option<String>,
    tap: Option<String>,
    version: Option<String>,
    #[serde(default)]
    deprecated: bool,
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn download(url: &str, dest: &Path) -> Result<(), String> {
    let status = Command::new("/usr/bin/curl")
        .args(["-fsSL", "--max-time", "120", "--retry", "2", url, "-o"])
        .arg(dest)
        .status()
        .map_err(|e| format!("Could not run curl: {e}"))?;
    if !status.success() {
        return Err(format!("Failed to download the package catalog from {url}"));
    }
    Ok(())
}

fn parse_formulae(path: &Path, out: &mut Vec<CatalogPackage>) -> Result<(), String> {
    let bytes = fs::read(path).map_err(|e| format!("Could not read catalog: {e}"))?;
    let items: Vec<FormulaIn> =
        serde_json::from_slice(&bytes).map_err(|e| format!("Invalid formula catalog: {e}"))?;
    for f in items {
        let name = f.name;
        out.push(CatalogPackage {
            full_name: f.full_name.unwrap_or_else(|| name.clone()),
            name,
            kind: "formula".into(),
            desc: f.desc.filter(|s| !s.is_empty()),
            homepage: f.homepage.filter(|s| !s.is_empty()),
            tap: f.tap.filter(|s| !s.is_empty()),
            version: f.versions.stable.unwrap_or_default(),
            deprecated: f.deprecated,
        });
    }
    Ok(())
}

fn parse_casks(path: &Path, out: &mut Vec<CatalogPackage>) -> Result<(), String> {
    let bytes = fs::read(path).map_err(|e| format!("Could not read catalog: {e}"))?;
    let items: Vec<CaskIn> =
        serde_json::from_slice(&bytes).map_err(|e| format!("Invalid cask catalog: {e}"))?;
    for c in items {
        let token = c.token;
        out.push(CatalogPackage {
            full_name: c.full_token.unwrap_or_else(|| token.clone()),
            name: token,
            kind: "cask".into(),
            desc: c.desc.filter(|s| !s.is_empty()),
            homepage: c.homepage.filter(|s| !s.is_empty()),
            tap: c.tap.filter(|s| !s.is_empty()),
            version: c.version.unwrap_or_default(),
            deprecated: c.deprecated,
        });
    }
    Ok(())
}

/// Load the catalog from the on-disk cache, downloading a fresh copy when the
/// cache is missing, stale (older than `TTL_SECS`), or `force` is set.
pub fn load_or_fetch(cache_dir: &Path, force: bool) -> Result<Catalog, String> {
    fs::create_dir_all(cache_dir).ok();
    let formula_path = cache_dir.join("formula.json");
    let cask_path = cache_dir.join("cask.json");
    let meta_path = cache_dir.join("catalog.meta");

    let cached_ts = fs::read_to_string(&meta_path)
        .ok()
        .and_then(|s| s.trim().parse::<u64>().ok());
    let fresh = !force
        && formula_path.exists()
        && cask_path.exists()
        && cached_ts.is_some_and(|ts| now_secs().saturating_sub(ts) < TTL_SECS);

    if !fresh {
        download(FORMULA_URL, &formula_path)?;
        download(CASK_URL, &cask_path)?;
        fs::write(&meta_path, now_secs().to_string()).ok();
    }

    let updated_at = fs::read_to_string(&meta_path)
        .ok()
        .and_then(|s| s.trim().parse::<u64>().ok())
        .unwrap_or_else(now_secs);

    let mut packages = Vec::with_capacity(16_000);
    parse_formulae(&formula_path, &mut packages)?;
    parse_casks(&cask_path, &mut packages)?;

    Ok(Catalog {
        packages,
        updated_at,
    })
}

/// Relevance score for a query against a package. Lower is better; `None`
/// means no match.
fn score(pkg: &CatalogPackage, query: &str) -> Option<u32> {
    let name = pkg.name.to_lowercase();
    if name == query {
        return Some(0);
    }
    if name.starts_with(query) {
        return Some(1);
    }
    if name.contains(query) {
        return Some(2);
    }
    if pkg.full_name.to_lowercase().contains(query) {
        return Some(3);
    }
    if pkg
        .desc
        .as_deref()
        .is_some_and(|d| d.to_lowercase().contains(query))
    {
        return Some(4);
    }
    None
}

pub fn search(
    catalog: &Catalog,
    query: &str,
    kind: &str,
    limit: Option<usize>,
    installed_keys: &HashSet<String>,
) -> Vec<SearchResult> {
    let q = query.trim().to_lowercase();
    if q.is_empty() {
        return Vec::new();
    }
    let limit = limit.unwrap_or(DEFAULT_LIMIT).clamp(1, 500);

    let mut scored: Vec<(u32, &CatalogPackage)> = catalog
        .packages
        .iter()
        .filter(|p| kind == "all" || p.kind == kind)
        .filter_map(|p| score(p, &q).map(|s| (s, p)))
        .collect();

    scored.sort_by(|a, b| {
        a.0.cmp(&b.0)
            .then(a.1.name.len().cmp(&b.1.name.len()))
            .then(a.1.name.to_lowercase().cmp(&b.1.name.to_lowercase()))
    });

    scored
        .into_iter()
        .take(limit)
        .map(|(_, p)| SearchResult {
            installed: installed_keys.contains(&format!("{}:{}", p.kind, p.name)),
            pkg: p.clone(),
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Install analytics — the "Top Downloaded" charts
// ---------------------------------------------------------------------------

const FORMULA_YEAR_URL: &str = "https://formulae.brew.sh/api/analytics/install/365d.json";
const CASK_YEAR_URL: &str = "https://formulae.brew.sh/api/analytics/cask-install/365d.json";
const FORMULA_MONTH_URL: &str = "https://formulae.brew.sh/api/analytics/install/30d.json";
const CASK_MONTH_URL: &str = "https://formulae.brew.sh/api/analytics/cask-install/30d.json";

/// Minimum 30-day install *share* for a package to qualify as "trending" —
/// filters long-tail noise where a few extra installs look explosive.
const TRENDING_MIN_SHARE: f64 = 0.0003;
/// Momentum for packages with recent installs but no 365-day history (brand-new
/// arrivals): high enough to surface, capped so they don't crowd everything out.
const NEW_ARRIVAL_MOMENTUM: f64 = 8.0;

/// One analytics window: ranked (name, install count) plus the window total.
pub struct Counts {
    pub items: Vec<(String, u64)>,
    pub total: u64,
}

pub struct Analytics {
    pub formula_year: Counts,
    pub cask_year: Counts,
    pub formula_month: Counts,
    pub cask_month: Counts,
    pub updated_at: u64,
}

#[derive(Deserialize)]
struct AnalyticsFile {
    #[serde(default)]
    total_count: u64,
    items: Vec<AnalyticsItem>,
}

#[derive(Deserialize)]
struct AnalyticsItem {
    // The name lives under "formula" or "cask" depending on the file.
    #[serde(alias = "formula", alias = "cask")]
    name: Option<String>,
    // Homebrew formats counts as strings with thousands separators, e.g. "5,586,847".
    count: Option<String>,
}

fn parse_analytics_file(path: &Path) -> Result<Counts, String> {
    let bytes = fs::read(path).map_err(|e| format!("Could not read analytics: {e}"))?;
    let file: AnalyticsFile =
        serde_json::from_slice(&bytes).map_err(|e| format!("Invalid analytics: {e}"))?;
    let items = file
        .items
        .into_iter()
        .filter_map(|it| {
            let name = it.name?;
            let count = it
                .count
                .unwrap_or_default()
                .replace(',', "")
                .parse::<u64>()
                .unwrap_or(0);
            Some((name, count))
        })
        .collect();
    Ok(Counts {
        items,
        total: file.total_count,
    })
}

/// True if cached data at `updated_at` (epoch seconds) is older than the TTL.
pub fn is_stale(updated_at: u64) -> bool {
    now_secs().saturating_sub(updated_at) >= TTL_SECS
}

/// Load install analytics (365-day + 30-day windows) from the on-disk cache,
/// refreshing when missing, stale, or `force` is set.
pub fn load_analytics(cache_dir: &Path, force: bool) -> Result<Analytics, String> {
    fs::create_dir_all(cache_dir).ok();
    let fy = cache_dir.join("analytics-formula-365d.json");
    let cy = cache_dir.join("analytics-cask-365d.json");
    let fm = cache_dir.join("analytics-formula-30d.json");
    let cm = cache_dir.join("analytics-cask-30d.json");
    let meta_path = cache_dir.join("analytics.meta");

    let cached_ts = fs::read_to_string(&meta_path)
        .ok()
        .and_then(|s| s.trim().parse::<u64>().ok());
    let fresh = !force
        && fy.exists()
        && cy.exists()
        && fm.exists()
        && cm.exists()
        && cached_ts.is_some_and(|ts| now_secs().saturating_sub(ts) < TTL_SECS);

    if !fresh {
        download(FORMULA_YEAR_URL, &fy)?;
        download(CASK_YEAR_URL, &cy)?;
        download(FORMULA_MONTH_URL, &fm)?;
        download(CASK_MONTH_URL, &cm)?;
        fs::write(&meta_path, now_secs().to_string()).ok();
    }

    let updated_at = fs::read_to_string(&meta_path)
        .ok()
        .and_then(|s| s.trim().parse::<u64>().ok())
        .unwrap_or_else(now_secs);

    Ok(Analytics {
        formula_year: parse_analytics_file(&fy)?,
        cask_year: parse_analytics_file(&cy)?,
        formula_month: parse_analytics_file(&fm)?,
        cask_month: parse_analytics_file(&cm)?,
        updated_at,
    })
}

/// Bare-name lookup maps for the catalog, split by kind.
fn build_maps(
    catalog: &Catalog,
) -> (
    HashMap<&str, &CatalogPackage>,
    HashMap<&str, &CatalogPackage>,
) {
    let mut formula_map: HashMap<&str, &CatalogPackage> = HashMap::new();
    let mut cask_map: HashMap<&str, &CatalogPackage> = HashMap::new();
    for p in &catalog.packages {
        if p.kind == "cask" {
            cask_map.insert(p.name.as_str(), p);
        } else {
            formula_map.insert(p.name.as_str(), p);
        }
    }
    (formula_map, cask_map)
}

/// Build the per-kind top-installed charts. Only exact catalog matches are
/// charted — tap-qualified analytics names (e.g. `user/tap/foo`) are skipped so
/// they can never be mis-attributed to an official package of the same name.
pub fn top_charts(
    catalog: &Catalog,
    analytics: &Analytics,
    installed_keys: &HashSet<String>,
    limit: usize,
) -> (Vec<TopPackage>, Vec<TopPackage>) {
    let (formula_map, cask_map) = build_maps(catalog);

    let build =
        |items: &[(String, u64)], map: &HashMap<&str, &CatalogPackage>| -> Vec<TopPackage> {
            let mut out = Vec::with_capacity(limit);
            for (name, count) in items {
                if let Some(p) = map.get(name.as_str()) {
                    out.push(TopPackage {
                        installed: installed_keys.contains(&format!("{}:{}", p.kind, p.name)),
                        downloads: *count,
                        rank: (out.len() + 1) as u32,
                        pkg: (*p).clone(),
                    });
                    if out.len() >= limit {
                        break;
                    }
                }
            }
            out
        };

    (
        build(&analytics.formula_year.items, &formula_map),
        build(&analytics.cask_year.items, &cask_map),
    )
}

/// Build the per-kind "trending" charts: packages whose 30-day install share is
/// high relative to their 365-day share (momentum), filtered by a volume floor
/// and ranked by momentum. Brand-new packages get a fixed boost.
pub fn trending(
    catalog: &Catalog,
    analytics: &Analytics,
    installed_keys: &HashSet<String>,
    limit: usize,
) -> (Vec<TopPackage>, Vec<TopPackage>) {
    let (formula_map, cask_map) = build_maps(catalog);

    let compute =
        |month: &Counts, year: &Counts, map: &HashMap<&str, &CatalogPackage>| -> Vec<TopPackage> {
            let total_month = month.total.max(1) as f64;
            let total_year = year.total.max(1) as f64;
            let year_map: HashMap<&str, u64> =
                year.items.iter().map(|(n, c)| (n.as_str(), *c)).collect();

            // (momentum, name, recent_count)
            let mut scored: Vec<(f64, &str, u64)> = Vec::new();
            for (name, recent) in &month.items {
                let recent_share = *recent as f64 / total_month;
                if recent_share < TRENDING_MIN_SHARE {
                    continue;
                }
                // Exact catalog match only (same rule as top_charts).
                if !map.contains_key(name.as_str()) {
                    continue;
                }
                let base = year_map.get(name.as_str()).copied().unwrap_or(0);
                let base_share = base as f64 / total_year;
                let momentum = if base_share > 0.0 {
                    recent_share / base_share
                } else {
                    NEW_ARRIVAL_MOMENTUM
                };
                scored.push((momentum, name.as_str(), *recent));
            }
            scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

            scored
                .into_iter()
                .take(limit)
                .enumerate()
                .map(|(i, (_, name, recent))| {
                    let p = map[name];
                    TopPackage {
                        installed: installed_keys.contains(&format!("{}:{}", p.kind, p.name)),
                        downloads: recent,
                        rank: (i + 1) as u32,
                        pkg: (*p).clone(),
                    }
                })
                .collect()
        };

    (
        compute(
            &analytics.formula_month,
            &analytics.formula_year,
            &formula_map,
        ),
        compute(&analytics.cask_month, &analytics.cask_year, &cask_map),
    )
}
