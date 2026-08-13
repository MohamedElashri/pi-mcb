.PHONY: build lint format format-check test test-watch check update bump bump-minor bump-major release-check prepack help

# Default target
.DEFAULT_GOAL := help

# Build the project using tsup
build:
	pnpm build

# Run eslint
lint:
	pnpm lint

# Format code with prettier
format:
	pnpm format

# Check formatting with prettier
format-check:
	pnpm format:check

# Run tests using vitest
test:
	pnpm test

# Run tests in watch mode
test-watch:
	pnpm test:watch

# Run typecheck and lint
check:
	pnpm check

# Update dependencies to the latest versions, then verify everything still passes
update:
	pnpm update --latest
	pnpm add -D typescript@~6.0.3
	pnpm check
	pnpm test

# Bump patch version
bump:
	pnpm version patch

# Bump minor version
bump-minor:
	pnpm version minor

# Bump major version
bump-major:
	pnpm version major

# Check the release by packing a dry-run
release-check:
	pnpm release:check

# Run a full prepack pipeline (check, test, and build)
prepack:
	pnpm prepack

# Help menu
help:
	@echo "Available commands:"
	@echo "  build         - Build the project using tsup"
	@echo "  lint          - Run eslint"
	@echo "  format        - Format code with prettier"
	@echo "  format-check  - Check formatting with prettier"
	@echo "  test          - Run tests using vitest"
	@echo "  test-watch    - Run tests in watch mode"
	@echo "  check         - Run typecheck and lint"
	@echo "  update        - Update dependencies to the latest versions, then verify"
	@echo "  bump          - Bump patch version"
	@echo "  bump-minor    - Bump minor version"
	@echo "  bump-major    - Bump major version"
	@echo "  release-check - Check the release by packing a dry-run"
	@echo "  prepack       - Run a full prepack pipeline (check, test, and build)"
