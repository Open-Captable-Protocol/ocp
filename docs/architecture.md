## Architecture

This is a high-level view of OCP's components and data flows.

### Components
- On-chain smart contracts (Solidity/Foundry)
- Off-chain tooling and SDKs (TypeScript)
- Shared schemas and test vectors

### Data flows
- Deterministic serialization using shared schemas
- Encoding/decoding round-trips validated by golden test vectors

Diagrams will be added with Excalidraw in `docs/diagrams/`.

