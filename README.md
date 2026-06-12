# Brewhouse

A beautiful native desktop GUI for [Homebrew](https://brew.sh) — built with **Tauri 2**, **React**, and **TypeScript**.

> _Amber Atelier_ design language: warm dark-luxury surfaces, glass layering, a honey/amber accent, an editorial serif paired with SF. Light + dark, follows the system appearance.

## Features

- **Updates** — see every outdated formula & cask, upgrade one or all, and refresh Homebrew's metadata (`brew update`).
- **Installed** — browse your whole library with live filtering, pin/unpin, and one-click uninstall or upgrade.
- **Discover** — instant search across the full Homebrew catalog (cached locally from formulae.brew.sh) for formulae and casks.
- **Sources** — list, add, and remove taps (third-party repositories).
- **Live console** — long-running `brew` commands stream their output into a collapsible console drawer in real time.
- **Detail drawer** — descriptions, versions, dependencies, license, homepage, and caveats for any package.

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

## Develop

```bash
npm install
npm run app          # tauri dev — launches the desktop window with HMR
```

## Build

```bash
npm run app:build    # produces a .app bundle and .dmg in src-tauri/target/release/bundle
```

## Requirements

- macOS with [Homebrew](https://brew.sh) installed (Apple Silicon or Intel)
- Node 18+ and a Rust toolchain (for building)
