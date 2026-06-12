// Thin typed wrappers over the Tauri command layer.

import { invoke } from "@tauri-apps/api/core";
import type {
  BrewStatus,
  InstalledPackage,
  KindFilter,
  OutdatedPackage,
  PackageDetail,
  PackageKind,
  SearchResult,
  Tap,
  TopCharts,
} from "./types";

export const api = {
  getStatus: () => invoke<BrewStatus>("get_status"),

  listInstalled: () => invoke<InstalledPackage[]>("list_installed"),
  listOutdated: () => invoke<OutdatedPackage[]>("list_outdated"),
  listTaps: () => invoke<Tap[]>("list_taps"),

  ensureCatalog: (force = false) => invoke<BrewStatus>("ensure_catalog", { force }),
  searchCatalog: (query: string, kind: KindFilter, limit?: number) =>
    invoke<SearchResult[]>("search_catalog", { query, kind, limit }),
  topDownloaded: (limit?: number, force?: boolean) =>
    invoke<TopCharts>("top_downloaded", { limit, force }),
  getPackageInfo: (name: string, kind: PackageKind) =>
    invoke<PackageDetail>("get_package_info", { name, kind }),

  // Job-producing commands return a job id; output streams via events.
  installPackage: (name: string, kind: PackageKind) =>
    invoke<string>("install_package", { name, kind }),
  uninstallPackage: (name: string, kind: PackageKind) =>
    invoke<string>("uninstall_package", { name, kind }),
  upgradePackage: (name: string, kind: PackageKind) =>
    invoke<string>("upgrade_package", { name, kind }),
  upgradeAll: () => invoke<string>("upgrade_all"),
  brewUpdate: () => invoke<string>("brew_update"),
  addTap: (name: string) => invoke<string>("add_tap", { name }),
  removeTap: (name: string) => invoke<string>("remove_tap", { name }),

  setPinned: (name: string, pinned: boolean) =>
    invoke<void>("set_pinned", { name, pinned }),
  openUrl: (url: string) => invoke<void>("open_url", { url }),
};
