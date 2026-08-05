# pi-mcb

**Memory + Compaction Bridge for Pi.**

Source: [MohamedElashri/pi-mcb](https://github.com/MohamedElashri/pi-mcb)

`pi-mcb` combines two complementary long-session features behind one compaction hook:

- **Deterministic structural compaction**: creates a fast, zero-LLM summary of goals, changes, commits, blockers, preferences, and the recent transcript.
- **Observational memory**: background Observer, Reflector, and Dropper workers preserve timestamped facts and durable reflections across compactions.
- **Unified recall**: the agent can retrieve memory evidence, search prior session history, expand entries, and inspect file content.

The extension owns the compaction hook and emits one summary containing both the structural recap and memory projection. This avoids the competing `session_before_compact` hooks that occur when standalone compaction and observational-memory extensions are installed together.

## Install

```bash
# From this checkout
pi install /absolute/path/to/pi-mcb
```

Do **not** load `pi-blackhole`, `pi-observational-memory`, or another compaction extension alongside pi-mcb. They can each register compaction hooks and/or a `recall` tool. pi-mcb warns when it detects one, but cannot safely resolve the conflict for you. Remove them, then restart Pi or run `/reload` from active session.

## Commands

| Command | Purpose |
| --- | --- |
| `/mcb` | Run deterministic compaction. Optional trailing text becomes a follow-up prompt. |
| `/mcb status` / `/mcb help` | Show current mode or the compact command guide. |
| `/mcb settings` | Open the settings overlay. |
| `/mcb om-on` / `/mcb om-off` | Enable or disable background observational memory. |
| `/mcb cleanup` | Remove orphaned manual-mode pending files. |
| `/mcb-memory [view|full] [page:N] [copy]` | Show pipeline status or inspect paginated visible/full memory; copying is explicit. |
| `/mcb-recall <query> [send]` | Search history locally. Append `send` only when results should enter agent context and trigger a turn. |

The agent-facing `recall` tool accepts a memory id, `#N` entry expansion, `#N:path` file drill-down, plain text/regex search, `mode:file`, `mode:touched`, and `scope:all`.

## Configuration

On first interactive load, pi-mcb offers safe presets (recommended Pi-visible tail, aggressive tail, or compaction-only) and then creates:

```text
~/.pi/agent/pi-mcb/pi-mcb-config.json
```

Useful defaults:

```json
{
  "compaction": "auto",
  "compactionEngine": "mcb",
  "tailBehavior": "minimal",
  "memory": true,
  "observeAfterTokens": 15000,
  "reflectAfterTokens": 25000,
  "compactAfterTokens": 81000
}
```

- `compaction`: `auto`, `manual`, or `off`.
- `compactionEngine`: `mcb` uses the deterministic summary; `pi-default` leaves normal Pi compaction in charge.
- `memory`: independently enables the Observer/Reflector/Dropper layer.
- Per-worker model overrides, fallback chains, cooldowns, input budgets, and environment overrides are available in [CONFIG.md](CONFIG.md).

## Design

Compaction itself never calls a model. Memory workers run before compaction, when their token clocks are due. At compaction, pi-mcb renders the prepared observations/reflections and appends them to the deterministic summary. Failed worker models fall through their configured fallback chain and use a persisted cooldown to avoid repeated failures.

Manual mode stores pending worker results per session and flushes them when `/mcb` is run.

## Release checks

Before publishing, run the automated package gate:

```bash
pnpm release:check
```

Then manually test the tarball in a clean Pi session:

```bash
pnpm pack
pi install ./pi-mcb-<version>.tgz
pi
```

Verify `/mcb status`, `/mcb settings`, `/mcb-memory`, `/mcb-recall test`, and one `/mcb` compaction. Remove the generated `.tgz` after testing. Confirm `git status` contains only intended files and that `pnpm pack --dry-run` lists only `dist/`, the license, documentation, and the example config.

## Credits and license

This project is a renamed, independently packaged derivative of [pi-blackhole](https://github.com/k0valik/pi-blackhole), which already unified [pi-vcc](https://github.com/sting8k/pi-vcc) and [pi-observational-memory](https://github.com/elpapi42/pi-observational-memory). Their MIT-licensed work provides the compaction, observational-memory, and recall foundations. See `LICENSE`.
