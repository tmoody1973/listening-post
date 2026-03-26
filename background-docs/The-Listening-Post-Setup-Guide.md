# The Listening Post — Developer Setup Guide

## Prerequisites

Before you begin, you need a Cloudflare account (free tier works for development) and accounts for each API service. This guide walks through every CLI tool, installation step, and configuration needed to get the project running.

---

## 1. Node.js

Wrangler requires Node.js 18+ (Active LTS or Current). We recommend using a version manager so you can switch versions without permission issues.

### macOS / Linux

```bash
# Install nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# Restart your terminal, then install Node 20 LTS
nvm install 20
nvm use 20
nvm alias default 20

# Verify
node --version   # Should show v20.x.x
npm --version    # Should show 10.x.x
```

### Alternative: Volta (recommended by Cloudflare)

```bash
# macOS / Linux
curl https://get.volta.sh | bash

# Restart terminal
volta install node@20
volta install npm

# Verify
node --version
```

### Windows

```powershell
# Option 1: Download installer from https://nodejs.org (LTS version)

# Option 2: Using winget
winget install OpenJS.NodeJS.LTS

# Option 3: Using nvm-windows
# Download from https://github.com/coreybutler/nvm-windows/releases
nvm install 20
nvm use 20
```

---

## 2. Wrangler (Cloudflare CLI)

Wrangler is the primary CLI for all Cloudflare Workers development — deploying Workers, managing D1 databases, R2 buckets, KV namespaces, Vectorize indexes, and Durable Objects.

### Install

Cloudflare recommends installing Wrangler locally per-project (already in our package.json), but you also want it globally for initial setup commands.

```bash
# Install globally for setup commands
npm install -g wrangler

# Verify installation
wrangler --version   # Should show 3.x.x or later

# Authenticate with your Cloudflare account
wrangler login
# This opens your browser — click "Allow" to authorize
# For CI/CD environments, use API tokens instead (see section 8)

# Verify authentication
wrangler whoami
# Should show your account name and account ID
```

### Key Wrangler commands you will use

```bash
# Development
wrangler dev                          # Start local dev server on localhost:8787
wrangler dev --remote                 # Dev against real Cloudflare services

# Deployment
wrangler deploy                       # Deploy Worker to production
wrangler deploy --dry-run             # Test build without deploying

# D1 Database
wrangler d1 create <name>            # Create a new D1 database
wrangler d1 execute <name> --file=<path>  # Run SQL file
wrangler d1 execute <name> --local --file=<path>  # Run locally

# R2 Storage
wrangler r2 bucket create <name>     # Create R2 bucket
wrangler r2 object put <bucket>/<key> --file=<path>  # Upload file

# KV Namespace
wrangler kv namespace create <name>  # Create KV namespace
wrangler kv key put --binding=<name> <key> <value>  # Set a key

# Vectorize
wrangler vectorize create <name> --dimensions=768 --metric=cosine

# Secrets (API keys — never put these in wrangler.toml)
wrangler secret put <SECRET_NAME>    # Prompts for value securely

# Tail logs
wrangler tail                        # Stream live Worker logs
```

### System requirements for Wrangler

- macOS 13.5+ (Ventura or later)
- Windows 11
- Linux with glibc 2.35+ (Ubuntu 22.04+, Debian 12+, Fedora 36+)

---

## 3. Git

You need Git for version control and deploying to Cloudflare Pages.

```bash
# macOS (usually pre-installed, or via Homebrew)
brew install git

# Ubuntu / Debian
sudo apt update && sudo apt install git

# Windows
winget install Git.Git

# Verify
git --version

# Configure (use your info)
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

---

## 4. Project setup

Clone or initialize the project and install all dependencies.

```bash
# Navigate to where you want the project
cd ~/projects

# If starting from the scaffold we created:
# Copy the listening-post directory, then:
cd listening-post

# Install all dependencies
npm install

# This installs:
#   wrangler (local, for consistent version)
#   @cloudflare/workers-types (TypeScript types)
#   typescript
#   hono (lightweight web framework)
```

---

## 5. Cloudflare resource provisioning

Run these commands to create all the Cloudflare resources the project needs. You must be authenticated via `wrangler login` first.

```bash
# Create D1 database
wrangler d1 create listening-post-db
# ⚡ Copy the database_id from the output
# Paste it into wrangler.toml under [[d1_databases]]

# Run the schema migration
wrangler d1 execute listening-post-db --file=./scripts/schema.sql

# Create R2 bucket for audio and images
wrangler r2 bucket create listening-post-media

# Create KV namespace for config and caching
wrangler kv namespace create CONFIG_KV
# ⚡ Copy the id from the output
# Paste it into wrangler.toml under [[kv_namespaces]]

# Create Vectorize index for editorial memory
wrangler vectorize create story-embeddings --dimensions=768 --metric=cosine
```

After running these commands, update `wrangler.toml` with the IDs that were printed to your terminal. The file has placeholder empty strings where IDs go.

---

## 6. API keys

You need API keys from eight services. Register for each, then store them as Wrangler secrets (never in wrangler.toml or committed to git).

### Register for API keys

| Service | Registration URL | Free tier |
|---------|-----------------|-----------|
| Congress.gov | https://api.congress.gov/sign-up | Yes, 5,000 req/hr |
| OpenStates | https://openstates.org/accounts/signup/ | Yes, 1,000 req/day |
| Perigon | https://www.perigon.io/products/pricing | Yes, free tier |
| Perplexity | https://docs.perplexity.ai/ → API Keys tab | Pay-per-use ($5 free w/ Pro) |
| ElevenLabs | https://elevenlabs.io/sign-up | Yes, 10K chars/mo free |
| FRED | https://fred.stlouisfed.org/docs/api/api_key.html | Yes, unlimited |
| Unsplash | https://unsplash.com/developers | Yes, 50 req/hr |
| Pexels | https://www.pexels.com/api/ | Yes, 200 req/hr |

### Store secrets in Wrangler

Run each command and paste the API key when prompted:

```bash
wrangler secret put CONGRESS_API_KEY
wrangler secret put OPENSTATES_API_KEY
wrangler secret put PERIGON_API_KEY
wrangler secret put PERPLEXITY_API_KEY
wrangler secret put ELEVENLABS_API_KEY
wrangler secret put ELEVENLABS_API_KEY
wrangler secret put FRED_API_KEY
wrangler secret put UNSPLASH_ACCESS_KEY
wrangler secret put PEXELS_API_KEY
```

For local development, create a `.dev.vars` file (this is gitignored):

```bash
# Create .dev.vars in project root (DO NOT commit this file)
cat > .dev.vars << 'EOF'
CONGRESS_API_KEY=your_key_here
OPENSTATES_API_KEY=your_key_here
PERIGON_API_KEY=your_key_here
PERPLEXITY_API_KEY=your_key_here
ELEVENLABS_API_KEY=your_key_here
FRED_API_KEY=your_key_here
UNSPLASH_ACCESS_KEY=your_key_here
PEXELS_API_KEY=your_key_here
EOF

# Make sure .dev.vars is in .gitignore
echo ".dev.vars" >> .gitignore
```

---

## 7. TypeScript configuration

TypeScript is already configured in the scaffold. Verify the setup:

```bash
# Check TypeScript version
npx tsc --version   # Should show 5.x.x

# Type check the project (no emit, just validation)
npx tsc --noEmit
```

If you see type errors about Cloudflare bindings, make sure `@cloudflare/workers-types` is installed:

```bash
npm install --save-dev @cloudflare/workers-types
```

---

## 8. Running locally

```bash
# Start the local development server
wrangler dev

# This starts on http://localhost:8787
# Workers AI, Vectorize, and D1 work locally with --local flag
# For remote bindings (real Workers AI inference):
wrangler dev --remote

# Test ingestion manually
curl -X POST http://localhost:8787/api/trigger/ingest

# Test morning episode production
curl -X POST http://localhost:8787/api/trigger/produce?edition=morning

# Test evening episode production
curl -X POST http://localhost:8787/api/trigger/produce?edition=evening

# View live logs from deployed Worker
wrangler tail
```

---

## 9. Deploying to production

```bash
# Deploy the Worker
wrangler deploy

# Your Worker is now live at:
# https://listening-post.<your-subdomain>.workers.dev

# Run the database migration on production
wrangler d1 execute listening-post-db --file=./scripts/schema.sql

# Verify deployment
curl https://listening-post.<your-subdomain>.workers.dev/api/stories
```

### Custom domain setup

If you want `thelisteningpost.news`:

1. Register the domain and add it to Cloudflare DNS
2. Add a route in `wrangler.toml`:

```toml
[[routes]]
pattern = "thelisteningpost.news/*"
zone_name = "thelisteningpost.news"
```

3. Redeploy: `wrangler deploy`

---

## 10. CI/CD with GitHub Actions (optional)

For automated deployments on push, create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare Workers
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

To create the API token for CI:
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Create a token with "Edit Cloudflare Workers" permissions
3. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub repository secrets

---

## 11. Useful development tools (optional but recommended)

### VS Code extensions

- **Cloudflare Workers** — syntax highlighting and wrangler integration
- **REST Client** — test API endpoints from VS Code
- **SQLite Viewer** — inspect local D1 database files

### Local D1 explorer

When running `wrangler dev`, visit `http://localhost:8787/cdn-cgi/explorer` to inspect your local D1 database, KV, and Durable Object state through a web UI. This is built into Wrangler.

### ffmpeg (for audio processing)

If you want to do more advanced audio assembly locally:

```bash
# macOS
brew install ffmpeg

# Ubuntu / Debian
sudo apt install ffmpeg

# Windows
winget install FFmpeg
```

---

## 12. Quick start checklist

Run through this checklist to go from zero to running:

```
[ ] Node.js 20+ installed (node --version)
[ ] Wrangler installed (wrangler --version)
[ ] Git installed and configured
[ ] Cloudflare account created
[ ] wrangler login completed (wrangler whoami)
[ ] D1 database created and ID added to wrangler.toml
[ ] R2 bucket created
[ ] KV namespace created and ID added to wrangler.toml
[ ] Vectorize index created
[ ] Schema migration run (wrangler d1 execute ... --file=schema.sql)
[ ] API keys registered (all 8 services)
[ ] Secrets stored (wrangler secret put ... for each key)
[ ] .dev.vars created for local development
[ ] .dev.vars added to .gitignore
[ ] npm install completed
[ ] wrangler dev starts without errors
[ ] curl POST to /api/trigger/ingest returns 200
```

---

## Troubleshooting

**"wrangler: command not found"** — restart your terminal after installing, or run `npx wrangler` instead.

**"Authentication error"** — run `wrangler logout` then `wrangler login` to re-authenticate.

**D1 errors about missing tables** — re-run the schema migration: `wrangler d1 execute listening-post-db --file=./scripts/schema.sql`

**"Node version not supported"** — Wrangler requires Node 18+. Run `node --version` and upgrade if needed.

**Workers AI not working locally** — use `wrangler dev --remote` to run AI inference against real Cloudflare services. Local-only mode does not support Workers AI.

**Vectorize errors** — Vectorize requires `--remote` mode during development. It does not work with `wrangler dev` in local-only mode.

**Rate limit errors from APIs** — Perigon's free tier has limited usage but should be sufficient for the hackathon. Perplexity is pay-per-use at ~$0.006/query. If you hit rate limits, reduce query frequency or cache responses in KV.

**ElevenLabs character limit** — the free tier is 10,000 characters/month. A single episode uses roughly 3,000-5,000 characters. You will likely need at least the Starter plan ($5/mo, 30K chars) for the hackathon.
