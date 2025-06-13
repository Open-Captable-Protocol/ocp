import { TransferAgentConfig } from "./lib/config";
import { FairmintClient } from "./lib/fairmintClient";

const config = new TransferAgentConfig(true);
const client = new FairmintClient(config);

export { config, client };
