import { Command } from "commander";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { getWallet, getProgram, getProgramId, getIdl } from "./common.js";

const program = new Command();

program
    .name("node-link-renter")
    .description("CLI for NodeLink renters to create and manage jobs.")
    .version("0.1.0");

program
    .command("create-job")
    .description("Create a new job on the network.")
    .option("-k, --keypair <path>", "Path to the renter's keypair file.")
    .requiredOption("-r, --reward <lamports>", "Reward for the job in lamports.")
    .requiredOption("-d, --details <cid>", "IPFS CID for the job details folder.")
    .action(async (options) => {
        try {
            console.log("Creating a new job...");
            const wallet = await getWallet(options.keypair);
            const program = await getProgram(new anchor.Wallet(wallet));
            const renterKey = wallet.publicKey;

            const counterPda = PublicKey.findProgramAddressSync([Buffer.from("counter")], program.programId)[0];
            const counterAccount = await program.account.jobCounter.fetch(counterPda);
            const jobId = counterAccount.count;

            const jobPda = PublicKey.findProgramAddressSync([Buffer.from("job"), jobId.toBuffer("le", 8)], program.programId)[0];
            const escrowPda = PublicKey.findProgramAddressSync([Buffer.from("escrow"), jobPda.toBuffer()], program.programId)[0];

            const reward = new anchor.BN(options.reward);
            const max_duration = new anchor.BN(3600); // 1 hour

            console.log(`Submitting job with ID: ${jobId.toString()}`);
            const tx = await program.methods
                .createJob(reward, { docker: {} }, "test-job", "test-hardware", options.details, max_duration)
                .accounts({
                    jobAccount: jobPda,
                    escrow: escrowPda,
                    renter: renterKey,
                    counter: counterPda,
                    systemProgram: SystemProgram.programId,
                } as any)
                .signers([wallet]) // The renter needs to sign to pay for the accounts
                .rpc();

            console.log("Job created successfully!");
            console.log(`Job ID: ${jobId.toString()}`);
            console.log(`Transaction signature: ${tx}`);
        } catch (error) {
            console.error("\nError creating job:", error.message);
            if (error.logs) {
                console.error("\n--- Solana Program Logs ---");
                error.logs.forEach((log: string) => console.log(log));
                console.error("---------------------------");
            }
        }
    });

(async () => {
    await getIdl();
    await getProgramId();
    program.parse(process.argv);
})();
