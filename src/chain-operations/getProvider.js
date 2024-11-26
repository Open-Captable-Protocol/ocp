import { ethers } from "ethers";
import { setupEnv } from "../utils/env";

setupEnv();

let RPC_URL = process.env.RPC_URL;
const CHAIN_ID = process.env.CHAIN_ID;

const LOCAL_RPC = "ws://127.0.0.1:8545";

// make sure it's websocket url wss
RPC_URL = RPC_URL.replace("http", "ws");
console.log("RPC_URL", RPC_URL);
let provider = null;

const getProvider = () => {
    if (provider) {
        console.log("🔗 | Using existing provider");
        return provider;
    }

    if (RPC_URL === LOCAL_RPC) {
        console.log("🔗 | Connecting to local network: ", RPC_URL);
        const customNetwork = {
            chainId: parseInt(CHAIN_ID),
            name: "local",
        };
        provider = new ethers.JsonRpcProvider(RPC_URL.replace("ws", "http"), customNetwork);
        console.log("🔗 | Connected to local network: ", RPC_URL);
    } else {
        console.log("🔗 | Connecting to network: ", RPC_URL);
        // provider = new ethers.WebSocketProvider(RPC_URL);
        provider = new ethers.JsonRpcProvider(RPC_URL.replace("ws", "http"));
        console.log("🔗 | Connected to network: ", RPC_URL);
    }
    return provider;
};

export default getProvider;
