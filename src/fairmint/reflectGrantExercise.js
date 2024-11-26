import axios from "axios";
import get from "lodash/get";
import { API_URL } from "./config";

export const reflectGrantExercise = async ({ security_id, issuerId, quantity, date, resulting_security_ids }) => {
    const webHookUrl = `${API_URL}/ocp/reflectGrantExercise?portalId=${issuerId}`;
    try {
        console.log("Reflecting Grant Exercise fairmint...");
        console.log({ security_id, issuerId, quantity, date, resulting_security_ids });

        const resp = await axios.post(webHookUrl, {
            security_id,
            quantity,
            date,
            resulting_security_ids,
        });

        return resp.data;
    } catch (error) {
        if (error.response) {
            const formattedError = {
                status: error.response.status,
                endpoint: webHookUrl,
                data: get(error, "response.data"),
                message: get(error, "response.data.message") || get(error, "message") || "Unknown error",
            };
            throw Error(`Error reflecting Investment into Fairmint: ${JSON.stringify(formattedError, null, 2)}`);
        } else {
            throw Error(`Error reflecting Investment into Fairmint: ${error.message}`);
        }
    }
};
