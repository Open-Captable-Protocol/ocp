import { connectDB, disconnectDB } from "../db/config/mongoose.ts";
import chalk from "chalk";
import StockIssuance from "../db/objects/transactions/issuance/StockIssuance.js";

const expectedPreviousValues = {
    "12e5f206e-3984-cc27-1f6d-92678faaef23": { current: 48, target: 24 },
    "2e5f206e-3984-cc27-1f6d-92678faaef23": { current: 48, target: 12 },
    "50ade601-e2de-4957-4c8e-301c9afe5c30": { current: 16, target: 8 },
    "64a4a089-5e00-b053-123e-f39ea52abb85": { current: 40, target: 20 },
    "03c44057-39fc-b2c7-4177-d1cc8e4d9123": { current: 40, target: 20 },
    "bd7c64db-c83b-49aa-e168-0b3ee7174d0d": { current: 16, target: 8 },
    "f86299bb-2b5b-5810-618d-3d46ad4cfa1b": [
        { current: 64, target: 24 },
        { current: 64, target: 20 },
        { current: 64, target: 20 },
    ],
    "8ce9ecbd-431f-1d01-84a6-08e727d74e87": [
        { current: 20, target: 12 },
        { current: 20, target: 8 },
    ],
    "9e400f09-51d0-c64e-aa5b-33099d77031a": { current: 20, target: 5 },
};

async function assertQuantity(stockIssuance, expectedValue, securityId) {
    if (String(stockIssuance.quantity) !== String(expectedValue.current)) {
        throw new Error(
            `Assertion failed for security_id ${securityId}:\n` +
                `Expected current quantity to be ${expectedValue.current} but found ${stockIssuance.quantity}`
        );
    }
}

async function fixStockIssuanceQuantities() {
    try {
        await connectDB();
        console.log(chalk.blue("Starting stock issuance quantity fixes...\n"));

        for (const [securityId, expectedValues] of Object.entries(expectedPreviousValues)) {
            // Find all stock issuances with this security_id
            const stockIssuances = await StockIssuance.find({
                security_id: securityId,
            }).sort({ _id: 1 }); // Ensure consistent ordering

            if (!stockIssuances.length) {
                console.log(chalk.yellow(`No stock issuances found for security_id: ${securityId}`));
                continue;
            }

            // Handle cases where we need multiple different quantities for same security_id
            const values = Array.isArray(expectedValues) ? expectedValues : [expectedValues];

            if (stockIssuances.length !== values.length) {
                console.log(
                    chalk.red(`Warning: Found ${stockIssuances.length} issuances for security_id ${securityId} ` + `but expected ${values.length}`)
                );
                continue;
            }

            let allAssertionsPassed = true;
            // First verify all current values
            for (let i = 0; i < stockIssuances.length; i++) {
                try {
                    await assertQuantity(stockIssuances[i], values[i], securityId);
                } catch (error) {
                    console.error(chalk.red(error.message));
                    allAssertionsPassed = false;
                    break;
                }
            }

            if (!allAssertionsPassed) {
                console.log(chalk.red(`Skipping updates for security_id ${securityId} due to failed assertions`));
                continue;
            }

            // If all assertions passed, proceed with updates
            for (let i = 0; i < stockIssuances.length; i++) {
                const stockIssuance = stockIssuances[i];
                const { current, target } = values[i];

                console.log(chalk.cyan(`Updating stock issuance ${stockIssuance._id}:`));
                console.log(`  Security ID: ${securityId}`);
                console.log(`  Current quantity: ${chalk.red(current)}`);
                console.log(`  Target quantity: ${chalk.green(target)}`);

                // await StockIssuance.findByIdAndUpdate(stockIssuance._id, { $set: { quantity: target } });

                console.log(chalk.green("✓ Updated successfully"));
            }
            console.log(chalk.gray("\n-------------------\n"));
        }

        console.log(chalk.green.bold("Stock issuance quantity fixes completed successfully!"));
    } catch (error) {
        console.error(chalk.red.bold("Error while fixing stock issuance quantities:"), chalk.red(error));
    } finally {
        await disconnectDB();
        process.exit(0);
    }
}

fixStockIssuanceQuantities();
