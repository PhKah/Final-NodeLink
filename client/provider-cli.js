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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const web3_js_1 = require("@solana/web3.js");
const anchor_1 = require("@coral-xyz/anchor");
const fs = __importStar(require("fs/promises"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const kubo_rpc_client_1 = require("kubo-rpc-client");
const sdk_1 = require("@wasmer/sdk");
const wasi_1 = require("@wasmer/wasi");
const it_tar_1 = require("it-tar");
const common_js_1 = require("./common.js");
// --- IPFS Helpers ---
function downloadJobDirectory(cid) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, e_1, _b, _c, _d, e_2, _e, _f;
        console.log(`   [IPFS] Creating IPFS client...`);
        const ipfs = (0, kubo_rpc_client_1.create)();
        console.log(`   [IPFS] Creating temporary directory...`);
        const tempDir = yield fs.mkdtemp(path.join(os.tmpdir(), 'nodelink-job-'));
        console.log(`   [IPFS] Job directory created`);
        console.log(`   [IPFS] Getting TAR stream for CID: ${cid}`);
        const tarStream = ipfs.get(cid);
        let fileCount = 0;
        try {
            for (var _g = true, _h = __asyncValues((0, it_tar_1.extract)()(tarStream)), _j; _j = yield _h.next(), _a = _j.done, !_a; _g = true) {
                _c = _j.value;
                _g = false;
                const entry = _c;
                const fullPath = path.join(tempDir, entry.header.name);
                if (entry.header.type === 'directory') {
                    yield fs.mkdir(fullPath, { recursive: true });
                }
                else {
                    yield fs.mkdir(path.dirname(fullPath), { recursive: true });
                    const content = [];
                    try {
                        for (var _k = true, _l = (e_2 = void 0, __asyncValues(entry.body)), _m; _m = yield _l.next(), _d = _m.done, !_d; _k = true) {
                            _f = _m.value;
                            _k = false;
                            const chunk = _f;
                            content.push(chunk);
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (!_k && !_d && (_e = _l.return)) yield _e.call(_l);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                    yield fs.writeFile(fullPath, Buffer.concat(content));
                    fileCount++;
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_g && !_a && (_b = _h.return)) yield _b.call(_h);
            }
            finally { if (e_1) throw e_1.error; }
        }
        console.log(`   [IPFS] Successfully extracted ${fileCount} file(s).`);
        return tempDir;
    });
}
function uploadToIpfs(directoryPath) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, e_3, _b, _c;
        console.log(`   [IPFS] Uploading result package from ${directoryPath}...`);
        const ipfs = (0, kubo_rpc_client_1.create)();
        let rootCid = '';
        try {
            for (var _d = true, _e = __asyncValues(ipfs.addAll((0, kubo_rpc_client_1.globSource)(directoryPath, '**/*'))), _f; _f = yield _e.next(), _a = _f.done, !_a; _d = true) {
                _c = _f.value;
                _d = false;
                const file = _c;
                rootCid = file.cid.toString();
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
            }
            finally { if (e_3) throw e_3.error; }
        }
        console.log(`   [IPFS] Result package uploaded`);
        return rootCid;
    });
}
// Wasm exe
function executeWasmJob(jobDirectoryPath) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`   [WASM] Initializing Wasmer SDK...`);
        yield (0, sdk_1.init)();
        console.log(`   [WASM] Reading manifest...`);
        const manifestPath = path.join(jobDirectoryPath, 'manifest.json');
        const manifestExists = yield fs.access(manifestPath).then(() => true).catch(() => false);
        if (!manifestExists) {
            throw new Error("manifest.json not found in job directory!");
        }
        const manifest = JSON.parse(yield fs.readFile(manifestPath, 'utf-8'));
        console.log(`   [WASM] Manifest loaded:`, manifest);
        const wasmFilePath = path.join(jobDirectoryPath, manifest.executable);
        console.log(`   [WASM] Loading Wasm module from: ${wasmFilePath}`);
        console.log(`   [WASM] Initializing WASI sandbox...`);
        const wasi = new wasi_1.WASI({
            args: [manifest.executable, ...manifest.args],
            env: {},
            preopens: {
                '/': jobDirectoryPath
            }
        });
        const wasmBytes = yield fs.readFile(wasmFilePath);
        const module = yield sdk_1.Wasmer.fromFile(wasmBytes);
        console.log(`   [WASM] Instantiating module with WASI imports...`);
        const instance = yield wasi.instantiate(module, wasi.getImports(module));
        console.log(`   [WASM] Running instance...`);
        const exitCode = wasi.start(instance);
        const stdout = yield wasi.getStdoutString();
        const stderr = yield wasi.getStderrString();
        console.log(`   [WASM] Execution finished`);
        if (exitCode !== 0)
            throw new Error(`Wasm execution failed`);
        const outputPath = path.join(jobDirectoryPath, manifest.output_path);
        return { outputPath, stdout, stderr };
    });
}
// Result Packager
function createResultPackage(execResult) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`   [SYS] Creating result package...`);
        const resultDir = yield fs.mkdtemp(path.join(os.tmpdir(), 'nodelink-result-'));
        yield fs.writeFile(path.join(resultDir, 'stdout.txt'), execResult.stdout);
        yield fs.writeFile(path.join(resultDir, 'stderr.txt'), execResult.stderr);
        const finalOutputPath = path.join(resultDir, 'output');
        yield fs.cp(execResult.outputPath, finalOutputPath, { recursive: true });
        console.log(`   [SYS] Result package created`);
        return resultDir;
    });
}
// cli
const program = new commander_1.Command();
program
    .name("compute-share-provider")
    .description("CLI for NodeLink providers to manage their nodes and jobs.")
    .version("0.1.0");
program
    .command("register")
    .description("Register as a provider on the NodeLink network.")
    .option("-k, --keypair <path>", "Path to the provider's keypair file.")
    .requiredOption("-j, --job-tags <tags>", "Comma-separated list of job types you can support (e.g., 'docker,image-resizing')")
    .requiredOption("-c, --hardware-config <config>", "Description of the hardware (e.g., 'CPU:8-core,RAM:16GB,GPU:RTX3080')")
    .action((options) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log("Registering provider...");
        const wallet = yield (0, common_js_1.getWallet)(options.keypair);
        console.log(`Provider wallet loaded: ${wallet.publicKey.toBase58()}`);
        const program = yield (0, common_js_1.getProgram)(new anchor_1.Wallet(wallet));
        const [providerPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("provider"), wallet.publicKey.toBuffer()], program.programId);
        const tx = yield program.methods
            .providerRegister(options.jobTags, options.hardwareConfig)
            .accounts({
            provider: providerPda,
            authority: wallet.publicKey,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .rpc();
        console.log("Provider registered successfully!");
        console.log(`Transaction signature: ${tx}`);
    }
    catch (error) {
        console.error("\nError registering provider:", error.message);
        if (error.logs) {
            console.error("\n--- Solana Program Logs ---");
            error.logs.forEach((log) => console.log(log));
            console.error("---------------------------");
        }
    }
}));
program
    .command("listen")
    .description("Start the provider daemon to listen for and process jobs.")
    .option("-k, --keypair <path>", "Path to the provider's keypair file.")
    .action((options) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("Starting provider daemon...");
    const wallet = yield (0, common_js_1.getWallet)(options.keypair);
    const program = yield (0, common_js_1.getProgram)(new anchor_1.Wallet(wallet));
    const providerKey = wallet.publicKey;
    const [providerPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("provider"), providerKey.toBuffer()], program.programId);
    console.log(`Daemon started for provider: ${providerKey.toBase58()}`);
    console.log(`Provider PDA: ${providerPda.toBase58()}`);
    console.log("Scanning for available jobs... ");
    while (true) {
        try {
            const jobAccounts = yield program.account.jobAccount.all();
            const suitableJobs = jobAccounts.filter(job => {
                const isPending = Object.keys(job.account.status)[0] === 'pending';
                const hasFailed = job.account.failedProviders.some(p => p.equals(providerKey));
                return isPending && !hasFailed;
            });
            if (suitableJobs.length === 0) {
                yield new Promise(resolve => setTimeout(resolve, 10000));
                continue;
            }
            console.log(`Found suitable job(s).`);
            const jobToProcess = suitableJobs[0];
            const jobPda = jobToProcess.publicKey;
            const jobId = jobToProcess.account.jobId;
            console.log(`   - Attempting to accept job: ${jobPda.toBase58()} (ID: ${jobId})`);
            try {
                const acceptTx = yield program.methods
                    .acceptJob(jobId)
                    .accounts({ jobAccount: jobPda, providerAccount: providerPda })
                    .rpc();
                console.log(`   Job accepted! Transaction: ${acceptTx}`);
                try {
                    const jobDetails = jobToProcess.account.jobDetails;
                    const jobTempDir = yield downloadJobDirectory(jobDetails);
                    const execResult = yield executeWasmJob(jobTempDir);
                    const resultPackageDir = yield createResultPackage(execResult);
                    const resultCid = yield uploadToIpfs(resultPackageDir);
                    console.log(`   [CHAIN] Submitting result CID to chain...`);
                    const submitTx = yield program.methods
                        .submitResults(jobId, resultCid)
                        .accounts({ jobAccount: jobPda, providerAccount: providerPda })
                        .rpc();
                    console.log(`   [CHAIN] Result submitted! Transaction: ${submitTx}`);
                }
                catch (processingError) {
                    console.error(`   Error processing job ${jobId}:`, processingError.message);
                }
                finally {
                    // Clean up logic can be added here if needed
                }
            }
            catch (acceptError) {
                if (acceptError.message.includes("Job is not pending")) {
                    console.log("   - Job was taken by another provider. Looking for another...");
                }
                else {
                    console.error(`   Failed to accept job: ${acceptError.message}`);
                }
            }
        }
        catch (error) {
            console.error("\nAn error occurred in the main loop:", error.message);
        }
        yield new Promise(resolve => setTimeout(resolve, 10000));
    }
}));
(() => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, common_js_1.getIdl)();
    yield (0, common_js_1.getProgramId)();
    program.parse(process.argv);
}))();
