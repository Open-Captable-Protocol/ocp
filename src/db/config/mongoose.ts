import mongoose from "mongoose";
import { setupEnv } from "../../utils/env";

setupEnv();

const DATABASE_URL = process.env.DATABASE_URL;
const DATABASE_OVERRIDE = process.env.DATABASE_OVERRIDE;

export const connectDB = async () => {
    const connectOptions = {
        ...(DATABASE_OVERRIDE ? { dbName: DATABASE_OVERRIDE } : {}),
        authMechanism: "SCRAM-SHA-1" as const,
        authSource: "admin",
        tls: true,
        tlsAllowInvalidHostnames: true,
        tlsCAFile: "./global-bundle.pem",
    };

    try {
        const sanitizedDatabaseURL = (DATABASE_URL as string).replace(/\/\/(.*):(.*)@/, "//$1:***@");
        console.log(" Mongo connecting...", sanitizedDatabaseURL);
        await mongoose.connect(DATABASE_URL as string, connectOptions);
        console.log("✅ | Mongo connected successfully", sanitizedDatabaseURL);
        return mongoose.connection;
    } catch (error) {
        console.error(error);
        console.error("❌ | Error connecting to Mongo", (error as Error).message);
        // Exit process with failure
        process.exit(1);
    }
};

export const disconnectDB = async () => {
    if (mongoose.connection.readyState === mongoose.ConnectionStates.connected) {
        console.log("Disconnecting from Mongo...");
        await mongoose.connection.close();
        console.log("✅ | Mongo disconnected successfully");
    }
};
