# HAHN Heroes website handoff

Public handoff repository: https://github.com/Dimamov/hahn-heroes-site. No live publication, DNS, or existing GitHub repository was changed.

## Current publishing

Service: ChatGPT Sites, backed by Cloudflare Workers and static assets.
Project: HAHN Heroes — Hidden Nexus (slug hahn-heroes).
Project ID: appgprj_6ac24c4686c88191aa5d9e7bfc3f27b9.
Live version: 20. Source commit: c58c70c9cf0622367114a600a977eaecd7a8431c.
Worker: site---6ac24c4686c88191aa5d9e7bfc3f27b9.
The existing Sites source repository is separate from Dimamov/hahn-heroes. Publication today uses saved Sites versions followed by Sites deployment; this new GitHub repository will not deploy automatically.

Cloudflare account: Sites does not expose its backing Cloudflare account name or ID. I cannot verify which Cloudflare account owns this worker from the current connection, and I have no direct Cloudflare account inventory operation.

hahnheroes.com is an active Sites custom domain; provider and SSL statuses are active. The Sites-provided CNAME target is custom-domains.chatgpt.site.; its apex proxy targets are 162.159.143.30 and 172.66.3.26. Domain verification uses _openai-site-verification.hahnheroes.com. These are the connection settings returned by Sites, not a direct inspection of the current DNS zone.

## Source contents

The archive places the complete published static directory at the repository root, including assets/, rebuild/, and _nexus-test/. It also includes src/, scripts/, server/, tests/, package.json, package-lock.json, tsconfig.json, and source notes from the original checkout. The Sites hosting manifest, Git history and runtime credentials are excluded. Public Supabase key literals were replaced with REPLACE_WITH_YOUR_API_KEY in the handoff only. Claude must configure API keys privately before enabling the connected app components.

The original build script writes rebuild output to dist/rebuild/. The handoff's published files are at the root; reconcile that output directory before future builds/deployment.

## Redacted files

- rebuild/app.js: 3 API-key literals replaced.
- _nexus-test/online.js: 1 API-key literals replaced.
- tests/live.py: 1 API-key literals replaced.
- src/rebuild/api.ts: 3 API-key literals replaced.

