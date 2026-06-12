import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { listen } from "@tauri-apps/api/event";
import type { JobDoneEvent, JobLineEvent, JobStatus, JobStream } from "../lib/types";

const MAX_LINES = 2500;

export interface JobLine {
  stream: JobStream;
  line: string;
}

export interface Job {
  id: string;
  label: string;
  status: JobStatus;
  lines: JobLine[];
  startedAt: number;
  finishedAt: number | null;
}

export interface JobResult {
  status: "success" | "error";
  code: number | null;
}

interface JobsContextValue {
  jobs: Job[];
  activeJob: Job | null;
  activeJobId: string | null;
  consoleOpen: boolean;
  runningCount: number;
  setActiveJobId: (id: string) => void;
  setConsoleOpen: (open: boolean) => void;
  clearHistory: () => void;
  /**
   * Start a job. `starter` invokes a Tauri command that returns a job id;
   * the returned promise resolves when the job finishes.
   */
  run: (starter: () => Promise<string>, opts: { label: string }) => Promise<JobResult>;
}

const JobsContext = createContext<JobsContextValue | null>(null);

export function JobsProvider({ children }: { children: ReactNode }) {
  const [jobsById, setJobsById] = useState<Record<string, Job>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const resolvers = useRef<Record<string, (r: JobResult) => void>>({});
  const labels = useRef<Record<string, string>>({});

  const ensureJob = useCallback((id: string): Job => {
    return {
      id,
      label: labels.current[id] ?? "brew",
      status: "running",
      lines: [],
      startedAt: Date.now(),
      finishedAt: null,
    };
  }, []);

  useEffect(() => {
    const unlistenLine = listen<JobLineEvent>("job-line", (event) => {
      const { jobId, stream, line } = event.payload;
      setJobsById((prev) => {
        const existing = prev[jobId] ?? ensureJob(jobId);
        const lines = [...existing.lines, { stream, line }];
        if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
        return { ...prev, [jobId]: { ...existing, lines } };
      });
      setOrder((prev) => (prev.includes(jobId) ? prev : [...prev, jobId]));
    });

    const unlistenDone = listen<JobDoneEvent>("job-done", (event) => {
      const { jobId, status } = event.payload;
      setJobsById((prev) => {
        const existing = prev[jobId] ?? ensureJob(jobId);
        return { ...prev, [jobId]: { ...existing, status, finishedAt: Date.now() } };
      });
      const resolve = resolvers.current[jobId];
      if (resolve) {
        resolve({ status, code: event.payload.code });
        delete resolvers.current[jobId];
      }
    });

    return () => {
      void unlistenLine.then((f) => f());
      void unlistenDone.then((f) => f());
    };
  }, [ensureJob]);

  const run = useCallback(
    async (starter: () => Promise<string>, opts: { label: string }): Promise<JobResult> => {
      const id = await starter();
      labels.current[id] = opts.label;
      setJobsById((prev) => {
        const existing = prev[id];
        const base = existing ?? {
          id,
          label: opts.label,
          status: "running" as JobStatus,
          lines: [],
          startedAt: Date.now(),
          finishedAt: null,
        };
        return { ...prev, [id]: { ...base, label: opts.label } };
      });
      setOrder((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setActiveJobId(id);
      setConsoleOpen(true);

      // The `job-done` listener runs as a later microtask/event, so this
      // resolver is always registered before it can fire — no race, no churn.
      return new Promise<JobResult>((resolve) => {
        resolvers.current[id] = resolve;
      });
    },
    [],
  );

  const clearHistory = useCallback(() => {
    setJobsById((prev) => {
      const next: Record<string, Job> = {};
      for (const [id, job] of Object.entries(prev)) {
        if (job.status === "running") next[id] = job;
      }
      return next;
    });
    setOrder((prev) => prev.filter((id) => jobsById[id]?.status === "running"));
  }, [jobsById]);

  const jobs = useMemo(
    () => order.map((id) => jobsById[id]).filter(Boolean).reverse(),
    [order, jobsById],
  );
  const activeJob = activeJobId ? jobsById[activeJobId] ?? null : null;
  const runningCount = useMemo(
    () => Object.values(jobsById).filter((j) => j.status === "running").length,
    [jobsById],
  );

  const value = useMemo<JobsContextValue>(
    () => ({
      jobs,
      activeJob,
      activeJobId,
      consoleOpen,
      runningCount,
      setActiveJobId,
      setConsoleOpen,
      clearHistory,
      run,
    }),
    [jobs, activeJob, activeJobId, consoleOpen, runningCount, clearHistory, run],
  );

  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>;
}

export function useJobs(): JobsContextValue {
  const ctx = useContext(JobsContext);
  if (!ctx) throw new Error("useJobs must be used within JobsProvider");
  return ctx;
}
