import axios from "axios";
import get from "lodash/get";
import { API_URL } from "./config";

export const reflectGrant = async ({
    security_id,
    issuerId,
    stakeholder_id,
    series_id,
    quantity,
    exercise_price,
    compensation_type,
    option_grant_type,
    security_law_exemptions,
    expiration_date,
    termination_exercise_windows,
    vestings,
    date,
    vesting_terms_id,
}) => {
    const webHookUrl = `${API_URL}/ocp/reflectGrant?portalId=${issuerId}`;
    console.log({
        security_id,
        stakeholder_id,
        series_id,
        exercise_price,
        compensation_type,
        option_grant_type,
        security_law_exemptions,
        expiration_date,
        termination_exercise_windows,
        vestings,
        date,
        quantity,
        vesting_terms_id,
    });

    try {
        console.log("Reflecting Equity Compensation Issuance into fairmint...");
        const resp = await axios.post(webHookUrl, {
            security_id,
            stakeholder_id,
            series_id,
            exercise_price,
            quantity,
            compensation_type,
            option_grant_type,
            security_law_exemptions,
            expiration_date,
            termination_exercise_windows,
            vestings,
            vesting_terms_id,
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
            throw Error(`Error reflecting Equity Compensation Issuance into Fairmint: ${JSON.stringify(formattedError, null, 2)}`);
        } else {
            throw Error(`Error reflecting Equity Compensation Issuance into Fairmint: ${error.message}`);
        }
    }
};
