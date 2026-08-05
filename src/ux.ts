import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Runtime } from "./om/runtime.js";
import { config, GLOBAL_CONFIG_DIR } from "./pi-base/mcb-settings.js";

export function formatMcbStatus(runtime: Runtime): string {
  const cfg = runtime.config;
  const state = runtime.consolidationInFlight
    ? `memory: running${runtime.consolidationPhase ? ` (${runtime.consolidationPhase})` : ""}`
    : cfg.memory
      ? "memory: on"
      : "memory: off";
  const compact =
    cfg.compaction === "auto"
      ? `compact: auto @ ${cfg.compactAfterTokens.toLocaleString()}`
      : `compact: ${cfg.compaction}`;
  const failedStage = runtime.lastObserverError
    ? "observer failed"
    : runtime.lastReflectorError
      ? "reflector failed"
      : runtime.lastDropperError
        ? "dropper failed"
        : undefined;
  return `MCB · ${state} · ${compact}${failedStage ? ` · ${failedStage} (see /mcb-memory)` : ""}`;
}

/** Persistent status, first-run preset selection, and duplicate-extension warning. */
export function registerMcbUx(pi: ExtensionAPI, runtime: Runtime): void {
  const refreshStatus = (ctx: any) => {
    runtime.ensureConfig(ctx.cwd, (message) =>
      ctx.ui?.notify?.(message, "warning"),
    );
    ctx.ui?.setStatus?.("pi-mcb", formatMcbStatus(runtime));
  };

  pi.on("session_start", async (_event, ctx: any) => {
    refreshStatus(ctx);

    const conflicts = pi.getCommands().filter((command) => {
      const source = command.sourceInfo?.source ?? "";
      const path = command.sourceInfo?.path ?? "";
      return /pi-(?:blackhole|observational-memory)|pi-blackhole|observational-memory/i.test(
        `${source} ${path}`,
      );
    });
    if (conflicts.length > 0) {
      ctx.ui?.notify?.(
        "pi-mcb detected another memory/compaction extension. Disable pi-blackhole and pi-observational-memory to prevent duplicate hooks or recall tools.",
        "warning",
      );
    }

    if (ctx.mode !== "tui" || runtime.config.onboardingSeen) return;
    const choice = await ctx.ui.select("pi-mcb setup", [
      "Safe — Pi visible tail + memory (recommended)",
      "Aggressive — minimal tail + memory",
      "Compaction only — no background memory",
      "Keep current settings",
    ]);
    if (!choice) return;

    const patch = choice.startsWith("Safe")
      ? { tailBehavior: "pi-default" as const, memory: true }
      : choice.startsWith("Aggressive")
        ? { tailBehavior: "minimal" as const, memory: true }
        : choice.startsWith("Compaction only")
          ? { memory: false }
          : {};
    try {
      config.save(
        {
          ...config.load(ctx.cwd, GLOBAL_CONFIG_DIR),
          ...patch,
          onboardingSeen: true,
        },
        "global",
        ctx.cwd,
        GLOBAL_CONFIG_DIR,
      );
      runtime.config = config.loadWithWarnings(
        ctx.cwd,
        GLOBAL_CONFIG_DIR,
      ).config;
      refreshStatus(ctx);
      ctx.ui.notify(
        "pi-mcb configured. Use /mcb status or /mcb settings any time.",
        "info",
      );
    } catch {
      ctx.ui.notify(
        "pi-mcb setup could not be saved; configure it with /mcb settings.",
        "warning",
      );
    }
  });

  pi.on("agent_start", (_event, ctx: any) => refreshStatus(ctx));
  pi.on("agent_settled", (_event, ctx: any) => refreshStatus(ctx));
  pi.on("session_shutdown", (_event, ctx: any) =>
    ctx.ui?.setStatus?.("pi-mcb", undefined),
  );
}
