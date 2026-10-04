import { Check, History, PauseCircle } from "lucide-react";
import { STAGE_INFO, STAGE_PATH, type ProjectStage } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { LocalTime } from "./LocalTime";
import type { ActivityT } from "@/lib/types";

/**
 * The project's road from onboarding to completed.
 * Pass client labels for the portal; internal stages that map to the same step light up the same dot.
 */
export function StageTimeline({ stage, forClient }: { stage: string; forClient?: boolean }) {
  // Stages off the main road sit on the nearest step before them.
  const position: Record<string, ProjectStage> = { "Internal Review": "In Progress", Revision: "Client Review" };
  const offRoad = stage === "On Hold" || stage === "Blocked";
  const current = STAGE_PATH.indexOf((position[stage] || stage) as ProjectStage);

  return (
    <div className="card p-5">
      {offRoad && (
        <div
          className={cn(
            "mb-4 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium",
            stage === "Blocked" && !forClient ? "bg-red-500/10 text-red-600 dark:text-red-300" : "bg-surface-2 text-muted"
          )}
        >
          <PauseCircle className="h-4 w-4" />
          {forClient ? STAGE_INFO[stage as ProjectStage].client : stage === "Blocked" ? "Blocked: check the open issues" : "On hold"}
        </div>
      )}
      {/* Phones: a vertical list, so every step name fits */}
      <ol className="space-y-0 sm:hidden">
        {STAGE_PATH.map((s, i) => {
          const done = current > i || (current === i && ["Live", "Completed"].includes(s));
          const active = current === i && !done;
          return (
            <li key={s} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold",
                    done && "border-brand bg-brand text-white",
                    active && "border-brand bg-brand/10 text-brand ring-4 ring-brand/15 dark:text-[#8f9bff]",
                    !done && !active && "border-line text-muted"
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                {i < STAGE_PATH.length - 1 && <span className={cn("w-0.5 flex-1 min-h-4", current > i ? "bg-brand" : "bg-line")} />}
              </div>
              <span className={cn("pb-3 pt-1 text-sm", active ? "font-bold text-heading" : done ? "font-medium text-fg" : "text-muted")}>
                {forClient ? STAGE_INFO[s].client : s}
                {active && <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand dark:text-[#8f9bff]">NOW</span>}
              </span>
            </li>
          );
        })}
      </ol>
      <ol className="hidden items-start gap-1 overflow-x-auto pb-1 sm:flex">
        {STAGE_PATH.map((s, i) => {
          const done = current > i || (current === i && ["Live", "Completed"].includes(s));
          const active = current === i && !done;
          return (
            <li key={s} className="flex min-w-[84px] flex-1 flex-col items-center text-center">
              <div className="flex w-full items-center">
                <span className={cn("h-0.5 flex-1", i === 0 ? "bg-transparent" : current >= i ? "bg-brand" : "bg-line")} />
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold",
                    done && "border-brand bg-brand text-white",
                    active && "border-brand bg-brand/10 text-brand ring-4 ring-brand/15 dark:text-[#8f9bff]",
                    !done && !active && "border-line text-muted"
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span className={cn("h-0.5 flex-1", i === STAGE_PATH.length - 1 ? "bg-transparent" : current > i ? "bg-brand" : "bg-line")} />
              </div>
              <span className={cn("mt-2 text-[11px] font-semibold leading-tight", active ? "text-heading" : "text-muted")}>
                {forClient ? STAGE_INFO[s].client : s}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function ActivityFeed({ items, title = "Activity" }: { items: ActivityT[]; title?: string }) {
  return (
    <div className="card p-5">
      <h2 className="mb-3 flex items-center gap-2 font-bold text-heading">
        <History className="h-4 w-4 text-brand dark:text-[#8f9bff]" /> {title}
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted">Nothing yet.</p>
      ) : (
        <ol className="relative space-y-4 border-l border-line pl-4">
          {items.map((a) => (
            <li key={a._id} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--surface)] bg-brand" />
              <p className="text-sm text-fg">{a.text}</p>
              <p className="text-xs text-muted">
                {a.actor ? `${a.actor} · ` : ""}
                <LocalTime iso={a.createdAt} />
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

