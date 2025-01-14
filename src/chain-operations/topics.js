import ethers from "ethers";
import ISTOCK_CLASS_FACET from "../../chain/out/IStockClassFacet.sol/IStockClassFacet.json";
import ISTAKEHOLDER_FACET from "../../chain/out/IStakeholderFacet.sol/IStakeholderFacet.json";
import ISTOCK_PLAN_FACET from "../../chain/out/IStockPlanFacet.sol/IStockPlanFacet.json";
import TX_HELPER from "../../chain/out/TxHelper.sol/TxHelper.json";

// Helper to generate event signature from ABI event
const getEventSignature = (abi, eventName) => {
    const event = abi.find((fn) => fn.name === eventName && fn.type === "event");
    if (!event) {
        throw new Error(`Event ${eventName} not found in ABI`);
    }
    return `${event.name}(${event.inputs.map((input) => input.type).join(",")})`;
};

// Generate event topics from ABIs
export const TxCreated = ethers.id(getEventSignature(TX_HELPER.abi, "TxCreated"));
export const StakeholderCreated = ethers.id(getEventSignature(ISTAKEHOLDER_FACET.abi, "StakeholderCreated"));
export const StockPlanCreated = ethers.id(getEventSignature(ISTOCK_PLAN_FACET.abi, "StockPlanCreated"));
export const StockClassCreated = ethers.id(getEventSignature(ISTOCK_CLASS_FACET.abi, "StockClassCreated"));
