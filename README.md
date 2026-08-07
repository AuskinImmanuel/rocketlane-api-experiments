# rocketlane-api-experiments

A hands-on sandbox for the Rocketlane public API: reading and creating projects, phases, tasks and time entries, pagination and rate-limit handling, webhooks, and eventually a custom app scaffold. Sandbox quality on purpose; nothing here is production code.

## Setup

1. Node 18.13+ (`node -v`).
2. Copy `.env.example` to `.env`, paste an API key from Rocketlane Settings -> API. The `.env` file is gitignored; keys never get committed.
3. Load it into the shell before running anything: `set -a; source .env; set +a`

## Layout

- `labs/` - runnable experiments, one file per topic. Start with `labs/labs.mjs` (`node labs/labs.mjs lab1`).
- `notes/` - what I learned, one note per module.

## What this sandbox grew into

Two working builds, each in its own repo:

- [workato-time-entry-sync](https://github.com/AuskinImmanuel/workato-time-entry-sync) - a Google Sheet of logged hours flowing into Rocketlane time entries daily via Workato, idempotent, with the error queue living in the sheet itself.
- [form-to-requirements-doc](https://github.com/AuskinImmanuel/form-to-requirements-doc) - form submission to auto-created requirements document, entirely native, including the undocumented import-template mechanism that makes it possible.

## Facts I keep needing

- Base URL `https://api.rocketlane.com/api/1.0`, auth header `api-key`.
- Rate limits: 60/min on list GETs, 200/min overall. 429 returns `X-Retry-After` in epoch millis.
- Pagination: `pageSize` (max 100) + `pageToken` (lives 15 minutes).
- Create project requires exactly: `projectName`, `owner`, `customer`. Docs say customer matching is case-sensitive; my live test matched "acme" to the existing "Acme" (same companyId), so matching is case-insensitive in practice. Immutability after creation still untested.
