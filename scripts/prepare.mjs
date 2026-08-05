// Best-effort build hook. Runs via `prepare` on install (dev clones, git deps)
// and on pack/publish. Registry tarballs contain the built `dist/` output;
// git installs need the declared development toolchain so this hook can build it.
//
// Zero runtime dependencies beyond the declared build toolchain.
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const bin = (name) =>
  join(
    root,
    "node_modules",
    ".bin",
    process.platform === "win32" ? `${name}.cmd` : name,
  );

const tsup = bin("tsup");
if (!existsSync(tsup)) {
  console.error("[prepare] tsup is required to build this git checkout");
  process.exit(1);
}
const result = spawnSync(tsup, [], { cwd: root, stdio: "inherit" });
if (result.status !== 0) {
  console.error("[prepare] tsup build failed");
  process.exit(result.status ?? 1);
}
