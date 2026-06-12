import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { PackageDrawer } from "./PackageDrawer";
import type { PackageKind } from "../../lib/types";

interface Selected {
  name: string;
  kind: PackageKind;
}

interface DetailApi {
  open: (name: string, kind: PackageKind) => void;
  close: () => void;
}

const DetailContext = createContext<DetailApi | null>(null);
const EXIT_MS = 240;

export function DetailProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<Selected | null>(null);
  const [open, setOpen] = useState(false);
  const exitTimer = useRef<number | null>(null);

  const openDetail = useCallback((name: string, kind: PackageKind) => {
    if (exitTimer.current) window.clearTimeout(exitTimer.current);
    setSelected({ name, kind });
    // Next frame so the panel transitions in from off-screen.
    requestAnimationFrame(() => setOpen(true));
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    exitTimer.current = window.setTimeout(() => setSelected(null), EXIT_MS);
  }, []);

  return (
    <DetailContext.Provider value={{ open: openDetail, close }}>
      {children}
      {selected && (
        <PackageDrawer
          key={`${selected.kind}:${selected.name}`}
          name={selected.name}
          kind={selected.kind}
          open={open}
          onClose={close}
        />
      )}
    </DetailContext.Provider>
  );
}

export function useDetail(): DetailApi {
  const ctx = useContext(DetailContext);
  if (!ctx) throw new Error("useDetail must be used within DetailProvider");
  return ctx;
}
