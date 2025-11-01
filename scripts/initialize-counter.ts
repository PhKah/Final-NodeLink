import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { getWallet, getProgram, getProgramId, getIdl } from "../client/common.ts";
import { Command } from "commander";
import * as os from "os";
import * as path from "path";

const program = new Command();

program
    .name("initialize-counter")
    .description("Initializes the JobCounter account on the NodeLink network.")
    .version("0.1.0")
    .option("-k, --keypair <path>", "Path to the user's keypair file.", path.join(os.homedir(), ".config", "solana", "id.json"))
    .action(async (options) => {
        try {
            console.log("Initializing JobCounter...");
            const wallet = await getWallet(options.keypair);
            const anchorProgram = await getProgram(new anchor.Wallet(wallet));

            const [counterPda] = PublicKey.findProgramAddressSync([Buffer.from("counter")], anchorProgram.programId);
            
            // Check if counter already exists
            const counterAccount = await anchorProgram.account.jobCounter.fetchNullable(counterPda);
            if (counterAccount) {
                console.log("JobCounter already initialized. Current count:", counterAccount.count.toString());
                return;
            }

            const tx = await anchorProgram.methods.initializeCounter().accounts({
                counter: counterPda,
                user: wallet.publicKey,
                systemProgram: SystemProgram.programId
            } as any).rpc();

            console.log("JobCounter initialized successfully!");
            console.log(`Transaction signature: ${tx}`);
        } catch (error) {
            console.error("\nError initializing JobCounter:", error.message);
            if (error.logs) {
                console.error("\n--- Solana Program Logs ---");
                error.logs.forEach((log: string) => console.log(log));
                console.error("---------------------------");
            }
        }
    });

program.parse(process.argv);
