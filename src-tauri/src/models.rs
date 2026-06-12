//! Data-transfer objects serialized to the frontend.
//!
//! All structs use `camelCase` so they map cleanly onto the TypeScript
//! interfaces in `src/lib/types.ts`.

use serde::Serialize;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InstalledPackage {
    pub name: String,
    pub full_name: String,
    /// "formula" | "cask"
    pub kind: String,
    pub desc: Option<String>,
    pub homepage: Option<String>,
    pub tap: Option<String>,
    pub installed_version: String,
    pub latest_version: String,
    pub outdated: bool,
    pub pinned: bool,
    pub deprecated: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OutdatedPackage {
    pub name: String,
    pub kind: String,
    pub installed_versions: Vec<String>,
    pub current_version: String,
    pub pinned: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CatalogPackage {
    pub name: String,
    pub full_name: String,
    pub kind: String,
    pub desc: Option<String>,
    pub homepage: Option<String>,
    pub tap: Option<String>,
    pub version: String,
    pub deprecated: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    #[serde(flatten)]
    pub pkg: CatalogPackage,
    pub installed: bool,
}

/// A package ranked by install count, for the "Top Downloaded" charts.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TopPackage {
    #[serde(flatten)]
    pub pkg: CatalogPackage,
    pub installed: bool,
    /// Installs over the trailing 365 days (from Homebrew analytics).
    pub downloads: u64,
    pub rank: u32,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TopCharts {
    pub formulae: Vec<TopPackage>,
    pub casks: Vec<TopPackage>,
    pub trending_formulae: Vec<TopPackage>,
    pub trending_casks: Vec<TopPackage>,
    /// Unix epoch seconds of the cached analytics.
    pub updated_at: u64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Tap {
    pub name: String,
    pub official: bool,
    pub custom: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BrewStatus {
    pub brew_found: bool,
    pub brew_version: String,
    pub brew_path: String,
    pub catalog_ready: bool,
    /// Unix epoch seconds of the last catalog refresh.
    pub catalog_updated_at: Option<u64>,
    pub catalog_count: u32,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PackageDetail {
    pub name: String,
    pub full_name: String,
    pub kind: String,
    pub desc: Option<String>,
    pub homepage: Option<String>,
    pub tap: Option<String>,
    pub version: String,
    pub installed: bool,
    pub installed_version: Option<String>,
    pub outdated: bool,
    pub deprecated: bool,
    pub license: Option<String>,
    pub dependencies: Vec<String>,
    pub caveats: Option<String>,
}

/// Streamed line of output from a running brew job.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct JobLine {
    pub job_id: String,
    /// "stdout" | "stderr" | "info"
    pub stream: String,
    pub line: String,
}

/// Terminal event for a running brew job.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct JobDone {
    pub job_id: String,
    /// "success" | "error"
    pub status: String,
    pub code: Option<i32>,
}
