import { useState } from "react";
import { ViewShell } from "../components/shell/ViewShell";
import { Badge, Button, EmptyState, SearchInput } from "../components/ui";
import { Icon } from "../components/ui/Icon";
import { PackageListSkeleton } from "../components/package/PackageListSkeleton";
import { useBrewData } from "../data/BrewDataProvider";
import { usePackageActions } from "../hooks/usePackageActions";
import "./views.css";

const TAP_PATTERN = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

export function TapsView() {
  const { taps } = useBrewData();
  const actions = usePackageActions();
  const [value, setValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const data = taps.data ?? [];
  const trimmed = value.trim();
  const valid = TAP_PATTERN.test(trimmed);

  async function add() {
    if (!valid || adding) return;
    setAdding(true);
    const ok = await actions.addTap(trimmed);
    setAdding(false);
    if (ok) setValue("");
  }

  async function remove(name: string) {
    setBusy((b) => ({ ...b, [name]: true }));
    await actions.removeTap(name);
    setBusy((b) => {
      const next = { ...b };
      delete next[name];
      return next;
    });
  }

  return (
    <ViewShell
      eyebrow="Repositories"
      title="Sources"
      subtitle={
        taps.initial ? "Loading taps…" : `${data.length} tap${data.length === 1 ? "" : "s"} configured`
      }
      actions={
        <Button
          variant="ghost"
          iconLeft="refresh"
          onClick={() => void taps.reload()}
        >
          Refresh
        </Button>
      }
    >
      <div className="info-card">
        <span className="info-card__icon">
          <Icon name="info" size={18} />
        </span>
        <p className="info-card__text">
          A <strong>tap</strong> is a third-party repository of formulae and casks. Add one to install
          packages that aren't in Homebrew core — then find them in Discover.
        </p>
      </div>

      <div className="tap-add">
        <SearchInput
          small
          value={value}
          onValueChange={setValue}
          placeholder="user/repo  —  e.g. homebrew/cask-fonts"
          aria-label="Tap to add"
          aria-invalid={Boolean(trimmed) && !valid}
          aria-describedby={trimmed && !valid ? "tap-error" : undefined}
          onKeyDown={(e) => {
            if (e.key === "Enter") void add();
          }}
        />
        <Button variant="primary" iconLeft="plus" disabled={!valid} loading={adding} onClick={add}>
          Add tap
        </Button>
      </div>
      <div className="tap-hint">
        {trimmed && !valid ? (
          <span id="tap-error" role="alert" style={{ color: "var(--danger)" }}>
            Taps must look like <code>user/repo</code>.
          </span>
        ) : (
          <>
            Try <code>homebrew/cask-fonts</code> or <code>homebrew/cask-versions</code>.
          </>
        )}
      </div>

      <div className="section-label">Configured taps</div>

      {taps.error && (
        <div className="error-banner">
          <Icon name="alert" size={16} />
          {taps.error}
        </div>
      )}

      {taps.initial && taps.loading ? (
        <PackageListSkeleton rows={4} />
      ) : data.length === 0 ? (
        <EmptyState icon="branch" title="No taps yet" description="Add a tap above to extend Homebrew." />
      ) : (
        <div className="surface pkg-list stagger">
          {data.map((tap, i) => (
            <div
              className={`pkg-row${busy[tap.name] ? " pkg-row--busy" : ""}`}
              key={tap.name}
              style={{ gridTemplateColumns: "auto 1fr auto", animationDelay: `${Math.min(i, 12) * 20}ms` }}
            >
              <span className="pkg-glyph pkg-glyph--formula">
                <Icon name="branch" size={18} />
              </span>
              <div className="pkg-body">
                <div className="pkg-head">
                  <span className="pkg-name mono">{tap.name}</span>
                  {tap.official ? (
                    <Badge tone="amber" icon="check">
                      Official
                    </Badge>
                  ) : (
                    <Badge>Custom</Badge>
                  )}
                </div>
              </div>
              <div className="pkg-actions">
                {tap.custom ? (
                  <Button
                    size="sm"
                    variant="danger"
                    iconLeft="trash"
                    loading={busy[tap.name]}
                    onClick={() => remove(tap.name)}
                  >
                    Remove
                  </Button>
                ) : (
                  <span className="muted" style={{ fontSize: "var(--text-xs)" }}>
                    Built-in
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </ViewShell>
  );
}
