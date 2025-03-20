import ISTOCK_FACET from "../../chain/out/IStockFacet.sol/IStockFacet.json";
import ICONVERTIBLES_FACET from "../../chain/out/IConvertiblesFacet.sol/IConvertiblesFacet.json";
import IWARRANTS_FACET from "../../chain/out/IWarrantFacet.sol/IWarrantFacet.json";
import IEQUITY_COMPENSATION_FACET from "../../chain/out/IEquityCompensationFacet.sol/IEquityCompensationFacet.json";

export const StockIssuance = ISTOCK_FACET.abi.find((fn) => fn.name === "issueStock").inputs[0];

export const IssuerAuthorizedSharesAdjustment = {
    type: "tuple",
    baseType: "tuple",
    components: [
        { type: "bytes16", baseType: "bytes16", name: "issuer_id" },
        { type: "uint256", baseType: "uint256", name: "new_shares_authorized" },
    ],
};

export const StockClassAuthorizedSharesAdjustment = {
    type: "tuple",
    baseType: "tuple",
    components: [
        { type: "bytes16", baseType: "bytes16", name: "id" },
        { type: "bytes16", baseType: "bytes16", name: "stock_class_id" },
        { type: "uint256", baseType: "uint256", name: "new_shares_authorized" },
    ],
};

export const StockPlanPoolAdjustment = {
    type: "tuple",
    baseType: "tuple",
    components: [
        { type: "bytes16", baseType: "bytes16", name: "id" },
        { type: "bytes16", baseType: "bytes16", name: "stock_plan_id" },
        { type: "uint256", baseType: "uint256", name: "new_shares_reserved" },
    ],
};

export const ConvertibleIssuance = ICONVERTIBLES_FACET.abi.find((fn) => fn.name === "issueConvertible").inputs[0];

export const WarrantIssuance = IWARRANTS_FACET.abi.find((fn) => fn.name === "issueWarrant").inputs[0];

export const EquityCompensationIssuance = IEQUITY_COMPENSATION_FACET.abi.find((fn) => fn.name === "issueEquityCompensation").inputs[0];

export const EquityCompensationExercise = IEQUITY_COMPENSATION_FACET.abi.find((fn) => fn.name === "exerciseEquityCompensation").inputs;

export const StockTransfer = {
    type: "tuple",
    components: [
        { type: "bytes16", name: "consolidated_security_id" },
        { type: "bytes16", name: "transferee_security_id" },
        { type: "bytes16", name: "remainder_security_id" },
        { type: "uint256", name: "quantity" },
        { type: "uint256", name: "share_price" },
    ],
};

/* TODO: IMPLEMENT THIS */
export const StockRepurchase = {};
export const StockAcceptance = {};
export const StockCancellation = {};
export const StockRetraction = {};
export const StockReissuance = {};
// export const StockConsolidation = ISTOCK_FACET.abi.find((fn) => fn.name === "consolidateStock").inputs[0];

export const StockConsolidation = {
    type: "tuple",
    components: [
        { type: "bytes16[]", name: "security_ids" },
        { type: "bytes16", name: "resulting_security_id" },
    ],
};
