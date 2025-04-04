import axios from "axios";
import get from "lodash/get";
import { API_URL } from "./config";

export const reflectInvestmentCancellation = async ({ security_id, issuerId, cancellation_amount, date, balance_security_id }) => {
    const webHookUrl = `${API_URL}/ocp/reflectInvestmentCancellation?portalId=${issuerId}`;
    try {
        console.log("Reflecting Investment Cancellation fairmint...");
        console.log({ security_id, issuerId, cancellation_amount, date });

        const resp = await axios.post(webHookUrl, {
            security_id,
            balance_security_id,
            cancellation_amount,
            date,
        });

        return resp.data;
    } catch (error) {
        if (error.response) {
            const formattedError = {
                status: error.response.status,
                endpoint: webHookUrl,
                data: get(error, "response.data"),
            };
            throw Error(`Error reflecting Investment into Fairmint: ${JSON.stringify(formattedError, null, 2)}`);
        } else {
            throw Error(`Error reflecting Investment into Fairmint: ${error.message}`);
        }
    }
};
