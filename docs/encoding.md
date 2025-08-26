## Encoding and Schemas

OCP standardizes serialization across stacks via canonical schemas in `common/schema/`.

### Rules and invariants
- Stable field ordering and explicit version fields
- Endianness and bigint handling are defined and tested
- Fixed vs dynamic arrays, padding, and string/bytes rules are explicit

### Golden test vectors
- Stored in `common/test-vectors/`
- Round-trip tests across Solidity ABI and TS/ethers

Solana/Anchor and Rust will be added later.

