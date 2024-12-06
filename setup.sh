#!/bin/bash
set -e  # Exit on error

cd chain

forge clean

# Remove current installations
rm -rf lib/*

# Install dependencies one by one with error checking
echo "Installing openzeppelin-contracts..."
forge install OpenZeppelin/openzeppelin-contracts@v4.9.3 --no-commit || exit 1

echo "Installing openzeppelin-contracts-upgradeable..."
forge install OpenZeppelin/openzeppelin-contracts-upgradeable@v4.9.3 --no-commit || exit 1

echo "Installing forge-std..."
forge install foundry-rs/forge-std@v1.5.3 --no-commit || exit 1

echo "Installing diamond-3-hardhat..."
forge install mudgen/diamond-3-hardhat --no-commit || exit 1

echo "Generating remappings..."
forge remappings > remappings.txt || exit 1

echo '@facets/=src/facets/' >> remappings.txt
echo '@libraries/=src/libraries/' >> remappings.txt
echo '@core/=src/core/' >> remappings.txt

echo "Building contracts..."
forge build --via-ir || exit 1

echo "Setup completed successfully!"