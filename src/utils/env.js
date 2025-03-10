import { config } from "dotenv";
import fs from "fs";
import pathTools from "path";
import get from "lodash/get";

const splitPath = (path) => {
    /* 
    Split the file/dir path into its directory and the rightMost piece
     ie /home/user/file.txt --> {dir: "/home/user", rightMost: "file.txt"}
    */
    const normalizedPath = path.replace(/\/+$/, "");
    const lastIndex = normalizedPath.lastIndexOf("/");
    const dir = normalizedPath.substring(0, lastIndex);
    const rightMost = normalizedPath.substring(lastIndex + 1);
    return { dir, rightMost };
};

const getEnvFile = (fileName) => {
    // Find the .env file by iterating up the PWD. However do not go past the repo root!
    const repoRootDirName = "open-captable-protocol";
    const cwd = process.env.PWD;
    let { dir, rightMost } = splitPath(cwd);
    let check = pathTools.join(cwd, fileName);
    while (!fs.existsSync(check)) {
        if (rightMost === repoRootDirName) {
            throw new Error(`Unable to locate .env in ${check}`);
        }
        // Check our current dir
        check = pathTools.join(dir, fileName);
        // The dir to look in next
        ({ dir, rightMost } = splitPath(dir));
    }
    return check;
};

let _ALREADY_SETUP = false;

export const setupEnv = () => {
    if (_ALREADY_SETUP) {
        return;
    }

    // If we're in a Docker environment, skip file loading
    if (get(process, "env.DOCKER_ENV", false)) {
        console.log("Using runtime environment variables");
        _ALREADY_SETUP = true;
        return;
    }

    // Fall back to .env file for local development
    const fileName = process.env.USE_ENV_FILE || ".env";
    const path = getEnvFile(fileName);
    console.log("Loading from env file:", path);
    config({ path });
    _ALREADY_SETUP = true;
};
