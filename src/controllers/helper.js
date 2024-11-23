import { isCallException, Interface } from "ethers";
import DIAMOND_CAP_TABLE from "../../chain/out/DiamondCapTable.sol/DiamondCapTable.json";
import STAKEHOLDER_FACET from "../../chain/out/StakeholderFacet.sol/StakeholderFacet.json";
import ISSUER_FACET from "../../chain/out/IssuerFacet.sol/IssuerFacet.json";
import STOCK_CLASS_FACET from "../../chain/out/StockClassFacet.sol/StockClassFacet.json";
import STOCK_FACET from "../../chain/out/StockFacet.sol/StockFacet.json";
import STOCK_PLAN_FACET from "../../chain/out/StockPlanFacet.sol/StockPlanFacet.json";
// Create an Interface instance
const combinedABI = [
    ...DIAMOND_CAP_TABLE.abi,
    ...STAKEHOLDER_FACET.abi,
    ...ISSUER_FACET.abi,
    ...STOCK_CLASS_FACET.abi,
    ...STOCK_FACET.abi,
    ...STOCK_PLAN_FACET.abi,
];
const icap = new Interface(combinedABI);

// TODO(adam): refactor to have a single error handler for all routes - this is too messy
export const withChainErrorHandler =
    (fn) =>
    async (...args) => {
        try {
            return await fn(...args);
        } catch (error) {
            if (isCallException(error)) {
                console.log("incoming error", error);
                try {
                    const decodedError = icap.parseError(error.data);
                    console.error(`Onchain error: ${decodedError.name}`, decodedError.args);
                    throw new Error(`Onchain - ${decodedError.name}: ${decodedError.args}`);
                } catch (parseError) {
                    console.log("captable interface decoding failed - trying stock lib interface");
                    const decodedError = icap.parseTransaction(error.transaction);
                    console.log({ decodedError });
                    console.error(`Onchain error: ${decodedError.name}`, decodedError.args);
                    throw new Error(`Onchain - ${decodedError.name}: ${decodedError.args}`);
                }
            }
            throw error; // Re-throw the error after logging
        }
    };
