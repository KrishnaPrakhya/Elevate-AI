"use client";

import { useState, useCallback } from "react";
import {
  Briefcase,
  MapPin,
  DollarSign,
  ExternalLink,
  RefreshCw,
  Loader2,
  Wifi,
  WifiOff,
  Trash2,
  CheckCircle,
  Clock,
  XCircle,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type ApplicationStatus =
  | "TRACKING"
  | "APPLIED"
  | "INTERVIEWING"
  | "OFFER"
  | "REJECTED"
  | "WITHDRAWN";

interface JobMeta {
  matchScore?: number | null;
  source?: string;
  foundAt?: string;
}

interface Job {
  id: string;
  company: string;
  role: string;
  jobUrl: string;
  description?: string | null;
  location?: string | null;
  salaryRange?: string | null;
  remote: boolean;
  status: ApplicationStatus;
  appliedAt?: string | null;
  followUpDate?: string | null;
  notes?: string | null;
  metadata?: JobMeta | null;
  createdAt: string;
}

interface Props {
  initialJobs: Job[];
  n8nConfigured: boolean;
}

const STATUS_CONFIG: Record<
  ApplicationStatus,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  TRACKING: { label: "Tracking", color: "bg-slate-500/10 text-slate-700 dark:text-slate-300", icon: Clock },
  APPLIED: { label: "Applied", color: "bg-blue-500/10 text-blue-700 dark:text-blue-300", icon: CheckCircle },
  INTERVIEWING: { label: "Interviewing", color: "bg-amber-500/10 text-amber-700 dark:text-amber-300", icon: Briefcase },
  OFFER: { label: "Offer", color: "bg-green-500/10 text-green-700 dark:text-green-300", icon: Trophy },
  REJECTED: { label: "Rejected", color: "bg-red-500/10 text-red-600 dark:text-red-400", icon: XCircle },
  WITHDRAWN: { label: "Withdrawn", color: "bg-muted text-muted-foreground", icon: XCircle },
};

const BOARD_STATUSES: ApplicationStatus[] = ["TRACKING", "APPLIED", "INTERVIEWING", "OFFER", "REJECTED"];

function MatchScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-green-500/10 text-green-700 dark:text-green-300"
      : score >= 60
      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
      : "bg-red-500/10 text-red-600 dark:text-red-400";

  return (
    <span className={`inline-flex whitespace-nowrap text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
      {score}% match
    </span>
  );
}

function cleanJobText(value?: string | null) {
  return (value || "")
    .replace(/#{2,6}\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getDisplayDescription(job: Job) {
  let description = cleanJobText(job.description);
  const salary = cleanJobText(job.salaryRange);

  if (salary && description.toLowerCase().startsWith(salary.toLowerCase())) {
    description = description.slice(salary.length).replace(/^\s*(?:a year|per year|annually)?\s*/i, "");
  }

  return description;
}

function JobCard({
  job,
  onStatusChange,
  onDelete,
  compact = false,
}: {
  job: Job;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
  onDelete: (id: string) => void;
  compact?: boolean;
}) {
  const meta = job.metadata as JobMeta | null;
  const cfg = STATUS_CONFIG[job.status];
  const Icon = cfg.icon;
  const role = cleanJobText(job.role) || "Untitled role";
  const company = cleanJobText(job.company) || "Unknown company";
  const description = getDisplayDescription(job);

  return (
    <Card className="group h-full min-w-0 gap-0 overflow-hidden transition-shadow hover:shadow-md">
      <CardHeader className={compact ? "gap-2 px-3 pb-2 pt-3" : "gap-2 pb-3"}>
        <div className="min-w-0">
          <CardTitle
            className="line-clamp-2 break-words text-sm font-semibold leading-snug"
            title={role}
          >
            {role}
          </CardTitle>
          <CardDescription className="mt-1 line-clamp-1 break-words text-xs" title={company}>
            {company}
          </CardDescription>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {meta?.matchScore != null && <MatchScoreBadge score={meta.matchScore} />}
          {job.remote && (
            <Badge variant="outline" className="flex whitespace-nowrap text-xs items-center gap-1">
              <Wifi className="h-2.5 w-2.5" /> Remote
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className={compact ? "flex-1 space-y-1 px-3 pb-3" : "flex-1 space-y-1 pb-3"}>
        {job.location && (
          <p className="flex min-w-0 items-start gap-1 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="min-w-0 break-words">{cleanJobText(job.location)}</span>
          </p>
        )}
        {job.salaryRange && (
          <p className="flex min-w-0 items-start gap-1 text-xs text-muted-foreground">
            <DollarSign className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="min-w-0 break-words">{cleanJobText(job.salaryRange)}</span>
          </p>
        )}
        {!compact && description && (
          <p className="mt-1 line-clamp-3 break-words text-xs text-muted-foreground">{description}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Found {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
        </p>
      </CardContent>
      <CardFooter className={`items-start gap-2 ${compact ? "px-3 pb-3" : "pb-4"}`}>
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          <Button asChild size="sm" variant="outline" className="h-8 gap-1 text-xs">
            <a href={job.jobUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3" /> View Job
            </a>
          </Button>
          <Select
            value={job.status}
            onValueChange={(v) => onStatusChange(job.id, v as ApplicationStatus)}
          >
            <SelectTrigger
              size="sm"
              aria-label={`Update status for ${role}`}
              className="h-8 min-w-[118px] max-w-[150px] flex-1 gap-1 px-2 text-xs"
            >
              <Icon className="h-3 w-3" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_CONFIG) as ApplicationStatus[]).map((s) => {
                const c = STATUS_CONFIG[s];
                const SI = c.icon;
                return (
                  <SelectItem key={s} value={s} className="text-xs">
                    <span className="flex items-center gap-1.5">
                      <SI className="h-3 w-3" />
                      {c.label}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Delete ${role}`}
          title="Delete job"
          className="h-8 shrink-0 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onDelete(job.id)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </CardFooter>
    </Card>
  );
}

export function JobsView({ initialJobs, n8nConfigured }: Props) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [triggering, setTriggering] = useState(false);
  const [lastSearched, setLastSearched] = useState<Date | null>(null);

  const handleTriggerSearch = useCallback(async () => {
    setTriggering(true);
    try {
      const res = await fetch("/api/n8n/trigger-search", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success("Job search started! Results will appear shortly.");
      setLastSearched(new Date());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not trigger job search");
    } finally {
      setTriggering(false);
    }
  }, []);

  const handleStatusChange = useCallback(async (id: string, status: ApplicationStatus) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status } : j)));
    try {
      const res = await fetch("/api/jobs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, ...(status === "APPLIED" ? { appliedAt: new Date().toISOString() } : {}) }),
      });
      if (!res.ok) throw new Error("Update failed");
    } catch {
      toast.error("Failed to update status");
      // revert
      setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: j.status } : j)));
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
    try {
      const res = await fetch(`/api/jobs?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Job removed");
    } catch {
      toast.error("Failed to remove job");
    }
  }, []);

  const refreshJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs");
      const data = await res.json();
      if (res.ok) setJobs(data.jobs ?? []);
    } catch {
      toast.error("Failed to refresh");
    }
  }, []);

  const matchedJobs = jobs.filter((j) => j.status === "TRACKING");
  const trackedJobs = jobs.filter((j) => j.status !== "TRACKING");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" />
            Job Search
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Automated job matching powered by your career plan
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={refreshJobs}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          {n8nConfigured ? (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleTriggerSearch}
              disabled={triggering}
            >
              {triggering ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wifi className="h-3.5 w-3.5" />
              )}
              {triggering ? "Searching…" : "Search Now"}
            </Button>
          ) : (
            <Badge variant="outline" className="gap-1.5 text-muted-foreground">
              <WifiOff className="h-3.5 w-3.5" />
              n8n not configured
            </Badge>
          )}
        </div>
      </div>

      {lastSearched && (
        <p className="text-xs text-muted-foreground">
          Last triggered {formatDistanceToNow(lastSearched, { addSuffix: true })} — check back in a minute for new results
        </p>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {BOARD_STATUSES.map((s) => {
          const count = jobs.filter((j) => j.status === s).length;
          const cfg = STATUS_CONFIG[s];
          const SI = cfg.icon;
          return (
            <div key={s} className={`rounded-lg p-3 text-center ${cfg.color} bg-opacity-10`}>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <SI className="h-4 w-4" />
                <span className="text-xs font-medium">{cfg.label}</span>
              </div>
              <span className="text-2xl font-bold">{count}</span>
            </div>
          );
        })}
      </div>

      <Tabs defaultValue="matches">
        <TabsList>
          <TabsTrigger value="matches">
            Matches
            {matchedJobs.length > 0 && (
              <Badge className="ml-1.5 h-4 px-1.5 text-xs" variant="secondary">
                {matchedJobs.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="tracker">
            My Applications
            {trackedJobs.length > 0 && (
              <Badge className="ml-1.5 h-4 px-1.5 text-xs" variant="secondary">
                {trackedJobs.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Matches tab — jobs found by n8n, not yet applied */}
        <TabsContent value="matches" className="mt-4">
          {matchedJobs.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Briefcase className="h-10 w-10 opacity-30" />
                <div>
                  <p className="font-medium">No job matches yet</p>
                  <p className="text-sm mt-1">
                    {n8nConfigured
                      ? 'Click "Search Now" to run your automated job search workflow'
                      : "Configure N8N_WEBHOOK_URL in your environment to enable automated job search"}
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {matchedJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tracker tab — kanban-like by status */}
        <TabsContent value="tracker" className="mt-4">
          {trackedJobs.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <CheckCircle className="h-10 w-10 opacity-30" />
                <div>
                  <p className="font-medium">No applications tracked yet</p>
                  <p className="text-sm mt-1">
                    Find job matches and move them to &quot;Applied&quot; to start tracking
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {(["APPLIED", "INTERVIEWING", "OFFER", "REJECTED"] as ApplicationStatus[]).map((status) => {
                const statusJobs = trackedJobs.filter((j) => j.status === status);
                const cfg = STATUS_CONFIG[status];
                const SI = cfg.icon;
                return (
                  <div key={status} className="space-y-2">
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold ${cfg.color}`}>
                      <SI className="h-3.5 w-3.5" />
                      {cfg.label} ({statusJobs.length})
                    </div>
                    <div className="space-y-2">
                      {statusJobs.map((job) => (
                        <JobCard
                          key={job.id}
                          job={job}
                          onStatusChange={handleStatusChange}
                          onDelete={handleDelete}
                          compact
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
