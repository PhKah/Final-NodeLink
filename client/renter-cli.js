"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const web3_js_1 = require("@solana/web3.js");
const anchor = __importStar(require("@coral-xyz/anchor"));
const common_js_1 = require("./common.js");
const bn_js_1 = __importDefault(require("bn.js"));
const program = new commander_1.Command();
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
    .action((options) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log("Creating a new job...");
        const wallet = yield (0, common_js_1.getWallet)(options.keypair);
        const program = yield (0, common_js_1.getProgram)(new anchor.Wallet(wallet));
        const renterKey = wallet.publicKey;
        const counterPda = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("counter")], program.programId)[0];
        const counterAccount = yield program.account.jobCounter.fetch(counterPda);
        const jobId = counterAccount.count;
        const jobPda = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("job"), jobId.toBuffer("le", 8)], program.programId)[0];
        const escrowPda = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("escrow"), jobPda.toBuffer()], program.programId)[0];
        const reward = new bn_js_1.default(options.reward);
        const max_duration = new bn_js_1.default(3600); // 1 hour
        console.log(`Submitting job with ID: ${jobId.toString()}`);
        const tx = yield program.methods
            .createJob(reward, { docker: {} }, "test-job", "test-hardware", options.details, max_duration)
            .accounts({
            jobAccount: jobPda,
            escrow: escrowPda,
            renter: renterKey,
            counter: counterPda,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .signers([wallet])
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
program
    .command("verify-job")
    .description("Verify the results of a job.")
    .option("-k, --keypair <path>", "Path to the renter's keypair file.")
    .requiredOption("-j, --job-id <jobId>", "The ID of the job to verify.")
    .requiredOption("-a, --accept <boolean>", "True to accept results, false to reject.")
    .action((options) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log(`Verifying job ${options.jobId}...`);
        const wallet = yield (0, common_js_1.getWallet)(options.keypair);
        const program = yield (0, common_js_1.getProgram)(new anchor.Wallet(wallet));
        const renterKey = wallet.publicKey;
        const jobId = new bn_js_1.default(options.jobId);
        const [jobPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("job"), jobId.toBuffer("le", 8)], program.programId);
        const jobAccount = yield program.account.jobAccount.fetch(jobPda);
        const [escrowPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("escrow"), jobPda.toBuffer()], program.programId);
        const [providerPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("provider"), jobAccount.provider.toBuffer()], program.programId);
        const isAccepted = options.accept === "true";
        const tx = yield program.methods
            .verifyResults(jobId, isAccepted)
            .accounts({
            jobAccount: jobPda,
            renter: renterKey,
            providerAccount: providerPda,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .signers([wallet])
            .rpc();
        console.log(`Job ${options.jobId} results ${isAccepted ? "accepted" : "rejected"} successfully!`);
        console.log(`Transaction signature: ${tx}`);
    }
    catch (error) {
        console.error("\nError verifying job:", error.message);
        if (error.logs) {
            console.error("\n--- Solana Program Logs ---");
            error.logs.forEach((log) => console.log(log));
            console.error("---------------------------");
        }
    }
}));
program
    .command("cancel-job")
    .description("Cancel a pending job.")
    .option("-k, --keypair <path>", "Path to the renter's keypair file.")
    .requiredOption("-j, --job-id <jobId>", "The ID of the job to cancel.")
    .action((options) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log(`Cancelling job ${options.jobId}...`);
        const wallet = yield (0, common_js_1.getWallet)(options.keypair);
        const program = yield (0, common_js_1.getProgram)(new anchor.Wallet(wallet));
        const renterKey = wallet.publicKey;
        const jobId = new bn_js_1.default(options.jobId);
        const [jobPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("job"), jobId.toBuffer("le", 8)], program.programId);
        const [escrowPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("escrow"), jobPda.toBuffer()], program.programId);
        const tx = yield program.methods
            .cancelJob(jobId)
            .accounts({
            jobAccount: jobPda,
            escrow: escrowPda,
            renter: renterKey,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .signers([wallet])
            .rpc();
        console.log(`Job ${options.jobId} cancelled successfully!`);
        console.log(`Transaction signature: ${tx}`);
    }
    catch (error) {
        console.error("\nError cancelling job:", error.message);
        if (error.logs) {
            console.error("\n--- Solana Program Logs ---");
            error.logs.forEach((log) => console.log(log));
            console.error("---------------------------");
        }
    }
}));
program
    .command("reclaim-job")
    .description("Reclaim a job if the provider fails to submit results within the deadline.")
    .option("-k, --keypair <path>", "Path to the renter's keypair file.")
    .requiredOption("-j, --job-id <jobId>", "The ID of the job to reclaim.")
    .action((options) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log(`Reclaiming job ${options.jobId}...`);
        const wallet = yield (0, common_js_1.getWallet)(options.keypair);
        const program = yield (0, common_js_1.getProgram)(new anchor.Wallet(wallet));
        const renterKey = wallet.publicKey;
        const jobId = new bn_js_1.default(options.jobId);
        const [jobPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("job"), jobId.toBuffer("le", 8)], program.programId);
        const jobAccount = yield program.account.jobAccount.fetch(jobPda);
        const [providerPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("provider"), jobAccount.provider.toBuffer()], program.programId);
        const tx = yield program.methods
            .reclaimJob(jobId)
            .accounts({
            jobAccount: jobPda,
            providerAccount: providerPda,
            renter: renterKey,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .signers([wallet])
            .rpc();
        console.log(`Job ${options.jobId} reclaimed successfully!`);
        console.log(`Transaction signature: ${tx}`);
    }
    catch (error) {
        console.error("\nError reclaiming job:", error.message);
        if (error.logs) {
            console.error("\n--- Solana Program Logs ---");
            error.logs.forEach((log) => console.log(log));
            console.error("---------------------------");
        }
    }
}));
(() => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, common_js_1.getIdl)();
    yield (0, common_js_1.getProgramId)();
    program.parse(process.argv);
}))();
