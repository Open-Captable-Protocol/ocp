import { connectDB } from "./src/db/config/mongoose";
import { deleteIssuerData } from "./src/tests/integration/utils";

const main = async () => {
    console.log("Connecting to DB");
    await connectDB();
    console.log("Connected to DB");
    await deleteIssuerData("96887358-568d-44f8-b6d0-73c4f38558f6");
};

main();
