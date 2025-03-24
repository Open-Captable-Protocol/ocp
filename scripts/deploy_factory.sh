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

# Check if REFERENCE_DIAMOND exists and has code
if [ ! -z "$REFERENCE_DIAMOND" ]; then
    echo "Checking if reference diamond exists at $REFERENCE_DIAMOND..."
    REMOTE_RPC=${RPC_URL:-"http://localhost:8545"}
    CONTRACT_CHECK=$(curl -s -X POST -H "Content-Type: application/json" --data "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getCode\",\"params\":[\"$REFERENCE_DIAMOND\", \"latest\"],\"id\":1}" $REMOTE_RPC)

    if [[ $CONTRACT_CHECK == *"\"result\":\"0x\""* ]]; then
        echo "⚠️  No implementation found at REFERENCE_DIAMOND address: $REFERENCE_DIAMOND"
        echo "This will deploy new implementations of:"
        echo "- Reference Diamond"
        echo "- All Facets"
        echo "RPC URL: $RPC_URL"
        
        if [ "$ENVIRONMENT" != "local" ]; then
            read -p "Deploy new implementation? (yes/no): " -r
            echo
            if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
                echo "Deployment cancelled"
                exit 1
            fi
            
            # Additional confirmation for non-local
            read -p "Type 'I understand' to proceed with deployment to $ENVIRONMENT: " -r
            echo
            if [[ ! $REPLY == "I understand" ]]; then
                echo "Deployment cancelled"
                exit 1
            fi
        else
            read -p "Deploy new implementation? (y/N): " -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                echo "Deployment cancelled"
                exit 1
            fi
        fi
        
        # Clear REFERENCE_DIAMOND to trigger new deployment
        REFERENCE_DIAMOND=""
    else
        echo "✅ Found existing reference diamond"
        echo "Options:"
        echo "1. Use existing implementation"
        echo "2. Deploy new implementation (will deploy new Reference Diamond and all Facets)"
        
        read -p "Choose option (1/2): " -r
        echo
        
        if [[ $REPLY == "2" ]]; then
            if [ "$ENVIRONMENT" != "local" ]; then
                # Additional confirmation for non-local
                read -p "Type 'I understand' to proceed with deployment to $ENVIRONMENT: " -r
                echo
                if [[ ! $REPLY == "I understand" ]]; then
                    echo "Deployment cancelled"
                    exit 1
                fi
            fi
            # Clear REFERENCE_DIAMOND to trigger new deployment
            REFERENCE_DIAMOND=""
        elif [[ $REPLY != "1" ]]; then
            echo "Invalid option. Deployment cancelled"
            exit 1
        fi
    fi
fi

# Creates a temporary copy of env file in the chain directory
# TEMP will be something like /your/path/chain/.env
TEMP=$PWD/chain/.env
cp "$USE_ENV_FILE" "$TEMP"
# Removes the temporary file when script exits
trap "rm $TEMP" EXIT

# Add confirmation step for non-local environments
if [ "$ENVIRONMENT" != "local" ] && [ -z "$REFERENCE_DIAMOND" ]; then
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
echo "RPC URL: $RPC_URL"
echo "Chain ID: $CHAIN_ID"

# Deploy contracts
echo "Deploying with REFERENCE_DIAMOND=${REFERENCE_DIAMOND:-empty}"
DEPLOY_OUTPUT=$(REFERENCE_DIAMOND=$REFERENCE_DIAMOND forge script script/DeployFactory.s.sol --broadcast --rpc-url $RPC_URL --private-key $PRIVATE_KEY --chain-id $CHAIN_ID)
echo "$DEPLOY_OUTPUT"

# Extract all addresses
FACTORY_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "FACTORY_ADDRESS=" | cut -d'=' -f2 | tr -d ' ')
REFERENCE_DIAMOND=$(echo "$DEPLOY_OUTPUT" | grep "REFERENCE_DIAMOND=" | cut -d'=' -f2 | tr -d ' ')
DIAMOND_LOUPE_FACET=$(echo "$DEPLOY_OUTPUT" | grep "DIAMOND_LOUPE_FACET=" | cut -d'=' -f2 | tr -d ' ')
ISSUER_FACET=$(echo "$DEPLOY_OUTPUT" | grep "ISSUER_FACET=" | cut -d'=' -f2 | tr -d ' ')
STAKEHOLDER_FACET=$(echo "$DEPLOY_OUTPUT" | grep "STAKEHOLDER_FACET=" | cut -d'=' -f2 | tr -d ' ')
STOCK_CLASS_FACET=$(echo "$DEPLOY_OUTPUT" | grep "STOCK_CLASS_FACET=" | cut -d'=' -f2 | tr -d ' ')
STOCK_FACET=$(echo "$DEPLOY_OUTPUT" | grep "STOCK_FACET=" | cut -d'=' -f2 | tr -d ' ')
CONVERTIBLES_FACET=$(echo "$DEPLOY_OUTPUT" | grep "CONVERTIBLES_FACET=" | cut -d'=' -f2 | tr -d ' ')
EQUITY_COMPENSATION_FACET=$(echo "$DEPLOY_OUTPUT" | grep "EQUITY_COMPENSATION_FACET=" | cut -d'=' -f2 | tr -d ' ')
STOCK_PLAN_FACET=$(echo "$DEPLOY_OUTPUT" | grep "STOCK_PLAN_FACET=" | cut -d'=' -f2 | tr -d ' ')
WARRANT_FACET=$(echo "$DEPLOY_OUTPUT" | grep "WARRANT_FACET=" | cut -d'=' -f2 | tr -d ' ')
STAKEHOLDER_NFT_FACET=$(echo "$DEPLOY_OUTPUT" | grep "STAKEHOLDER_NFT_FACET=" | cut -d'=' -f2 | tr -d ' ')
ACCESS_CONTROL_FACET=$(echo "$DEPLOY_OUTPUT" | grep "ACCESS_CONTROL_FACET=" | cut -d'=' -f2 | tr -d ' ')

# Display new addresses
echo "New contract addresses:"
echo "FACTORY_ADDRESS: $FACTORY_ADDRESS"
echo "REFERENCE_DIAMOND: $REFERENCE_DIAMOND"
echo "DIAMOND_LOUPE_FACET: $DIAMOND_LOUPE_FACET"
echo "ISSUER_FACET: $ISSUER_FACET"
echo "STAKEHOLDER_FACET: $STAKEHOLDER_FACET"
echo "STOCK_CLASS_FACET: $STOCK_CLASS_FACET"
echo "STOCK_FACET: $STOCK_FACET"
echo "CONVERTIBLES_FACET: $CONVERTIBLES_FACET"
echo "EQUITY_COMPENSATION_FACET: $EQUITY_COMPENSATION_FACET"
echo "STOCK_PLAN_FACET: $STOCK_PLAN_FACET"
echo "WARRANT_FACET: $WARRANT_FACET"
echo "STAKEHOLDER_NFT_FACET: $STAKEHOLDER_NFT_FACET"
echo "ACCESS_CONTROL_FACET: $ACCESS_CONTROL_FACET"

# Check if addresses have changed
ADDRESSES_CHANGED=false
if [ "$FACTORY_ADDRESS" != "$(grep '^FACTORY_ADDRESS=' "$USE_ENV_FILE" | cut -d'=' -f2)" ] || \
   [ "$REFERENCE_DIAMOND" != "$(grep '^REFERENCE_DIAMOND=' "$USE_ENV_FILE" | cut -d'=' -f2)" ]; then
   ADDRESSES_CHANGED=true
fi

# If addresses changed, prompt for update
if [ "$ADDRESSES_CHANGED" = true ]; then
    echo -e "\n⚠️  Contract addresses have changed"
    echo "Would you like to update $USE_ENV_FILE with the new addresses?"
    if [ "$ENVIRONMENT" != "local" ]; then
        read -p "Update addresses in $USE_ENV_FILE? (yes/no): " -r
        echo
        if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            echo "Skipping address update"
        else
            echo "Updating $USE_ENV_FILE with new addresses..."
            
            # Go back to project root directory
            cd ..
            
            # Create backup
            cp "$USE_ENV_FILE" "${USE_ENV_FILE}.backup"
            
            # Update addresses using temp file to handle BSD/GNU sed differences
            temp_file=$(mktemp)
            if grep -q "^FACTORY_ADDRESS=" "$USE_ENV_FILE"; then
                sed "s|^FACTORY_ADDRESS=.*|FACTORY_ADDRESS=$FACTORY_ADDRESS|" "$USE_ENV_FILE" > "$temp_file"
            else
                # If FACTORY_ADDRESS doesn't exist, append it
                echo "FACTORY_ADDRESS=$FACTORY_ADDRESS" >> "$USE_ENV_FILE"
            fi
            mv "$temp_file" "$USE_ENV_FILE"
            
            temp_file=$(mktemp)
            if grep -q "^REFERENCE_DIAMOND=" "$USE_ENV_FILE"; then
                sed "s|^REFERENCE_DIAMOND=.*|REFERENCE_DIAMOND=$REFERENCE_DIAMOND|" "$USE_ENV_FILE" > "$temp_file"
            else
                # If REFERENCE_DIAMOND doesn't exist, append it
                echo "REFERENCE_DIAMOND=$REFERENCE_DIAMOND" >> "$USE_ENV_FILE"
            fi
            mv "$temp_file" "$USE_ENV_FILE"
            
            echo "✅ Updated $USE_ENV_FILE with new contract addresses"
            echo "Backup saved as ${USE_ENV_FILE}.backup"
            
            # Go back to chain directory for the rest of the script
            cd chain
        fi
    else
        read -p "Update addresses in $USE_ENV_FILE? (y/N): " -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Skipping address update"
        else
            echo "Updating $USE_ENV_FILE with new addresses..."
            
            # Go back to project root directory
            cd ..
            
            # Create backup
            cp "$USE_ENV_FILE" "${USE_ENV_FILE}.backup"
            
            # Update addresses using temp file to handle BSD/GNU sed differences
            temp_file=$(mktemp)
            if grep -q "^FACTORY_ADDRESS=" "$USE_ENV_FILE"; then
                sed "s|^FACTORY_ADDRESS=.*|FACTORY_ADDRESS=$FACTORY_ADDRESS|" "$USE_ENV_FILE" > "$temp_file"
            else
                # If FACTORY_ADDRESS doesn't exist, append it
                echo "FACTORY_ADDRESS=$FACTORY_ADDRESS" >> "$USE_ENV_FILE"
            fi
            mv "$temp_file" "$USE_ENV_FILE"
            
            temp_file=$(mktemp)
            if grep -q "^REFERENCE_DIAMOND=" "$USE_ENV_FILE"; then
                sed "s|^REFERENCE_DIAMOND=.*|REFERENCE_DIAMOND=$REFERENCE_DIAMOND|" "$USE_ENV_FILE" > "$temp_file"
            else
                # If REFERENCE_DIAMOND doesn't exist, append it
                echo "REFERENCE_DIAMOND=$REFERENCE_DIAMOND" >> "$USE_ENV_FILE"
            fi
            mv "$temp_file" "$USE_ENV_FILE"
            
            echo "✅ Updated $USE_ENV_FILE with new contract addresses"
            echo "Backup saved as ${USE_ENV_FILE}.backup"
            
            # Go back to chain directory for the rest of the script
            cd chain
        fi
    fi
fi

# Only attempt verification for non-local environments
if [ "$ENVIRONMENT" != "local" ]; then
    echo "Waiting for deployment to be confirmed..."
    sleep 30

    echo "Verifying contracts..."
    # Verify Factory
    forge verify-contract $FACTORY_ADDRESS src/core/CapTableFactory.sol:CapTableFactory \
        --chain-id $CHAIN_ID \
        --etherscan-api-key $ETHERSCAN_API_KEY \
        --verifier-url https://api-sepolia.basescan.org/api \
        --constructor-args $(cast abi-encode "constructor(address)" $REFERENCE_DIAMOND)
    
    # Verify Diamond
    forge verify-contract $REFERENCE_DIAMOND src/core/CapTable.sol:CapTable \
        --chain-id $CHAIN_ID \
        --etherscan-api-key $ETHERSCAN_API_KEY \
        --constructor-args $(cast abi-encode "constructor(address)" $FACTORY_ADDRESS)

    # Verify Diamond Loupe Facet
    forge verify-contract $DIAMOND_LOUPE_FACET src/facets/DiamondLoupeFacet.sol:DiamondLoupeFacet \
        --chain-id $CHAIN_ID \
        --etherscan-api-key $ETHERSCAN_API_KEY

    # Verify Issuer Facet
    forge verify-contract $ISSUER_FACET src/facets/IssuerFacet.sol:IssuerFacet \
        --chain-id $CHAIN_ID \
        --etherscan-api-key $ETHERSCAN_API_KEY

    # Verify Stakeholder Facet
    forge verify-contract $STAKEHOLDER_FACET src/facets/StakeholderFacet.sol:StakeholderFacet \
        --chain-id $CHAIN_ID \
        --etherscan-api-key $ETHERSCAN_API_KEY

    # Verify Stock Class Facet
    forge verify-contract $STOCK_CLASS_FACET src/facets/StockClassFacet.sol:StockClassFacet \
        --chain-id $CHAIN_ID \
        --etherscan-api-key $ETHERSCAN_API_KEY

    # Verify Stock Facet
    forge verify-contract $STOCK_FACET src/facets/StockFacet.sol:StockFacet \
        --chain-id $CHAIN_ID \
        --etherscan-api-key $ETHERSCAN_API_KEY

    # Verify Convertibles Facet
    forge verify-contract $CONVERTIBLES_FACET src/facets/ConvertiblesFacet.sol:ConvertiblesFacet \
        --chain-id $CHAIN_ID \
        --etherscan-api-key $ETHERSCAN_API_KEY

    # Verify Equity Compensation Facet
    forge verify-contract $EQUITY_COMPENSATION_FACET src/facets/EquityCompensationFacet.sol:EquityCompensationFacet \
        --chain-id $CHAIN_ID \
        --etherscan-api-key $ETHERSCAN_API_KEY

    # Verify Stock Plan Facet
    forge verify-contract $STOCK_PLAN_FACET src/facets/StockPlanFacet.sol:StockPlanFacet \
        --chain-id $CHAIN_ID \
        --etherscan-api-key $ETHERSCAN_API_KEY

    # Verify Warrant Facet
    forge verify-contract $WARRANT_FACET src/facets/WarrantFacet.sol:WarrantFacet \
        --chain-id $CHAIN_ID \
        --etherscan-api-key $ETHERSCAN_API_KEY

    # Verify Stakeholder NFT Facet
    forge verify-contract $STAKEHOLDER_NFT_FACET src/facets/StakeholderNFTFacet.sol:StakeholderNFTFacet \
        --chain-id $CHAIN_ID \
        --etherscan-api-key $ETHERSCAN_API_KEY

    # Verify Access Control Facet
    forge verify-contract $ACCESS_CONTROL_FACET src/facets/AccessControlFacet.sol:AccessControlFacet \
        --chain-id $CHAIN_ID \
        --etherscan-api-key $ETHERSCAN_API_KEY

    echo "Verification complete!"
fi
