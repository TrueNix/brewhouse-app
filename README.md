<p align="center">
  <img src="docs/banner.png" alt="Brewhouse — a beautiful desktop GUI for Homebrew" width="100%">
</p>

<h1 align="center">Brewhouse</h1>

<p align="center">
  A beautiful native desktop GUI for <a href="https://brew.sh">Homebrew</a> — update, search, install, and manage formulae, casks, and taps.
</p>

<p align="center">
  <a href="https://github.com/TrueNix/brewhouse-app/actions/workflows/ci.yml"><img src="https://github.com/TrueNix/brewhouse-app/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/TrueNix/brewhouse-app/actions/workflows/release.yml"><img src="https://github.com/TrueNix/brewhouse-app/actions/workflows/release.yml/badge.svg" alt="Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-f5a623.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/platform-macOS%20%C2%B7%20Linux-555" alt="Platforms">
  <img src="https://img.shields.io/badge/built%20with-Tauri%202%20%C2%B7%20React-f5a623" alt="Built with Tauri + React">
</p>

> _Amber Atelier_ design language: warm dark-luxury surfaces, glass layering, a honey/amber accent, an editorial serif paired with SF. Light + dark, follows the system appearance.

## Screenshots

Brewhouse is a real desktop window — run it with `npm run app` to see it live. To
add screenshots here, capture the window (macOS: `⌘⇧4` then `Space`) into
`docs/screenshots/` and reference them in this section.

## Features

- **Updates** — see every outdated formula & cask, upgrade one or all, and refresh Homebrew's metadata (`brew update`).
- **Installed** — browse your whole library with live filtering, pin/unpin, and one-click uninstall or upgrade.
- **Discover** — instant search across the full Homebrew catalog (cached locally from formulae.brew.sh) for formulae and casks.
- **Sources** — list, add, and remove taps (third-party repositories).
- **Live console** — long-running `brew` commands stream their output into a collapsible console drawer in real time.
- **Detail drawer** — descriptions, versions, dependencies, license, homepage, and caveats for any package.

## Download

Grab the latest build from the [**Releases**](https://github.com/TrueNix/brewhouse-app/releases) page:

- **macOS** — download the `.dmg` (universal: Apple Silicon + Intel). Builds are
  **unsigned**, so on first launch right-click the app and choose **Open**, or run:
  ```bash
  xattr -dr com.apple.quarantine /Applications/Brewhouse.app
  ```
- **Linux** — download the `.AppImage` (portable) or `.deb`. Requires
  [Homebrew on Linux](https://docs.brew.sh/Homebrew-on-Linux).

> Windows isn't built because Homebrew doesn't run there.

## Develop

```bash
npm install
npm run app          # tauri dev — launches the desktop window with HMR
```

## Build

```bash
npm run app:build    # produces a .app bundle + .dmg in src-tauri/target/release/bundle
```

## Releasing

Releases are built automatically by GitHub Actions. To cut one:

```bash
# bump the version in package.json + src-tauri/tauri.conf.json, then:
git tag v0.1.0
git push origin v0.1.0
```

The [`Release`](.github/workflows/release.yml) workflow builds macOS (universal) and
Linux artifacts and attaches them to a **draft** GitHub Release for you to review and
publish. You can also trigger it manually from the **Actions** tab.

## Architecture

```
src/                 React + TypeScript frontend
  lib/               types + Tauri command bridge (api.ts)
  hooks/             theme, async resource, package actions
  data/              shared brew-data provider (installed/outdated/taps/status)
  jobs/              streaming job/console state
  components/        ui primitives, shell (sidebar/console), package rows + drawer
  views/             Updates · Installed · Discover · Sources
src-tauri/           Rust backend
  src/brew.rs        locate brew, run it, parse JSON, stream jobs as events
  src/catalog.rs     fetch/cache/search the formulae.brew.sh catalog
  src/lib.rs         Tauri command layer + app state
  src/models.rs      DTOs (camelCase) mirrored in src/lib/types.ts
```

The backend never invokes a shell: every `brew` call uses argument vectors, package
names are validated against a strict allow-list, and `open_url` only accepts `http(s)`.

## Requirements

- macOS or Linux with [Homebrew](https://brew.sh) installed
- Node 18+ and a Rust toolchain (for building)

## License

[MIT](LICENSE) © 2026 TrueNix
