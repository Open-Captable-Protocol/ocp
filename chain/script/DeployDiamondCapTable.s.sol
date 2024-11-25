// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/lib/diamond/DiamondCapTableFactory.sol";

contract DeployDiamondCapTableScript is Script {
    // Anvil's first default account private key
    uint256 constant ANVIL_PRIVATE_KEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    address deployer;

    function setUp() public {
        console.log("Setting up DiamondCapTable deployment");
        deployer = vm.addr(ANVIL_PRIVATE_KEY);
        console.log("Deployer address:", deployer);
    }

    function run() external {
        console.log("Deploying DiamondCapTable system");

        vm.startBroadcast(ANVIL_PRIVATE_KEY);

        // Deploy the factory
        DiamondCapTableFactory factory = new DiamondCapTableFactory();
        console.log("DiamondCapTableFactory deployed at:", address(factory));

        // Log the NFT facet address
        console.log("StakeholderNFTFacet deployed at:", factory.stakeholderNFTFacet());

        vm.stopBroadcast();
    }
}
