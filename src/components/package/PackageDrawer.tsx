import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { api } from "../../lib/api";
import { errorMessage, hostOf } from "../../lib/format";
import { Badge, Button, IconButton, Spinner } from "../ui";
import { Icon } from "../ui/Icon";
import { usePackageActions } from "../../hooks/usePackageActions";
import type { PackageDetail, PackageKind } from "../../lib/types";
import "./drawer.css";

interface PackageDrawerProps {
  name: string;
  kind: PackageKind;
  open: boolean;
  onClose: () => void;
}

export function PackageDrawer({ name, kind, open, onClose }: PackageDrawerProps) {
  const [detail, setDetail] = useState<PackageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const actions = usePackageActions();
  const asideRef = useRef<HTMLElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  const focusableIn = (node: HTMLElement | null) =>
    Array.from(
      node?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter((el) => !el.hasAttribute("disabled"));

  // On open: remember the trigger, move focus into the dialog. On close: restore.
  useEffect(() => {
    if (!open) return;
    restoreRef.current = (document.activeElement as HTMLElement) ?? null;
    const id = window.setTimeout(() => focusableIn(asideRef.current)[0]?.focus(), 30);
    return () => {
      window.clearTimeout(id);
      restoreRef.current?.focus?.();
    };
  }, [open]);

  function trapFocus(e: ReactKeyboardEvent) {
    if (e.key !== "Tab") return;
    const items = focusableIn(asideRef.current);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDetail(await api.getPackageInfo(name, kind));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [name, kind]);

  useEffect(() => {
    void load();
  }, [load]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const host = hostOf(detail?.homepage ?? null);

  async function withRefresh(fn: () => Promise<boolean>) {
    const ok = await fn();
    if (ok) void load();
  }

  return (
    <>
      <div
        className={`drawer-scrim${open ? " drawer-scrim--open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={asideRef}
        className={`drawer${open ? " drawer--open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={`${name} details`}
        onKeyDown={trapFocus}
      >
        <header className="drawer__head" data-tauri-drag-region>
          <span className={`pkg-glyph pkg-glyph--${kind}`}>
            <Icon name={kind === "cask" ? "layers" : "box"} size={22} />
          </span>
          <div className="drawer__titles">
            <div className="drawer__name">{name}</div>
            {detail && detail.fullName !== name && (
              <div className="drawer__full mono">{detail.fullName}</div>
            )}
          </div>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </header>

        {loading ? (
          <div className="drawer__center">
            <Spinner size={26} />
          </div>
        ) : error ? (
          <div className="drawer__center">
            <div className="error-banner" style={{ margin: 0 }}>
              <Icon name="alert" size={16} />
              {error}
            </div>
          </div>
        ) : detail ? (
          <>
            <div className="drawer__body">
              <div className="drawer__badges">
                <Badge tone={kind === "cask" ? "copper" : "amber"}>
                  {kind === "cask" ? "Cask" : "Formula"}
                </Badge>
                {detail.installed && (
                  <Badge tone="success" icon="check">
                    Installed
                  </Badge>
                )}
                {detail.outdated && (
                  <Badge tone="amber" icon="arrowUp">
                    Update available
                  </Badge>
                )}
                {detail.deprecated && (
                  <Badge tone="danger" icon="alert">
                    Deprecated
                  </Badge>
                )}
              </div>

              {detail.desc && <p className="drawer__desc">{detail.desc}</p>}

              <div>
                <div className="field-label">Details</div>
                <div className="drawer__facts">
                  <span className="drawer__fact-key">Latest version</span>
                  <span className="drawer__fact-val mono">{detail.version || "—"}</span>
                  {detail.installed && (
                    <>
                      <span className="drawer__fact-key">Installed version</span>
                      <span className="drawer__fact-val mono">
                        {detail.installedVersion || "—"}
                      </span>
                    </>
                  )}
                  {detail.tap && (
                    <>
                      <span className="drawer__fact-key">Tap</span>
                      <span className="drawer__fact-val mono">{detail.tap}</span>
                    </>
                  )}
                  {detail.license && (
                    <>
                      <span className="drawer__fact-key">License</span>
                      <span className="drawer__fact-val">{detail.license}</span>
                    </>
                  )}
                  {detail.homepage && (
                    <>
                      <span className="drawer__fact-key">Homepage</span>
                      <span className="drawer__fact-val">
                        <button
                          className="drawer__link"
                          onClick={() => actions.openHomepage(detail.homepage)}
                        >
                          {host ?? "Open"}
                          <Icon name="external" size={13} />
                        </button>
                      </span>
                    </>
                  )}
                </div>
              </div>

              {detail.dependencies.length > 0 && (
                <div>
                  <div className="field-label">Dependencies ({detail.dependencies.length})</div>
                  <div className="drawer__deps">
                    {detail.dependencies.map((dep) => (
                      <span key={dep} className="drawer__dep">
                        {dep}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {detail.caveats && (
                <div>
                  <div className="field-label">Caveats</div>
                  <div className="drawer__caveats">{detail.caveats}</div>
                </div>
              )}
            </div>

            <footer className="drawer__foot">
              {detail.installed ? (
                <>
                  {detail.outdated && (
                    <Button
                      variant="primary"
                      iconLeft="arrowUp"
                      onClick={() => withRefresh(() => actions.upgrade(detail.name, kind))}
                    >
                      Upgrade
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    iconLeft="trash"
                    onClick={() => withRefresh(() => actions.uninstall(detail.name, kind))}
                  >
                    Uninstall
                  </Button>
                </>
              ) : (
                <Button
                  variant="primary"
                  iconLeft="download"
                  block
                  onClick={() => withRefresh(() => actions.install(detail.name, kind))}
                >
                  Install {kind === "cask" ? "cask" : "formula"}
                </Button>
              )}
            </footer>
          </>
        ) : null}
      </aside>
    </>
  );
}
