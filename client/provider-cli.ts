import { Command } from "commander";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import type { NodeLink } from "../target/types/node_link.js";
import * as fs from "fs";
import os from "os";
// @ts-ignore
import toml from 'toml';

// --- Merged from common.ts ---

// @ts-ignore
const idl = JSON.parse(fs.readFileSync('./target/idl/node_link.json', 'utf-8'));

// Config
let anchorConfig: any = null;

function getAnchorConfig() {
    if (anchorConfig) return anchorConfig;
    const tomlPath = "./Anchor.toml";
    if (!fs.existsSync(tomlPath)) {
        throw new Error("Anchor.toml not found!");
    }
    const tomlContent = fs.readFileSync(tomlPath, "utf-8");
    anchorConfig = toml.parse(tomlContent);
    return anchorConfig;
}

// Program and Cluster
const PROGRAM_ID = new PublicKey(getAnchorConfig().programs.localnet.node_link);

const CLUSTER_URLS = {
    localnet: "http://127.0.0.1:8899",
    devnet: "https://api.devnet.solana.com",
    mainnet: "https://api.mainnet-beta.solana.com",
};

// Connection and Provider
function getConnection(): Connection {
    const config = getAnchorConfig();
    const clusterName = config.provider.cluster;
    const clusterUrl = CLUSTER_URLS[clusterName];
    if (!clusterUrl) {
        throw new Error(`Unknown cluster name in Anchor.toml: ${clusterName}`);
    }
    return new Connection(clusterUrl, "confirmed");
}

function getProvider(wallet: Wallet): AnchorProvider {
    const connection = getConnection();
    return new AnchorProvider(connection, wallet, AnchorProvider.defaultOptions());
}

// Wallet
function getWallet(keypairPath?: string): Keypair {
    let pathToLoad = keypairPath;

    if (!pathToLoad) {
        const config = getAnchorConfig();
        const walletPath = config.provider.wallet;
        if (walletPath) {
            pathToLoad = walletPath.replace('~', os.homedir());
        }
    }
    
    if (!pathToLoad) {
        pathToLoad = os.homedir() + "/.config/solana/id.json";
    }

    if (!fs.existsSync(pathToLoad)) {
        throw new Error(`Keypair file not found at path: ${pathToLoad}`);
    }
    const keypairData = JSON.parse(fs.readFileSync(pathToLoad, "utf-8"));
    return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

// Program
function getProgram(wallet: Wallet): Program<NodeLink> {
    const provider = getProvider(wallet);
    return new Program<NodeLink>(idl, provider);
}

// --- Original provider-cli.ts code ---

const program = new Command();

program
    .name("node-link-provider")
    .description("CLI for NodeLink providers to manage their nodes and jobs.")
    .version("0.1.0");

// --- Register Command ---
program
    .command("register")
    .description("Register as a provider on the NodeLink network.")
    .option("-k, --keypair <path>", "Path to the provider's keypair file.")
    .requiredOption("-j, --job-tags <tags>", "Comma-separated list of job types you can support (e.g., 'docker,image-resizing')")
    .requiredOption("-c, --hardware-config <config>", "Description of the hardware (e.g., 'CPU:8-core,RAM:16GB,GPU:RTX3080')")
    .action(async (options) => {
        try {
            console.log("Registering provider...");

            // 1. Load wallet
            const wallet = getWallet(options.keypair);
            console.log(`Provider wallet loaded: ${wallet.publicKey.toBase58()}`);

            // 2. Get program
            const program = getProgram(new Wallet(wallet));

            // 3. Calculate Provider PDA
            const [providerPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("provider"), wallet.publicKey.toBuffer()],
                program.programId
            );

            // 4. Call the register instruction
            const tx = await program.methods
                .providerRegister(options.jobTags, options.hardwareConfig)
                .accounts({
                    provider: providerPda,
                    authority: wallet.publicKey,
                    systemProgram: SystemProgram.programId,
                }as any)
                .rpc();

            console.log("✅ Provider registered successfully!");
            console.log(`Transaction signature: ${tx}`);

        } catch (error) {
            console.error("\n❌ Error registering provider:", error.message);
            // Add more detailed error logging if needed
            if (error.logs) {
                console.error("\n--- Solana Program Logs ---");
                error.logs.forEach((log: string) => console.log(log));
                console.error("---------------------------");
            }
        }
    });

// --- Add more commands here (e.g., listen, status) ---


// Parse arguments
program.parse(process.argv);
