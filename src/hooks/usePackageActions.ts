import { useMemo } from "react";
import { api } from "../lib/api";
import { errorMessage } from "../lib/format";
import { useJobs } from "../jobs/JobsProvider";
import { useToast } from "../components/feedback/ToastProvider";
import { useBrewData } from "../data/BrewDataProvider";
import type { PackageKind } from "../lib/types";

/**
 * Centralizes the "run a streaming brew job, toast the outcome, refresh the
 * affected data" flow shared by every view and the detail drawer.
 */
export function usePackageActions() {
  const jobs = useJobs();
  const toast = useToast();
  const { reloadPackages, taps } = useBrewData();

  return useMemo(() => {
    async function runJob(
      starter: () => Promise<string>,
      label: string,
      successMsg: string,
    ): Promise<boolean> {
      try {
        const result = await jobs.run(starter, { label });
        if (result.status === "success") {
          toast.success(successMsg);
          return true;
        }
        toast.error(`${label} failed — see console for details`);
        return false;
      } catch (err) {
        toast.error(errorMessage(err));
        return false;
      }
    }

    return {
      async install(name: string, kind: PackageKind) {
        const ok = await runJob(
          () => api.installPackage(name, kind),
          `Installing ${name}`,
          `Installed ${name}`,
        );
        if (ok) reloadPackages();
        return ok;
      },
      async uninstall(name: string, kind: PackageKind) {
        const ok = await runJob(
          () => api.uninstallPackage(name, kind),
          `Uninstalling ${name}`,
          `Uninstalled ${name}`,
        );
        if (ok) reloadPackages();
        return ok;
      },
      async upgrade(name: string, kind: PackageKind) {
        const ok = await runJob(
          () => api.upgradePackage(name, kind),
          `Upgrading ${name}`,
          `Upgraded ${name}`,
        );
        if (ok) reloadPackages();
        return ok;
      },
      async upgradeAll() {
        const ok = await runJob(() => api.upgradeAll(), "Upgrading all packages", "Everything upgraded");
        if (ok) reloadPackages();
        return ok;
      },
      async update() {
        const ok = await runJob(() => api.brewUpdate(), "Updating Homebrew", "Homebrew is up to date");
        if (ok) reloadPackages();
        return ok;
      },
      async addTap(name: string) {
        const ok = await runJob(() => api.addTap(name), `Tapping ${name}`, `Added ${name}`);
        if (ok) void taps.reload();
        return ok;
      },
      async removeTap(name: string) {
        const ok = await runJob(() => api.removeTap(name), `Untapping ${name}`, `Removed ${name}`);
        if (ok) void taps.reload();
        return ok;
      },
      async setPinned(name: string, pinned: boolean) {
        try {
          await api.setPinned(name, pinned);
          toast.success(pinned ? `Pinned ${name}` : `Unpinned ${name}`);
          reloadPackages();
          return true;
        } catch (err) {
          toast.error(errorMessage(err));
          return false;
        }
      },
      async openHomepage(url: string | null) {
        if (!url) return;
        try {
          await api.openUrl(url);
        } catch (err) {
          toast.error(errorMessage(err));
        }
      },
    };
  }, [jobs, toast, reloadPackages, taps]);
}

export type PackageActions = ReturnType<typeof usePackageActions>;
