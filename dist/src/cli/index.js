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
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const crypto = __importStar(require("crypto"));
const child_process_1 = require("child_process");
const anchor = __importStar(require("@coral-xyz/anchor"));
const web3_js_1 = require("@solana/web3.js");
// ---------- Helpers ----------
function resolveIdlPath() {
    const candidates = [
        path.join(process.cwd(), "target", "idl", "node_link.json"),
        path.join(process.cwd(), "idl", "node_link.json"),
    ];
    for (const p of candidates) {
        if (fs.existsSync(p))
            return p;
    }
    throw new Error("Không tìm thấy IDL cho chương trình. Hãy chạy 'anchor build' hoặc đặt idl tại ./idl/node_link.json");
}
function loadKeypair(keypairPath) {
    const defaultPath = path.join(os.homedir(), ".config", "solana", "id.json");
    const file = keypairPath || process.env.ANCHOR_WALLET || defaultPath;
    if (!fs.existsSync(file)) {
        throw new Error(`Không tìm thấy ví tại ${file}. Thiết lập ANCHOR_WALLET hoặc tạo ví bằng solana-keygen.`);
    }
    const secret = JSON.parse(fs.readFileSync(file, "utf-8"));
    return web3_js_1.Keypair.fromSecretKey(Uint8Array.from(secret));
}
function getRpcUrl() {
    return (process.env.ANCHOR_PROVIDER_URL ||
        process.env.SOLANA_RPC_URL ||
        "https://api.devnet.solana.com");
}
function loadProgram() {
    return __awaiter(this, void 0, void 0, function* () {
        const rpc = getRpcUrl();
        const wallet = loadKeypair();
        const connection = new anchor.web3.Connection(rpc, "confirmed");
        const Provider = new anchor.AnchorProvider(connection, new anchor.Wallet(wallet), { preflightCommitment: "processed" });
        anchor.setProvider(Provider);
        // Avoid constructing Program here to bypass IDL account coder errors during register
        const program = null;
        const idl = null;
        return { program, Provider, idl };
    });
}
function deriveProviderPda(programId, authority) {
    const [pda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("provider"), authority.toBuffer()], programId);
    return pda;
}
function deriveEscrowPda(programId, jobAccount) {
    const [pda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("escrow"), jobAccount.toBuffer()], programId);
    return pda;
}
function sha256ToU8Array32(input) {
    const buf = crypto.createHash("sha256").update(input).digest();
    return Array.from(buf);
}
function toBytes32FromHexOrText(input) {
    const hex = input.trim().toLowerCase();
    const isHex = /^[0-9a-f]{64}$/.test(hex);
    if (isHex) {
        const buf = Buffer.from(hex, "hex");
        return Array.from(buf);
    }
    return sha256ToU8Array32(input);
}
function deriveJobPda(programId, renter, jobDetails32) {
    const [pda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("job"), renter.toBuffer(), Buffer.from(jobDetails32)], programId);
    return pda;
}
function runNodeScript(scriptPath, envVars) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            (0, child_process_1.execFile)("node", [scriptPath], { encoding: "utf-8", env: Object.assign(Object.assign({}, process.env), (envVars || {})) }, (err, stdout, stderr) => {
                if (err)
                    return reject(err);
                if (stderr)
                    console.error(stderr);
                resolve(stdout.trim());
            });
        });
    });
}
function getAccountsCoder(idl) {
    return new anchor.BorshAccountsCoder(idl);
}
function tryDecodeJob(coder, data) {
    try {
        return coder.decode("JobAccount", data);
    }
    catch (_) {
        try {
            return coder.decode("jobAccount", data);
        }
        catch (__) {
            return null;
        }
    }
}
// ---------- Commands ----------
function cmdRegister() {
    return __awaiter(this, arguments, void 0, function* (outputJson = false) {
        const { Provider } = yield loadProgram();
        const authority = Provider.wallet.payer.publicKey;
        const programId = new web3_js_1.PublicKey("BzBmVWwhcqohg6vHZ7bNrT6nDDvNcsvbkvc6jHwSLgUK");
        const providerPda = deriveProviderPda(programId, authority);
        // Build direct instruction for provider_register (no client-side createAccount for PDA)
        const discriminator = crypto
            .createHash("sha256")
            .update("global:provider_register")
            .digest()
            .subarray(0, 8);
        const ix = new anchor.web3.TransactionInstruction({
            keys: [
                { pubkey: providerPda, isSigner: false, isWritable: true },
                { pubkey: authority, isSigner: true, isWritable: true },
                { pubkey: web3_js_1.SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId,
            data: discriminator,
        });
        const txObj = new web3_js_1.Transaction().add(ix);
        const tx = yield Provider.sendAndConfirm(txObj, [Provider.wallet.payer]);
        if (outputJson) {
            console.log(JSON.stringify({ tx, providerPda: providerPda.toBase58() }, null, 2));
            return;
        }
        console.log("Đăng ký node thành công. Tx:", tx);
        console.log("Provider PDA:", providerPda.toBase58());
    });
}
function cmdDaemon(opts) {
    return __awaiter(this, void 0, void 0, function* () {
        const { program, Provider, idl } = yield loadProgram();
        const authority = Provider.wallet.payer.publicKey;
        const providerPda = deriveProviderPda(program.programId, authority);
        const jsonLog = !!opts.logJson;
        const logEvt = (event, payload = {}) => {
            if (jsonLog) {
                console.log(JSON.stringify(Object.assign({ event }, payload), null, 2));
            }
            else {
                if (payload && Object.keys(payload).length) {
                    console.log(`${event}:`, payload);
                }
                else {
                    console.log(event);
                }
            }
        };
        if (!fs.existsSync(opts.script)) {
            throw new Error(`Script không tồn tại: ${opts.script}`);
        }
        if (jsonLog) {
            console.log(JSON.stringify({
                event: "daemon_start",
                Provider: authority.toBase58(),
                minReward: String(opts.minReward || 0),
                script: opts.script,
                intervalMs: Number(opts.intervalMs || 15000),
            }, null, 2));
        }
        else {
            console.log("Bắt đầu daemon. Provider:", authority.toBase58());
            console.log("Ngưỡng phần thưởng (lamports):", opts.minReward);
        }
        const loop = () => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                logEvt("scan_start");
                const jobs = yield scanPendingJobs(program, idl, authority);
                logEvt("scan_done", { count: jobs.length });
                for (const { pubkey, job } of jobs) {
                    const renter = new web3_js_1.PublicKey(job.renter || ((_a = job.renter) === null || _a === void 0 ? void 0 : _a.toString()));
                    const jobDetails = (job.job_details || job.jobDetails);
                    const jobRewardLamports = ((_b = job.reward) === null || _b === void 0 ? void 0 : _b.toString) ? job.reward.toString() : String(job.reward);
                    logEvt("job_candidate", {
                        jobAccount: pubkey.toBase58(),
                        renter: renter.toBase58(),
                        detailsHex: toHex(jobDetails),
                        rewardLamports: jobRewardLamports,
                    });
                    if (!jobDetails || jobDetails.length !== 32) {
                        logEvt("job_skip_invalid_details", { jobAccount: pubkey.toBase58() });
                        console.log("Bỏ qua job vì job_details không hợp lệ:", pubkey.toBase58());
                        continue;
                    }
                    const escrowPda = deriveEscrowPda(program.programId, pubkey);
                    const escrowBalance = yield program.provider.connection.getBalance(escrowPda);
                    if (escrowBalance < (opts.minReward || 0)) {
                        logEvt("job_skip_low_reward", {
                            jobAccount: pubkey.toBase58(),
                            escrowLamports: String(escrowBalance),
                            minReward: String(opts.minReward || 0),
                        });
                        console.log(`Bỏ qua job ${pubkey.toBase58()} vì phần thưởng ${escrowBalance} < ngưỡng ${opts.minReward}`);
                        continue;
                    }
                    // Accept job
                    try {
                        const txAccept = yield program.methods
                            .accept_job(renter, jobDetails)
                            .accounts({
                            jobAccount: pubkey,
                            providerAccount: providerPda,
                            provider: authority,
                            systemProgram: web3_js_1.SystemProgram.programId,
                        })
                            .rpc();
                        logEvt("job_accept_success", { jobAccount: pubkey.toBase58(), tx: txAccept });
                        console.log("Đã nhận job:", pubkey.toBase58(), "tx:", txAccept);
                    }
                    catch (e) {
                        logEvt("job_accept_error", { jobAccount: pubkey.toBase58(), error: (e === null || e === void 0 ? void 0 : e.message) || String(e) });
                        console.warn("Nhận job thất bại:", (e === null || e === void 0 ? void 0 : e.message) || e);
                        continue; // thử job khác
                    }
                    // Execute script
                    let output = "";
                    try {
                        logEvt("run_script_start", { jobAccount: pubkey.toBase58(), script: opts.script });
                        const envVars = {
                            NL_JOB_ACCOUNT: pubkey.toBase58(),
                            NL_RENTER: renter.toBase58(),
                            NL_DETAILS_HEX: toHex(jobDetails),
                            NL_JOB_REWARD_LAMPORTS: jobRewardLamports,
                            NL_ESCROW_BALANCE: String(escrowBalance),
                            NL_ESCROW_PDA: escrowPda.toBase58(),
                            NL_MIN_REWARD: String(opts.minReward || 0),
                            NL_PROVIDER: authority.toBase58(),
                            NL_PROVIDER_PDA: providerPda.toBase58(),
                            NL_PROGRAM_ID: program.programId.toBase58(),
                        };
                        output = yield runNodeScript(opts.script, envVars);
                        logEvt("run_script_output", { jobAccount: pubkey.toBase58(), outputLen: output.length });
                        console.log("Kết quả script:", output);
                    }
                    catch (e) {
                        logEvt("run_script_error", { jobAccount: pubkey.toBase58(), error: (e === null || e === void 0 ? void 0 : e.message) || String(e) });
                        console.error("Chạy script thất bại:", (e === null || e === void 0 ? void 0 : e.message) || e);
                        continue;
                    }
                    const resultsArr = sha256ToU8Array32(output);
                    const resultsHex = toHex(resultsArr);
                    // Submit results
                    try {
                        const txSubmit = yield program.methods
                            .submit_results(renter, jobDetails, resultsArr)
                            .accounts({
                            jobAccount: pubkey,
                            provider: providerPda,
                            providerSign: authority,
                            systemProgram: web3_js_1.SystemProgram.programId,
                        })
                            .rpc();
                        logEvt("submit_results_success", { jobAccount: pubkey.toBase58(), tx: txSubmit, resultsHex });
                        console.log("Đã submit kết quả:", pubkey.toBase58(), "tx:", txSubmit);
                    }
                    catch (e) {
                        logEvt("submit_results_error", { jobAccount: pubkey.toBase58(), error: (e === null || e === void 0 ? void 0 : e.message) || String(e) });
                        console.error("Submit kết quả thất bại:", (e === null || e === void 0 ? void 0 : e.message) || e);
                    }
                }
            }
            catch (e) {
                logEvt("scan_error", { error: (e === null || e === void 0 ? void 0 : e.message) || String(e) });
                console.error("Daemon lỗi vòng quét:", (e === null || e === void 0 ? void 0 : e.message) || e);
            }
        });
        yield loop();
        setInterval(loop, opts.intervalMs || 15000);
    });
}
function scanPendingJobs(program, idl, providerAuthority) {
    return __awaiter(this, void 0, void 0, function* () {
        const coder = getAccountsCoder(idl);
        const accounts = yield program.provider.connection.getProgramAccounts(program.programId);
        const jobs = [];
        for (const acc of accounts) {
            const job = tryDecodeJob(coder, acc.account.data);
            if (!job)
                continue;
            // status handling: accept if string/enum says Pending or numeric 0
            const statusVal = job.status;
            const isPending = statusVal === "Pending" ||
                (statusVal === null || statusVal === void 0 ? void 0 : statusVal.pending) === true ||
                (statusVal === null || statusVal === void 0 ? void 0 : statusVal.pending) !== undefined ||
                statusVal === 0; // fallback
            if (!isPending)
                continue;
            // skip if provider was previously failed
            const failedProviders = job.failed_providers || job.failedProviders || [];
            const me = providerAuthority.toBase58();
            if (failedProviders.map((p) => (typeof p === "string" ? p : new web3_js_1.PublicKey(p).toBase58())).includes(me)) {
                continue;
            }
            jobs.push({ pubkey: acc.pubkey, job });
        }
        return jobs;
    });
}
// ---------- CLI bootstrap ----------
const cli = new commander_1.Command();
cli.name("node-link").description("NodeLink CLI (Provider & Consumer)").version("0.1.0");
cli
    .command("register")
    .description("Đăng ký node (Provider) với ví hiện tại")
    .option("--json", "Xuất JSON máy-đọc")
    .action((opts) => __awaiter(void 0, void 0, void 0, function* () {
    yield cmdRegister(Boolean(opts.json));
}));
cli
    .command("daemon")
    .description("Tiến trình nền: quét job, nhận, chạy script và submit kết quả")
    .requiredOption("-s, --script <path>", "Đường dẫn script Node.js để thực thi job")
    .option("-m, --min-reward <lamports>", "Ngưỡng phần thưởng tối thiểu (lamports)", (v) => parseInt(v, 10))
    .option("-i, --interval-ms <ms>", "Khoảng thời gian quét (ms)", (v) => parseInt(v, 10), 15000)
    .option("--log-json", "Log sự kiện dạng JSON máy-đọc")
    .action((opts) => __awaiter(void 0, void 0, void 0, function* () {
    yield cmdDaemon({
        script: opts.script,
        minReward: Number(opts.minReward || 0),
        intervalMs: Number(opts.intervalMs || 15000),
        logJson: Boolean(opts.logJson),
    });
}));
cli
    .command("offer-storage")
    .description("Đăng ký node sẵn sàng cho thuê ổ cứng")
    .option("--json", "Xuất JSON máy-đọc")
    .action((opts) => __awaiter(void 0, void 0, void 0, function* () {
    yield cmdRegister(Boolean(opts.json));
}));
cli
    .command("storage-daemon")
    .description("Tiến trình nền lưu trữ: phục vụ/challenge và submit kết quả")
    .requiredOption("-s, --script <path>", "Đường dẫn script xử lý lưu trữ")
    .option("-m, --min-reward <lamports>", "Ngưỡng phần thưởng tối thiểu (lamports)", (v) => parseInt(v, 10))
    .option("-i, --interval-ms <ms>", "Khoảng thời gian quét (ms)", (v) => parseInt(v, 10), 15000)
    .option("--log-json", "Log sự kiện dạng JSON máy-đọc")
    .action((opts) => __awaiter(void 0, void 0, void 0, function* () {
    yield cmdDaemon({
        script: opts.script,
        minReward: Number(opts.minReward || 0),
        intervalMs: Number(opts.intervalMs || 15000),
        logJson: Boolean(opts.logJson),
    });
}));
cli
    .command("create-contract")
    .description("Tạo hợp đồng thuê lưu trữ: nạp escrow và lưu spec")
    .requiredOption("-r, --reward <lamports>", "Phần thưởng (lamports)", (v) => parseInt(v, 10))
    .option("-d, --details <textOrHex>", "Chi tiết hợp đồng (text hoặc hex SHA-256)")
    .option("-f, --spec-file <path>", "Đường dẫn file spec để băm SHA-256")
    .option("--json", "Xuất JSON máy-đọc")
    .action((opts) => __awaiter(void 0, void 0, void 0, function* () {
    const reward = Number(opts.reward);
    let details = opts.details ? String(opts.details) : undefined;
    if (opts.specFile) {
        const buf = fs.readFileSync(String(opts.specFile));
        const hex = crypto.createHash("sha256").update(buf).digest("hex");
        details = hex;
    }
    if (!details)
        throw new Error("Cần -d details hoặc -f spec-file");
    yield cmdCreateJob(reward, details);
}));
cli
    .command("verify-storage")
    .description("Xác minh việc lưu trữ: chấp nhận hoặc từ chối kết quả")
    .option("-d, --details <textOrHex>", "Chi tiết (text hoặc hex SHA-256)")
    .option("-f, --spec-file <path>", "File spec để tính SHA-256")
    .option("--accept", "Đánh dấu kết quả là đúng")
    .option("--reject", "Đánh dấu kết quả là sai")
    .option("--json", "Xuất JSON máy-đọc")
    .action((opts) => __awaiter(void 0, void 0, void 0, function* () {
    let details = opts.details ? String(opts.details) : undefined;
    if (opts.specFile) {
        const buf = fs.readFileSync(String(opts.specFile));
        const hex = crypto.createHash("sha256").update(buf).digest("hex");
        details = hex;
    }
    if (!details)
        throw new Error("Cần -d details hoặc -f spec-file");
    const acceptFlag = opts.accept ? true : opts.reject ? false : true;
    yield cmdVerifyJob(details, acceptFlag);
}));
cli
    .command("contract-status")
    .description("Xem trạng thái hợp đồng lưu trữ theo spec chi tiết")
    .option("-d, --details <textOrHex>", "Chi tiết (text hoặc hex SHA-256)")
    .option("-f, --spec-file <path>", "File spec để tính SHA-256")
    .option("--json", "Xuất JSON máy-đọc")
    .action((opts) => __awaiter(void 0, void 0, void 0, function* () {
    let details = opts.details ? String(opts.details) : undefined;
    if (opts.specFile) {
        const buf = fs.readFileSync(String(opts.specFile));
        const hex = crypto.createHash("sha256").update(buf).digest("hex");
        details = hex;
    }
    if (!details)
        throw new Error("Cần -d details hoặc -f spec-file");
    yield cmdJobStatus(details, Boolean(opts.json));
}));
cli
    .command("list-contracts")
    .description("Liệt kê các hợp đồng lưu trữ của ví hiện tại (mặc định)")
    .option("-a, --all", "Liệt kê tất cả hợp đồng của chương trình")
    .option("--json", "Xuất JSON máy-đọc")
    .action((opts) => __awaiter(void 0, void 0, void 0, function* () {
    yield cmdListJobs(Boolean(opts.all), Boolean(opts.json));
}));
cli.command("job-status")
    .description("Xem trạng thái job theo chi tiết (details)")
    .requiredOption("-d, --details <textOrHex>", "Chi tiết job (text hoặc hex 64 ký tự)")
    .option("--json", "Xuất JSON máy-đọc")
    .action((opts) => __awaiter(void 0, void 0, void 0, function* () {
    yield cmdJobStatus(String(opts.details), Boolean(opts.json));
}));
cli.command("list-jobs")
    .description("Liệt kê các job của ví hiện tại (mặc định)")
    .option("-a, --all", "Liệt kê tất cả job của chương trình")
    .option("--json", "Xuất JSON máy-đọc")
    .action((opts) => __awaiter(void 0, void 0, void 0, function* () {
    yield cmdListJobs(Boolean(opts.all), Boolean(opts.json));
}));
cli.addHelpText("after", `\nNhóm lệnh Provider:\n  register           Đăng ký node\n  daemon             Tiến trình nền nhận job\n  claim-payment      Yêu cầu thanh toán sau hạn verify\n\nNhóm lệnh Consumer:\n  create-job         Tạo job mới và nạp escrow\n  verify-job         Xác minh kết quả job\n  job-status         Xem trạng thái job\n  list-jobs          Liệt kê job của ví hiện tại hoặc tất cả\n\nNhóm alias Thuê ổ cứng:\n  offer-storage      Alias của register\n  storage-daemon     Alias của daemon\n  create-contract    Alias của create-job (hỗ trợ --spec-file)\n  verify-storage     Alias của verify-job (hỗ trợ --spec-file)\n  contract-status    Alias của job-status (hỗ trợ --spec-file)\n  list-contracts     Alias của list-jobs\n`);
// Lệnh nguyên gốc song song với alias
cli
    .command("create-job")
    .description("Tạo job mới và nạp escrow")
    .requiredOption("-r, --reward <lamports>", "Phần thưởng (lamports)", (v) => parseInt(v, 10))
    .requiredOption("-d, --details <textOrHex>", "Chi tiết job (text hoặc hex 64 ký tự)")
    .option("--json", "Xuất JSON máy-đọc")
    .action((opts) => __awaiter(void 0, void 0, void 0, function* () {
    yield cmdCreateJob(Number(opts.reward), String(opts.details), Boolean(opts.json));
}));
cli
    .command("verify-job")
    .description("Xác minh kết quả job")
    .requiredOption("-d, --details <textOrHex>", "Chi tiết job (text hoặc hex 64 ký tự)")
    .option("--accept", "Đánh dấu kết quả là đúng")
    .option("--reject", "Đánh dấu kết quả là sai")
    .option("--json", "Xuất JSON máy-đọc")
    .action((opts) => __awaiter(void 0, void 0, void 0, function* () {
    const acceptFlag = opts.accept ? true : opts.reject ? false : true;
    yield cmdVerifyJob(String(opts.details), acceptFlag, Boolean(opts.json));
}));
cli
    .command("claim-payment")
    .description("Yêu cầu thanh toán sau hạn verify")
    .requiredOption("-d, --details <textOrHex>", "Chi tiết job (text hoặc hex 64 ký tự)")
    .option("-r, --renter <base58>", "Public key của renter nếu không tự tìm được")
    .option("--json", "Xuất JSON máy-đọc")
    .action((opts) => __awaiter(void 0, void 0, void 0, function* () {
    yield cmdClaimPayment(String(opts.details), opts.renter ? String(opts.renter) : undefined, Boolean(opts.json));
}));
cli.parseAsync(process.argv);
function cmdCreateJob(rewardLamports_1, details_1) {
    return __awaiter(this, arguments, void 0, function* (rewardLamports, details, outputJson = false) {
        const { program, Provider } = yield loadProgram();
        const renter = Provider.wallet.payer.publicKey;
        const jobDetails32 = toBytes32FromHexOrText(details);
        const jobAccount = deriveJobPda(program.programId, renter, jobDetails32);
        const escrow = deriveEscrowPda(program.programId, jobAccount);
        const tx = yield program.methods
            .create_job(rewardLamports, jobDetails32)
            .accounts({
            jobAccount,
            escrow,
            renter,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .rpc();
        if (outputJson) {
            console.log(JSON.stringify({
                tx,
                jobAccount: jobAccount.toBase58(),
                escrow: escrow.toBase58(),
                renter: renter.toBase58(),
                rewardLamports: String(rewardLamports),
                detailsHex: toHex(jobDetails32),
            }, null, 2));
            return;
        }
        console.log("Tạo job thành công. Tx:", tx);
        console.log("JobAccount:", jobAccount.toBase58());
        console.log("Escrow:", escrow.toBase58());
    });
}
function cmdVerifyJob(details_1, accept_1) {
    return __awaiter(this, arguments, void 0, function* (details, accept, outputJson = false) {
        const { program, Provider } = yield loadProgram();
        const renter = Provider.wallet.payer.publicKey;
        const jobDetails32 = toBytes32FromHexOrText(details);
        const jobAccount = deriveJobPda(program.programId, renter, jobDetails32);
        const escrow = deriveEscrowPda(program.programId, jobAccount);
        // Fetch job to get current provider
        let jobData;
        try {
            jobData = yield program.account.jobAccount.fetch(jobAccount);
        }
        catch (e) {
            throw new Error("Không tìm thấy JobAccount. Hãy kiểm tra chi tiết job hoặc renter.");
        }
        const providerPk = new web3_js_1.PublicKey(jobData.provider);
        const tx = yield program.methods
            .verify_results(renter, jobDetails32, accept)
            .accounts({
            jobAccount,
            escrow,
            renter,
            provider: providerPk,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .rpc();
        if (outputJson) {
            console.log(JSON.stringify({
                tx,
                jobAccount: jobAccount.toBase58(),
                renter: renter.toBase58(),
                provider: providerPk.toBase58(),
                decision: accept ? "accept" : "reject",
                detailsHex: toHex(jobDetails32),
            }, null, 2));
            return;
        }
        console.log("Xác minh job thành công. Tx:", tx);
    });
}
function statusToString(st) {
    if (typeof st === "string")
        return st;
    if (typeof st === "number") {
        const map = ["Pending", "InProgress", "Completed", "PendingVerification"];
        return map[st] || `Unknown(${st})`;
    }
    if ((st === null || st === void 0 ? void 0 : st.pending) !== undefined)
        return "Pending";
    if ((st === null || st === void 0 ? void 0 : st.inProgress) !== undefined || (st === null || st === void 0 ? void 0 : st.in_progress) !== undefined)
        return "InProgress";
    if ((st === null || st === void 0 ? void 0 : st.completed) !== undefined)
        return "Completed";
    if ((st === null || st === void 0 ? void 0 : st.pendingVerification) !== undefined || (st === null || st === void 0 ? void 0 : st.pending_verification) !== undefined)
        return "PendingVerification";
    return "Unknown";
}
function fmtPubkey(pk) {
    try {
        if (typeof pk === "string")
            return pk;
        return new web3_js_1.PublicKey(pk).toBase58();
    }
    catch (_) {
        return String(pk);
    }
}
function toHex(arr) {
    try {
        if (Buffer.isBuffer(arr))
            return Buffer.from(arr).toString("hex");
        if (Array.isArray(arr))
            return Buffer.from(arr).toString("hex");
        return String(arr);
    }
    catch (_) {
        return String(arr);
    }
}
function cmdJobStatus(details_1) {
    return __awaiter(this, arguments, void 0, function* (details, outputJson = false) {
        var _a, _b;
        const { program, Provider } = yield loadProgram();
        const renter = Provider.wallet.payer.publicKey;
        const jobDetails32 = toBytes32FromHexOrText(details);
        const jobAccount = deriveJobPda(program.programId, renter, jobDetails32);
        let jobData;
        try {
            jobData = yield program.account.jobAccount.fetch(jobAccount);
        }
        catch (e) {
            throw new Error("Không tìm thấy JobAccount. Hãy kiểm tra chi tiết job hoặc renter.");
        }
        const status = statusToString(jobData.status);
        const rewardStr = ((_a = jobData.reward) === null || _a === void 0 ? void 0 : _a.toString) ? jobData.reward.toString() : String(jobData.reward);
        const renterStr = fmtPubkey(jobData.renter);
        const providerStr = fmtPubkey(jobData.provider);
        const detailsHex = toHex(jobData.job_details || jobData.jobDetails);
        const resultsHex = toHex(jobData.results);
        const deadlineSec = ((_b = jobData.verification_deadline) === null || _b === void 0 ? void 0 : _b.toNumber)
            ? jobData.verification_deadline.toNumber()
            : Number(jobData.verification_deadline || 0);
        const deadlineIso = deadlineSec ? new Date(deadlineSec * 1000).toISOString() : "0";
        const failedProvidersArr = Array.isArray(jobData.failed_providers)
            ? jobData.failed_providers.map((pk) => fmtPubkey(pk))
            : Array.isArray(jobData.failedProviders)
                ? jobData.failedProviders.map((pk) => fmtPubkey(pk))
                : [];
        if (outputJson) {
            console.log(JSON.stringify({
                jobAccount: jobAccount.toBase58(),
                status,
                rewardLamports: rewardStr,
                renter: renterStr,
                Provider: providerStr,
                detailsHex,
                resultsHex,
                verificationDeadlineSec: deadlineSec,
                verificationDeadlineIso: deadlineIso,
                failedProviders: failedProvidersArr,
            }, null, 2));
            return;
        }
        console.log("Job:", jobAccount.toBase58());
        console.log("- Status:", status);
        console.log("- Reward:", rewardStr, "lamports");
        console.log("- Renter:", renterStr);
        console.log("- Provider:", providerStr);
        console.log("- Details(hex):", detailsHex);
        console.log("- Results(hex):", resultsHex);
        console.log("- Verification deadline:", deadlineIso);
    });
}
function cmdListJobs(all_1) {
    return __awaiter(this, arguments, void 0, function* (all, outputJson = false) {
        var _a, _b;
        const { program, Provider, idl } = yield loadProgram();
        const coder = getAccountsCoder(idl);
        const me = Provider.wallet.payer.publicKey.toBase58();
        const accounts = yield program.provider.connection.getProgramAccounts(program.programId);
        const rows = [];
        for (const acc of accounts) {
            const job = tryDecodeJob(coder, acc.account.data);
            if (!job)
                continue;
            const renterStr = fmtPubkey(job.renter || ((_a = job.renter) === null || _a === void 0 ? void 0 : _a.toString()));
            if (!all && renterStr !== me)
                continue;
            const status = statusToString(job.status);
            const rewardStr = ((_b = job.reward) === null || _b === void 0 ? void 0 : _b.toString) ? job.reward.toString() : String(job.reward);
            const providerStr = fmtPubkey(job.provider);
            rows.push({ key: acc.pubkey.toBase58(), status, reward: rewardStr, renter: renterStr, Provider: providerStr });
        }
        if (!rows.length) {
            console.log(all ? "Không có job nào trong chương trình." : "Ví hiện tại chưa có job nào.");
            return;
        }
        if (outputJson) {
            console.log(JSON.stringify(rows, null, 2));
            return;
        }
        console.log("Danh sách job:");
        for (const r of rows) {
            console.log(`- ${r.key} | ${r.status} | reward=${r.reward} | renter=${r.renter} | provider=${r.Provider}`);
        }
    });
}
function cmdClaimPayment(details_1, renterOpt_1) {
    return __awaiter(this, arguments, void 0, function* (details, renterOpt, outputJson = false) {
        var _a;
        const { program, Provider, idl } = yield loadProgram();
        const authority = Provider.wallet.payer.publicKey;
        const providerPda = deriveProviderPda(program.programId, authority);
        const jobDetails32 = toBytes32FromHexOrText(details);
        let renterPk = renterOpt ? new web3_js_1.PublicKey(renterOpt) : undefined;
        let jobAccountPk;
        if (!renterPk) {
            const coder = getAccountsCoder(idl);
            const accounts = yield program.provider.connection.getProgramAccounts(program.programId);
            for (const acc of accounts) {
                const job = tryDecodeJob(coder, acc.account.data);
                if (!job)
                    continue;
                const jd = (job.job_details || job.jobDetails);
                if (!jd || jd.length !== 32)
                    continue;
                let match = true;
                for (let i = 0; i < 32; i++) {
                    if (jd[i] !== jobDetails32[i]) {
                        match = false;
                        break;
                    }
                }
                if (!match)
                    continue;
                const providerStr = fmtPubkey(job.provider);
                if (providerStr !== authority.toBase58())
                    continue;
                renterPk = new web3_js_1.PublicKey(job.renter || ((_a = job.renter) === null || _a === void 0 ? void 0 : _a.toString()));
                jobAccountPk = acc.pubkey;
                break;
            }
        }
        else {
            jobAccountPk = deriveJobPda(program.programId, renterPk, jobDetails32);
        }
        if (!renterPk || !jobAccountPk) {
            throw new Error("Không tìm thấy job phù hợp để claim. Hãy cung cấp --renter hoặc đảm bảo details trùng khớp job của bạn.");
        }
        const escrowPda = deriveEscrowPda(program.programId, jobAccountPk);
        const tx = yield program.methods
            .claim_payment(renterPk, jobDetails32)
            .accounts({
            jobAccount: jobAccountPk,
            provider: providerPda,
            escrow: escrowPda,
            providerSigner: authority,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .rpc();
        if (outputJson) {
            console.log(JSON.stringify({
                tx,
                jobAccount: jobAccountPk.toBase58(),
                renter: renterPk.toBase58(),
                Provider: authority.toBase58(),
                providerPda: providerPda.toBase58(),
                escrow: escrowPda.toBase58(),
                detailsHex: toHex(jobDetails32),
            }, null, 2));
            return;
        }
        console.log("Claim payment thành công. Tx:", tx);
        console.log("Job:", jobAccountPk.toBase58());
    });
}
