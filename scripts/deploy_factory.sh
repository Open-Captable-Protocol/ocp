#!/bin/bash

# Sets default environment to "local" if no environment is specified
ENVIRONMENT="local"

# Processes command line arguments
# Example: ./deploy_factory.local.sh --env=dev
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --env=*) ENVIRONMENT="${1#*=}" ;;  # Extracts value after --env=
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done


# Constructs env file path based on environment
# Example: .env.local, .env.dev, .env.prod
USE_ENV_FILE=".env.$ENVIRONMENT"

# Exits if the environment file doesn't exist
[ ! -f "$USE_ENV_FILE" ] && echo "Error: $USE_ENV_FILE does not exist" && exit 1

# Loads environment variables from the env file
# set -a: automatically exports all variables
# source: loads the env file
# set +a: stops auto-exporting
set -a
source "$USE_ENV_FILE"
set +a

# Creates a temporary copy of env file in the chain directory
# TEMP will be something like /your/path/chain/.env
TEMP=$PWD/chain/.env
cp "$USE_ENV_FILE" "$TEMP"
# Removes the temporary file when script exits
trap "rm $TEMP" EXIT

# Add confirmation step for non-local environments
if [ "$ENVIRONMENT" != "local" ]; then
    echo "⚠️  You are about to deploy to $ENVIRONMENT environment"
    echo "RPC URL will be: $RPC_URL"
    read -p "Are you sure you want to continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled"
        exit 1
    fi
fi

# Changes to chain directory and runs the forge deploy script
cd chain
echo $RPC_URL
echo $PRIVATE_KEY
echo $CHAIN_ID

# Deploy contracts
DEPLOY_OUTPUT=$(forge script script/DeployFactory.s.sol --broadcast --rpc-url $RPC_URL --private-key $PRIVATE_KEY --chain-id $CHAIN_ID)
echo "$DEPLOY_OUTPUT"
FACTORY_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "FACTORY_ADDRESS=" | cut -d'=' -f2 | tr -d ' ')
REFERENCE_DIAMOND=$(echo "$DEPLOY_OUTPUT" | grep "REFERENCE_DIAMOND=" | cut -d'=' -f2 | tr -d ' ')
echo "\nAdd the following to your .env file:"
echo "FACTORY_ADDRESS=$FACTORY_ADDRESS"
echo "REFERENCE_DIAMOND=$REFERENCE_DIAMOND"

# Only attempt verification for non-local environments
if [ "$ENVIRONMENT" != "local" ]; then
    # Extract deployed addresses from output
    
    echo "Waiting for deployment to be confirmed..."
    sleep 30  # Wait for deployment to be confirmed on chain

    echo "Verifying contracts..."
    # Verify Factory contract
    forge verify-contract $FACTORY_ADDRESS src/core/CapTableFactory.sol:CapTableFactory \
        --chain-id $CHAIN_ID \
        --etherscan-api-key $ETHERSCAN_API_KEY \
        --constructor-args $(cast abi-encode "constructor(address)" $REFERENCE_DIAMOND)
    
    echo "Verification complete!"
fi
