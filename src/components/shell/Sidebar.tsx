import { Icon, type IconName } from "../ui/Icon";
import { useTheme, type ThemeChoice } from "../../hooks/useTheme";
import { useBrewData } from "../../data/BrewDataProvider";
import type { NavKey } from "../../lib/nav";
import "./sidebar.css";

interface NavDef {
  key: NavKey;
  label: string;
  icon: IconName;
}

const NAV: NavDef[] = [
  { key: "updates", label: "Updates", icon: "arrowUp" },
  { key: "installed", label: "Installed", icon: "box" },
  { key: "discover", label: "Discover", icon: "search" },
  { key: "taps", label: "Sources", icon: "branch" },
];

const THEME_ICON: Record<ThemeChoice, IconName> = {
  system: "monitor",
  light: "sun",
  dark: "moon",
};
const THEME_LABEL: Record<ThemeChoice, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

interface SidebarProps {
  active: NavKey;
  onNavigate: (key: NavKey) => void;
}

export function Sidebar({ active, onNavigate }: SidebarProps) {
  const { choice, cycle } = useTheme();
  const { installed, outdated, taps, status } = useBrewData();

  const counts: Partial<Record<NavKey, number>> = {
    updates: outdated.data?.length ?? 0,
    installed: installed.data?.length ?? 0,
    taps: taps.data?.length ?? 0,
  };

  return (
    <aside className="sidebar">
      <div className="sidebar__head" data-tauri-drag-region>
        <div className="brand">
          <div className="brand__mark">
            <Icon name="beer" size={20} strokeWidth={1.8} />
          </div>
          <div className="brand__text">
            <span className="brand__name">Brewhouse</span>
            <span className="brand__sub">Homebrew, refined</span>
          </div>
        </div>
      </div>

      <nav className="sidebar__nav">
        {NAV.map((item) => {
          const count = counts[item.key];
          const isActive = active === item.key;
          const isUpdates = item.key === "updates";
          return (
            <button
              key={item.key}
              className={`navitem${isActive ? " navitem--active" : ""}`}
              onClick={() => onNavigate(item.key)}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="navitem__icon">
                <Icon name={item.icon} size={18} />
              </span>
              <span className="navitem__label">{item.label}</span>
              {count !== undefined && count > 0 && (
                <span
                  className={`navitem__count${
                    isUpdates ? " navitem__count--accent" : ""
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="sidebar__footer">
        <button className="theme-toggle" onClick={cycle} title="Switch appearance">
          <Icon name={THEME_ICON[choice]} size={16} />
          <span>{THEME_LABEL[choice]}</span>
        </button>
        <div className="sidebar__meta mono" title={status.data?.brewPath ?? ""}>
          {status.data?.brewVersion ?? "Homebrew"}
        </div>
      </div>
    </aside>
  );
}
