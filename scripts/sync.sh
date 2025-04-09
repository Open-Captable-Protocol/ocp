#!/bin/bash

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Log file setup
LOG_DIR="logs"
LOG_FILE="$LOG_DIR/sync_$(date +%Y%m%d_%H%M%S).log"
mkdir -p "$LOG_DIR"

# Function to log messages
log() {
    local message="$1"
    local color="$2"
    echo -e "${color}${message}${NC}" | tee -a "$LOG_FILE"
}

# Function to check if anvil is running
check_anvil() {
    if ! nc -z localhost 8546 2>/dev/null; then
        log "Starting anvil on port 8546..." "$BLUE"
        anvil --port 8546 > /dev/null 2>&1 &
        ANVIL_PID=$!
        sleep 2
    else
        log "Anvil is already running on port 8546" "$GREEN"
    fi
}

# Function to cleanup
cleanup() {
    if [ ! -z "$ANVIL_PID" ]; then
        log "Stopping anvil..." "$BLUE"
        kill $ANVIL_PID
    fi
}

# Set trap for cleanup
trap cleanup EXIT INT TERM

# Function to validate environment
validate_environment() {
    local env="$1"
    local env_file=".env.$env"
    
    if [ ! -f "$env_file" ]; then
        log "Error: Environment file $env_file not found" "$RED"
        exit 1
    fi
    
    # Load environment variables
    set -a
    source "$env_file"
    set +a
    
    # Validate required variables
    local required_vars=("REFERENCE_DIAMOND" "FACTORY_ADDRESS" "RPC_URL" "PRIVATE_KEY")
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            log "Error: $var is not set in $env_file" "$RED"
            exit 1
        fi
    done
    
    log "Environment $env validated successfully" "$GREEN"
}

# Function to check reference diamond
check_reference_diamond() {
    log "Checking reference diamond at $REFERENCE_DIAMOND..." "$BLUE"
    
    local code=$(cast call "$REFERENCE_DIAMOND" "facetAddress(bytes4)" "0x1f931c1c" --rpc-url "$RPC_URL" || true)
    
    if [[ "$code" == "0x0000000000000000000000000000000000000000000000000000000000000000" ]]; then
        log "Reference diamond not found at $REFERENCE_DIAMOND" "$YELLOW"
        
        exit 1
    else
        log "Reference diamond found at $REFERENCE_DIAMOND" "$GREEN"
    fi
}

# Function to run dry run
run_dry_run() {
    log "Running dry run to detect changes..." "$BLUE"
    
    cd chain
    
    # Capture forge script output
    local output
    if ! output=$(LOCAL_RPC="http://localhost:8546" REMOTE_RPC="$RPC_URL" forge script script/SyncFacets.s.sol:SyncFacetsScript \
        --sig "detectChanges()" \
        --rpc-url "$RPC_URL" \
        --private-key "$PRIVATE_KEY" \
        -vvvv 2>&1); then
        log "Error running forge script: $output" "$RED"
        return 1
    fi
    
    # Log the output
    echo "$output" | tee -a "$LOG_FILE"
    
    if echo "$output" | grep -q "CHANGES_DETECTED=true"; then
        log "Changes detected:" "$YELLOW"
        echo "$output" | grep "CHANGE_" | while read -r line; do
            log "$line" "$YELLOW"
        done
    else
        log "No changes detected" "$GREEN"
    fi
    
    cd ..
}

# Function to run actual sync
run_sync() {
    log "Starting sync process..." "$BLUE"
    
    cd chain
    
    # Capture forge script output
    local output
    if ! output=$(LOCAL_RPC="http://localhost:8546" REMOTE_RPC="$RPC_URL" forge script script/SyncFacets.s.sol:SyncFacetsScript \
        --sig "detectChanges()" \
        --rpc-url "$RPC_URL" \
        --private-key "$PRIVATE_KEY" \
        -vvvv 2>&1); then
        log "Error running forge script: $output" "$RED"
        return 1
    fi
    
    # Log the output
    echo "$output" | tee -a "$LOG_FILE"
    
    if echo "$output" | grep -q "CHANGES_DETECTED=true"; then
        log "Changes detected:" "$YELLOW"
        echo "$output" | grep "CHANGE_" | while read -r line; do
            log "$line" "$YELLOW"
        done
        
        if [ "$ENVIRONMENT" != "local" ]; then
            log "⚠️  WARNING: You are about to update facets in $ENVIRONMENT environment" "$YELLOW"
            read -p "Type 'I understand' to proceed: " -r
            if [[ ! $REPLY == "I understand" ]]; then
                log "Operation cancelled" "$RED"
                exit 1
            fi
        else
            read -p "Would you like to apply these changes? (y/N): " -r
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log "Operation cancelled" "$RED"
                exit 1
            fi
        fi
        
        log "Applying changes..." "$BLUE"
        if ! LOCAL_RPC="http://localhost:8546" REMOTE_RPC="$RPC_URL" forge script script/SyncFacets.s.sol:SyncFacetsScript \
            --broadcast \
            --rpc-url "$RPC_URL" \
            --private-key "$PRIVATE_KEY" \
            -vvvv 2>&1 | tee -a "$LOG_FILE"; then
            log "Failed to apply changes" "$RED"
            exit 1
        fi
        
        log "Changes applied successfully" "$GREEN"
    else
        log "No changes detected" "$GREEN"
    fi
    
    cd ..
}

# Main sync function
sync() {
    local env="$1"
    local check_only="$2"
    
    ENVIRONMENT="$env"
    log "Starting sync for $ENVIRONMENT environment" "$BLUE"
    
    # Validate environment
    validate_environment "$env"
    
    # Check reference diamond
    check_reference_diamond
    
    # Start anvil
    check_anvil
    
    # Run sync process
    if [ "$check_only" = true ]; then
        FOUNDRY_PROFILE=production run_dry_run
    else
        FOUNDRY_PROFILE=production run_sync
    fi
}

# Main execution
if [ "$#" -lt 1 ]; then
    log "Usage: $0 <environment> [--check]" "$RED"
    exit 1
fi

ENV="$1"
CHECK_ONLY=false

if [ "$2" = "--check" ]; then
    CHECK_ONLY=true
fi

sync "$ENV" "$CHECK_ONLY"
