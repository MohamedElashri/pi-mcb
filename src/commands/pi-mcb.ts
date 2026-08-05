/**
 * /pi-mcb command — triggers pi-mcb compaction.
 *
 * Upstream: https://github.com/sting8k/pi-mcb (src/commands/pi-mcb.ts)
 * Modified by pi-mcb-om:
 * - Flushes pending OM state (observations/reflections/dropped) when manual mode is active
 *   before triggering compaction, so the compaction summary includes all accumulated memory.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Runtime } from "../om/runtime.js";
import {
  PI_MCB_COMPACT_INSTRUCTION,
  notifyMigrationReminder,
  formatCompactionStats,
} from "../hooks/before-compact";
import {
  readPendingState,
  clearPendingState,
  hasPendingData,
} from "../om/pending.js";
import {
  OM_OBSERVATIONS_DROPPED,
  OM_OBSERVATIONS_RECORDED,
  OM_REFLECTIONS_RECORDED,
} from "../om/ledger/index.js";
import { handleCleanup } from "./cleanup.js";
import {
  openMcbSettings,
  config,
  GLOBAL_CONFIG_DIR,
} from "../pi-base/mcb-settings.js";
import { formatMcbStatus } from "../ux.js";

export const registerMcbCommand = (pi: ExtensionAPI, runtime: Runtime) => {
  const prefixMatch = (value: string, prefix: string): boolean => {
    return value.toLowerCase().startsWith(prefix.toLowerCase());
  };

  pi.registerCommand("mcb", {
    description:
      "Manual compact control center. Run /mcb status, settings, memory, recall, cleanup, om-on, or om-off; /mcb alone compacts.",
    getArgumentCompletions: (prefix: string) => {
      const subcommands = [
        {
          value: "status",
          label: "Show compaction and memory status [status]",
        },
        { value: "memory", label: "Open memory status [/mcb-memory]" },
        { value: "recall", label: "Recall help [/mcb-recall]" },
        { value: "help", label: "Show command help [help]" },
        {
          value: "settings",
          label: "Open configuration overlay [settings]",
        },
        {
          value: "cleanup",
          label: "Remove orphaned pending files [cleanup]",
        },
        { value: "om-off", label: "Disable observational memory [om-off]" },
        { value: "om-on", label: "Enable observational memory [om-on]" },
      ];
      if (!prefix) return subcommands;
      // "configure" is an accepted alias for "settings" (routed by the
      // handler); surface the settings entry when the user types either.
      return subcommands.filter(
        (s) =>
          prefixMatch(s.value, prefix) ||
          (s.value === "settings" && prefixMatch("configure", prefix)),
      );
    },
    handler: async (args, ctx) => {
      const sessionId = ctx.sessionManager.getSessionId();

      // Handle subcommands
      const trimmed = (typeof args === "string" ? args : "").trim();
      if (trimmed === "help") {
        ctx.ui.notify(
          "pi-mcb commands:\n  /mcb — compact now\n  /mcb status — current mode\n  /mcb settings — configure\n  /mcb-memory [view|full] — inspect memory\n  /mcb-recall <query> [send] — search history; `send` gives results to the agent\n  /mcb om-on|om-off — toggle memory\n  /mcb cleanup — remove orphaned pending files",
          "info",
        );
        return;
      }
      if (trimmed === "status") {
        runtime.ensureConfig(ctx.cwd, (message) =>
          ctx.ui?.notify?.(message, "warning"),
        );
        ctx.ui.notify(formatMcbStatus(runtime), "info");
        return;
      }
      if (trimmed === "memory") {
        ctx.ui.notify(
          "Use /mcb-memory for pipeline status, /mcb-memory view for visible memory, or /mcb-memory full for the ledger.",
          "info",
        );
        return;
      }
      if (trimmed === "recall") {
        ctx.ui.notify(
          "Use /mcb-recall <query>. Results stay local by default; append `send` to add them to the agent context.",
          "info",
        );
        return;
      }
      if (trimmed === "configure" || trimmed === "settings") {
        // Open the config overlay ("configure" kept as a hidden alias)
        await openMcbSettings(ctx);
        return;
      }
      if (trimmed === "cleanup") {
        await handleCleanup(ctx);
        return;
      }
      if (trimmed === "om-off") {
        try {
          config.save(
            { ...config.load(ctx.cwd, GLOBAL_CONFIG_DIR), memory: false },
            "global",
            ctx.cwd,
            GLOBAL_CONFIG_DIR,
          );
          runtime.config = config.loadWithWarnings(
            ctx.cwd,
            GLOBAL_CONFIG_DIR,
          ).config;
          ctx.ui.notify(
            "Observational memory disabled. Use /mcb om-on to re-enable.",
            "info",
          );
        } catch {
          ctx.ui.notify(
            "Failed to save config — the config file may be read-only (e.g., managed by Nix). " +
              "Runtime state updated for this session only.",
            "warning",
          );
        }
        return;
      }
      if (trimmed === "om-on") {
        try {
          config.save(
            { ...config.load(ctx.cwd, GLOBAL_CONFIG_DIR), memory: true },
            "global",
            ctx.cwd,
            GLOBAL_CONFIG_DIR,
          );
          runtime.config = config.loadWithWarnings(
            ctx.cwd,
            GLOBAL_CONFIG_DIR,
          ).config;
          ctx.ui.notify("Observational memory enabled.", "info");
        } catch {
          ctx.ui.notify(
            "Failed to save config — the config file may be read-only (e.g., managed by Nix). " +
              "Runtime state updated for this session only.",
            "warning",
          );
        }
        return;
      } // Warn if input starts with a known subcommand but isn't an exact match.
      // Prevents "/mcb configure foo" from silently becoming a follow-up.
      const SUBCOMMAND_NAMES = [
        "configure",
        "settings",
        "cleanup",
        "om-off",
        "om-on",
        "status",
        "memory",
        "recall",
        "help",
      ];
      const nearMiss = SUBCOMMAND_NAMES.find(
        (name) =>
          trimmed.toLowerCase().startsWith(name.toLowerCase()) &&
          trimmed.length > name.length,
      );
      if (nearMiss) {
        ctx.ui.notify(
          `/mcb ${nearMiss} accepts no arguments. Did you mean \"/mcb ${nearMiss}\"?`,
          "warning",
        );
        return;
      }

      // Extract follow-up prompt: everything after the subcommand check
      // that isn't a known subcommand is treated as follow-up text.
      const followUpPrompt = trimmed ? trimmed : null;

      // If compaction is manual (or legacy noAutoCompact): flush pending OM entries
      // into the branch before compacting so the summary includes accumulated memory.
      if (runtime.config.compaction === "manual" && hasPendingData(sessionId)) {
        const pending = readPendingState(sessionId);
        // Write all accumulated observation batches (or latest single batch
        // as fallback for legacy pending.json without batch arrays).
        const obsBatches = pending.observationBatches?.length
          ? pending.observationBatches
          : pending.observation
            ? [pending.observation]
            : [];
        for (const batch of obsBatches) {
          pi.appendEntry(OM_OBSERVATIONS_RECORDED, batch.data);
        }
        // Write all accumulated reflection batches (or latest single batch
        // as fallback for legacy pending.json without batch arrays).
        const reflBatches = pending.reflectionBatches?.length
          ? pending.reflectionBatches
          : pending.reflection
            ? [pending.reflection]
            : [];
        for (const batch of reflBatches) {
          pi.appendEntry(OM_REFLECTIONS_RECORDED, batch.data);
        }
        // Write all accumulated dropper batches (or latest single batch
        // as fallback for legacy pending.json without batch arrays).
        const dropBatches = pending.droppedBatches?.length
          ? pending.droppedBatches
          : pending.dropped
            ? [pending.dropped]
            : [];
        for (const batch of dropBatches) {
          pi.appendEntry(OM_OBSERVATIONS_DROPPED, batch.data);
        }
        clearPendingState(sessionId);
        ctx.ui.notify("Observational memory: pending entries flushed", "info");
      }

      ctx.compact({
        customInstructions: PI_MCB_COMPACT_INSTRUCTION,
        onComplete: () => {
          const stats = runtime.compactionStats;
          if (stats) {
            ctx.ui.notify(formatCompactionStats(stats), "info");
          } else {
            ctx.ui.notify("Compacted with mcb", "info");
          }
          notifyMigrationReminder(sessionId, (msg, level) =>
            ctx.ui.notify(msg, level as any),
          );

          // Fire follow-up prompt after compaction completes
          if (followUpPrompt) {
            try {
              void Promise.resolve(pi.sendUserMessage(followUpPrompt)).catch(
                () => {},
              );
            } catch {}
          }
        },
        onError: (err) => {
          if (
            err.message === "Compaction cancelled" ||
            err.message === "Already compacted"
          ) {
            ctx.ui.notify("Nothing to compact", "warning");
          } else {
            ctx.ui.notify(`Compaction failed: ${err.message}`, "error");
          }
        },
      });
    },
  });
};
