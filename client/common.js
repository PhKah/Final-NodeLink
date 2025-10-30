var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
// @ts-ignore
import toml from 'toml';
// @ts-ignore
let idl = null;
export function getIdl() {
    return __awaiter(this, void 0, void 0, function* () {
        if (idl)
            return idl;
        idl = JSON.parse(yield fs.readFile('./target/idl/node_link.json', 'utf-8'));
        return idl;
    });
}
let anchorConfig = null;
export function getAnchorConfig() {
    return __awaiter(this, void 0, void 0, function* () {
        if (anchorConfig)
            return anchorConfig;
        const tomlPath = "./Anchor.toml";
        const tomlContent = yield fs.readFile(tomlPath, "utf-8");
        anchorConfig = toml.parse(tomlContent);
        return anchorConfig;
    });
}
let programId = null;
export function getProgramId() {
    return __awaiter(this, void 0, void 0, function* () {
        if (programId)
            return programId;
        const config = yield getAnchorConfig();
        programId = new PublicKey(config.programs.localnet.node_link);
        return programId;
    });
}
const CLUSTER_URLS = {
    localnet: "http://127.0.0.1:8899",
    devnet: "https://api.devnet.solana.com",
    mainnet: "https://api.mainnet-beta.solana.com",
};
export function getConnection() {
    return __awaiter(this, void 0, void 0, function* () {
        const config = yield getAnchorConfig();
        const clusterName = config.provider.cluster;
        const clusterUrl = CLUSTER_URLS[clusterName];
        if (!clusterUrl) {
            throw new Error(`Unknown cluster: ${clusterName}`);
        }
        return new Connection(clusterUrl, "confirmed");
    });
}
export function getProvider(wallet) {
    return __awaiter(this, void 0, void 0, function* () {
        const connection = yield getConnection();
        return new AnchorProvider(connection, wallet, AnchorProvider.defaultOptions());
    });
}
export function getWallet(keypairPath) {
    return __awaiter(this, void 0, void 0, function* () {
        let pathToLoad = keypairPath;
        if (!pathToLoad) {
            const config = yield getAnchorConfig();
            const walletPath = config.provider.wallet;
            if (walletPath) {
                pathToLoad = walletPath.replace('~', os.homedir());
            }
        }
        if (!pathToLoad) {
            pathToLoad = path.join(os.homedir(), ".config", "solana", "id.json");
        }
        const keypairData = JSON.parse(yield fs.readFile(pathToLoad, "utf-8"));
        return Keypair.fromSecretKey(new Uint8Array(keypairData));
    });
}
export function getProgram(wallet) {
    return __awaiter(this, void 0, void 0, function* () {
        const provider = yield getProvider(wallet);
        const pId = yield getProgramId();
        const i = yield getIdl();
        return new Program(i, provider);
    });
}
