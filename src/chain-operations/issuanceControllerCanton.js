import { client } from "./canton/clientConfig";

export const convertAndCreateIssuanceStockOnchainCanton = async ({ stockClassContractId, stakeholderPartyId, quantity, issuerPartyId }) => {
    // Issuer proposes quantity shares to stakeholder
    const { proposalContractId, updatedStockClassContractId } = await client.proposeIssueStock(
        stockClassContractId,
        stakeholderPartyId,
        quantity,
        issuerPartyId
    );

    // Stakeholder accepts the proposal and receives shares
    const stakeholderStockPositionContractId = await client.acceptIssueStockProposal(proposalContractId, stakeholderPartyId);

    return {
        stakeholderStockPositionContractId,
        updatedStockClassContractId,
    };
};
