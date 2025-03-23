import { Interface } from "ethers";
import CAP_TABLE_FACTORY from "../../chain/out/CapTableFactory.sol/CapTableFactory.json";
import STAKEHOLDER_FACET from "../../chain/out/StakeholderFacet.sol/StakeholderFacet.json";
import ISSUER_FACET from "../../chain/out/IssuerFacet.sol/IssuerFacet.json";
import STOCK_CLASS_FACET from "../../chain/out/StockClassFacet.sol/StockClassFacet.json";
import STOCK_FACET from "../../chain/out/StockFacet.sol/StockFacet.json";
import CONVERTIBLE_FACET from "../../chain/out/ConvertiblesFacet.sol/ConvertiblesFacet.json";
import WARRANT_FACET from "../../chain/out/WarrantFacet.sol/WarrantFacet.json";
import EQUITY_COMPENSATION_FACET from "../../chain/out/EquityCompensationFacet.sol/EquityCompensationFacet.json";
import STOCK_PLAN_FACET from "../../chain/out/StockPlanFacet.sol/StockPlanFacet.json";
import STAKEHOLDER_NFT_FACET from "../../chain/out/StakeholderNFTFacet.sol/StakeholderNFTFacet.json";
import ACCESS_CONTROL_FACET from "../../chain/out/AccessControlFacet.sol/AccessControlFacet.json";
import VALIDATION_LIB from "../../chain/out/ValidationLib.sol/ValidationLib.json";

// Export ABIs for external use
export const facetsABI = [
    ...STAKEHOLDER_FACET.abi,
    ...ISSUER_FACET.abi,
    ...STOCK_CLASS_FACET.abi,
    ...STOCK_FACET.abi,
    ...STOCK_PLAN_FACET.abi,
    ...CONVERTIBLE_FACET.abi,
    ...WARRANT_FACET.abi,
    ...EQUITY_COMPENSATION_FACET.abi,
    ...STAKEHOLDER_NFT_FACET.abi,
    ...ACCESS_CONTROL_FACET.abi,
    ...VALIDATION_LIB.abi,
];

export const capTableFactoryABI = CAP_TABLE_FACTORY.abi;

// Define all error interfaces
const errorInterface = new Interface(facetsABI.filter((item) => item.type === "error"));

// Helper function to try decoding with a specific interface
const tryDecodeWithInterface = (errorData, contractInterface) => {
    try {
        // Extract the error selector (first 4 bytes)
        const errorSelector = errorData.slice(0, 10);
        console.log("Trying to decode error with selector:", errorSelector);

        const decodedError = contractInterface.parseError(errorData);
        if (decodedError) {
            console.log("Successfully decoded error:", decodedError.name);
            console.log("Error fragment:", JSON.stringify(decodedError.fragment));
            console.log("Error args:", decodedError.args);
        }
        return decodedError;
    } catch (e) {
        return null;
    }
};

/**
 * Decodes a Solidity custom error from its hex representation
 * @param {string} error - The error object or string from ethers
 * @returns {Object} Decoded error with name and args
 */
export const decodeError = (error) => {
    try {
        // If error is already decoded or is a regular error, return it
        if (typeof error === "string" || !error.data) {
            return { name: "Error", message: error.message || error };
        }

        // Get the error data
        const errorData = error.data;
        console.log("Raw error data:", errorData);

        // Try to decode with each interface
        let decodedError = null;
        decodedError = tryDecodeWithInterface(errorData, errorInterface);

        // // If no interface worked, try the factory and facets interfaces
        // if (!decodedError) {
        //     decodedError = tryDecodeWithInterface(errorData, facetsInterface);
        // }

        // If all attempts failed, throw to be caught by catch block
        if (!decodedError) {
            throw new Error("Could not decode error with any interface");
        }

        // Format the error in a readable way
        const errorArgs = {};
        if (decodedError.args && decodedError.fragment && decodedError.fragment.inputs) {
            decodedError.args.forEach((arg, index) => {
                if (index < decodedError.fragment.inputs.length) {
                    const paramName = decodedError.fragment.inputs[index].name;
                    errorArgs[paramName] = arg.toString();
                }
            });
        }

        return {
            name: decodedError.name,
            args: errorArgs,
            message: formatErrorMessage(decodedError.name, errorArgs),
        };
    } catch (e) {
        console.log("Error decoding:", e);
        // If we can't decode the error, return the original error
        return {
            name: "UnknownError",
            message: error.message || "Unknown error occurred",
        };
    }
};

/**
 * Formats the error message in a human readable way
 * @param {string} errorName
 * @param {Object} errorArgs
 * @returns {string}
 */
const formatErrorMessage = (errorName, errorArgs) => {
    switch (errorName) {
        case "NoStakeholder":
            return `Stakeholder not found with ID: ${errorArgs.stakeholder_id}`;
        case "InvalidStockClass":
            return `Invalid stock class with ID: ${errorArgs.stock_class_id}`;
        case "InvalidStockPlan":
            return `Invalid stock plan with ID: ${errorArgs.stock_plan_id}`;
        case "InvalidQuantity":
            return "Invalid quantity: quantity must be greater than 0";
        case "InvalidAmount":
            return "Invalid amount: amount must be greater than 0";
        case "InvalidSecurity":
            return `Invalid security with ID: ${errorArgs.security_id}`;
        case "InvalidSecurityStakeholder":
            return `Invalid security stakeholder combination. Security ID: ${errorArgs.security_id}, Stakeholder ID: ${errorArgs.stakeholder_id}`;
        case "InsufficientShares":
            return "Insufficient shares available for this operation";
        case "NoPositionsToConsolidate":
            return "No positions available to consolidate";
        case "StockClassMismatch":
            return `Stock class mismatch. Expected: ${errorArgs.expected}, Actual: ${errorArgs.actual}`;
        case "ZeroQuantityPosition":
            return `Position has zero quantity for security ID: ${errorArgs.security_id}`;
        case "StockClassAlreadyExists":
            return `Stock class already exists with ID: ${errorArgs.stock_class_id}`;
        case "StockClassNotFound":
            return `Stock class not found with ID: ${errorArgs.stock_class_id}`;
        case "InvalidSharesAuthorized":
            return "Invalid shares authorized";
        case "StakeholderAlreadyExists":
            return `Stakeholder already exists with ID: ${errorArgs.stakeholder_id}`;
        case "AddressAlreadyLinked":
            return `Address already linked: ${errorArgs.wallet_address}`;
        case "StockPlanAlreadyExists":
            return `Stock plan already exists with ID: ${errorArgs.stock_plan_id}`;
        case "StockPlanNotFound":
            return `Stock plan not found with ID: ${errorArgs.stock_plan_id}`;
        case "AccessControlUnauthorized":
            return `Account ${errorArgs.account} is not authorized for role ${errorArgs.role}`;
        case "AccessControlBadConfirmation":
            return "Bad confirmation for access control";
        case "AccessControlInvalidTransfer":
            return "Invalid transfer in access control";
        default:
            // For unknown errors, return all args as a string
            return `${errorName}: ${Object.entries(errorArgs)
                .map(([key, value]) => `${key}=${value}`)
                .join(", ")}`;
    }
};
