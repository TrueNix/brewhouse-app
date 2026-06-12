// Shared types mirroring the Rust DTOs in src-tauri/src/models.rs.

export type PackageKind = "formula" | "cask";
export type KindFilter = "all" | "formula" | "cask";

export interface InstalledPackage {
  name: string;
  fullName: string;
  kind: PackageKind;
  desc: string | null;
  homepage: string | null;
  tap: string | null;
  installedVersion: string;
  latestVersion: string;
  outdated: boolean;
  pinned: boolean;
  deprecated: boolean;
}

export interface OutdatedPackage {
  name: string;
  kind: PackageKind;
  installedVersions: string[];
  currentVersion: string;
  pinned: boolean;
}

export interface CatalogPackage {
  name: string;
  fullName: string;
  kind: PackageKind;
  desc: string | null;
  homepage: string | null;
  tap: string | null;
  version: string;
  deprecated: boolean;
}

export interface SearchResult extends CatalogPackage {
  installed: boolean;
}

export interface Tap {
  name: string;
  official: boolean;
  custom: boolean;
}

export interface BrewStatus {
  brewFound: boolean;
  brewVersion: string;
  brewPath: string;
  catalogReady: boolean;
  /** Unix epoch *seconds* of the last catalog refresh. */
  catalogUpdatedAt: number | null;
  catalogCount: number;
}

export interface PackageDetail {
  name: string;
  fullName: string;
  kind: PackageKind;
  desc: string | null;
  homepage: string | null;
  tap: string | null;
  version: string;
  installed: boolean;
  installedVersion: string | null;
  outdated: boolean;
  deprecated: boolean;
  license: string | null;
  dependencies: string[];
  caveats: string | null;
}

// Streaming job events emitted by the Rust backend.
export type JobStream = "stdout" | "stderr" | "info";
export type JobStatus = "running" | "success" | "error";

export interface JobLineEvent {
  jobId: string;
  stream: JobStream;
  line: string;
}

export interface JobDoneEvent {
  jobId: string;
  status: "success" | "error";
  code: number | null;
}
