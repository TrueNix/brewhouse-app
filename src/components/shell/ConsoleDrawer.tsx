import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { Spinner } from "../ui";
import { useJobs, type Job } from "../../jobs/JobsProvider";
import "./console.css";

function elapsed(job: Job, now: number): string {
  const end = job.finishedAt ?? now;
  const secs = Math.max(0, Math.round((end - job.startedAt) / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ConsoleDrawer() {
  const { jobs, activeJob, activeJobId, consoleOpen, runningCount, setActiveJobId, setConsoleOpen, clearHistory } =
    useJobs();
  const logRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());

  // Tick while a job is running so the elapsed timer advances.
  useEffect(() => {
    if (runningCount === 0) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [runningCount]);

  // Keep the log pinned to the newest line.
  useLayoutEffect(() => {
    if (consoleOpen && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
    // Depend on the last line's content too, so scrolling keeps up even once
    // the buffer hits its line cap and `length` stops changing.
  }, [
    activeJob?.lines.length,
    activeJob?.lines[activeJob.lines.length - 1]?.line,
    consoleOpen,
    activeJobId,
  ]);

  const status = activeJob?.status ?? "idle";

  return (
    <div className={`console${consoleOpen ? " console--open" : ""}`}>
      <button
        className="console__bar"
        onClick={() => setConsoleOpen(!consoleOpen)}
        aria-expanded={consoleOpen}
      >
        <span className={`console__status console__status--${status}`}>
          {status === "running" ? (
            <Spinner size={14} />
          ) : status === "idle" ? (
            <Icon name="terminal" size={16} />
          ) : (
            <Icon name={status === "success" ? "checkCircle" : "alert"} size={16} />
          )}
        </span>
        <span className="console__label">{activeJob?.label ?? "Console"}</span>
        {activeJob && <span className="console__elapsed mono">{elapsed(activeJob, now)}</span>}
        <span className="console__spacer" />
        {runningCount > 0 && (
          <span className="console__running">
            {runningCount} running
          </span>
        )}
        <Icon name={consoleOpen ? "chevronDown" : "chevronUp"} size={16} />
      </button>

      {consoleOpen && (
        <div className="console__body">
          <div className="console__tabs">
            {jobs.slice(0, 8).map((job) => (
              <button
                key={job.id}
                className={`console__tab${
                  job.id === activeJobId ? " console__tab--active" : ""
                } console__tab--${job.status}`}
                onClick={() => setActiveJobId(job.id)}
                title={job.label}
              >
                <span className="console__tab-dot" />
                <span className="console__tab-label">{job.label}</span>
              </button>
            ))}
            <span className="console__spacer" />
            <button className="console__clear" onClick={clearHistory} title="Clear finished jobs">
              <Icon name="trash" size={14} />
              <span>Clear</span>
            </button>
          </div>

          <div className="console__log mono" ref={logRef}>
            {!activeJob || activeJob.lines.length === 0 ? (
              <div className="console__placeholder">
                {activeJob ? "Waiting for output…" : "Output from brew commands appears here."}
              </div>
            ) : (
              activeJob.lines.map((l, i) => (
                <div key={i} className={`console__line console__line--${l.stream}`}>
                  {l.line || " "}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
