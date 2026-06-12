//! Brewhouse command layer: the Tauri commands the React frontend invokes,
//! plus the shared application state.

mod brew;
mod catalog;
mod models;

use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Mutex;

use serde_json::Value;
use tauri::{AppHandle, Manager, State};

use models::*;

pub struct AppState {
    pub brew: PathBuf,
    pub brew_found: bool,
    pub catalog: Mutex<Option<catalog::Catalog>>,
    /// "kind:name" keys for currently installed packages, used to flag search
    /// results. Refreshed by `list_installed`.
    pub installed_keys: Mutex<HashSet<String>>,
    /// Resolved once at startup — the version string never changes at runtime,
    /// so `get_status` never has to shell out on the main thread.
    pub brew_version: String,
}

// `unwrap_or_else(|e| e.into_inner())` recovers a poisoned lock instead of
// panicking — important under `panic = "abort"`, where a panic is fatal. The
// guarded data is always in a valid state.
fn lock<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|e| e.into_inner())
}

fn status_snapshot(state: &AppState) -> BrewStatus {
    let (ready, ts, count) = match &*lock(&state.catalog) {
        Some(c) => (true, Some(c.updated_at), c.packages.len() as u32),
        None => (false, None, 0),
    };
    BrewStatus {
        brew_found: state.brew_found,
        brew_version: state.brew_version.clone(),
        brew_path: state.brew.display().to_string(),
        catalog_ready: ready,
        catalog_updated_at: ts,
        catalog_count: count,
    }
}

// ---------------------------------------------------------------------------
// Read commands
// ---------------------------------------------------------------------------

#[tauri::command]
fn get_status(state: State<'_, AppState>) -> BrewStatus {
    status_snapshot(&state)
}

#[tauri::command]
async fn list_installed(state: State<'_, AppState>) -> Result<Vec<InstalledPackage>, String> {
    let brew = state.brew.clone();
    let pkgs = tauri::async_runtime::spawn_blocking(move || -> Result<_, String> {
        let json = brew::run_brew_capture(&brew, &["info", "--json=v2", "--installed"])?;
        brew::parse_installed(&json)
    })
    .await
    .map_err(|e| e.to_string())??;

    let mut keys = lock(&state.installed_keys);
    keys.clear();
    for p in &pkgs {
        keys.insert(format!("{}:{}", p.kind, p.name));
    }
    Ok(pkgs)
}

#[tauri::command]
async fn list_outdated(state: State<'_, AppState>) -> Result<Vec<OutdatedPackage>, String> {
    let brew = state.brew.clone();
    tauri::async_runtime::spawn_blocking(move || -> Result<_, String> {
        let json = brew::run_brew_capture(&brew, &["outdated", "--json=v2"])?;
        brew::parse_outdated(&json)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn list_taps(state: State<'_, AppState>) -> Result<Vec<Tap>, String> {
    let brew = state.brew.clone();
    tauri::async_runtime::spawn_blocking(move || -> Result<_, String> {
        let out = brew::run_brew_capture(&brew, &["tap"])?;
        Ok(brew::parse_taps(&out))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn ensure_catalog(
    app: AppHandle,
    state: State<'_, AppState>,
    force: bool,
) -> Result<BrewStatus, String> {
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| format!("No cache directory: {e}"))?;
    let cat =
        tauri::async_runtime::spawn_blocking(move || catalog::load_or_fetch(&cache_dir, force))
            .await
            .map_err(|e| e.to_string())??;
    *lock(&state.catalog) = Some(cat);
    Ok(status_snapshot(&state))
}

#[tauri::command]
fn search_catalog(
    state: State<'_, AppState>,
    query: String,
    kind: String,
    limit: Option<usize>,
) -> Result<Vec<SearchResult>, String> {
    let guard = lock(&state.catalog);
    let cat = guard.as_ref().ok_or("Package catalog is still loading")?;
    let keys = lock(&state.installed_keys);
    Ok(catalog::search(cat, &query, &kind, limit, &keys))
}

fn opt_str(v: &Value) -> Option<String> {
    v.as_str().map(str::to_string).filter(|s| !s.is_empty())
}

#[tauri::command]
async fn get_package_info(
    state: State<'_, AppState>,
    name: String,
    kind: String,
) -> Result<PackageDetail, String> {
    validate_token(&name)?;
    let brew = state.brew.clone();
    tauri::async_runtime::spawn_blocking(move || -> Result<PackageDetail, String> {
        let args: Vec<&str> = if kind == "cask" {
            vec!["info", "--json=v2", "--cask", &name]
        } else {
            vec!["info", "--json=v2", &name]
        };
        let json = brew::run_brew_capture(&brew, &args)?;
        let root: Value = serde_json::from_str(&json).map_err(|e| format!("Invalid JSON: {e}"))?;

        if kind != "cask" {
            let f = root["formulae"]
                .as_array()
                .and_then(|a| a.first())
                .ok_or("Package not found")?;
            let latest = opt_str(&f["versions"]["stable"]).unwrap_or_default();
            let installed_arr = f["installed"].as_array();
            let installed = installed_arr.map(|a| !a.is_empty()).unwrap_or(false);
            let installed_version = installed_arr
                .and_then(|a| a.first())
                .and_then(|k| opt_str(&k["version"]));
            let dependencies = f["dependencies"]
                .as_array()
                .map(|a| a.iter().filter_map(opt_str).collect())
                .unwrap_or_default();
            let nm = opt_str(&f["name"]).unwrap_or(name.clone());
            Ok(PackageDetail {
                full_name: opt_str(&f["full_name"]).unwrap_or_else(|| nm.clone()),
                name: nm,
                kind: "formula".into(),
                desc: opt_str(&f["desc"]),
                homepage: opt_str(&f["homepage"]),
                tap: opt_str(&f["tap"]),
                version: latest,
                installed,
                installed_version,
                outdated: f["outdated"].as_bool().unwrap_or(false),
                deprecated: f["deprecated"].as_bool().unwrap_or(false),
                license: opt_str(&f["license"]),
                dependencies,
                caveats: opt_str(&f["caveats"]),
            })
        } else {
            let c = root["casks"]
                .as_array()
                .and_then(|a| a.first())
                .ok_or("Package not found")?;
            let token = opt_str(&c["token"]).unwrap_or(name.clone());
            let installed_version = opt_str(&c["installed"]);
            let desc = opt_str(&c["desc"]).or_else(|| {
                c["name"]
                    .as_array()
                    .and_then(|a| a.first())
                    .and_then(opt_str)
            });
            Ok(PackageDetail {
                full_name: opt_str(&c["full_token"]).unwrap_or_else(|| token.clone()),
                name: token,
                kind: "cask".into(),
                desc,
                homepage: opt_str(&c["homepage"]),
                tap: opt_str(&c["tap"]),
                version: opt_str(&c["version"]).unwrap_or_default(),
                installed: installed_version.is_some(),
                installed_version,
                outdated: c["outdated"].as_bool().unwrap_or(false),
                deprecated: c["deprecated"].as_bool().unwrap_or(false),
                license: None,
                dependencies: Vec::new(),
                caveats: opt_str(&c["caveats"]),
            })
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

// ---------------------------------------------------------------------------
// Job commands — return a job id immediately; output streams via events.
// ---------------------------------------------------------------------------

fn require_brew(state: &AppState) -> Result<PathBuf, String> {
    if state.brew_found {
        Ok(state.brew.clone())
    } else {
        Err("Homebrew was not found on this system.".into())
    }
}

fn start_job(
    app: &AppHandle,
    state: &AppState,
    args: Vec<String>,
    allow_auto_update: bool,
) -> Result<String, String> {
    let brew = require_brew(state)?;
    let job_id = brew::next_job_id();
    brew::spawn_job(app.clone(), brew, args, job_id.clone(), allow_auto_update);
    Ok(job_id)
}

/// Reject anything that isn't a plausible bare package token, so a name can
/// never smuggle extra flags into the brew invocation.
fn validate_token(name: &str) -> Result<(), String> {
    let ok = !name.is_empty()
        && name.len() <= 120
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | '+' | '@' | '/'));
    if ok && !name.starts_with('-') {
        Ok(())
    } else {
        Err(format!("Invalid package name: {name}"))
    }
}

fn validate_tap(name: &str) -> Result<(), String> {
    let parts: Vec<&str> = name.split('/').collect();
    let shape_ok = parts.len() == 2 && !parts[0].is_empty() && !parts[1].is_empty();
    let chars_ok = name
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | '/'));
    if shape_ok && chars_ok && !name.starts_with('-') {
        Ok(())
    } else {
        Err(format!("Tap must look like `user/repo` (got `{name}`)"))
    }
}

#[tauri::command]
fn install_package(
    app: AppHandle,
    state: State<'_, AppState>,
    name: String,
    kind: String,
) -> Result<String, String> {
    validate_token(&name)?;
    let args = if kind == "cask" {
        vec!["install".into(), "--cask".into(), name]
    } else {
        vec!["install".into(), name]
    };
    start_job(&app, &state, args, false)
}

#[tauri::command]
fn uninstall_package(
    app: AppHandle,
    state: State<'_, AppState>,
    name: String,
    kind: String,
) -> Result<String, String> {
    validate_token(&name)?;
    let args = if kind == "cask" {
        vec!["uninstall".into(), "--cask".into(), name]
    } else {
        vec!["uninstall".into(), name]
    };
    start_job(&app, &state, args, false)
}

#[tauri::command]
fn upgrade_package(
    app: AppHandle,
    state: State<'_, AppState>,
    name: String,
    kind: String,
) -> Result<String, String> {
    validate_token(&name)?;
    let args = if kind == "cask" {
        vec!["upgrade".into(), "--cask".into(), name]
    } else {
        vec!["upgrade".into(), name]
    };
    start_job(&app, &state, args, false)
}

#[tauri::command]
fn upgrade_all(app: AppHandle, state: State<'_, AppState>) -> Result<String, String> {
    start_job(&app, &state, vec!["upgrade".into()], false)
}

#[tauri::command]
fn brew_update(app: AppHandle, state: State<'_, AppState>) -> Result<String, String> {
    // The one place we let brew refresh its own metadata.
    start_job(&app, &state, vec!["update".into()], true)
}

#[tauri::command]
fn add_tap(app: AppHandle, state: State<'_, AppState>, name: String) -> Result<String, String> {
    validate_tap(&name)?;
    start_job(&app, &state, vec!["tap".into(), name], true)
}

#[tauri::command]
fn remove_tap(app: AppHandle, state: State<'_, AppState>, name: String) -> Result<String, String> {
    validate_tap(&name)?;
    start_job(&app, &state, vec!["untap".into(), name], false)
}

#[tauri::command]
async fn set_pinned(state: State<'_, AppState>, name: String, pinned: bool) -> Result<(), String> {
    validate_token(&name)?;
    let brew = require_brew(&state)?;
    tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        let sub = if pinned { "pin" } else { "unpin" };
        brew::run_brew_capture(&brew, &[sub, &name]).map(|_| ())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    let is_http = url.starts_with("https://") || url.starts_with("http://");
    let has_unsafe = url.chars().any(|c| c.is_control() || c.is_whitespace());
    // For "scheme://host/rest", the host is the 3rd `/`-separated segment.
    let host = url.split('/').nth(2).unwrap_or("");
    if !is_http || has_unsafe || host.is_empty() {
        return Err("Only well-formed http(s) links can be opened.".into());
    }
    // Pick the OS's "open this URL" helper.
    let mut cmd = if cfg!(target_os = "macos") {
        let mut c = std::process::Command::new("/usr/bin/open");
        c.arg(&url);
        c
    } else if cfg!(target_os = "windows") {
        let mut c = std::process::Command::new("cmd");
        c.args(["/C", "start", "", &url]);
        c
    } else {
        let mut c = std::process::Command::new("xdg-open");
        c.arg(&url);
        c
    };
    cmd.spawn()
        .map_err(|e| format!("Could not open link: {e}"))?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let located = brew::locate_brew();
    let brew_found = located.is_some();
    let brew = located.unwrap_or_else(|| PathBuf::from("brew"));

    // Resolve the version once, off the hot path (this runs before the event loop).
    let brew_version = if brew_found {
        brew::run_brew_capture(&brew, &["--version"])
            .ok()
            .and_then(|s| s.lines().next().map(str::to_string))
            .unwrap_or_else(|| "Homebrew".into())
    } else {
        "Homebrew not found".into()
    };

    tauri::Builder::default()
        .manage(AppState {
            brew,
            brew_found,
            catalog: Mutex::new(None),
            installed_keys: Mutex::new(HashSet::new()),
            brew_version,
        })
        .invoke_handler(tauri::generate_handler![
            get_status,
            list_installed,
            list_outdated,
            list_taps,
            ensure_catalog,
            search_catalog,
            get_package_info,
            install_package,
            uninstall_package,
            upgrade_package,
            upgrade_all,
            brew_update,
            add_tap,
            remove_tap,
            set_pinned,
            open_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Brewhouse");
}
