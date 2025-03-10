#!/bin/bash
# Accept a single argument of an env file to use. By default use .env at root
USE_ENV_FILE=${1:-.env}
echo "USE_ENV_FILE=$USE_ENV_FILE"

# Check if .env file exists
if [ ! -f "$USE_ENV_FILE" ]; then
    echo "Error: Environment file $USE_ENV_FILE does not exist"
    exit 1
fi

# Check if file is readable
if [ ! -r "$USE_ENV_FILE" ]; then
    echo "Error: Environment file $USE_ENV_FILE is not readable"
    exit 1
fi

# Export environment variables from .env file
while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip empty lines and comments
    if [[ -z "$line" ]] || [[ "$line" =~ ^# ]]; then
        continue
    fi
    # Remove any quotes and export the variable
    line=$(echo "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    export "${line?}"
done < "$USE_ENV_FILE"

# Copy the root .env underneath chain so we dont have to maintain two copies
TEMP=$PWD/chain/.env
cp $USE_ENV_FILE $TEMP
trap "rm $TEMP" EXIT

set -x
cd chain
forge script script/AcceptAdminTransfers.s.sol --broadcast --fork-url localhost:8545 --private-key $PRIVATE_KEY