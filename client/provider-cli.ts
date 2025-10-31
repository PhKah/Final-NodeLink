import { Command } from "commander";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { Wallet } from "@coral-xyz/anchor";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { create, globSource } from 'kubo-rpc-client';
import { init, Wasmer } from "@wasmer/sdk";
import { WASI } from "@wasmer/wasi";
import { extract } from 'it-tar';
import { getWallet, getProgram, getIdl, getProgramId } from "./common.ts";

type ExecutionResult = {
    outputPath: string;
    stdout: string;
    stderr: string;
};

// --- IPFS Helpers ---
async function downloadJobDirectory(cid: string): Promise<string> {
    console.log(`   [IPFS] Creating IPFS client...`);
    const ipfs = create();

    console.log(`   [IPFS] Creating temporary directory...`);
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nodelink-job-'));
    console.log(`   [IPFS] Job directory created`);

    console.log(`   [IPFS] Getting TAR stream for CID: ${cid}`);
    const tarStream = ipfs.get(cid);

    let fileCount = 0;
    for await (const entry of extract()(tarStream)) {
        const fullPath = path.join(tempDir, entry.header.name);

        if (entry.header.type === 'directory') {
            await fs.mkdir(fullPath, { recursive: true });
        } else {
            await fs.mkdir(path.dirname(fullPath), { recursive: true });

            const content = [];
            for await (const chunk of entry.body) {
                content.push(chunk);
            }
            await fs.writeFile(fullPath, Buffer.concat(content));
            fileCount++;
        }
    }

    console.log(`   [IPFS] Successfully extracted ${fileCount} file(s).`);
    return tempDir;
}

async function uploadToIpfs(directoryPath: string): Promise<string> {
    console.log(`   [IPFS] Uploading result package from ${directoryPath}...`);
    const ipfs = create();
    let rootCid = '';

    for await (const file of ipfs.addAll(globSource(directoryPath, '**/*'))) 
        rootCid = file.cid.toString();
    
    console.log(`   [IPFS] Result package uploaded`);
    return rootCid;
}

// Wasm exe
async function executeWasmJob(jobDirectoryPath: string): Promise<ExecutionResult> {
    console.log(`   [WASM] Initializing Wasmer SDK...`);
    await init();

    console.log(`   [WASM] Reading manifest...`);
    const manifestPath = path.join(jobDirectoryPath, 'manifest.json');
    const manifestExists = await fs.access(manifestPath).then(() => true).catch(() => false);
    if (!manifestExists) {
        throw new Error("manifest.json not found in job directory!");
    }
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
    console.log(`   [WASM] Manifest loaded:`, manifest);

    const wasmFilePath = path.join(jobDirectoryPath, manifest.executable);
    console.log(`   [WASM] Loading Wasm module from: ${wasmFilePath}`);
    
    console.log(`   [WASM] Initializing WASI sandbox...`);
    const wasi = new WASI({
        args: [manifest.executable, ...manifest.args],
        env: {},
        preopens: {
            '/': jobDirectoryPath
        }
    });

    const wasmBytes = await fs.readFile(wasmFilePath);
    const module = await Wasmer.fromFile(wasmBytes);
    console.log(`   [WASM] Instantiating module with WASI imports...`);
    const instance = await wasi.instantiate(module, wasi.getImports(module));

    console.log(`   [WASM] Running instance...`);
    const exitCode = wasi.start(instance);
    const stdout = await wasi.getStdoutString();
    const stderr = await wasi.getStderrString();

    console.log(`   [WASM] Execution finished`);

    if (exitCode !== 0) throw new Error(`Wasm execution failed`);

    const outputPath = path.join(jobDirectoryPath, manifest.output_path);
    return { outputPath, stdout, stderr };
}

// Result Packager
async function createResultPackage(execResult: ExecutionResult): Promise<string> {
    console.log(`   [SYS] Creating result package...`);
    const resultDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nodelink-result-'));

    await fs.writeFile(path.join(resultDir, 'stdout.txt'), execResult.stdout);
    await fs.writeFile(path.join(resultDir, 'stderr.txt'), execResult.stderr);

    
    const finalOutputPath = path.join(resultDir, 'output');
    await fs.cp(execResult.outputPath, finalOutputPath, { recursive: true });

    console.log(`   [SYS] Result package created`);
    return resultDir;
}

// cli
const program = new Command();

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
    .action(async (options) => {
        try {
            console.log("Registering provider...");
            const wallet = await getWallet(options.keypair);
            console.log(`Provider wallet loaded: ${wallet.publicKey.toBase58()}`);
            const program = await getProgram(new Wallet(wallet));
            const [providerPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("provider"), wallet.publicKey.toBuffer()],
                program.programId
            );
            const tx = await program.methods
                .providerRegister(options.jobTags, options.hardwareConfig)
                .accounts({
                    provider: providerPda,
                    authority: wallet.publicKey,
                    systemProgram: SystemProgram.programId,
                } as any)
                .rpc();
            console.log("Provider registered successfully!");
            console.log(`Transaction signature: ${tx}`);
        } catch (error) {
            console.error("\nError registering provider:", error.message);
            if (error.logs) {
                console.error("\n--- Solana Program Logs ---");
                error.logs.forEach((log: string) => console.log(log));
                console.error("---------------------------");
            }
        }
    });
program
    .command("listen")
    .description("Start the provider daemon to listen for and process jobs.")
    .option("-k, --keypair <path>", "Path to the provider's keypair file.")
    .action(async (options) => 
    {
        console.log("Starting provider daemon...");
        const wallet = await getWallet(options.keypair);
        const program = await getProgram(new Wallet(wallet));
        const providerKey = wallet.publicKey;
        const [providerPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("provider"), providerKey.toBuffer()],
            program.programId
        );
        console.log(`Daemon started for provider: ${providerKey.toBase58()}`);
        console.log(`Provider PDA: ${providerPda.toBase58()}`);
        console.log("Scanning for available jobs... ");

        while (true) 
        {
            try {
                const jobAccounts = await program.account.jobAccount.all();
                const suitableJobs = jobAccounts.filter(job => {
                    const isPending = Object.keys(job.account.status)[0] === 'pending';
                    const hasFailed = job.account.failedProviders.some(p => p.equals(providerKey));
                    return isPending && !hasFailed;
                });

                if (suitableJobs.length === 0) {
                    await new Promise(resolve => setTimeout(resolve, 10000));
                    continue;
                }

                console.log(`Found suitable job(s).`);
                const jobToProcess = suitableJobs[0];
                const jobPda = jobToProcess.publicKey;
                const jobId = jobToProcess.account.jobId;

                console.log(`   - Attempting to accept job: ${jobPda.toBase58()} (ID: ${jobId})`);

                try {
                    const acceptTx = await program.methods
                        .acceptJob(jobId)
                        .accounts({jobAccount: jobPda, providerAccount: providerPda} as any)
                        .rpc();
                    console.log(`   Job accepted! Transaction: ${acceptTx}`);

                    try {
                        const jobDetails = jobToProcess.account.jobDetails;

                            const jobTempDir = await downloadJobDirectory(jobDetails);
                            const execResult = await executeWasmJob(jobTempDir);
                            
                            const resultPackageDir = await createResultPackage(execResult);
                            const resultCid = await uploadToIpfs(resultPackageDir);

                            console.log(`   [CHAIN] Submitting result CID to chain...`);
                            const submitTx = await program.methods
                                .submitResults(jobId, resultCid)
                                .accounts({ jobAccount: jobPda, providerAccount: providerPda} as any)
                                .rpc();
                            console.log(`   [CHAIN] Result submitted! Transaction: ${submitTx}`);

                    } catch (processingError) {
                        console.error(`   Error processing job ${jobId}:`, processingError.message);
                    } finally {
                        // Clean up logic can be added here if needed
                    }
                } catch (acceptError) {
                    if (acceptError.message.includes("Job is not pending")) {
                        console.log("   - Job was taken by another provider. Looking for another...");
                    } else {
                        console.error(`   Failed to accept job: ${acceptError.message}`);
                    }
                }
            } catch (error) {
                console.error("\nAn error occurred in the main loop:", error.message);
            }
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    });

(async () => {
    await getIdl();
    await getProgramId();
    program.parse(process.argv);
})();