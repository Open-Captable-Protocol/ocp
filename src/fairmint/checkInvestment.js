import axios from "axios";
import get from "lodash/get";
import { API_URL } from "./config";

export const checkInvestment = async ({ issuerId, securityId }) => {
    const webHookUrl = `${API_URL}/ocp/checkInvestment?portalId=${issuerId}&securityId=${securityId}`;

    try {
        console.log("Checking investment status in Fairmint...");
        const resp = await axios.get(webHookUrl);

        return resp.data;
    } catch (error) {
        if (error.response) {
            const formattedError = {
                status: error.response.status,
                endpoint: webHookUrl,
                data: get(error, "response.data"),
            };
            throw Error(`Error checking portal status in Fairmint: ${JSON.stringify(formattedError, null, 2)}`);
        } else {
            throw Error(`Error checking portal status in Fairmint: ${error.message}`);
        }
    }
};
