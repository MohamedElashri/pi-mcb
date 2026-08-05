.PHONY: build lint format format-check test test-watch check bump bump-minor bump-major release-check prepack

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
