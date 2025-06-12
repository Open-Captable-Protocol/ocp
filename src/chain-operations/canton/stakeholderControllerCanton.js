import { client } from "./clientConfig";

// eslint-disable-next-line no-unused-vars
export const convertAndReflectStakeholderOnchainCanton = async (stakeholderId) => {
    console.log("🗽 | Converting and reflecting stakeholder onchain Canton...");

    // Create new party for stakeholder [Once per stakeholder]
    const { partyId } = await client.createParty(stakeholderId);

    return { partyId, updateId: null /* TODO */ };
};
