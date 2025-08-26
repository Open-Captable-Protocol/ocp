## OCP Documentation Plan (v0)

This plan captures goals, decisions, information architecture, and initial deliverables for the OCP documentation site.

### Goals (next 4–6 weeks)
- Onboard developers into the protocol and help outsiders understand what OCP is.
- Serve smart contract contributors and non-technical stakeholders with a professional, serious tone.
- Start with core protocol concepts and Solidity (Ethereum); add other languages later.

### Audience
- Primary: smart contract contributors (Solidity/Ethereum), integrators building with TS/ethers.
- Secondary: non-technical stakeholders who need a high-level understanding and architecture overview.

### Platform & Hosting
- Site generator: MkDocs with Material theme.
- Hosting: GitHub Pages with CI build/publish.
- Analytics: Umami (self-hosted or cloud).
- Diagrams: Excalidraw, stored versioned in-repo.
- Docs versioning: not initially; keep it simple. Revisit later.
- PR previews: yes (deploy previews per PR).
- Contribution/governance/security pages: kept in repo, not included in the docs site navigation.

### Information Architecture (initial)
- Overview (Home)
  - What is OCP?
  - Why OCP? Problem/Scope
  - Project status and roadmap snapshot
- Quickstart (Solidity + TS/ethers)
  - Install deps, run local dev (`anvil`)
  - Deploy minimal contract or interact with existing endpoints
  - Encode/decode a sample payload (round-trip)
- Concepts
  - Core protocol concepts (naming consistent with OCP)
  - Assumptions and non-goals
- Architecture
  - High-level protocol diagram (Excalidraw)
  - On-chain components; off-chain services (if any)
  - Data flows
- Data Model (nice-to-have v0)
  - Canonical entities and relationships
- Encoding
  - Canonical schema in `common/schema/`
  - Deterministic serialization rules and compatibility policy
  - Golden test vectors + cross-language round-trips
- Ethereum Guide (v0 focus)
  - Contracts layout, local dev, testing with Foundry
  - TS/ethers examples
- Solana Guide (later)
  - Placeholder page; link plan for Anchor/IDL parity
- API Reference
  - Solidity: Foundry doc output
  - TS: TypeDoc
  - Rust (later): cargo doc
- Tutorials & Examples
  - Minimal end-to-end flows using TS/ethers
- Integration Environments
  - Supported networks (Ethereum: mainnet/testnets; Solana: devnet/mainnet-beta later)
  - Local development: `anvil`, `solana-test-validator` (placeholder)
- Glossary (optional in v0)
  - Core terms aligned with OCP
- Changelog & Releases
  - Independent package releases; semantic-release strategy (docs-only page summarizing process)

### Page outlines (top priority)
- Overview: succinct definition of OCP; positioning; current capabilities; roadmap snapshot.
- Quickstart: copy-pastable commands for local dev; TS/ethers example for a minimal interaction; link to Ethereum Guide.
- Architecture: single-page diagram + brief explanation of components and data flows.
- Encoding: schema location, invariants (endianness, bigint, padding), versioning field, and explanation of golden test vectors.
- Ethereum Guide: repo layout, scripts, testing, deployment, and interaction examples.

### Implementation plan (PR 1 → PR 3)
- PR 1: Scaffolding
  - Add `docs/` with initial pages: `index.md`, `quickstart.md`, `architecture.md`, `encoding.md`, `ethereum.md` (Solana placeholder).
  - Add `mkdocs.yml` with Material theme and navigation.
  - Add `.github/workflows/docs.yml` to build and deploy to GitHub Pages; enable PR previews.
  - Add `docs/assets/` and `docs/diagrams/` (Excalidraw) directories.
  - Configure Umami hooks (placeholder `UMAMI_WEBSITE_ID` and endpoint envs).
- PR 2: Content
  - Fill Overview, Quickstart, Architecture (v1 diagrams), Encoding (rules + golden vectors locations), Ethereum Guide (local dev + examples).
  - Generate and link Solidity API docs (Foundry doc) and TypeDoc for TS clients if present.
- PR 3: Quality and polish
  - Add link checker, spell/style checks, and code block tests in CI.
  - Add Project Canvas at repo root and link from Overview.
  - Decide on Repo Map (defer if not needed v0).

### mkdocs.yml (draft)
```yaml
site_name: OCP Documentation
theme:
  name: material
  features:
    - navigation.sections
    - content.code.copy
    - search.suggest
    - search.highlight
nav:
  - Overview: index.md
  - Quickstart: quickstart.md
  - Concepts: concepts.md
  - Architecture: architecture.md
  - Data Model: data-model.md
  - Encoding: encoding.md
  - Ethereum: ethereum.md
  - Solana (coming soon): solana.md
  - API Reference:
      - Solidity: api/solidity.md
      - TypeScript: api/typescript.md
plugins:
  - search
extra:
  analytics:
    provider: umami
    property: ${UMAMI_WEBSITE_ID}
```

### Directory structure (draft)
```text
docs/
  index.md
  quickstart.md
  concepts.md
  architecture.md
  data-model.md
  encoding.md
  ethereum.md
  solana.md
  api/
    solidity.md
    typescript.md
  assets/
  diagrams/
```

### Decisions
- Monorepo docs for now; centralize even if code splits later.
- Only Solidity now; Solana/DAML later.
- Keep contributor, governance, and security documents in repo root but out of docs nav.

### Non-goals (v0)
- Docs versioning and multi-language i18n.
- Full Solana content; only placeholders.

### Open questions (please provide when convenient)
- Node and package manager: prefer PNPM or Yarn as canonical? Which Node version should we target (e.g., 20 LTS)?
- Umami: do you already have a Website ID and endpoint? If not, should we add placeholders and wire later?
- GitHub Pages: publish to `gh-pages` branch under this repo, project site (recommended)?
- Repo Map: what level of detail would you like (top-level only vs. file-by-file)?
- Disclaimers: do you have a preferred wording to add on the Overview page?
- Top 3 examples to prioritize for Quickstart/Tutorials (TS/ethers): suggestions welcome.

### References
- Whitepaper context (for alignment only): Open-Captable-Protocol/whitepaper `draft_1.tex`
- Inspiration for structure and tone: tinygrad docs and repo


