var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Command } from "commander";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { Wallet, BN } from "@coral-xyz/anchor";
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
    .action((options) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log("Creating a new job...");
        const wallet = yield getWallet(options.keypair);
        const program = yield getProgram(new Wallet(wallet));
        const renterKey = wallet.publicKey;
        const counterPda = PublicKey.findProgramAddressSync([Buffer.from("counter")], program.programId)[0];
        const counterAccount = yield program.account.jobCounter.fetch(counterPda);
        const jobId = counterAccount.count;
        const jobPda = PublicKey.findProgramAddressSync([Buffer.from("job"), jobId.toBuffer("le", 8)], program.programId)[0];
        const escrowPda = PublicKey.findProgramAddressSync([Buffer.from("escrow"), jobPda.toBuffer()], program.programId)[0];
        const reward = new BN(options.reward);
        const max_duration = new BN(3600); // 1 hour
        console.log(`Submitting job with ID: ${jobId.toString()}`);
        const tx = yield program.methods
            .createJob(reward, { docker: {} }, "test-job", "test-hardware", options.details, max_duration)
            .accounts({
            jobAccount: jobPda,
            escrow: escrowPda,
            renter: renterKey,
            counter: counterPda,
            systemProgram: SystemProgram.programId,
        })
            .signers([wallet]) // The renter needs to sign to pay for the accounts
            .rpc();
        console.log("Job created successfully!");
        console.log(`Job ID: ${jobId.toString()}`);
        console.log(`Transaction signature: ${tx}`);
    }
    catch (error) {
        console.error("\nError creating job:", error.message);
        if (error.logs) {
            console.error("\n--- Solana Program Logs ---");
            error.logs.forEach((log) => console.log(log));
            console.error("---------------------------");
        }
    }
}));
(() => __awaiter(void 0, void 0, void 0, function* () {
    yield getIdl();
    yield getProgramId();
    program.parse(process.argv);
}))();
