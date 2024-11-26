import { issuer, stakeholder1, stockClass, stockIssuance } from "./sampleData.js";
import axios from "axios";
import sleep from "../utils/sleep.js";
import STAKEHOLDER_FACET from "../../chain/out/StakeholderFacet.sol/StakeholderFacet.json";
import STAKEHOLDER_NFT_FACET from "../../chain/out/StakeholderNFTFacet.sol/StakeholderNFTFacet.json";
import { ethers } from "ethers";
import Issuer from "../db/objects/Issuer.js";
import getProvider from "../chain-operations/getProvider.js";
import { convertUUIDToBytes16 } from "../utils/convertUUID.js";
import { connectDB } from "../db/config/mongoose.js";
import fs from "fs/promises";
import get from "lodash/get.js";

const combinedABI = [...STAKEHOLDER_FACET.abi, ...STAKEHOLDER_NFT_FACET.abi];
const provider = getProvider();

// Create the diamond contract with combined ABI
// @dev this script needs to run first in order to run the others scripts in this file
const setup = async (issuerId, stakeholderId, stockClassId) => {
    // create issuer
    issuer.id = issuerId;
    console.log("⏳ | Creating issuer…");
    const issuerResponse = await axios.post("http://localhost:8080/issuer/create", issuer);

    console.log("✅ | Issuer response ", issuerResponse.data);

    await sleep(3000);

    console.log("⏳ | Creating first stakeholder");

    // create stakeholder
    const _stakeholder = stakeholder1(issuerId);
    _stakeholder.data.id = stakeholderId;
    const stakeholder1Response = await axios.post("http://localhost:8080/stakeholder/create", _stakeholder);

    console.log("✅ | stakeholder1Response", stakeholder1Response.data);
    console.log("✅ | finished");

    await sleep(3000);

    console.log("⏳| Creating stock class");

    // create stockClass
    const _stockClass = stockClass(issuerId);
    _stockClass.data.id = stockClassId;
    const stockClassResponse = await axios.post("http://localhost:8080/stock-class/create", _stockClass);

    console.log("✅ | stockClassResponse", stockClassResponse.data);
    // create stock issuance
    const _stockIssuance = stockIssuance(issuerId, stakeholderId, stockClassId, "100", "1.23");
    const stockIssuanceResponse = await axios.post("http://localhost:8080/transactions/issuance/stock", _stockIssuance);
    console.log("✅ | stockIssuanceResponse", stockIssuanceResponse.data);
};

const main = async () => {
    await connectDB();
    console.log("✅ | connected to DB");
    const issuerId = "66ff16f7-5f65-4a78-9011-fac4a8596efc";
    const stakeholderId = "1c81483c-23fd-461f-aded-c73ef721b64e";
    const stockClassId = "f1ba685c-57ac-4d28-a9f3-574322337660";
    const WALLET_PRIVATE_KEY = process.env.PRIVATE_KEY;
    // let tokenId = null;

    const stakeholderWalletAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const stkaeholderPK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

    // console.log("🔑 | WALLET_PRIVATE_KEY", WALLET_PRIVATE_KEY);
    await setup(issuerId, stakeholderId, stockClassId);

    const deployedIssuer = await Issuer.findById(issuerId);

    // Listen for Transfer events to get the tokenId
    provider.on(
        {
            address: [deployedIssuer.deployed_to],
            topics: [ethers.id("Transfer(address,address,uint256)")],
        },
        async (log) => {
            console.log(log);
            const tokenId = get(log, "topics.3", null);
            console.log("✅ | Minted tokenId", tokenId);
        }
    );
    console.log("✅ | issuer", deployedIssuer);

    const ocpWallet = new ethers.Wallet(WALLET_PRIVATE_KEY, provider);
    let diamond = new ethers.Contract(deployedIssuer.deployed_to, combinedABI, ocpWallet);

    // Link stakeholder address before minting
    const stakeholderIdBytes16 = convertUUIDToBytes16(stakeholderId);

    console.log("🔗 | Linking stakeholder wallet", stakeholderWalletAddress);
    const tx = await diamond.linkStakeholderAddress(stakeholderIdBytes16, stakeholderWalletAddress);
    await tx.wait();
    console.log("✅ | linked stakeholder wallet");

    await sleep(3000);

    console.log("⏳ | Minting NFT");
    const mintTx = await diamond.connect(new ethers.Wallet(stkaeholderPK, provider)).mint();
    console.log("✅ | mintTx", mintTx);
    const receipt = await mintTx.wait();

    // Get tokenId from the Transfer event
    const transferEvent = receipt.logs.find(
        log => log.topics[0] === ethers.id("Transfer(address,address,uint256)")
    );
    const tokenId = transferEvent.topics[3];  // The tokenId is the third topic

    console.log("⏳ | Testing getter function");
    try {
        const positions = await diamond.getStakeholderPositions(stakeholderIdBytes16);
        console.log("✅ | Stakeholder positions:", positions);
    } catch (error) {
        console.log("❌ | Error calling getStakeholderPositions:", error.message);
    }

    // Then try tokenURI...
    console.log("⏳ | Fetching tokenURI for tokenId:", tokenId);
    const tokenURI = await diamond.tokenURI(tokenId);
    console.log("✅ | Raw tokenURI:", tokenURI);

    // Decode the base64 data URI
    const base64Data = tokenURI.split(',')[1];
    const decodedData = Buffer.from(base64Data, 'base64').toString();
    console.log("✅ | Decoded metadata:", JSON.parse(decodedData));
};

main()
    .then()
    .catch((err) => {
        if (err?.response) {
            console.error(err.response.data);
        } else {
            console.error(err);
        }
    });
