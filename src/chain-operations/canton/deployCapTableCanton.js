import { TransferAgentConfig } from "./lib/fairmint-canton/scripts/src/helpers/config";
import { FairmintClient } from "./lib/fairmint-canton/scripts/src/helpers/fairmintClient";

// eslint-disable-next-line no-unused-vars
export async function deployCapTableCanton(issuerId, initial_shares_authorized, chainId) {
    const config = new TransferAgentConfig();
    const client = new FairmintClient(config);

    console.log("🗽 | Deploying cap table on Canton...");

    // Pre-req: Create FairmintAdminService [One time]
    const { contractId, updateId } = await client.createFairmintAdminService();
    console.log(`Created FairmintAdminService with contract ID: ${contractId}`);

    return {
        address: contractId,
        deployHash: updateId,
    };
}
