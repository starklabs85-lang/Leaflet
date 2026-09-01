# Fernly Scan Development Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a correctly configured physical-device development build that uses build 30's exact icon and reaches Fernly's Premium-protected scan backend.

**Architecture:** Keep the product scan and subscription contracts unchanged. Add a small, value-safe build validator as an EAS pre-install hook, make every build profile select an explicit EAS environment, and source development client configuration from EAS rather than tracked `.env` files.

**Tech Stack:** Expo SDK 54, React Native, TypeScript, Node test runner, EAS Build, Supabase Edge Functions, RevenueCat.

**Spec:** `docs/superpowers/specs/2026-09-01-fernly-scan-dev-build.md`

## Global Constraints

- Do not bypass Fernly Premium or write subscription rows.
- Do not deploy or mutate Supabase production.
- Do not submit or replace an App Store build.
- Do not commit or print configuration values.
- Use `development-device` for the requested iOS build.

---

### Task 1: Add a fail-fast EAS build configuration contract

**Files:**
- Create: `scripts/validate-build-env.test.mjs`
- Create: `scripts/validate-build-env.mjs`
- Modify: `package.json`
- Modify: `eas.json`
- Modify: `app.config.ts`

**Interfaces:**
- Consumes: EAS variables `EAS_BUILD_PLATFORM`, `EAS_BUILD_PROFILE`, the required `EXPO_PUBLIC_*` client variables, and optional `GOOGLE_SERVICES_INFO_PLIST`.
- Produces: `validateBuildEnvironment(env, fileExists)` returning `{ ok: boolean, errors: string[] }` and the `eas-build-pre-install` build gate.

- [x] **Step 1: Write the failing validator tests**

  Cover three observable failures: missing iOS client configuration, a missing Firebase plist, and production profiles containing dev-login credentials. Also cover a valid iOS development configuration.

- [x] **Step 2: Run the validator test and verify RED**

  Run: `node --test scripts/validate-build-env.test.mjs`

  Expected: FAIL because `scripts/validate-build-env.mjs` does not exist.

- [x] **Step 3: Implement the minimal validator**

  Validate variable presence and plist existence without ever reading or logging values. Print only missing variable names when run as a script.

- [x] **Step 4: Wire the validator into EAS**

  Add `eas-build-pre-install` and `test:build-config` scripts. Set `environment` explicitly to `development`, `preview`, or `production` for each profile. Resolve `ios.googleServicesFile` from `GOOGLE_SERVICES_INFO_PLIST` with the existing local path as fallback.

- [x] **Step 5: Run the validator tests and verify GREEN**

  Run: `node --test scripts/validate-build-env.test.mjs`

  Expected: all tests pass.

### Task 2: Move development configuration out of the build archive

**Files:**
- Modify: `.gitignore`
- Remove from Git index while retaining locally: `.env`
- Local ignored input only: `GoogleService-Info.plist`
- External configuration: EAS `development` environment

**Interfaces:**
- Consumes: existing local configuration values and the verified Firebase plist from the earlier isolated release worktree.
- Produces: required named EAS development variables and a source tree that no longer tracks `.env`.

- [x] **Step 1: Ignore local environment files**

  Add `.env` and `.env.local` to `.gitignore`, then remove `.env` from the Git index without deleting the local file.

- [x] **Step 2: Configure EAS development variables**

  Set the Supabase URL/anon key, RevenueCat iOS key, Google OAuth client values, and Firebase plist for the `development` environment using EAS sensitive/secret visibility. Commands must print only variable names and success/failure.

- [x] **Step 3: Verify configuration names and secret hygiene**

  Confirm the required names exist in EAS development, `.env` is untracked and ignored, the plist is ignored, and no values appear in Git diff or logs.

### Task 3: Verify and build the physical-device candidate

**Files:**
- Create: `docs/release-qc/2026-09-01-fernly-development-build.md`

**Interfaces:**
- Consumes: Tasks 1-2, current release source `a89dec838ca145dfe073222b2420628725edbcb8`, and build 30 icon digest.
- Produces: a pushed source commit and a finished EAS `development-device` build URL.

- [x] **Step 1: Run source verification**

  Run focused tests, production-ops tests, build-config tests, analytics validation, direct TypeScript checking, Expo config inspection, and icon SHA-256 comparison.

- [ ] **Step 2: Commit and push the isolated branch**

  Commit only source, tests, configuration, and redacted documentation. Push `codex/fernly-build30-icon-scan-fix`.

- [ ] **Step 3: Start the signed iOS development build**

  Run `eas build --profile development-device --platform ios --non-interactive` and wait for completion. Do not use a production profile or auto-submit.

- [ ] **Step 4: Record redacted QC evidence**

  Record the exact branch/commit, icon digest, test results, configuration-name proof, EAS build ID/status, and install URL without configuration values.
