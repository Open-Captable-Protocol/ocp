## Multi-chain OSS Monorepo Playbook

A concise playbook for leading an open-source project that spans multiple chains and languages (Solidity/Ethereum, Rust/Solana, and potentially DAML). It favors a monorepo-first approach with clear boundaries, shared schemas, and per-package releases.

### What to do first (healthy OSS from day one)
- **Contributor experience**:
  - `README.md` (quickstart + why), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `GOVERNANCE.md`, `CODEOWNERS`.
  - PR/Issue templates; label taxonomy and triage policy.
  - One-command local dev (`make dev` or `just dev`); devcontainers and scripts.
  - Conventional Commits + semantic releases; auto-generated changelogs.
- **Documentation**:
  - Keep docs in-repo; publish with MkDocs or Docusaurus.
  - Generate API docs (Foundry doc for Solidity, `cargo doc` for Rust) and link them.
  - Add architecture, data-model, and glossary sections; diagrams for onboarding.
- **CI/CD**:
  - Matrix build/test per language; cache dependencies; parallelize.
  - Security scanning (Dependabot/Renovate), license checks, format/lint gates, coverage.
  - Automated releases per package (independent versioning).
- **Governance & community**:
  - Branch protections; required reviews via `CODEOWNERS`.
  - Contributor ladder; RFC/ADR process for significant changes.

### Monorepo vs multi-repo

#### Monorepo (one repository)
- **Pros**
  - **Shared standards**: single source of truth for schemas, encoders/decoders, and test vectors.
  - **Atomic cross-stack changes**: one PR for features/bugfixes touching multiple stacks.
  - **Discoverability**: unified docs and issue tracker; simpler onboarding.
  - **End-to-end tests**: integration spanning Ethereum + Solana with shared fixtures.
  - **Infra reuse**: shared CI, scripts, devcontainers.
- **Cons**
  - **Heavier CI**: slower pipelines; more cross-language tooling to maintain.
  - **Coupled changes**: unrelated edits can trigger broader builds; release coordination.
  - **Ownership boundaries**: noisier reviews without strong `CODEOWNERS` discipline.
  - **Repo weight**: larger history and artifacts.

#### Multi-repo (split by chain/stack)
- **Pros**
  - **Isolation**: separate release cadences, security boundaries, and ownership.
  - **Faster pipelines**: smaller clones; focused CI per stack.
  - **Community focus**: contributors only pull relevant code.
- **Cons**
  - **Coordination cost**: cross-repo changes require multi-PR/multi-release choreography.
  - **Duplication/drift**: shared schemas and encoders can diverge.
  - **Scattered issues/docs**: weaker program-wide visibility.

#### Practical recommendation
- Start **monorepo-first with strong boundaries**, plan for optional future split:
  - Top-level packages: `ethereum/`, `solana/`, `daml/`, `common/` (schemas, encoders, test vectors), `docs/`, `examples/`.
  - Independent versioning per package; publish artifacts to native registries.
  - If needed, split later using `git filter-repo` or `git subtree` without losing history; optionally mirror subtrees to separate repos while keeping the monorepo as the source of truth.
- Split when ≥2 are true: distinct maintainers/roadmaps, CI is consistently slow, cross-stack changes are rare, or compliance/security requires isolation.

### Tackling Solana data encoding/decoding (and aligning with Ethereum)
- **Unify around canonical schemas**
  - Maintain shared JSON Schemas or IDLs in `common/schema/`. Schemas are the spec.
  - Generate type-safe encoders/decoders for Solidity (ABI), Solana (Borsh/Anchor), and TypeScript.
- **Golden test vectors**
  - Store fixtures in `common/test-vectors/` and run round-trip tests across stacks.
  - Use property-based testing (`forge` fuzz/invariants, Rust `proptest`).
- **Edge cases to lock down**
  - Endianness; `u128`/bigint; fixed vs dynamic arrays; padding; string/bytes; address formats; signature serialization; time/decimal units.
- **Ecosystem tools**
  - Solana: Anchor + IDL, `borsh`; consistency checks across encoders.
  - Ethereum: EIP-712 typed data, `ethers` ABICoder v2, Foundry invariants.
- **Deterministic serialization**
  - Stable field ordering and strict versions; include version fields in payloads.
  - Add “compat” tests to block breaking ABI/IDL changes without explicit version bumps.

### Suggested monorepo layout
```text
/docs/                   # mkdocs/docusaurus sources
/common/
  schema/                # JSON schemas/IDLs used by all chains
  encoding/              # shared generators/adapters
  test-vectors/          # canonical fixtures + golden files
/ethereum/
  contracts/             # Solidity (Foundry)
  scripts/               # deploy, verify, tasks
  tests/                 # Foundry tests incl. cross-fixture tests
/solana/
  programs/              # Rust/Anchor
  sdk/                   # client sdk (ts/rust)
  tests/                 # validator-based + e2e using test vectors
/daml/
  models/                # DAML sources
/examples/               # cross-chain usage samples
/tools/                  # dev tooling, codegen, precommit hooks
```

### Versioning and releases
- **Independent package versioning** with automated release notes.
- Conventional Commits + `release-please` or Changesets for per-package releases.
- Tag artifacts per package; avoid forced lockstep versions.

### CI essentials (matrix and speed)
- Matrix builds: `{ethereum, solana, daml}` × `{lint, test, build}`.
- Cache: Foundry `~/.foundry`, Cargo, npm/yarn; reuse artifacts between jobs.
- Networks: `anvil` (Ethereum), `solana-test-validator` (Solana); run e2e with shared fixtures.
- Security: Dependabot/Renovate; license scan; `cargo deny`; optional `slither`/`mythril`; Anchor audit checks.
- Enforce formatting (`forge fmt`, `cargo fmt`, `prettier`) and lint gates.

### Documentation improvements
- Architecture Decision Records in `docs/adr/`.
- Generate/publish API docs per stack; link from a single docs site.
- “How to contribute” per stack with copy-pastable setup and test commands.
- Add a top-level “map of the repo” and diagrams.

### Project Canvas template (`PROJECT_CANVAS.md`)
```markdown
# Project Canvas
- Vision: …
- Problem & Scope: …
- Target Users & Use Cases: …
- Value Proposition: …
- Architecture Overview: (diagram + brief)
- Data Model & Encoding Strategy: schema links, versioning, compat policy
- Roadmap & Milestones: now/next/later
- Success Metrics: …
- Governance & Maintainers: roles, CODEOWNERS
- Contribution Guide: quickstart, dev env, tests
- Risks & Assumptions: …
```

### Next steps checklist
- [ ] Add `PROJECT_CANVAS.md`, `CONTRIBUTING.md`, `CODEOWNERS`, PR/Issue templates.
- [ ] Create `common/schema/` and `common/test-vectors/` with a first canonical fixture.
- [ ] Add round-trip tests in Ethereum and Solana using shared vectors.
- [ ] Set up CI matrix and caching; enforce formatting/lint gates.
- [ ] Publish first per-package releases; document release process.

### Bottom line
- Keep a monorepo with clear package boundaries, shared schemas, and golden vectors. Publish per-package releases. Revisit splitting when ownership/cadence diverge.
- Invest early in docs, CI, and encoding discipline; these pay off the most for multi-chain OSS.


