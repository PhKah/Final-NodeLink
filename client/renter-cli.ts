import { Command } from "commander";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { getWallet, getProgram, getProgramId, getIdl } from "./common.js";
import BN from "bn.js";

const program = new Command();

program
    .name("compute-share-renter")
    .description("CLI for Compute Share renters to create and manage jobs.")
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

            const reward = new BN(options.reward);
            const max_duration = new BN(3600); // 1 hour

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
                .signers([wallet]) 
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

program
    .command("verify-job")
    .description("Verify the results of a job.")
    .option("-k, --keypair <path>", "Path to the renter's keypair file.")
    .requiredOption("-j, --job-id <jobId>", "The ID of the job to verify.")
    .requiredOption("-a, --accept <boolean>", "True to accept results, false to reject.")
    .action(async (options) => {
        try {
            console.log(`Verifying job ${options.jobId}...`);
            const wallet = await getWallet(options.keypair);
            const program = await getProgram(new anchor.Wallet(wallet));
            const renterKey = wallet.publicKey;

            const jobId = new BN(options.jobId);
            const [jobPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("job"), jobId.toBuffer("le", 8)],
                program.programId
            );

            const jobAccount = await program.account.jobAccount.fetch(jobPda);
            const [escrowPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("escrow"), jobPda.toBuffer()],
                program.programId
            );
            const [providerPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("provider"), jobAccount.provider.toBuffer()],
                program.programId
            );

            const isAccepted = options.accept === "true";

            const tx = await program.methods
                .verifyResults(jobId, isAccepted)
                .accounts({
                    jobAccount: jobPda,
                    renter: renterKey,
                    providerAccount: providerPda,
                    systemProgram: SystemProgram.programId,
                } as any)
                .signers([wallet])
                .rpc();

            console.log(`Job ${options.jobId} results ${isAccepted ? "accepted" : "rejected"} successfully!`);
            console.log(`Transaction signature: ${tx}`);
        } catch (error) {
            console.error("\nError verifying job:", error.message);
            if (error.logs) {
                console.error("\n--- Solana Program Logs ---");
                error.logs.forEach((log: string) => console.log(log));
                console.error("---------------------------");
            }
        }
    });

program
    .command("cancel-job")
    .description("Cancel a pending job.")
    .option("-k, --keypair <path>", "Path to the renter's keypair file.")
    .requiredOption("-j, --job-id <jobId>", "The ID of the job to cancel.")
    .action(async (options) => {
        try {
            console.log(`Cancelling job ${options.jobId}...`);
            const wallet = await getWallet(options.keypair);
            const program = await getProgram(new anchor.Wallet(wallet));
            const renterKey = wallet.publicKey;

            const jobId = new BN(options.jobId);
            const [jobPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("job"), jobId.toBuffer("le", 8)],
                program.programId
            );
            const [escrowPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("escrow"), jobPda.toBuffer()],
                program.programId
            );

            const tx = await program.methods
                .cancelJob(jobId)
                .accounts({
                    jobAccount: jobPda,
                    escrow: escrowPda,
                    renter: renterKey,
                    systemProgram: SystemProgram.programId,
                } as any)
                .signers([wallet])
                .rpc();

            console.log(`Job ${options.jobId} cancelled successfully!`);
            console.log(`Transaction signature: ${tx}`);
        } catch (error) {
            console.error("\nError cancelling job:", error.message);
            if (error.logs) {
                console.error("\n--- Solana Program Logs ---");
                error.logs.forEach((log: string) => console.log(log));
                console.error("---------------------------");
            }
        }
    });

program
    .command("reclaim-job")
    .description("Reclaim a job if the provider fails to submit results within the deadline.")
    .option("-k, --keypair <path>", "Path to the renter's keypair file.")
    .requiredOption("-j, --job-id <jobId>", "The ID of the job to reclaim.")
    .action(async (options) => {
        try {
            console.log(`Reclaiming job ${options.jobId}...`);
            const wallet = await getWallet(options.keypair);
            const program = await getProgram(new anchor.Wallet(wallet));
            const renterKey = wallet.publicKey;

            const jobId = new BN(options.jobId);
            const [jobPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("job"), jobId.toBuffer("le", 8)],
                program.programId
            );

            const jobAccount = await program.account.jobAccount.fetch(jobPda);
            const [providerPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("provider"), jobAccount.provider.toBuffer()],
                program.programId
            );

            const tx = await program.methods
                .reclaimJob(jobId)
                .accounts({
                    jobAccount: jobPda,
                    providerAccount: providerPda,
                    renter: renterKey,
                    systemProgram: SystemProgram.programId,
                } as any)
                .signers([wallet])
                .rpc();

            console.log(`Job ${options.jobId} reclaimed successfully!`);
            console.log(`Transaction signature: ${tx}`);
        } catch (error) {
            console.error("\nError reclaiming job:", error.message);
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
