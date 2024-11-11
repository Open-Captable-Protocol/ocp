import { connectDB } from "./src/db/config/mongoose.js";
import { captableStats } from "./src/rxjs/index.js";

const issuers = [
    { id: "9ce1822d-21ec-4ab6-886a-0b95d632132d", name: "Magnetic Media Holdings Inc" },
    { id: "d5cffdf6-790c-477b-bce9-67831e5d834e", name: "Protelicious USA Corp" },
    { id: "cbb949c6-c048-49f5-94ac-409b7e636163", name: "Dextego Inc" },
    { id: "6230a0c0-fa38-4283-87c9-fc09a14121b0", name: "Worthy Futures Corporation" },
    { id: "5df2208b-3b1b-477a-8654-f2b0b06e5807", name: "Fairmint Inc" },
    { id: "eb9a1218-796d-43e8-90af-ad2f1699d7a5", name: "FHE Labs Ltd" },
    { id: "3f50cdaf-6218-4fb4-81b3-b23516fd602a", name: "Fairbnb" },
    { id: "02f300ea-f3dd-4652-8b58-68c777a9516b", name: "Medialister Inc" },
    { id: "58e201e7-ce75-4697-801d-20ca2da98d30", name: "Magnetic Media Holdings Inc" },
    { id: "96887358-568d-44f8-b6d0-73c4f38558f6", name: "Quine Co" },
    { id: "0265c44c-deb3-4ea2-9894-fb380d23e4ad", name: "Azos Labs" },
    { id: "75a5c300-dc6e-496b-8181-b35677c2aa19", name: "Protelicious SARL" },
    { id: "625c70f6-b4da-4619-8d08-6af383da27aa", name: "AHSAN Inc" },
    { id: "d4d59598-5360-47e6-8d08-f861469fd478", name: "SOIRE GOODS" },
    { id: "2e4f6ebb-cb01-4123-9463-4ddf10396439", name: "Cleanster Inc" },
    { id: "e1afe777-9774-4f9f-bde9-9e896c5e9b22", name: "Nilli Inc" },
    { id: "adf1bd8b-e002-4a83-b73d-f62fc54f5048", name: "COR Anet Solutions Inc" },
    { id: "058f3cb9-1068-4e92-ab8e-1fc9bb6d88ca", name: "Thresh Power" },
    { id: "8bba18d8-496b-4afe-832f-1b065dcc83c9", name: "Pistachio Fi Inc" },
];

async function testCaptableStats() {
    console.log = () => {};
    await connectDB();
    console.log("Testing captables...");
    const errorIssuers = [];

    for (const issuer of issuers) {
        try {
            console.debug(`Testing issuer: ${issuer.name}`);
            const result = await captableStats(issuer.id);

            if (result?.errors?.size > 0) {
                errorIssuers.push({
                    id: issuer.id,
                    name: issuer.name,
                    errors: result.errors,
                    timestamp: new Date().toISOString(),
                });
                console.error(`Error found for ${issuer.name}:`);
                console.error("Errors:", Array.from(result.errors));
            }
            console.debug(`No errors found for ${issuer.name}`);
        } catch (error) {
            errorIssuers.push({
                id: issuer.id,
                name: issuer.name,
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString(),
            });
            console.error(`Exception for ${issuer.name}:`);
            console.error("Error message:", error.message);
            console.error("Stack trace:", error.stack);
        }
    }

    console.log("\nSummary of issuers with errors:");
    console.log(JSON.stringify(errorIssuers, null, 2));

    return errorIssuers;
}

// Run the test with better error handling
testCaptableStats().catch((error) => {
    console.error("Script execution failed:");
    console.error("Error message:", error.message);
    console.error("Stack trace:", error.stack);
});
