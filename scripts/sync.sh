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

# Validate required environment variables
if [ -z "$REFERENCE_DIAMOND" ]; then
    echo "Error: REFERENCE_DIAMOND is not set in $USE_ENV_FILE"
    exit 1
fi

if [ -z "$FACTORY_ADDRESS" ]; then
    echo "Error: FACTORY_ADDRESS is not set in $USE_ENV_FILE"
    exit 1
fi

# Check if anvil is running on port 8545 (remote)
if ! nc -z localhost 8545 2>/dev/null; then
    echo "Error: Anvil is not running on port 8545 (remote chain)"
    echo "Please start anvil first with: anvil --port 8545"
    exit 1
fi

# Check if the REFERENCE_DIAMOND contract exists on the remote chain
REMOTE_RPC=${RPC_URL:-"http://localhost:8545"}
CONTRACT_CHECK=$(curl -s -X POST -H "Content-Type: application/json" --data "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getCode\",\"params\":[\"$REFERENCE_DIAMOND\", \"latest\"],\"id\":1}" $REMOTE_RPC)

if [[ $CONTRACT_CHECK == *"\"result\":\"0x\""* ]]; then
    echo "⚠️  No implementation found at REFERENCE_DIAMOND address: $REFERENCE_DIAMOND"
    echo "Would you like to deploy a new reference diamond with all facets?"
    
    if [ "$ENVIRONMENT" != "local" ]; then
        read -p "This is a non-local environment. Are you sure? (yes/no): " -r
        echo
        if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            echo "Operation cancelled"
            exit 1
        fi
        
        echo "⚠️  WARNING: You are about to deploy to $ENVIRONMENT environment"
        echo "This will deploy new implementations of:"
        echo "- Reference Diamond"
        echo "- All Facets"
        echo "RPC URL: $RPC_URL"
        read -p "Type 'I understand' to proceed: " -r
        echo
        if [[ ! $REPLY == "I understand" ]]; then
            echo "Operation cancelled"
            exit 1
        fi
    else
        read -p "Deploy new implementation? (y/N): " -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Operation cancelled"
            exit 1
        fi
    fi
    
    # Deploy new implementation
    echo "🚀 Deploying new reference diamond and facets..."
    yarn deploy:local
    
    if [ $? -ne 0 ]; then
        echo "❌ Deployment failed"
        exit 1
    fi
    
    echo "✅ Deployment successful"
    echo "Please run sync again to apply your changes"
    exit 0
fi

echo "✅ Found existing reference diamond at: $REFERENCE_DIAMOND"

# Check and start anvil if not running on port 8546 (local)
if ! nc -z localhost 8546 2>/dev/null; then
    echo "Starting anvil on port 8546 (local chain)..."
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

cd chain

echo "🔄 Starting sync process..."

# Step 1: Run SyncFacets script to detect changes
echo "🔄 Checking for facet changes..."
echo "LOCAL_RPC: $LOCAL_RPC"
echo "REMOTE_RPC: $REMOTE_RPC"
SYNC_OUTPUT=$(LOCAL_RPC=${LOCAL_RPC:-"http://localhost:8546"} REMOTE_RPC=$RPC_URL forge script script/SyncFacets.s.sol:SyncFacetsScript \
    --sig "detectChanges()" \
    --rpc-url $RPC_URL \
    --private-key $PRIVATE_KEY \
    -vvvv 2>&1 || true)

# Check if changes were detected
if echo "$SYNC_OUTPUT" | grep -q "CHANGES_DETECTED=true"; then
    echo -e "\n📝 Changes detected in facets:"
    
    # Extract and display changes
    CHANGE_COUNT=$(echo "$SYNC_OUTPUT" | grep "CHANGE_COUNT=" | cut -d'=' -f2 | tr -d ' ')
    for i in $(seq 0 $((CHANGE_COUNT-1))); do
        CHANGE=$(echo "$SYNC_OUTPUT" | grep "CHANGE_$i=" | cut -d'=' -f2)
        echo "- $CHANGE"
    done
    
    # Prompt for confirmation
    if [ "$ENVIRONMENT" != "local" ]; then
        echo -e "\n⚠️  You are about to update facets in $ENVIRONMENT environment"
        read -p "Would you like to apply these changes? (yes/no): " -r
        echo
        if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            echo "Sync cancelled"
            exit 1
        fi
        
        # Additional confirmation for non-local environments
        echo "⚠️  WARNING: This will modify facets in $ENVIRONMENT environment"
        read -p "Type 'I understand' to proceed: " -r
        echo
        if [[ ! $REPLY == "I understand" ]]; then
            echo "Sync cancelled"
            exit 1
        fi
    else
        read -p "Would you like to apply these changes? (y/N): " -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Sync cancelled"
            exit 1
        fi
    fi
    
    # Apply changes
    echo "🔄 Applying facet changes..."
    LOCAL_RPC=${LOCAL_RPC:-"http://localhost:8546"} REMOTE_RPC=$RPC_URL forge script script/SyncFacets.s.sol:SyncFacetsScript \
        --broadcast \
        --rpc-url $RPC_URL \
        --private-key $PRIVATE_KEY \
        -vvvv
    
    if [ $? -ne 0 ]; then
        echo "❌ Failed to apply changes"
        exit 1
    fi
    
    echo "✅ Changes applied successfully!"
else
    echo "✅ No changes detected"
fi
