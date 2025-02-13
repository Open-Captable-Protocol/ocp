#!/bin/bash

# Sets default environment to "local" if no environment is specified
ENVIRONMENT="local"

# Function to cleanup processes on exit
cleanup() {
    # Kill anvil if we started it
    if [ ! -z "$ANVIL_PID" ]; then
        echo "Stopping anvil..."
        kill $ANVIL_PID
    fi
    # Remove temp env file if it exists
    if [ -f "$TEMP" ]; then
        rm -f "$TEMP"
    fi
}

# Set single trap for cleanup
trap cleanup EXIT INT TERM

# Processes command line arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --env=*) ENVIRONMENT="${1#*=}" ;;
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
set -a
source "$USE_ENV_FILE"
set +a

# Check and start anvil if not running
if ! nc -z localhost 8546 2>/dev/null; then
    echo "Starting anvil..."
    anvil --port 8546 > /dev/null 2>&1 & 
    ANVIL_PID=$!
    
    # Wait for anvil to start
    echo "Waiting for anvil to start..."
    until nc -z localhost 8546 2>/dev/null; do
        sleep 1
    done
    echo "✅ Anvil started on port 8546"
    
    # Set LOCAL_RPC for the script
    export LOCAL_RPC="http://localhost:8546"
fi

# Creates a temporary copy of env file in the chain directory
TEMP=$PWD/chain/.env.temp
cp "$USE_ENV_FILE" "$TEMP"

# Validate required environment variables
if [ -z "$REFERENCE_DIAMOND" ]; then
    echo "Error: REFERENCE_DIAMOND is not set in $USE_ENV_FILE"
    exit 1
fi

# Validate required environment variables
if [ -z "$FACTORY_ADDRESS" ]; then
    echo "Error: FACTORY_ADDRESS is not set in $USE_ENV_FILE"
    exit 1
fi

# Add confirmation step for non-local environments
if [ "$ENVIRONMENT" != "local" ]; then
    echo "⚠️  You are about to sync contracts in $ENVIRONMENT environment"
    echo "RPC URL: $RPC_URL"
    echo "Reference Diamond: $REFERENCE_DIAMOND"
    read -p "Are you sure you want to continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Sync cancelled"
        exit 1
    fi
fi

cd chain

echo "🔄 Starting sync process..."

# Step 1: Run SyncFacets script
echo "🔄 Syncing facets..."
echo "LOCAL_RPC: $LOCAL_RPC"
echo "REMOTE_RPC: $RPC_URL"
LOCAL_RPC=${LOCAL_RPC:-"http://localhost:8546"} REMOTE_RPC=$RPC_URL forge script script/SyncFacets.s.sol \
    --broadcast \
    --rpc-url $RPC_URL \
    --private-key $PRIVATE_KEY \
    -vvvv

if [ $? -ne 0 ]; then
    echo "❌ SyncFacets script failed"
    exit 1
fi

# Add confirmation step for non-local environments
if [ "$ENVIRONMENT" != "local" ]; then
    echo "⚠️  You are about to sync Diamonds in $ENVIRONMENT environment"
    echo "RPC URL: $RPC_URL"
    echo "Reference Diamond: $REFERENCE_DIAMOND"
    echo "Factory Address: $FACTORY_ADDRESS"
    read -p "Are you sure you want to continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Sync cancelled"
        exit 1
    fi
fi

# Step 2: Run SyncDiamonds script
# echo "🔄 Syncing deployed diamonds..."
# echo "Using Factory Address: $FACTORY_ADDRESS"
# echo "Using Reference Diamond: $REFERENCE_DIAMOND"

# Run forge with verbose output and stream logs
# forge script script/SyncDiamonds.s.sol \
#     --broadcast \
#     --rpc-url $RPC_URL \
#     --private-key $PRIVATE_KEY \
#     -vvvv

# if [ $? -ne 0 ]; then
#     echo "❌ SyncDiamonds script failed"
#     exit 1
# fi

echo "✅ Sync completed successfully!"
