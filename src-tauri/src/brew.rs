//! Locating the `brew` binary, running it, parsing its JSON output, and
//! streaming long-running jobs back to the frontend as Tauri events.

use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};

use serde_json::Value;
use tauri::{AppHandle, Emitter};

use crate::models::{InstalledPackage, JobDone, JobLine, OutdatedPackage, Tap};

static JOB_COUNTER: AtomicU64 = AtomicU64::new(1);

/// Best-effort discovery of the Homebrew binary. App bundles don't inherit the
/// user's shell `PATH`, so we probe the canonical install locations first.
pub fn locate_brew() -> Option<PathBuf> {
    if let Ok(prefix) = std::env::var("HOMEBREW_PREFIX") {
        let cand = PathBuf::from(prefix).join("bin").join("brew");
        if cand.exists() {
            return Some(cand);
        }
    }
    for candidate in [
        "/opt/homebrew/bin/brew",
        "/usr/local/bin/brew",
        "/home/linuxbrew/.linuxbrew/bin/brew",
    ] {
        let p = PathBuf::from(candidate);
        if p.exists() {
            return Some(p);
        }
    }
    if let Ok(out) = Command::new("/usr/bin/which").arg("brew").output() {
        if out.status.success() {
            let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !s.is_empty() {
                return Some(PathBuf::from(s));
            }
        }
    }
    None
}

/// Run a brew subcommand and capture stdout. Errors carry brew's stderr so the
/// UI can surface an actionable message.
pub fn run_brew_capture(brew: &Path, args: &[&str]) -> Result<String, String> {
    let out = Command::new(brew)
        .args(args)
        .env("HOMEBREW_NO_AUTO_UPDATE", "1")
        .env("HOMEBREW_NO_ENV_HINTS", "1")
        .env("HOMEBREW_NO_ANALYTICS", "1")
        .env("HOMEBREW_NO_COLOR", "1")
        .output()
        .map_err(|e| format!("Could not launch brew: {e}"))?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        let msg = err.trim();
        return Err(if msg.is_empty() {
            format!("`brew {}` failed", args.join(" "))
        } else {
            msg.to_string()
        });
    }
    Ok(String::from_utf8_lossy(&out.stdout).to_string())
}

fn opt_str(v: &Value) -> Option<String> {
    v.as_str().map(|s| s.to_string()).filter(|s| !s.is_empty())
}

// ---------------------------------------------------------------------------
// Parsing `brew info --json=v2 --installed`
// ---------------------------------------------------------------------------

pub fn parse_installed(json: &str) -> Result<Vec<InstalledPackage>, String> {
    let root: Value = serde_json::from_str(json).map_err(|e| format!("Invalid brew JSON: {e}"))?;
    let mut out = Vec::new();

    if let Some(formulae) = root.get("formulae").and_then(Value::as_array) {
        for f in formulae {
            let name = match opt_str(&f["name"]) {
                Some(n) => n,
                None => continue,
            };
            let latest = opt_str(&f["versions"]["stable"]).unwrap_or_default();
            // `installed` is an array of installed kegs; the first is the active one.
            let installed_version = f["installed"]
                .as_array()
                .and_then(|a| a.first())
                .and_then(|k| opt_str(&k["version"]))
                .unwrap_or_else(|| latest.clone());
            out.push(InstalledPackage {
                name: name.clone(),
                full_name: opt_str(&f["full_name"]).unwrap_or(name),
                kind: "formula".into(),
                desc: opt_str(&f["desc"]),
                homepage: opt_str(&f["homepage"]),
                tap: opt_str(&f["tap"]),
                installed_version,
                latest_version: latest,
                outdated: f["outdated"].as_bool().unwrap_or(false),
                pinned: f["pinned"].as_bool().unwrap_or(false),
                deprecated: f["deprecated"].as_bool().unwrap_or(false),
            });
        }
    }

    if let Some(casks) = root.get("casks").and_then(Value::as_array) {
        for c in casks {
            let token = match opt_str(&c["token"]) {
                Some(t) => t,
                None => continue,
            };
            let latest = opt_str(&c["version"]).unwrap_or_default();
            let installed_version = opt_str(&c["installed"]).unwrap_or_else(|| latest.clone());
            // Casks expose human-readable names in a `name` array; use the first.
            let desc = opt_str(&c["desc"]).or_else(|| {
                c["name"]
                    .as_array()
                    .and_then(|a| a.first())
                    .and_then(opt_str)
            });
            out.push(InstalledPackage {
                name: token.clone(),
                full_name: opt_str(&c["full_token"]).unwrap_or(token),
                kind: "cask".into(),
                desc,
                homepage: opt_str(&c["homepage"]),
                tap: opt_str(&c["tap"]),
                installed_version,
                latest_version: latest,
                outdated: c["outdated"].as_bool().unwrap_or(false),
                pinned: false,
                deprecated: c["deprecated"].as_bool().unwrap_or(false),
            });
        }
    }

    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}

// ---------------------------------------------------------------------------
// Parsing `brew outdated --json=v2`
// ---------------------------------------------------------------------------

pub fn parse_outdated(json: &str) -> Result<Vec<OutdatedPackage>, String> {
    let root: Value = serde_json::from_str(json).map_err(|e| format!("Invalid brew JSON: {e}"))?;
    let mut out = Vec::new();

    let mut collect = |arr: Option<&Vec<Value>>, kind: &str| {
        if let Some(items) = arr {
            for it in items {
                let name = match opt_str(&it["name"]) {
                    Some(n) => n,
                    None => continue,
                };
                let installed_versions = it["installed_versions"]
                    .as_array()
                    .map(|a| a.iter().filter_map(opt_str).collect())
                    .unwrap_or_default();
                out.push(OutdatedPackage {
                    name,
                    kind: kind.to_string(),
                    installed_versions,
                    current_version: opt_str(&it["current_version"]).unwrap_or_default(),
                    pinned: it["pinned"].as_bool().unwrap_or(false),
                });
            }
        }
    };

    collect(root.get("formulae").and_then(Value::as_array), "formula");
    collect(root.get("casks").and_then(Value::as_array), "cask");
    Ok(out)
}

// ---------------------------------------------------------------------------
// Parsing `brew tap`
// ---------------------------------------------------------------------------

pub fn parse_taps(stdout: &str) -> Vec<Tap> {
    let mut taps: Vec<Tap> = stdout
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .map(|name| {
            let official = name.starts_with("homebrew/");
            Tap {
                name: name.to_string(),
                official,
                custom: !official,
            }
        })
        .collect();
    taps.sort_by(|a, b| {
        // Official taps first, then alphabetical.
        b.official
            .cmp(&a.official)
            .then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    taps
}

// ---------------------------------------------------------------------------
// Streaming jobs
// ---------------------------------------------------------------------------

pub fn next_job_id() -> String {
    format!("job-{}", JOB_COUNTER.fetch_add(1, Ordering::SeqCst))
}

/// Spawn a brew command on a background thread, streaming stdout/stderr to the
/// frontend line-by-line via `job-line` events and a final `job-done` event.
pub fn spawn_job(
    app: AppHandle,
    brew: PathBuf,
    args: Vec<String>,
    job_id: String,
    allow_auto_update: bool,
) {
    std::thread::spawn(move || {
        let emit_line = |stream: &str, line: String| {
            let _ = app.emit(
                "job-line",
                JobLine {
                    job_id: job_id.clone(),
                    stream: stream.to_string(),
                    line,
                },
            );
        };

        emit_line("info", format!("$ brew {}", args.join(" ")));

        let mut cmd = Command::new(&brew);
        cmd.args(&args)
            .env("HOMEBREW_NO_ENV_HINTS", "1")
            .env("HOMEBREW_NO_ANALYTICS", "1")
            .env("HOMEBREW_NO_COLOR", "1")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        if !allow_auto_update {
            cmd.env("HOMEBREW_NO_AUTO_UPDATE", "1");
        }

        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                emit_line("stderr", format!("Failed to launch brew: {e}"));
                let _ = app.emit(
                    "job-done",
                    JobDone {
                        job_id: job_id.clone(),
                        status: "error".into(),
                        code: None,
                    },
                );
                return;
            }
        };

        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        // Read stderr on its own thread so a full pipe can't deadlock stdout.
        let stderr_handle = {
            let app = app.clone();
            let job_id = job_id.clone();
            std::thread::spawn(move || {
                if let Some(err) = stderr {
                    for line in BufReader::new(err).lines().map_while(Result::ok) {
                        let _ = app.emit(
                            "job-line",
                            JobLine {
                                job_id: job_id.clone(),
                                stream: "stderr".into(),
                                line,
                            },
                        );
                    }
                }
            })
        };

        if let Some(out) = stdout {
            for line in BufReader::new(out).lines().map_while(Result::ok) {
                emit_line("stdout", line);
            }
        }
        let _ = stderr_handle.join();

        match child.wait() {
            Ok(status) => {
                let st = if status.success() { "success" } else { "error" };
                let _ = app.emit(
                    "job-done",
                    JobDone {
                        job_id: job_id.clone(),
                        status: st.into(),
                        code: status.code(),
                    },
                );
            }
            Err(e) => {
                emit_line("stderr", format!("Process error: {e}"));
                let _ = app.emit(
                    "job-done",
                    JobDone {
                        job_id: job_id.clone(),
                        status: "error".into(),
                        code: None,
                    },
                );
            }
        }
    });
}
