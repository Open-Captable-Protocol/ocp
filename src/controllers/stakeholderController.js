import { convertUUIDToBytes16 } from "../utils/convertUUID.js";
import { decodeError } from "../utils/errorDecoder.js";
/// @dev: controller handles conversion from OCF type to Onchain types and creates the stakeholder.
export const convertAndReflectStakeholderOnchain = async (contract, stakeholderId) => {
    try {
        const stakeholderIdBytes16 = convertUUIDToBytes16(stakeholderId);
        const tx = await contract.createStakeholder(stakeholderIdBytes16);
        const receipt = await tx.wait();
        return receipt;
    } catch (error) {
        const decodedError = decodeError(error);
        throw new Error(decodedError.message);
    }
};

export const addWalletToStakeholder = async (contract, id, wallet) => {
    // First: convert OCF Types to Onchain Types
    const stakeholderIdBytes16 = convertUUIDToBytes16(id);
    // Second: add wallet to stakeholder onchain
    const tx = await contract.addWalletToStakeholder(stakeholderIdBytes16, wallet);
    const receipt = await tx.wait();
    return receipt;
};

export const removeWalletFromStakeholder = async (contract, id, wallet) => {
    // First: convert OCF Types to Onchain Types
    const stakeholderIdBytes16 = convertUUIDToBytes16(id);
    // Second: remove wallet from stakeholder onchain
    const tx = await contract.removeWalletFromStakeholder(stakeholderIdBytes16, wallet);
    const receipt = await tx.wait();

    console.log("✅ | Wallet removed from stakeholder onchain");
    return receipt;
};

// TODO: to decide if we want to also return offchain data.
export const getStakeholderById = async (contract, id) => {
    // First: convert OCF Types to Onchain Types
    const stakeholderIdBytes16 = convertUUIDToBytes16(id);
    // Second: get stakeholder onchain
    const stakeHolderAdded = await contract.getStakeholderById(stakeholderIdBytes16);
    const stakeholderId = stakeHolderAdded[0];
    const type = stakeHolderAdded[1];
    const role = stakeHolderAdded[2];
    console.log("Stakeholder:", { stakeholderId, type, role });
    return { stakeholderId, type, role };
};

export const getTotalNumberOfStakeholders = async (contract) => {
    const totalStakeholders = await contract.getTotalNumberOfStakeholders();
    console.log("＃ | Total number of stakeholders:", totalStakeholders.toString());
    return totalStakeholders.toString();
};
