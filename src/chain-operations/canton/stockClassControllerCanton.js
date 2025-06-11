import { client } from "./clientConfig";

export const convertAndReflectStockClassOnchainCanton = async (stockClass, issuer) => {
    const classType = stockClass.class_type === "COMMON" ? "Common" : "Unknown";
    const { stockClassContractId, updatedIssuerContractId } = await client.createStockClass(
        issuer.deployed_to,
        classType,
        stockClass.initial_shares_authorized,
        issuer.party_id
    );

    return { stockClassContractId, updatedIssuerContractId };
};
