import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Connection } from "@solana/web3.js";
import { execSync, spawn, ChildProcess } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { assert } from "chai";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import type { ComputeShare } from "../target/types/compute-share.js";
import BN from "bn.js";

// --- Test Configuration ---
const N = 1; // For WASM test, we'll use a single renter/provider for simplicity
const WASM_JOB_DIR = "tests/wasm-jobs/double-number";

// --- Helper Functions ---

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function airdrop(connection: Connection, publicKey: PublicKey) {
    try {
        const signature = await connection.requestAirdrop(publicKey, 2 * LAMPORTS_PER_SOL);
        await connection.confirmTransaction(signature, "confirmed");
    } catch (error) {
        console.warn(`Airdrop failed for ${publicKey.toBase58()}: ${error.message}`);
    }
}

const runCliSync = (command: string): string => {
    try {
        console.log(`
$ ${command}`);
        const output = execSync(`ts-node ${command}`, { encoding: "utf8", stdio: 'pipe' });
        console.log(output);
        return output;
    } catch (e) {
        console.error(`Error executing command: ${command}`);
        console.error(e.stdout);
        console.error(e.stderr);
        throw e;
    }
};

const startListener = (command: string): ChildProcess => {
    console.log(`
$ ${command}`);
    const [cmd, ...args] = command.split(' ');
    const child = spawn(cmd, args, {
        stdio: ['pipe', 'pipe', 'pipe'], // Pipe stdout, stderr
    });

    child.stdout.on('data', (data) => {
        console.log(`[LISTENER-${child.pid} STDOUT]: ${data.toString()}`);
    });

    child.stderr.on('data', (data) => {
        console.error(`[LISTENER-${child.pid} STDERR]: ${data.toString()}`);
    });

    child.on('close', (code) => {
        console.log(`[LISTENER-${child.pid}]: Process exited with code ${code}`);
    });
    
    return child;
};

// --- Test Suite ---

describe("NodeLink End-to-End Tests", () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.NodeLink as Program<ComputeShare>;

    const renters: { keypair: Keypair; keypairPath: string }[] = [];
    const providers: { keypair: Keypair; keypairPath: string }[] = [];
    let listenerProcesses: ChildProcess[] = [];

    before(async function() {
        this.timeout(120000); // 2 minutes timeout for setup

        console.log(`--- Setting up ${N} Renters and ${N} Providers ---`);

        // 1. Generate Keypairs
        for (let i = 0; i < N; i++) {
            const renterKp = Keypair.generate();
            const renterPath = path.join(os.tmpdir(), `renter-${i}.json`);
            await fs.writeFile(renterPath, JSON.stringify(Array.from(renterKp.secretKey)));
            renters.push({ keypair: renterKp, keypairPath: renterPath });

            const providerKp = Keypair.generate();
            const providerPath = path.join(os.tmpdir(), `provider-${i}.json`);
            await fs.writeFile(providerPath, JSON.stringify(Array.from(providerKp.secretKey)));
            providers.push({ keypair: providerKp, keypairPath: providerPath });
        }

        // 2. Airdrop SOL
        console.log("--- Airdropping SOL to all participants ---");
        const allPubkeys = [...renters.map(r => r.keypair.publicKey), ...providers.map(p => p.keypair.publicKey)];
        await Promise.all(allPubkeys.map(pk => airdrop(provider.connection, pk)));
        console.log("Airdrops complete.");

        // 3. Initialize Job Counter
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

        // 4. Register all providers
        console.log("--- Registering all Providers ---");
        for (let i = 0; i < N; i++) {
            const p = providers[i];
            runCliSync(
                `client/provider-cli.ts register --keypair ${p.keypairPath} --job-tags "add-op,wasm-double" --hardware-config "test-cpu"`
            );
        }
        console.log("Provider registration complete.");
    });

    after(async () => {
        console.log("--- Tearing Down Test ---");
        listenerProcesses.forEach(p => {
            if (p && !p.killed) p.kill();
        });
        console.log("Killed all listener processes.");

        const allKeypairPaths = [...renters.map(r => r.keypairPath), ...providers.map(p => p.keypairPath)];
        await Promise.all(allKeypairPaths.map(p => fs.unlink(p).catch(e => console.error(e))));
        console.log("Cleaned up all temporary keypairs.");
    });

    describe("WASM Job Lifecycle", () => {
        let wasmJobCID: string;

        before(async function() {
            this.timeout(60000);
            console.log("--- Preparing WASM Job ---");

            // 1. Compile the WASM module
            console.log("Compiling WASM module...");
            execSync(`bash ${WASM_JOB_DIR}/build.sh`, { stdio: 'inherit' });

            // 2. Upload the job directory to IPFS
            console.log("Uploading WASM job directory to IPFS...");
            try {
                const output = execSync(`ipfs add -r -Q ${WASM_JOB_DIR}`);
                wasmJobCID = output.toString().trim();
                console.log(`WASM Job CID: ${wasmJobCID}`);
                assert.isString(wasmJobCID);
                assert.isNotEmpty(wasmJobCID);
            } catch (e) {
                console.error("IPFS command failed. Is IPFS daemon running? Please start it with 'ipfs daemon'");
                throw e;
            }
        });

        it(`should handle a WASM job from creation to verification`, async function() {
            this.timeout(240000); // 4 minutes for the full lifecycle test
            
            const testRenter = renters[0];
            const testProvider = providers[0];

            // 1. Start a provider listener
            console.log("--- Starting Provider Listener for WASM Test ---");
            const listener = startListener(`ts-node client/provider-cli.ts listen --keypair ${testProvider.keypairPath}`);
            listenerProcesses.push(listener);
            await sleep(5000); // Give listener time to start

            // 2. Renter creates the WASM job
            console.log("--- Renter Creating WASM Job ---");
            const createOutput = runCliSync(
                `client/renter-cli.ts create-job --keypair ${testRenter.keypairPath} --reward ${LAMPORTS_PER_SOL} --details ${wasmJobCID}`
            );
            const jobIdMatch = createOutput.match(/Job ID: (\d+)/);
            assert.exists(jobIdMatch, "Job ID not found in create job output");
            const jobId = new BN(jobIdMatch[1]);
            const [jobPda] = PublicKey.findProgramAddressSync([Buffer.from("job"), jobId.toBuffer("le", 8)], program.programId);
            console.log(`WASM Job created with ID: ${jobId} and PDA: ${jobPda.toBase58()}`);

            // 3. Poll for job to be processed
            console.log("--- Polling for WASM Job Processing ---");
            let jobState = await program.account.jobAccount.fetch(jobPda);
            let attempts = 0;
            while (Object.keys(jobState.status)[0] !== 'pendingVerification' && attempts < 40) {
                await sleep(3000);
                jobState = await program.account.jobAccount.fetch(jobPda);
                attempts++;
            }
            assert.equal(Object.keys(jobState.status)[0], 'pendingVerification', "WASM job did not enter verification state.");

            // 4. Renter verifies the result
            console.log("--- Renter Verifying WASM Result ---");
            const resultCID = jobState.results;
            assert.isString(resultCID);
            assert.isNotEmpty(resultCID);
            console.log(`Result CID from chain: ${resultCID}`);

            const tempResultDir = path.join(os.tmpdir(), `wasm-result-${jobId}`);
            try {
                console.log(`Downloading result from IPFS to ${tempResultDir}...`);
                execSync(`ipfs get -o ${tempResultDir} ${resultCID}`, { stdio: 'inherit' });

                const resultFilePath = path.join(tempResultDir, 'output/result.txt');
                const resultFileContent = await fs.readFile(resultFilePath, "utf-8");
                const expectedResult = 21 * 2; 
                assert.equal(parseInt(resultFileContent.trim()), expectedResult, "Result from WASM execution is incorrect!");
                console.log(`✅ Result verified: ${resultFileContent.trim()} === ${expectedResult}`);

                const verifyOutput = runCliSync(
                    `client/renter-cli.ts verify-job --keypair ${testRenter.keypairPath} --job-id ${jobId} --accept true`
                );
                assert.include(verifyOutput, "results accepted successfully");

            } finally {
                await fs.rm(tempResultDir, { recursive: true, force: true });
            }

            // 5. Final check
            const finalState = await program.account.jobAccount.fetch(jobPda);
            assert.equal(Object.keys(finalState.status)[0], 'completed', "Job should be in COMPLETED state");
            console.log("✅ Success! WASM job lifecycle completed successfully.");
        });
    });
});