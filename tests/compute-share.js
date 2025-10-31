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
const web3_js_1 = require("@solana/web3.js");
const child_process_1 = require("child_process");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const chai_1 = require("chai");
const anchor = __importStar(require("@coral-xyz/anchor"));
const bn_js_1 = __importDefault(require("bn.js"));
// --- Test Configuration ---
const N = 1; // For WASM test, we'll use a single renter/provider for simplicity
const WASM_JOB_DIR = "tests/wasm-jobs/double-number";
// --- Helper Functions ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
function airdrop(connection, publicKey) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const signature = yield connection.requestAirdrop(publicKey, 2 * web3_js_1.LAMPORTS_PER_SOL);
            yield connection.confirmTransaction(signature, "confirmed");
        }
        catch (error) {
            console.warn(`Airdrop failed for ${publicKey.toBase58()}: ${error.message}`);
        }
    });
}
const runCliSync = (command) => {
    try {
        console.log(`
$ ${command}`);
        const output = (0, child_process_1.execSync)(`ts-node ${command}`, { encoding: "utf8", stdio: 'pipe' });
        console.log(output);
        return output;
    }
    catch (e) {
        console.error(`Error executing command: ${command}`);
        console.error(e.stdout);
        console.error(e.stderr);
        throw e;
    }
};
const startListener = (command) => {
    console.log(`
$ ${command}`);
    const [cmd, ...args] = command.split(' ');
    const child = (0, child_process_1.spawn)(cmd, args, {
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
    const program = anchor.workspace.NodeLink;
    const renters = [];
    const providers = [];
    let listenerProcesses = [];
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(120000); // 2 minutes timeout for setup
            console.log(`--- Setting up ${N} Renters and ${N} Providers ---`);
            // 1. Generate Keypairs
            for (let i = 0; i < N; i++) {
                const renterKp = web3_js_1.Keypair.generate();
                const renterPath = path.join(os.tmpdir(), `renter-${i}.json`);
                yield fs.writeFile(renterPath, JSON.stringify(Array.from(renterKp.secretKey)));
                renters.push({ keypair: renterKp, keypairPath: renterPath });
                const providerKp = web3_js_1.Keypair.generate();
                const providerPath = path.join(os.tmpdir(), `provider-${i}.json`);
                yield fs.writeFile(providerPath, JSON.stringify(Array.from(providerKp.secretKey)));
                providers.push({ keypair: providerKp, keypairPath: providerPath });
            }
            // 2. Airdrop SOL
            console.log("--- Airdropping SOL to all participants ---");
            const allPubkeys = [...renters.map(r => r.keypair.publicKey), ...providers.map(p => p.keypair.publicKey)];
            yield Promise.all(allPubkeys.map(pk => airdrop(provider.connection, pk)));
            console.log("Airdrops complete.");
            // 3. Initialize Job Counter
            const [counterPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("counter")], program.programId);
            const counterAccount = yield program.account.jobCounter.fetchNullable(counterPda);
            if (counterAccount === null) {
                console.log("--- Initializing JobCounter ---");
                yield program.methods.initializeCounter().accounts({
                    counter: counterPda,
                    user: provider.wallet.publicKey,
                    systemProgram: web3_js_1.SystemProgram.programId
                }).rpc();
            }
            // 4. Register all providers
            console.log("--- Registering all Providers ---");
            for (let i = 0; i < N; i++) {
                const p = providers[i];
                runCliSync(`client/provider-cli.ts register --keypair ${p.keypairPath} --job-tags "add-op,wasm-double" --hardware-config "test-cpu"`);
            }
            console.log("Provider registration complete.");
        });
    });
    after(() => __awaiter(void 0, void 0, void 0, function* () {
        console.log("--- Tearing Down Test ---");
        listenerProcesses.forEach(p => {
            if (p && !p.killed)
                p.kill();
        });
        console.log("Killed all listener processes.");
        const allKeypairPaths = [...renters.map(r => r.keypairPath), ...providers.map(p => p.keypairPath)];
        yield Promise.all(allKeypairPaths.map(p => fs.unlink(p).catch(e => console.error(e))));
        console.log("Cleaned up all temporary keypairs.");
    }));
    describe("WASM Job Lifecycle", () => {
        let wasmJobCID;
        before(function () {
            return __awaiter(this, void 0, void 0, function* () {
                this.timeout(60000);
                console.log("--- Preparing WASM Job ---");
                // 1. Compile the WASM module
                console.log("Compiling WASM module...");
                (0, child_process_1.execSync)(`bash ${WASM_JOB_DIR}/build.sh`, { stdio: 'inherit' });
                // 2. Upload the job directory to IPFS
                console.log("Uploading WASM job directory to IPFS...");
                try {
                    const output = (0, child_process_1.execSync)(`ipfs add -r -Q ${WASM_JOB_DIR}`);
                    wasmJobCID = output.toString().trim();
                    console.log(`WASM Job CID: ${wasmJobCID}`);
                    chai_1.assert.isString(wasmJobCID);
                    chai_1.assert.isNotEmpty(wasmJobCID);
                }
                catch (e) {
                    console.error("IPFS command failed. Is IPFS daemon running? Please start it with 'ipfs daemon'");
                    throw e;
                }
            });
        });
        it(`should handle a WASM job from creation to verification`, function () {
            return __awaiter(this, void 0, void 0, function* () {
                this.timeout(240000); // 4 minutes for the full lifecycle test
                const testRenter = renters[0];
                const testProvider = providers[0];
                // 1. Start a provider listener
                console.log("--- Starting Provider Listener for WASM Test ---");
                const listener = startListener(`ts-node client/provider-cli.ts listen --keypair ${testProvider.keypairPath}`);
                listenerProcesses.push(listener);
                yield sleep(5000); // Give listener time to start
                // 2. Renter creates the WASM job
                console.log("--- Renter Creating WASM Job ---");
                const createOutput = runCliSync(`client/renter-cli.ts create-job --keypair ${testRenter.keypairPath} --reward ${web3_js_1.LAMPORTS_PER_SOL} --details ${wasmJobCID}`);
                const jobIdMatch = createOutput.match(/Job ID: (\d+)/);
                chai_1.assert.exists(jobIdMatch, "Job ID not found in create job output");
                const jobId = new bn_js_1.default(jobIdMatch[1]);
                const [jobPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("job"), jobId.toBuffer("le", 8)], program.programId);
                console.log(`WASM Job created with ID: ${jobId} and PDA: ${jobPda.toBase58()}`);
                // 3. Poll for job to be processed
                console.log("--- Polling for WASM Job Processing ---");
                let jobState = yield program.account.jobAccount.fetch(jobPda);
                let attempts = 0;
                while (Object.keys(jobState.status)[0] !== 'pendingVerification' && attempts < 40) {
                    yield sleep(3000);
                    jobState = yield program.account.jobAccount.fetch(jobPda);
                    attempts++;
                }
                chai_1.assert.equal(Object.keys(jobState.status)[0], 'pendingVerification', "WASM job did not enter verification state.");
                // 4. Renter verifies the result
                console.log("--- Renter Verifying WASM Result ---");
                const resultCID = jobState.results;
                chai_1.assert.isString(resultCID);
                chai_1.assert.isNotEmpty(resultCID);
                console.log(`Result CID from chain: ${resultCID}`);
                const tempResultDir = path.join(os.tmpdir(), `wasm-result-${jobId}`);
                try {
                    console.log(`Downloading result from IPFS to ${tempResultDir}...`);
                    (0, child_process_1.execSync)(`ipfs get -o ${tempResultDir} ${resultCID}`, { stdio: 'inherit' });
                    const resultFilePath = path.join(tempResultDir, 'output/result.txt');
                    const resultFileContent = yield fs.readFile(resultFilePath, "utf-8");
                    const expectedResult = 21 * 2;
                    chai_1.assert.equal(parseInt(resultFileContent.trim()), expectedResult, "Result from WASM execution is incorrect!");
                    console.log(`✅ Result verified: ${resultFileContent.trim()} === ${expectedResult}`);
                    const verifyOutput = runCliSync(`client/renter-cli.ts verify-job --keypair ${testRenter.keypairPath} --job-id ${jobId} --accept true`);
                    chai_1.assert.include(verifyOutput, "results accepted successfully");
                }
                finally {
                    yield fs.rm(tempResultDir, { recursive: true, force: true });
                }
                // 5. Final check
                const finalState = yield program.account.jobAccount.fetch(jobPda);
                chai_1.assert.equal(Object.keys(finalState.status)[0], 'completed', "Job should be in COMPLETED state");
                console.log("✅ Success! WASM job lifecycle completed successfully.");
            });
        });
    });
});
