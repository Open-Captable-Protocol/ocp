import { connectDB } from "../../db/config/mongoose";
import Fairmint from "../../db/objects/Fairmint";
import Issuer from "../../db/objects/Issuer";
import Stakeholder from "../../db/objects/Stakeholder";
import StockClass from "../../db/objects/StockClass";
import StockLegendTemplate from "../../db/objects/StockLegendTemplate";
import StockPlan from "../../db/objects/StockPlan";
import Valuation from "../../db/objects/Valuation";
import VestingTerms from "../../db/objects/VestingTerms";
import { typeToModelType } from "../../db/operations/transactions"; // Import the typeToModelType object to delete all transactions

export const SERVER_BASE = `http://localhost:${process.env.PORT}`;

const deleteAllTransactions = async () => {
    for (const ModelType of Object.values(typeToModelType)) {
        // @ts-expect-error
        await ModelType.deleteMany({});
    }
};

const deleteAll = async () => {
    // Delete all documents from the collections
    await Issuer.deleteMany({});
    await Stakeholder.deleteMany({});
    await StockClass.deleteMany({});
    await StockLegendTemplate.deleteMany({});
    await StockPlan.deleteMany({});
    await Valuation.deleteMany({});
    await VestingTerms.deleteMany({});
    await Fairmint.deleteMany({});
    await deleteAllTransactions(); // Delete all transactions
};

export const deseedDatabase = async () => {
    const connection = await connectDB();
    console.log("Deseeding from database: ", connection.name);
    await deleteAll();
    await connection.close();
};

export const deleteIssuerData = async (issuerId: string) => {
    console.log(`Deleting data for issuer: ${issuerId}`);

    const issuerCount = await Issuer.deleteMany({ _id: issuerId });
    console.log(`Deleted ${issuerCount.deletedCount} issuer records`);

    const stakeholderCount = await Stakeholder.deleteMany({ issuer: issuerId });
    console.log(`Deleted ${stakeholderCount.deletedCount} stakeholder records`);

    const stockClassCount = await StockClass.deleteMany({ issuer: issuerId });
    console.log(`Deleted ${stockClassCount.deletedCount} stock class records`);

    const stockLegendCount = await StockLegendTemplate.deleteMany({ issuer: issuerId });
    console.log(`Deleted ${stockLegendCount.deletedCount} stock legend records`);

    const stockPlanCount = await StockPlan.deleteMany({ issuer: issuerId });
    console.log(`Deleted ${stockPlanCount.deletedCount} stock plan records`);

    const fairmintCount = await Fairmint.deleteMany({ issuer: issuerId });
    console.log(`Deleted ${fairmintCount.deletedCount} fairmint records`);

    for (const [modelName, ModelType] of Object.entries(typeToModelType)) {
        // @ts-expect-error
        const count = await ModelType.deleteMany({ issuer: issuerId });
        console.log(`Deleted ${count.deletedCount} ${modelName} records`);
    }

    console.log("Finished deleting issuer data");
};
