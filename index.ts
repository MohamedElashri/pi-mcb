/**
 * pi-mcb entry point. One extension runtime owns both deterministic compaction
 * and observational memory, so they share one compaction hook and summary.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { scaffoldSettings } from "./src/core/settings";
import { registerBeforeCompactHook } from "./src/hooks/before-compact";
import { registerMcbCommand } from "./src/commands/pi-mcb";
import { registerMemoryCommand } from "./src/commands/memory";
import { registerVccRecallCommand } from "./src/commands/mcb-recall";
import { registerConsolidationTrigger } from "./src/om/consolidation.js";
import { registerCompactionTrigger } from "./src/om/compaction-trigger.js";
import { registerRecallTool } from "./src/tools/recall";
import { Runtime } from "./src/om/runtime.js";
import { captureRegisteredProviderStreams } from "./src/om/provider-stream.js";
import { registerMcbUx } from "./src/ux.js";

export default (pi: ExtensionAPI) => {
  // ── Bridge: capture custom provider stream functions for jiti-loaded agents ──
  // pi-mcb's consolidation agents are loaded via jiti with moduleCache: false,
  // which creates a separate pi-ai instance whose apiProviderRegistry lacks custom
  // providers (e.g., claude-bridge registered by other extensions). This bridge stores
  // streamSimple functions in a Symbol.for() global so agents can access them without
  // going through pi-ai's registry.
  //
  // Capture custom provider streams from Pi's model registry before each run.
  // This works regardless of extension load order and includes providers added
  // after startup.
  const PROVIDER_STREAMS_KEY = Symbol.for("pi-mcb:provider-streams");
  const providerStreams: Map<string, Function> = ((globalThis as any)[
    PROVIDER_STREAMS_KEY
  ] ??= new Map());
  pi.on("agent_start", (_event: unknown, ctx: any) => {
    captureRegisteredProviderStreams(ctx.modelRegistry, providerStreams);
  });

  scaffoldSettings();

  const omRuntime = new Runtime();

  // Observational memory: background consolidation pipeline
  registerConsolidationTrigger(pi, omRuntime); // agent_start + turn_end → observer/reflector/dropper
  registerCompactionTrigger(pi, omRuntime); // agent_end → auto-compaction

  // Deterministic compaction + observational-memory injection.
  registerBeforeCompactHook(pi, omRuntime);

  // Commands
  registerMcbCommand(pi, omRuntime); // /mcb flushes manual-mode pending memory
  registerMemoryCommand(pi, omRuntime); // /mcb-memory [status|view|full]
  registerVccRecallCommand(pi); // /mcb-recall <query>

  // Tools
  registerRecallTool(pi); // unified recall (#N + [12char])

  // Quiet status, safe first-run presets, and duplicate-extension diagnostics.
  registerMcbUx(pi, omRuntime);
};
