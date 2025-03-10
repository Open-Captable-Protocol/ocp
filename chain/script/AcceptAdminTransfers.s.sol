// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/core/CapTableFactory.sol";
import { AccessControlFacet } from "@facets/AccessControlFacet.sol";
import { AccessControl } from "@libraries/AccessControl.sol";

contract AcceptAdminTransfersScript is Script {
    function run() external {
        // Get the fairmint wallet private key
        uint256 fairmintPrivateKey = vm.envUint("PRIVATE_KEY");
        address fairmintWallet = vm.addr(fairmintPrivateKey);
        if (fairmintWallet == address(0)) {
            revert("Invalid private key");
        }

        // Get factory address from env
        address factoryAddress = vm.envAddress("FACTORY_ADDRESS");
        CapTableFactory factory = CapTableFactory(factoryAddress);

        console.log("Starting admin transfer acceptance for Fairmint wallet:", fairmintWallet);
        console.log("Factory address:", factoryAddress);

        vm.startBroadcast(fairmintPrivateKey);

        uint256 capTableCount = factory.getCapTableCount();
        console.log("Total cap tables:", capTableCount);

        for (uint256 i = 0; i < capTableCount; i++) {
            address capTable = factory.capTables(i);
            console.log("\nChecking cap table:", capTable);

            // Check if we're already admin
            if (AccessControlFacet(capTable).hasRole(AccessControl.DEFAULT_ADMIN_ROLE, fairmintWallet)) {
                console.log("Already admin, skipping...");
                continue;
            }

            // Check if we're the pending admin
            if (AccessControlFacet(capTable).getPendingAdmin() == fairmintWallet) {
                console.log("Accepting admin transfer...");
                AccessControlFacet(capTable).acceptAdmin();
                console.log("Admin transfer accepted!");
            } else {
                console.log("Not pending admin, skipping...");
            }
        }

        vm.stopBroadcast();
        console.log("\nAdmin transfer acceptance complete!");
    }
}
