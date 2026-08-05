/**
 * /mcb-recall command — search session history.
 *
 * Upstream: https://github.com/sting8k/pi-mcb (src/commands/vcc-recall.ts)
 * Ported and renamed to /mcb-recall for mcb.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  loadAllMessages,
  loadMessagesFromEntries,
  type LoadedMessages,
} from "../core/load-messages.js";
import { searchEntries, getTouchedFiles } from "../core/search-entries.js";
import {
  formatRecallOutput,
  formatTouchedOutput,
} from "../core/format-recall.js";
import { getActiveLineageEntryIds } from "../core/lineage.js";
import { parseRecallScope } from "../core/recall-scope.js";
import {
  findObservationsForEntryIds,
  findReflectionsForEntryIds,
  formatRelatedObservations,
} from "../om/reverse-recall.js";
import type { Entry } from "../om/ledger/recall.js";

const PAGE_SIZE = 5;
const DEFAULT_RECENT = 25;

/** Display recall locally by default. Add `send` to deliberately place it in
 * the agent's context and start a turn. */
function showRecallOutput(
  pi: ExtensionAPI,
  ctx: any,
  output: string,
  sendToAgent: boolean,
): void {
  if (sendToAgent || !ctx.ui?.notify) {
    pi.sendMessage(
      { customType: "mcb-recall", content: output, display: true },
      { triggerTurn: sendToAgent },
    );
    return;
  }
  ctx.ui.notify(output, "info");
}

/**
 * Pi allocates a session path before the first JSONL flush. Recall must still
 * work in that short window, so use SessionManager's in-memory entries when
 * the advertised file does not exist yet.
 */
function loadCurrentSessionMessages(
  sessionFile: string,
  ctx: any,
  lineageEntryIds?: Set<string>,
): LoadedMessages {
  try {
    return loadAllMessages(sessionFile, false, lineageEntryIds);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;

    const entries =
      ctx.sessionManager.getEntries?.() ??
      ctx.sessionManager.getBranch?.() ??
      [];
    if (entries.length > 0) {
      return loadMessagesFromEntries(entries, false, lineageEntryIds);
    }

    ctx.ui?.notify?.(
      "Session history has not been persisted yet. Send a message, then try /mcb-recall again.",
      "warning",
    );
    return { rendered: [], rawMessages: [], entryIds: [] };
  }
}

async function augmentWithObservations(
  output: string,
  rendered: { id: string }[],
  ctx: any,
): Promise<string> {
  const ids = rendered.map((e) => e.id).filter(Boolean);
  if (ids.length === 0) return output;
  try {
    const branchEntries = ctx.sessionManager.getBranch() as Entry[];
    const obs = findObservationsForEntryIds(branchEntries, ids);
    const refs = findReflectionsForEntryIds(branchEntries, ids);
    if (obs.length > 0 || refs.length > 0) {
      return output + "\n\n" + formatRelatedObservations(obs, refs);
    }
  } catch {
    /* branch may not be available */
  }
  return output;
}

export const registerVccRecallCommand = (pi: ExtensionAPI) => {
  pi.registerCommand("mcb-recall", {
    description:
      "Search session history locally. Add `send` to place results in agent context. Usage: /mcb-recall <query> [page:N] [scope:all] [mode:file|touched] [send]",
    handler: async (args: string, ctx) => {
      const sessionFile = ctx.sessionManager.getSessionFile();
      if (!sessionFile) {
        ctx.ui.notify("No session file available.", "error");
        return;
      }

      const raw = args.trim();
      const sendToAgent = /(?:^|\s)send\s*$/i.test(raw);
      const queryArgs = sendToAgent
        ? raw.replace(/(?:^|\s)send\s*$/i, "").trim()
        : raw;
      const parsed = parseRecallScope(queryArgs);
      const lineageEntryIds =
        parsed.scope === "lineage"
          ? getActiveLineageEntryIds(ctx.sessionManager)
          : undefined;
      const mode = parsed.mode;

      if (mode === "touched") {
        const pageMatch = queryArgs.match(/\bpage:(\d+)\b/i);
        const page = pageMatch ? Math.max(1, parseInt(pageMatch[1], 10)) : 1;
        const { rendered, rawMessages } = loadCurrentSessionMessages(
          sessionFile,
          ctx,
          lineageEntryIds,
        );
        const touched = getTouchedFiles(rawMessages, rendered);
        const text = formatTouchedOutput(touched, page);
        showRecallOutput(pi, ctx, text, sendToAgent);
        return;
      }

      if (!parsed.text) {
        // No query: show recent entries
        const { rendered } = loadCurrentSessionMessages(
          sessionFile,
          ctx,
          lineageEntryIds,
        );
        const recent = rendered.slice(-DEFAULT_RECENT);
        const base =
          (parsed.scope === "all" ? "Scope: all\n\n" : "") +
          formatRecallOutput(recent);
        const output = await augmentWithObservations(base, recent, ctx);
        showRecallOutput(pi, ctx, output, sendToAgent);
        return;
      }

      // Parse page:N from args
      const pageMatch = parsed.text.match(/\bpage:(\d+)\b/i);
      const page = pageMatch ? Math.max(1, parseInt(pageMatch[1], 10)) : 1;
      const query = parsed.text.replace(/\bpage:\d+\b/i, "").trim();

      if (!query) {
        const { rendered } = loadCurrentSessionMessages(
          sessionFile,
          ctx,
          lineageEntryIds,
        );
        const recent = rendered.slice(-DEFAULT_RECENT);
        const base =
          (parsed.scope === "all" ? "Scope: all\n\n" : "") +
          formatRecallOutput(recent);
        const output = await augmentWithObservations(base, recent, ctx);
        showRecallOutput(pi, ctx, output, sendToAgent);
        return;
      }

      const { rendered, rawMessages } = loadCurrentSessionMessages(
        sessionFile,
        ctx,
        lineageEntryIds,
      );
      const allResults = searchEntries(
        rendered,
        rawMessages,
        query,
        undefined,
        mode,
      );

      const start = (page - 1) * PAGE_SIZE;
      const pageResults = allResults.slice(start, start + PAGE_SIZE);
      const totalPages = Math.ceil(allResults.length / PAGE_SIZE);
      const scopeSuffix = parsed.scope === "all" ? " (scope: all)" : "";
      const header =
        totalPages > 1
          ? `Page ${page}/${totalPages} (${allResults.length} total matches${scopeSuffix})`
          : `${allResults.length} matches${scopeSuffix}`;
      const footer =
        page < totalPages
          ? `\n--- /mcb-recall ${query}${parsed.scope === "all" ? " scope:all" : ""} page:${page + 1} ---`
          : "";
      const base = formatRecallOutput(pageResults, query, header) + footer;
      const output = await augmentWithObservations(base, pageResults, ctx);
      showRecallOutput(pi, ctx, output, sendToAgent);
    },
  });
};
