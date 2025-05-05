#!/bin/bash
set -euo pipefail

# Processes command line arguments
# Example: ./verify_simple.sh --env=dev
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --env=*) ENVIRONMENT="${1#*=}" ;;  # Extracts value after --env=
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done


# Constructs env file path based on environment
# Example: .env.local, .env.dev, .env.prod
USE_ENV_FILE=".env.${ENVIRONMENT}"

# Exits if the environment file doesn't exist
[ ! -f "$USE_ENV_FILE" ] && echo "Error: $USE_ENV_FILE does not exist" && exit 1

# Loads environment variables from the env file
# set -a: automatically exports all variables
# source: loads the env file
# set +a: stops auto-exporting
set -a
source "$USE_ENV_FILE"
set +a

# Changes to chain directory and runs the forge deploy script
cd chain

CHAIN_ID=$(cast chain-id --rpc-url "$RPC_URL")
echo "RPC_URL=$RPC_URL"
echo "CHAIN_ID=$CHAIN_ID"

env | grep "DIAMOND"
env | grep "ADDRESS"
env | grep "FACET"

verify_contract() {
  local address=$1
  local src_spec=$2
  shift 2

  # Choose blockscout vs etherscan based on chain
  if [[ "$CHAIN_ID" == "98867" || "$CHAIN_ID" == "98866" ]]; then
    verifier_flags="--rpc-url $RPC_URL --verifier blockscout --verifier-url $VERIFY_URL"
  else
    verifier_flags="--chain-id $CHAIN_ID --etherscan-api-key $ETHERSCAN_API_KEY"
  fi

  # set -x
  forge verify-contract "$address" "$src_spec" $verifier_flags "$@" --watch -vvvv
  # set +x
}

verify_contract $DIAMOND_CUT_FACET lib/diamond-3-hardhat/contracts/facets/DiamondCutFacet.sol:DiamondCutFacet
verify_contract $DIAMOND_LOUPE_FACET lib/diamond-3-hardhat/contracts/facets/DiamondLoupeFacet.sol:DiamondLoupeFacet

verify_contract $FACTORY_ADDRESS src/core/CapTableFactory.sol:CapTableFactory \
    --constructor-args $(cast abi-encode "constructor(address)" $REFERENCE_DIAMOND)

verify_contract $REFERENCE_DIAMOND src/core/CapTable.sol:CapTable \
    --constructor-args $(cast abi-encode "constructor(address,address)" $FACTORY_ADDRESS $DIAMOND_CUT_FACET)

verify_contract $ISSUER_FACET src/facets/IssuerFacet.sol:IssuerFacet
verify_contract $STAKEHOLDER_FACET src/facets/StakeholderFacet.sol:StakeholderFacet
verify_contract $STOCK_CLASS_FACET src/facets/StockClassFacet.sol:StockClassFacet
verify_contract $STOCK_FACET src/facets/StockFacet.sol:StockFacet
verify_contract $CONVERTIBLES_FACET src/facets/ConvertiblesFacet.sol:ConvertiblesFacet
verify_contract $EQUITY_COMPENSATION_FACET src/facets/EquityCompensationFacet.sol:EquityCompensationFacet
verify_contract $STOCK_PLAN_FACET src/facets/StockPlanFacet.sol:StockPlanFacet
verify_contract $WARRANT_FACET src/facets/WarrantFacet.sol:WarrantFacet
verify_contract $STAKEHOLDER_NFT_FACET src/facets/StakeholderNFTFacet.sol:StakeholderNFTFacet
verify_contract $ACCESS_CONTROL_FACET src/facets/AccessControlFacet.sol:AccessControlFacet

echo "Verification complete!"
