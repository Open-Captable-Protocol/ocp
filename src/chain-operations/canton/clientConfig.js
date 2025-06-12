import { TransferAgentConfig } from "./lib/fairmint-canton/scripts/src/helpers/config";
import { FairmintClient } from "./lib/fairmint-canton/scripts/src/helpers/fairmintClient";

const config = new TransferAgentConfig(false);
const client = new FairmintClient(config);

export { config, client };
