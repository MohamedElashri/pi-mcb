# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.5] - 2026-08-06

### Changed
- Moved `@huggingface/transformers` to an optional peer dependency. This removes heavy C++ binaries (`onnxruntime-node`) and audit vulnerabilities from the default installation. Users who enable `semanticRecall` must now install this package manually.

## [0.1.4] - 2026-08-05

### Fixed
- Fixed a bug where the Pi onboarding preset screen would be invoked every time Pi started, rather than just on the first run.
- Fixed a bug where configuring model overrides via the TUI Settings Menu would fail to save to the persistent configuration file.

## [0.1.3] - 2026-08-05

### Added 
- Implement Semantic Memory Retrieval using a local embedding model. This uses the `@huggingface/transformers` JS library to unlock conceptual memory search.
- Exposed model overrides (`model`, `observerModel`, `reflectorModel`, `dropperModel`) directly in the TUI Settings Menu (`/mcb settings`), allowing for easy in-app reconfiguration without editing JSON.

### Security
- Fixed a CWE-377 (Insecure Temporary File) vulnerability in `before-compact` hook by moving `pi-mcb-debug.json` from the shared `/tmp` directory to the user's secure agent directory (`~/.pi/agent/pi-mcb/debug.json`).

## [0.1.2] - 2026-08-05

### Added
- Created a `Makefile` to simplify common development tasks (`build`, `lint`, `format`, `test`, `bump`, etc.).

### Changed
- Updated all development dependencies to their latest compatible versions.

### Removed
- Removed the `typebox` dependency entirely to make the extension 100% dependency-free at runtime (excluding peer dependencies on `pi` core). All schema definitions in tools (`recall`, `dropper`, `observer`, `reflector`) are now using raw JSON schema and strictly typed TypeScript interfaces.
