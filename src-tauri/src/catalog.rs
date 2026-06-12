//! The package catalog: the full list of installable formulae and casks from
//! formulae.brew.sh, cached on disk and searched in-memory for instant results.

use std::collections::HashSet;
use std::fs;
use std::path::Path;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Deserialize;

use crate::models::{CatalogPackage, SearchResult};

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
