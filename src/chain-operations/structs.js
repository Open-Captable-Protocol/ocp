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
        { type: "bytes16", baseType: "bytes16", name: "stock_class_id" },
        { type: "uint256", baseType: "uint256", name: "new_shares_authorized" },
    ],
};

export const StockPlanPoolAdjustment = {
    type: "tuple",
    baseType: "tuple",
    components: [
        { type: "bytes16", baseType: "bytes16", name: "stock_plan_id" },
        { type: "uint256", baseType: "uint256", name: "new_shares_reserved" },
    ],
};

export const ConvertibleIssuance = ICONVERTIBLES_FACET.abi.find((fn) => fn.name === "issueConvertible").inputs[0];

export const WarrantIssuance = IWARRANTS_FACET.abi.find((fn) => fn.name === "issueWarrant").inputs[0];

export const EquityCompensationIssuance = IEQUITY_COMPENSATION_FACET.abi.find((fn) => fn.name === "issueEquityCompensation").inputs[0];

export const EquityCompensationExercise = IEQUITY_COMPENSATION_FACET.abi.find((fn) => fn.name === "exerciseEquityCompensation").inputs[0];

/* TODO: IMPLEMENT THIS */
export const StockTransfer = {};
export const StockRepurchase = {};
export const StockAcceptance = {};
export const StockCancellation = {};
export const StockRetraction = {};
export const StockReissuance = {};
