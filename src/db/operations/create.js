import Factory from "../objects/Factory.js";
import Issuer from "../objects/Issuer.js";
import Stakeholder from "../objects/Stakeholder.js";
import StockClass from "../objects/StockClass.js";
import StockLegendTemplate from "../objects/StockLegendTemplate.js";
import StockPlan from "../objects/StockPlan.js";
import Valuation from "../objects/Valuation.js";
import VestingTerms from "../objects/VestingTerms.js";
import ConvertibleIssuance from "../objects/transactions/issuance/ConvertibleIssuance.js";
import EquityCompensationIssuance from "../objects/transactions/issuance/EquityCompensationIssuance.js";
import StockIssuance from "../objects/transactions/issuance/StockIssuance.js";
import StockTransfer from "../objects/transactions/transfer/StockTransfer.js";
import { save } from "./atomic.ts";
import WarrantIssuance from "../objects/transactions/issuance/WarrantIssuance.js";
import VestingStart from "../objects/transactions/vesting/VestingStart.js";
import EquityCompensationExercise from "../objects/transactions/exercise/EquityCompensationExercise.js";
import StockPlanPoolAdjustment from "../objects/transactions/adjustment/StockPlanPoolAdjustment.js";
import StockClassAuthorizedSharesAdjustment from "../objects/transactions/adjustment/StockClassAuthorizedSharesAdjustment.js";
import IssuerAuthorizedSharesAdjustment from "../objects/transactions/adjustment/IssuerAuthorizedSharesAdjustment.js";
import StockCancellation from "../objects/transactions/cancellation/StockCancellation.js";

export const createIssuer = (issuerData) => {
    return save(new Issuer(issuerData));
};

export const createStakeholder = (stakeholderData) => {
    return save(new Stakeholder(stakeholderData));
};

export const createStockClass = (stockClassData) => {
    return save(new StockClass(stockClassData));
};

export const createStockLegendTemplate = (stockLegendTemplateData) => {
    return save(new StockLegendTemplate(stockLegendTemplateData));
};

export const createStockPlan = (stockPlanData) => {
    return save(new StockPlan(stockPlanData));
};

export const createValuation = (valuationData) => {
    return save(new Valuation(valuationData));
};

export const createVestingTerms = (vestingTermsData) => {
    return save(new VestingTerms(vestingTermsData));
};

export const createStockIssuance = (stockIssuanceData) => {
    return save(new StockIssuance(stockIssuanceData));
};

export const createEquityCompensationIssuance = (issuanceData) => {
    return save(new EquityCompensationIssuance(issuanceData));
};

export const createConvertibleIssuance = (issuanceData) => {
    return save(new ConvertibleIssuance(issuanceData));
};

export const createWarrantIssuance = (issuanceData) => {
    return save(new WarrantIssuance(issuanceData));
};

export const createStockTransfer = (stockTransferData) => {
    return save(new StockTransfer(stockTransferData));
};

export const createVestingStart = (vestingStartData) => {
    return save(new VestingStart(vestingStartData));
};

export const createFactory = (factoryData) => {
    return save(new Factory(factoryData));
};

export const createEquityCompensationExercise = (exerciseData) => {
    return save(new EquityCompensationExercise(exerciseData));
};

export const createStockCancellation = (stockCancellationData) => {
    return save(new StockCancellation(stockCancellationData));
};

export const createStockPlanPoolAdjustment = (stockPlanPoolAdjustmentData) => {
    return save(new StockPlanPoolAdjustment(stockPlanPoolAdjustmentData));
};

export const createStockClassAuthorizedSharesAdjustment = (stockClassAuthorizedSharesAdjustmentData) => {
    return save(new StockClassAuthorizedSharesAdjustment(stockClassAuthorizedSharesAdjustmentData));
};

export const createIssuerAuthorizedSharesAdjustment = (issuerAuthorizedSharesAdjustmentData) => {
    return save(new IssuerAuthorizedSharesAdjustment(issuerAuthorizedSharesAdjustmentData));
};
