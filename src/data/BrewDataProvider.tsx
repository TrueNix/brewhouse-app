import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { api } from "../lib/api";
import { useResource, type Resource } from "../hooks/useResource";
import type { BrewStatus, InstalledPackage, OutdatedPackage, Tap } from "../lib/types";

interface BrewDataValue {
  status: Resource<BrewStatus>;
  installed: Resource<InstalledPackage[]>;
  outdated: Resource<OutdatedPackage[]>;
  taps: Resource<Tap[]>;
  /** Refresh the package-state resources (after an install/upgrade/tap change). */
  reloadPackages: () => void;
  reloadAll: () => void;
}

const BrewDataContext = createContext<BrewDataValue | null>(null);

export function BrewDataProvider({ children }: { children: ReactNode }) {
  const status = useResource<BrewStatus>(useCallback(() => api.getStatus(), []));
  const installed = useResource<InstalledPackage[]>(useCallback(() => api.listInstalled(), []));
  const outdated = useResource<OutdatedPackage[]>(useCallback(() => api.listOutdated(), []));
  const taps = useResource<Tap[]>(useCallback(() => api.listTaps(), []));

  const reloadPackages = useCallback(() => {
    void installed.reload();
    void outdated.reload();
  }, [installed, outdated]);

  const reloadAll = useCallback(() => {
    void status.reload();
    void installed.reload();
    void outdated.reload();
    void taps.reload();
  }, [status, installed, outdated, taps]);

  const value = useMemo<BrewDataValue>(
    () => ({ status, installed, outdated, taps, reloadPackages, reloadAll }),
    [status, installed, outdated, taps, reloadPackages, reloadAll],
  );

  return <BrewDataContext.Provider value={value}>{children}</BrewDataContext.Provider>;
}

export function useBrewData(): BrewDataValue {
  const ctx = useContext(BrewDataContext);
  if (!ctx) throw new Error("useBrewData must be used within BrewDataProvider");
  return ctx;
}
