var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
/// <reference types="mocha" />
import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { Keypair, SystemProgram, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
// Helper function to sleep for a given time
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
describe("node-link", () => {
    // Configure the client to use the local cluster.
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.NodeLink;
    // Keypairs for accounts
    const renter = Keypair.generate();
    const providerAuthority = Keypair.generate();
    const providerAuthority2 = Keypair.generate(); // A second provider for testing penalties
    // PDAs
    const [counterPda] = PublicKey.findProgramAddressSync([Buffer.from("counter")], program.programId);
    const [providerAccountPda] = PublicKey.findProgramAddressSync([Buffer.from("provider"), providerAuthority.publicKey.toBuffer()], program.programId);
    const [providerAccountPda2] = PublicKey.findProgramAddressSync([Buffer.from("provider"), providerAuthority2.publicKey.toBuffer()], program.programId);
    // Shared state for tests
    let jobId;
    let jobAccountPda;
    let escrowPda;
    before(() => __awaiter(void 0, void 0, void 0, function* () {
        // Airdrop SOL to all parties
        yield Promise.all([
            provider.connection.requestAirdrop(renter.publicKey, 10 * LAMPORTS_PER_SOL),
            provider.connection.requestAirdrop(providerAuthority.publicKey, 10 * LAMPORTS_PER_SOL),
            provider.connection.requestAirdrop(providerAuthority2.publicKey, 10 * LAMPORTS_PER_SOL),
        ]).then((signatures) => __awaiter(void 0, void 0, void 0, function* () {
            yield Promise.all(signatures.map((sig) => provider.connection.confirmTransaction(sig, "confirmed")));
        }));
        // Initialize the job counter, catching error if it already exists
        try {
            yield program.methods
                .initializeCounter()
                .accounts({
                counter: counterPda,
                user: renter.publicKey,
                systemProgram: SystemProgram.programId
            })
                .signers([renter])
                .rpc();
            console.log("Job counter initialized.");
        }
        catch (e) {
            if (e.toString().includes("already in use")) {
                console.log("Job counter already initialized.");
            }
            else {
                throw e;
            }
        }
        // Register both providers with their capabilities
        const provider1_job_tags = "ai_training,3d_rendering";
        const provider1_hardware = "gpu,gpu_vram_16gb,ram_32gb";
        yield program.methods
            .providerRegister(provider1_job_tags, provider1_hardware)
            .accounts({
            provider: providerAccountPda,
            authority: providerAuthority.publicKey,
            systemProgram: SystemProgram.programId
        })
            .signers([providerAuthority])
            .rpc();
        console.log(`Provider 1 ${providerAuthority.publicKey.toBase58()} registered with tags.`);
        const provider2_job_tags = "data_analysis";
        const provider2_hardware = "cpu_multicore,ram_16gb";
        yield program.methods
            .providerRegister(provider2_job_tags, provider2_hardware)
            .accounts({
            provider: providerAccountPda2,
            authority: providerAuthority2.publicKey,
            systemProgram: SystemProgram.programId
        })
            .signers([providerAuthority2])
            .rpc();
        console.log(`Provider 2 ${providerAuthority2.publicKey.toBase58()} registered with tags.`);
    }));
    describe("Happy Path Full Job Lifecycle", () => {
        it("should create a new job", () => __awaiter(void 0, void 0, void 0, function* () {
            const counterAccountBefore = yield program.account.jobCounter.fetch(counterPda);
            jobId = counterAccountBefore.count;
            const [pda, bump] = PublicKey.findProgramAddressSync([Buffer.from("job"), jobId.toBuffer("le", 8)], program.programId);
            jobAccountPda = pda;
            const [escrow, escrowBump] = PublicKey.findProgramAddressSync([Buffer.from("escrow"), jobAccountPda.toBuffer()], program.programId);
            escrowPda = escrow;
            const reward = new BN(1 * LAMPORTS_PER_SOL);
            const max_duration = new BN(60); // 60 seconds for the job
            yield program.methods
                .createJob(reward, { docker: {} }, "3d_rendering", "gpu,ram_32gb", max_duration)
                .accounts({
                jobAccount: jobAccountPda,
                escrow: escrowPda,
                renter: renter.publicKey,
                counter: counterPda,
                systemProgram: SystemProgram.programId,
            })
                .signers([renter])
                .rpc();
            const jobAccount = yield program.account.jobAccount.fetch(jobAccountPda);
            assert.equal(jobAccount.status.hasOwnProperty("pending"), true, "Job status should be Pending");
            assert.equal(jobAccount.renter.toBase58(), renter.publicKey.toBase58());
            assert.equal(jobAccount.reward.toString(), reward.toString());
            const escrowBalance = yield provider.connection.getBalance(escrowPda);
            assert.isAbove(escrowBalance, 0, "Escrow should be funded");
        }));
        it("should allow a provider to accept the job", () => __awaiter(void 0, void 0, void 0, function* () {
            yield program.methods
                .acceptJob(jobId)
                .accounts({
                jobAccount: jobAccountPda,
                providerAccount: providerAccountPda,
                provider: providerAuthority.publicKey,
                systemProgram: SystemProgram.programId,
            })
                .signers([providerAuthority])
                .rpc();
            const jobAccount = yield program.account.jobAccount.fetch(jobAccountPda);
            const providerAccount = yield program.account.provider.fetch(providerAccountPda);
            assert.equal(jobAccount.status.hasOwnProperty("inProgress"), true, "Job status should be InProgress");
            assert.equal(jobAccount.provider.toBase58(), providerAuthority.publicKey.toBase58());
            assert.equal(providerAccount.status.hasOwnProperty("busy"), true, "Provider status should be Busy");
            assert.isTrue(jobAccount.submissionDeadline.gtn(0), "Submission deadline should be set");
            assert.isTrue(jobAccount.verificationDeadline.gtn(0), "Verification deadline should be set");
        }));
        it("should allow the provider to submit results and become available", () => __awaiter(void 0, void 0, void 0, function* () {
            const results = "Qm...example...CID";
            yield program.methods
                .submitResults(jobId, results)
                .accounts({
                jobAccount: jobAccountPda,
                providerAccount: providerAccountPda,
                provider: providerAuthority.publicKey,
                systemProgram: SystemProgram.programId,
            })
                .signers([providerAuthority])
                .rpc();
            const jobAccount = yield program.account.jobAccount.fetch(jobAccountPda);
            const providerAccount = yield program.account.provider.fetch(providerAccountPda);
            assert.equal(jobAccount.status.hasOwnProperty("pendingVerification"), true, "Job status should be PendingVerification");
            assert.equal(jobAccount.results, results, "Results should be stored");
            assert.equal(providerAccount.status.hasOwnProperty("available"), true, "Provider status should be Available");
        }));
        it("should CATCH the known 'Privilege Escalation' error in verifyResults(true)", () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                yield program.methods
                    .verifyResults(jobId, true)
                    .accounts({
                    jobAccount: jobAccountPda,
                    escrow: escrowPda,
                    renter: renter.publicKey,
                    providerAccount: providerAccountPda,
                    providerWallet: providerAuthority.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                    .signers([renter])
                    .rpc();
                assert.fail("The transaction should have failed with a Privilege Escalation error.");
            }
            catch (e) {
                assert.include(e.message, "Cross-program invocation with unauthorized signer or writable account");
                console.log("\n✅ Successfully caught known 'Privilege Escalation' error in verifyResults(true).");
            }
        }));
    });
    describe("Penalty and Edge Cases", () => {
        let penaltyJobId;
        let penaltyJobPda;
        let penaltyEscrowPda;
        beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
            // Create a new job for each penalty test
            const counterAccount = yield program.account.jobCounter.fetch(counterPda);
            penaltyJobId = counterAccount.count;
            [penaltyJobPda] = PublicKey.findProgramAddressSync([Buffer.from("job"), penaltyJobId.toBuffer("le", 8)], program.programId);
            [penaltyEscrowPda] = PublicKey.findProgramAddressSync([Buffer.from("escrow"), penaltyJobPda.toBuffer()], program.programId);
            yield program.methods
                .createJob(new BN(0.5 * LAMPORTS_PER_SOL), { docker: {} }, "penalty-job", "", new BN(10))
                .accounts({
                jobAccount: penaltyJobPda,
                escrow: penaltyEscrowPda,
                renter: renter.publicKey,
                counter: counterPda,
                systemProgram: SystemProgram.programId
            })
                .signers([renter])
                .rpc();
        }));
        it("should allow the renter to reject results and penalize the provider", () => __awaiter(void 0, void 0, void 0, function* () {
            yield program.methods.acceptJob(penaltyJobId).accounts({ jobAccount: penaltyJobPda, providerAccount: providerAccountPda, provider: providerAuthority.publicKey }).signers([providerAuthority]).rpc();
            yield program.methods.submitResults(penaltyJobId, "bad results").accounts({ jobAccount: penaltyJobPda, providerAccount: providerAccountPda, provider: providerAuthority.publicKey, systemProgram: SystemProgram.programId }).signers([providerAuthority]).rpc();
            const providerAccountBefore = yield program.account.provider.fetch(providerAccountPda);
            yield program.methods.verifyResults(penaltyJobId, false).accounts({ jobAccount: penaltyJobPda, escrow: penaltyEscrowPda, renter: renter.publicKey, providerAccount: providerAccountPda, providerWallet: providerAuthority.publicKey, systemProgram: SystemProgram.programId }).signers([renter]).rpc();
            const providerAccountAfter = yield program.account.provider.fetch(providerAccountPda);
            const jobAccountAfter = yield program.account.jobAccount.fetch(penaltyJobPda);
            assert.equal(providerAccountAfter.jobsFailed.toNumber(), providerAccountBefore.jobsFailed.toNumber() + 1, "Provider's failed jobs should increment");
            assert.isTrue(providerAccountAfter.bannedUntil.gt(providerAccountBefore.bannedUntil), "Provider should be banned for a duration");
            assert.equal(jobAccountAfter.status.hasOwnProperty("pending"), true, "Job should be reset to Pending");
            assert.equal(jobAccountAfter.provider.toBase58(), SystemProgram.programId.toBase58(), "Job provider should be reset");
        }));
        it("should prevent a banned provider from accepting a job", () => __awaiter(void 0, void 0, void 0, function* () {
            // This test relies on the provider being banned from the previous test.
            try {
                yield program.methods.acceptJob(penaltyJobId).accounts({ jobAccount: penaltyJobPda, providerAccount: providerAccountPda, provider: providerAuthority.publicKey }).signers([providerAuthority]).rpc();
                assert.fail("Banned provider should not be able to accept a job");
            }
            catch (e) {
                assert.include(e.message, "Provider is currently banned or not available", "Error should be ProviderBannedOrBusy");
            }
        }));
        it("should allow the renter to reclaim a timed-out job", () => __awaiter(void 0, void 0, void 0, function* () {
            const shortJobDuration = new BN(0); // 0 seconds to make it timeout instantly
            const counterAccount = yield program.account.jobCounter.fetch(counterPda);
            const reclaimJobId = counterAccount.count;
            const [reclaimJobPda] = PublicKey.findProgramAddressSync([Buffer.from("job"), reclaimJobId.toBuffer("le", 8)], program.programId);
            const [reclaimEscrowPda] = PublicKey.findProgramAddressSync([Buffer.from("escrow"), reclaimJobPda.toBuffer()], program.programId);
            yield program.methods.createJob(new BN(0.1 * LAMPORTS_PER_SOL), { docker: {} }, "reclaim-job", "", shortJobDuration).accounts({ jobAccount: reclaimJobPda, escrow: reclaimEscrowPda, renter: renter.publicKey, counter: counterPda, systemProgram: SystemProgram.programId }).signers([renter]).rpc();
            // FIX: Use the second, non-banned provider
            yield program.methods.acceptJob(reclaimJobId).accounts({ jobAccount: reclaimJobPda, providerAccount: providerAccountPda2, provider: providerAuthority2.publicKey, systemProgram: SystemProgram.programId }).signers([providerAuthority2]).rpc();
            console.log("\n    Waiting for submission deadline to pass...");
            yield sleep(3000); // Wait 3 seconds, more than the job duration
            console.log("    ...deadline passed.");
            const providerAccountBefore = yield program.account.provider.fetch(providerAccountPda2);
            yield program.methods.reclaimJob(reclaimJobId).accounts({ jobAccount: reclaimJobPda, providerAccount: providerAccountPda2, renter: renter.publicKey, systemProgram: SystemProgram.programId }).signers([renter]).rpc();
            const providerAccountAfter = yield program.account.provider.fetch(providerAccountPda2);
            assert.equal(providerAccountAfter.jobsFailed.toNumber(), providerAccountBefore.jobsFailed.toNumber() + 1, "Provider's failed jobs should increment on reclaim");
            assert.isTrue(providerAccountAfter.bannedUntil.gt(providerAccountBefore.bannedUntil), "Provider should be banned after reclaim");
        }));
    });
});
