// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/lib/diamond/DiamondCapTableFactory.sol";

contract DeployDiamondCapTableScript is Script {
    function setUp() public {
        // Setup for Base Sepolia deployment
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        console.log("Deploying DiamondCapTable system to Base Sepolia");

        vm.startBroadcast(deployerPrivateKey);

        DiamondCapTableFactory factory = new DiamondCapTableFactory();
        console.log("DiamondCapTableFactory deployed at:", address(factory));
        console.log("StakeholderNFTFacet deployed at:", factory.stakeholderNFTFacet());

        vm.stopBroadcast();
    }
}
