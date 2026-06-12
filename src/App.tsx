import { useState } from "react";
import { Sidebar } from "./components/shell/Sidebar";
import { ConsoleDrawer } from "./components/shell/ConsoleDrawer";
import { Button, Spinner } from "./components/ui";
import { Icon } from "./components/ui/Icon";
import { useBrewData } from "./data/BrewDataProvider";
import { api } from "./lib/api";
import type { NavKey } from "./lib/nav";
import { UpdatesView } from "./views/UpdatesView";
import { InstalledView } from "./views/InstalledView";
import { DiscoverView } from "./views/DiscoverView";
import { TapsView } from "./views/TapsView";
import "./app.css";

function BrewNotFound() {
  return (
    <div className="brewless" data-tauri-drag-region>
      <div className="brewless__card">
        <div className="brewless__mark">
          <Icon name="beer" size={34} strokeWidth={1.7} />
        </div>
        <h1 className="brewless__title">Homebrew isn't installed</h1>
        <p className="brewless__desc">
          Brewhouse is a companion for Homebrew, but it couldn't find <code>brew</code> on this Mac.
          Install Homebrew, then reopen Brewhouse.
        </p>
        <pre className="brewless__cmd mono">
          /bin/bash -c "$(curl -fsSL
          https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        </pre>
        <Button
          variant="primary"
          iconRight="external"
          onClick={() => void api.openUrl("https://brew.sh")}
        >
          Open brew.sh
        </Button>
      </div>
    </div>
  );
}

function Splash() {
  return (
    <div className="splash" data-tauri-drag-region>
      <Spinner size={28} />
    </div>
  );
}

export function App() {
  const { status } = useBrewData();
  const [nav, setNav] = useState<NavKey>("updates");

  if (status.initial && status.loading) return <Splash />;
  if (status.data && !status.data.brewFound) return <BrewNotFound />;

  return (
    <div className="app">
      <Sidebar active={nav} onNavigate={setNav} />
      <main className="main">
        {nav === "updates" && <UpdatesView />}
        {nav === "installed" && <InstalledView />}
        {nav === "discover" && <DiscoverView />}
        {nav === "taps" && <TapsView />}
        <ConsoleDrawer />
      </main>
    </div>
  );
}
