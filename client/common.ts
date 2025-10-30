import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import type { NodeLink } from "../target/types/node_link.js";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
// @ts-ignore
import toml from 'toml';

// @ts-ignore
let idl: any = null;
export async function getIdl() {
    if (idl) return idl;
    idl = JSON.parse(await fs.readFile('./target/idl/node_link.json', 'utf-8'));
    return idl;
}

let anchorConfig: any = null;
export async function getAnchorConfig() {
    if (anchorConfig) return anchorConfig;
    const tomlPath = "./Anchor.toml";
    const tomlContent = await fs.readFile(tomlPath, "utf-8");
    anchorConfig = toml.parse(tomlContent);
    return anchorConfig;
}

let programId: PublicKey | null = null;
export async function getProgramId(): Promise<PublicKey> {
    if (programId) return programId;
    const config = await getAnchorConfig();
    programId = new PublicKey(config.programs.localnet.node_link);
    return programId;
}

const CLUSTER_URLS: { [key: string]: string } = {
    localnet: "http://127.0.0.1:8899",
    devnet: "https://api.devnet.solana.com",
    mainnet: "https://api.mainnet-beta.solana.com",
};

export async function getConnection(): Promise<Connection> {
    const config = await getAnchorConfig();
    const clusterName = config.provider.cluster;
    const clusterUrl = CLUSTER_URLS[clusterName];
    if (!clusterUrl) {
        throw new Error(`Unknown cluster: ${clusterName}`);
    }
    return new Connection(clusterUrl, "confirmed");
}

export async function getProvider(wallet: Wallet): Promise<AnchorProvider> {
    const connection = await getConnection();
    return new AnchorProvider(connection, wallet, AnchorProvider.defaultOptions());
}

export async function getWallet(keypairPath?: string): Promise<Keypair> {
    let pathToLoad = keypairPath;
    if (!pathToLoad) {
        const config = await getAnchorConfig();
        const walletPath = config.provider.wallet;
        if (walletPath) {
            pathToLoad = walletPath.replace('~', os.homedir());
        }
    }
    if (!pathToLoad) {
        pathToLoad = path.join(os.homedir(), ".config", "solana", "id.json");
    }
    const keypairData = JSON.parse(await fs.readFile(pathToLoad, "utf-8"));
    return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

export async function getProgram(wallet: Wallet): Promise<Program<NodeLink>> {
    const provider = await getProvider(wallet);
    const pId = await getProgramId();
    const i = await getIdl();
    return new Program<NodeLink>(i, provider);
}
