# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2026-08-05

### Added
- Created a `Makefile` to simplify common development tasks (`build`, `lint`, `format`, `test`, `bump`, etc.).

### Changed
- Updated all development dependencies to their latest compatible versions.

### Removed
- Removed the `typebox` dependency entirely to make the extension 100% dependency-free at runtime (excluding peer dependencies on `pi` core). All schema definitions in tools (`recall`, `dropper`, `observer`, `reflector`) are now using raw JSON schema and strictly typed TypeScript interfaces.
