import { client } from "./clientConfig";

export const convertAndCreateTransferStockOnchainCanton = async (contract, transfer) => {
    const { transferorPartyId, transferorStockPositionContractId, transfereePartyId, quantity } = transfer;

    // Transferer proposes share transfer to transferee
    const { transferProposalContractId, updatedStockPositionContractId } = await client.proposeTransfer(
        transferorStockPositionContractId,
        transfereePartyId,
        quantity,
        transferorPartyId
    );

    // Transferee accepts the transfer proposal and receives shares
    const transfereeStockPositionContractId = await client.acceptTransfer(transferProposalContractId, transfereePartyId);

    return {
        transferorUpdatedStockPositionContractId: updatedStockPositionContractId,
        transfereeStockPositionContractId: transfereeStockPositionContractId,
    };
};
