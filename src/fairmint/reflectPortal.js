import axios from "axios";
import get from "lodash/get";
import { API_URL } from "./config";

export const reflectPortal = async ({ portalId }) => {
    const webHookUrl = `${API_URL}/ocp/reflectCaptable?portalId=${portalId}`;
    console.log({ portalId });

    try {
        console.log("🌐 | Reflecting Captable into fairmint...");
        const resp = await axios.post(webHookUrl, {});
        console.log(`🌐 | Successfully reflected Captable ${portalId} into Fairmint webhook`);
        console.log("🌐 | Fairmint response:", resp.data);

        return resp.data;
    } catch (error) {
        if (error.response) {
            const formattedError = {
                status: error.response.status,
                endpoint: webHookUrl,
                data: get(error, "response.data"),
            };
            throw Error(`Error reflecting Portal into Fairmint: ${JSON.stringify(formattedError, null, 2)}`);
        } else {
            throw Error(`Error reflecting Portal into Fairmint: ${error.message}`);
        }
    }
};
