import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { execSync, spawn, ChildProcess } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { assert } from "chai";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import type { NodeLink } from "../target/types/node_link.js";
import BN from "bn.js";

// Utility to wait for a certain amount of time
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe("CLI End-to-End Tests", () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.NodeLink as Program<NodeLink>;

    let renter: Keypair;
    let providerKp: Keypair;
    let renterKeypairPath: string;
    let providerKeypairPath: string;
    let listenerProcess: ChildProcess | null = null;

    // Helper to run synchronous CLI commands
    const runCliSync = (command: string): string => {
        try {
            console.log(`\n$ ${command}`);
            const output = execSync(`ts-node ${command}`, { encoding: "utf8" });
            console.log(output);
            return output;
        } catch (e) {
            console.error(`Error executing command: ${command}`, e);
            throw e;
        }
    };

    // Helper to run the listener command in the background
    const startListener = (command: string): ChildProcess => {
        console.log(`\n$ ${command}`);
        const [cmd, ...args] = command.split(' ');
        const child = spawn(cmd, args, {
            stdio: ['pipe', 'pipe', 'pipe'], // Pipe stdout, stderr
        });

        child.stdout.on('data', (data) => {
            console.log(`[LISTENER STDOUT]: ${data.toString()}`);
        });

        child.stderr.on('data', (data) => {
            console.error(`[LISTENER STDERR]: ${data.toString()}`);
        });

        child.on('close', (code) => {
            console.log(`[LISTENER]: Process exited with code ${code}`);
        });
        
        return child;
    };

    before(async () => {
        renter = Keypair.generate();
        providerKp = Keypair.generate();

        renterKeypairPath = path.join(os.tmpdir(), "renter-keypair.json");
        providerKeypairPath = path.join(os.tmpdir(), "provider-keypair.json");
        await fs.writeFile(renterKeypairPath, JSON.stringify(Array.from(renter.secretKey)));
        await fs.writeFile(providerKeypairPath, JSON.stringify(Array.from(providerKp.secretKey)));

        console.log("--- Airdropping SOL ---");
        await provider.connection.requestAirdrop(renter.publicKey, 5 * LAMPORTS_PER_SOL);
        await provider.connection.requestAirdrop(providerKp.publicKey, 5 * LAMPORTS_PER_SOL);
        console.log(`Airdropped 5 SOL to Renter: ${renter.publicKey.toBase58()}`);
        console.log(`Airdropped 5 SOL to Provider: ${providerKp.publicKey.toBase58()}`);

        const [counterPda] = PublicKey.findProgramAddressSync([Buffer.from("counter")], program.programId);
        const counterAccount = await program.account.jobCounter.fetchNullable(counterPda);
        if (counterAccount === null) {
            console.log("--- Initializing JobCounter ---");
            await program.methods.initializeCounter().accounts({ 
                counter: counterPda, 
                user: provider.wallet.publicKey,
                systemProgram: SystemProgram.programId
            } as any).rpc();
        }
    });

    after(async () => {
        if (listenerProcess && !listenerProcess.killed) {
            console.log("--- Stopping listener process ---");
            listenerProcess.kill();
        }
        console.log("--- Cleaning up temporary keypairs ---");
        await fs.unlink(renterKeypairPath);
        await fs.unlink(providerKeypairPath);
    });

    it("should successfully run the full job lifecycle via CLI", async function() {
        this.timeout(120000); // Increase timeout to 2 minutes for this long-running test

        // 1. Register the provider
        console.log("\n--- Testing: Provider Register ---");
        const registerOutput = runCliSync(
            `client/provider-cli.ts register --keypair ${providerKeypairPath} --job-tags "e2e-test" --hardware-config "test-config"`
        );
        assert.include(registerOutput, "Provider registered successfully!");

        // 2. Start the provider listener in the background
        console.log("\n--- Testing: Provider Listen ---");
        listenerProcess = startListener(
            `ts-node client/provider-cli.ts listen --keypair ${providerKeypairPath}`
        );
        await sleep(5000); // Give the listener a moment to start up

        // 3. Create the job
        console.log("\n--- Testing: Renter Create Job ---");
        const createJobOutput = runCliSync(
            `client/renter-cli.ts create-job --keypair ${renterKeypairPath} --reward ${LAMPORTS_PER_SOL} --details "Qm...e2e...CID"`
        );
        assert.include(createJobOutput, "Job created successfully!");

        const jobIdMatch = createJobOutput.match(/Job ID: (\d+)/);
        assert.exists(jobIdMatch, "Job ID not found in create job output");
        const jobId = new BN(jobIdMatch[1]);
        console.log(`Extracted Job ID: ${jobId}`);

        const [jobPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("job"), jobId.toBuffer("le", 8)],
            program.programId
        );

        // 4. Poll until the job is processed by the listener.
        // This means it should eventually end up in the 'pendingVerification' state.
        console.log("\n--- Polling for Job Processing by Listener ---");
        let jobState = await program.account.jobAccount.fetch(jobPda);
        let attempts = 0;
        while (Object.keys(jobState.status)[0] !== 'pendingVerification' && attempts < 20) {
            const currentState = Object.keys(jobState.status)[0];
            console.log(`Job status is '${currentState}', waiting for 'pendingVerification'...`);
            // It's okay for the state to be 'pending' or 'inProgress' while we wait.
            assert.oneOf(currentState, ['pending', 'inProgress']); 
            await sleep(3000);
            jobState = await program.account.jobAccount.fetch(jobPda);
            attempts++;
        }

        // Final check to ensure we reached the desired state.
        assert.equal(Object.keys(jobState.status)[0], 'pendingVerification', "Job did not enter 'pendingVerification' state");
        console.log("Job is now AWAITING VERIFICATION.");

        // At this point, the listener has done its job. We can stop it.
        if (listenerProcess) {
            console.log("--- Stopping listener process ---");
            listenerProcess.kill();
        }

        // 5. Renter verifies results
        console.log("\n--- Testing: Renter Verify Job ---");
        const verifyJobOutput = runCliSync(
            `client/renter-cli.ts verify-job --keypair ${renterKeypairPath} --job-id ${jobId} --accept true`
        );
        assert.include(verifyJobOutput, `results accepted successfully`);

        // 6. Verify final job state
        jobState = await program.account.jobAccount.fetch(jobPda);
        assert.equal(Object.keys(jobState.status)[0], 'completed', "Job should be in 'Completed' state");
        console.log("Job is now COMPLETED.");
    });
});
