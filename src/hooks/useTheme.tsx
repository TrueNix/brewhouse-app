import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeChoice = "system" | "light" | "dark";
type Effective = "light" | "dark";

interface ThemeContextValue {
  choice: ThemeChoice;
  effective: Effective;
  setChoice: (choice: ThemeChoice) => void;
  cycle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "brewhouse-theme";

function systemPrefersDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
  });
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const effective: Effective = choice === "system" ? (systemDark ? "dark" : "light") : choice;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", effective);
  }, [effective]);

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const cycle = useCallback(() => {
    setChoiceState((prev) => {
      const order: ThemeChoice[] = ["system", "light", "dark"];
      const next = order[(order.indexOf(prev) + 1) % order.length];
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ choice, effective, setChoice, cycle }),
    [choice, effective, setChoice, cycle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
