import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import { execFile } from "child_process";
import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

// ---------- Helpers ----------
function resolveIdlPath(): string {
  const candidates = [
    path.join(process.cwd(), "target", "idl", "node_link.json"),
    path.join(process.cwd(), "idl", "node_link.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    "Không tìm thấy IDL cho chương trình. Hãy chạy 'anchor build' hoặc đặt idl tại ./idl/node_link.json"
  );
}

function loadKeypair(keypairPath?: string): Keypair {
  const defaultPath = path.join(
    os.homedir(),
    ".config",
    "solana",
    "id.json"
  );
  const file = keypairPath || process.env.ANCHOR_WALLET || defaultPath;
  if (!fs.existsSync(file)) {
    throw new Error(
      `Không tìm thấy ví tại ${file}. Thiết lập ANCHOR_WALLET hoặc tạo ví bằng solana-keygen.`
    );
  }
  const secret = JSON.parse(fs.readFileSync(file, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

function getRpcUrl(): string {
  return (
    process.env.ANCHOR_PROVIDER_URL ||
    process.env.SOLANA_RPC_URL ||
    "https://api.devnet.solana.com"
  );
}

async function loadProgram(): Promise<{ program: anchor.Program<any>; Provider: anchor.AnchorProvider; idl: any }> {
  const rpc = getRpcUrl();
  const wallet = loadKeypair();
  const connection = new anchor.web3.Connection(rpc, "confirmed");
  const Provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(wallet),
    { preflightCommitment: "processed" }
  );
  anchor.setProvider(Provider);

  // Avoid constructing Program here to bypass IDL account coder errors during register
  const program = null as any;
  const idl = null as any;
  return { program, Provider, idl };
}

function deriveProviderPda(programId: PublicKey, authority: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("provider"), authority.toBuffer()],
    programId
  );
  return pda;
}

function deriveEscrowPda(programId: PublicKey, jobAccount: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), jobAccount.toBuffer()],
    programId
  );
  return pda;
}

function sha256ToU8Array32(input: Buffer | string): number[] {
  const buf = crypto.createHash("sha256").update(input).digest();
  return Array.from(buf);
}

function toBytes32FromHexOrText(input: string): number[] {
  const hex = input.trim().toLowerCase();
  const isHex = /^[0-9a-f]{64}$/.test(hex);
  if (isHex) {
    const buf = Buffer.from(hex, "hex");
    return Array.from(buf);
  }
  return sha256ToU8Array32(input);
}

function deriveJobPda(programId: PublicKey, renter: PublicKey, jobDetails32: number[]): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("job"), renter.toBuffer(), Buffer.from(jobDetails32)],
    programId
  );
  return pda;
}

async function runNodeScript(scriptPath: string, envVars?: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "node",
      [scriptPath],
      { encoding: "utf-8", env: { ...process.env, ...(envVars || {}) } },
      (err, stdout, stderr) => {
        if (err) return reject(err);
        if (stderr) console.error(stderr);
        resolve(stdout.trim());
      }
    );
  });
}

function getAccountsCoder(idl: any) {
  return new (anchor as any).BorshAccountsCoder(idl);
}

function tryDecodeJob(coder: any, data: Buffer): any | null {
  try {
    return coder.decode("JobAccount", data);
  } catch (_) {
    try {
      return coder.decode("jobAccount", data);
    } catch (__) {
      return null;
    }
  }
}

// ---------- Commands ----------
async function cmdRegister(outputJson: boolean = false) {
  const { Provider } = await loadProgram();
  const authority = (Provider.wallet as any).payer.publicKey as PublicKey;
  const programId = new PublicKey("BzBmVWwhcqohg6vHZ7bNrT6nDDvNcsvbkvc6jHwSLgUK");
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
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId,
    data: discriminator,
  });

  const txObj = new Transaction().add(ix);
  const tx = await Provider.sendAndConfirm(txObj, [Provider.wallet.payer]);

  if (outputJson) {
    console.log(JSON.stringify({ tx, providerPda: providerPda.toBase58() }, null, 2));
    return;
  }
  console.log("Đăng ký node thành công. Tx:", tx);
  console.log("Provider PDA:", providerPda.toBase58());
}

type DaemonOptions = {
  minReward: number;
  script: string;
  intervalMs: number;
  logJson?: boolean;
};

async function cmdDaemon(opts: DaemonOptions) {
  const { program, Provider, idl } = await loadProgram();
  const authority = (Provider.wallet as any).payer.publicKey as PublicKey;
  const providerPda = deriveProviderPda(program.programId, authority);

  const jsonLog = !!opts.logJson;
  const logEvt = (event: string, payload: any = {}) => {
    if (jsonLog) {
      console.log(JSON.stringify({ event, ...payload }, null, 2));
    } else {
      if (payload && Object.keys(payload).length) {
        console.log(`${event}:`, payload);
      } else {
        console.log(event);
      }
    }
  };

  if (!fs.existsSync(opts.script)) {
    throw new Error(`Script không tồn tại: ${opts.script}`);
  }

  if (jsonLog) {
    console.log(
      JSON.stringify(
        {
          event: "daemon_start",
          Provider: authority.toBase58(),
          minReward: String(opts.minReward || 0),
          script: opts.script,
          intervalMs: Number(opts.intervalMs || 15000),
        },
        null,
        2
      )
    );
  } else {
    console.log("Bắt đầu daemon. Provider:", authority.toBase58());
    console.log("Ngưỡng phần thưởng (lamports):", opts.minReward);
  }

  const loop = async () => {
    try {
      logEvt("scan_start");
      const jobs = await scanPendingJobs(program, idl, authority);
      logEvt("scan_done", { count: jobs.length });
      for (const { pubkey, job } of jobs) {
        const renter: PublicKey = new PublicKey(job.renter || job.renter?.toString());
        const jobDetails: number[] = (job.job_details || job.jobDetails) as number[];
        const jobRewardLamports: string = job.reward?.toString ? job.reward.toString() : String(job.reward);
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
        const escrowBalance = await program.provider.connection.getBalance(escrowPda);
        if (escrowBalance < (opts.minReward || 0)) {
          logEvt("job_skip_low_reward", {
            jobAccount: pubkey.toBase58(),
            escrowLamports: String(escrowBalance),
            minReward: String(opts.minReward || 0),
          });
          console.log(
            `Bỏ qua job ${pubkey.toBase58()} vì phần thưởng ${escrowBalance} < ngưỡng ${opts.minReward}`
          );
          continue;
        }

        // Accept job
        try {
          const txAccept = await (program as any).methods
            .accept_job(renter, jobDetails)
            .accounts({
              jobAccount: pubkey,
              providerAccount: providerPda,
              provider: authority,
              systemProgram: SystemProgram.programId,
            })
            .rpc();
          logEvt("job_accept_success", { jobAccount: pubkey.toBase58(), tx: txAccept });
          console.log("Đã nhận job:", pubkey.toBase58(), "tx:", txAccept);
        } catch (e) {
          logEvt("job_accept_error", { jobAccount: pubkey.toBase58(), error: (e as any)?.message || String(e) });
          console.warn("Nhận job thất bại:", (e as any)?.message || e);
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
          output = await runNodeScript(opts.script, envVars);
          logEvt("run_script_output", { jobAccount: pubkey.toBase58(), outputLen: output.length });
          console.log("Kết quả script:", output);
        } catch (e) {
          logEvt("run_script_error", { jobAccount: pubkey.toBase58(), error: (e as any)?.message || String(e) });
          console.error("Chạy script thất bại:", (e as any)?.message || e);
          continue;
        }

        const resultsArr = sha256ToU8Array32(output);
        const resultsHex = toHex(resultsArr);

        // Submit results
        try {
          const txSubmit = await (program as any).methods
            .submit_results(renter, jobDetails, resultsArr)
            .accounts({
              jobAccount: pubkey,
              provider: providerPda,
              providerSign: authority,
              systemProgram: SystemProgram.programId,
            })
            .rpc();
          logEvt("submit_results_success", { jobAccount: pubkey.toBase58(), tx: txSubmit, resultsHex });
          console.log("Đã submit kết quả:", pubkey.toBase58(), "tx:", txSubmit);
        } catch (e) {
          logEvt("submit_results_error", { jobAccount: pubkey.toBase58(), error: (e as any)?.message || String(e) });
          console.error("Submit kết quả thất bại:", (e as any)?.message || e);
        }
      }
    } catch (e) {
      logEvt("scan_error", { error: (e as any)?.message || String(e) });
      console.error("Daemon lỗi vòng quét:", (e as any)?.message || e);
    }
  };

  await loop();
  setInterval(loop, opts.intervalMs || 15000);
}

async function scanPendingJobs(program: anchor.Program, idl: any, providerAuthority: PublicKey) {
  const coder = getAccountsCoder(idl);
  const accounts = await program.provider.connection.getProgramAccounts(program.programId);
  const jobs: Array<{ pubkey: PublicKey; job: any }> = [];
  for (const acc of accounts) {
    const job = tryDecodeJob(coder, acc.account.data as Buffer);
    if (!job) continue;
    // status handling: accept if string/enum says Pending or numeric 0
    const statusVal = job.status;
    const isPending =
      statusVal === "Pending" ||
      statusVal?.pending === true ||
      statusVal?.pending !== undefined ||
      statusVal === 0; // fallback

    if (!isPending) continue;

    // skip if provider was previously failed
    const failedProviders: string[] = job.failed_providers || job.failedProviders || [];
    const me = providerAuthority.toBase58();
    if (failedProviders.map((p: any) => (typeof p === "string" ? p : new PublicKey(p).toBase58())).includes(me)) {
      continue;
    }

    jobs.push({ pubkey: acc.pubkey, job });
  }
  return jobs;
}

// ---------- CLI bootstrap ----------
const cli = new Command();
cli.name("node-link").description("NodeLink CLI (Provider & Consumer)").version("0.1.0");

cli
  .command("register")
  .description("Đăng ký node (Provider) với ví hiện tại")
  .option("--json", "Xuất JSON máy-đọc")
  .action(async (opts: any) => {
    await cmdRegister(Boolean(opts.json));
  });

cli
  .command("daemon")
  .description("Tiến trình nền: quét job, nhận, chạy script và submit kết quả")
  .requiredOption("-s, --script <path>", "Đường dẫn script Node.js để thực thi job")
  .option("-m, --min-reward <lamports>", "Ngưỡng phần thưởng tối thiểu (lamports)", (v) => parseInt(v, 10))
  .option("-i, --interval-ms <ms>", "Khoảng thời gian quét (ms)", (v) => parseInt(v, 10), 15000)
  .option("--log-json", "Log sự kiện dạng JSON máy-đọc")
  .action(async (opts: any) => {
    await cmdDaemon({
      script: opts.script,
      minReward: Number(opts.minReward || 0),
      intervalMs: Number(opts.intervalMs || 15000),
      logJson: Boolean(opts.logJson),
    });
  });

cli
  .command("offer-storage")
  .description("Đăng ký node sẵn sàng cho thuê ổ cứng")
  .option("--json", "Xuất JSON máy-đọc")
  .action(async (opts: any) => {
    await cmdRegister(Boolean(opts.json));
  });

cli
  .command("storage-daemon")
  .description("Tiến trình nền lưu trữ: phục vụ/challenge và submit kết quả")
  .requiredOption("-s, --script <path>", "Đường dẫn script xử lý lưu trữ")
  .option("-m, --min-reward <lamports>", "Ngưỡng phần thưởng tối thiểu (lamports)", (v) => parseInt(v, 10))
  .option("-i, --interval-ms <ms>", "Khoảng thời gian quét (ms)", (v) => parseInt(v, 10), 15000)
  .option("--log-json", "Log sự kiện dạng JSON máy-đọc")
  .action(async (opts: any) => {
    await cmdDaemon({
      script: opts.script,
      minReward: Number(opts.minReward || 0),
      intervalMs: Number(opts.intervalMs || 15000),
      logJson: Boolean(opts.logJson),
    });
  });

cli
  .command("create-contract")
  .description("Tạo hợp đồng thuê lưu trữ: nạp escrow và lưu spec")
  .requiredOption("-r, --reward <lamports>", "Phần thưởng (lamports)", (v) => parseInt(v, 10))
  .option("-d, --details <textOrHex>", "Chi tiết hợp đồng (text hoặc hex SHA-256)")
  .option("-f, --spec-file <path>", "Đường dẫn file spec để băm SHA-256")
  .option("--json", "Xuất JSON máy-đọc")
  .action(async (opts: any) => {
    const reward = Number(opts.reward);
    let details: string | undefined = opts.details ? String(opts.details) : undefined;
    if (opts.specFile) {
      const buf = fs.readFileSync(String(opts.specFile));
      const hex = crypto.createHash("sha256").update(buf).digest("hex");
      details = hex;
    }
    if (!details) throw new Error("Cần -d details hoặc -f spec-file");
    await cmdCreateJob(reward, details);
  });

cli
  .command("verify-storage")
  .description("Xác minh việc lưu trữ: chấp nhận hoặc từ chối kết quả")
  .option("-d, --details <textOrHex>", "Chi tiết (text hoặc hex SHA-256)")
  .option("-f, --spec-file <path>", "File spec để tính SHA-256")
  .option("--accept", "Đánh dấu kết quả là đúng")
  .option("--reject", "Đánh dấu kết quả là sai")
  .option("--json", "Xuất JSON máy-đọc")
  .action(async (opts: any) => {
    let details: string | undefined = opts.details ? String(opts.details) : undefined;
    if (opts.specFile) {
      const buf = fs.readFileSync(String(opts.specFile));
      const hex = crypto.createHash("sha256").update(buf).digest("hex");
      details = hex;
    }
    if (!details) throw new Error("Cần -d details hoặc -f spec-file");
    const acceptFlag = opts.accept ? true : opts.reject ? false : true;
    await cmdVerifyJob(details, acceptFlag);
  });

cli
  .command("contract-status")
  .description("Xem trạng thái hợp đồng lưu trữ theo spec chi tiết")
  .option("-d, --details <textOrHex>", "Chi tiết (text hoặc hex SHA-256)")
  .option("-f, --spec-file <path>", "File spec để tính SHA-256")
  .option("--json", "Xuất JSON máy-đọc")
  .action(async (opts: any) => {
    let details: string | undefined = opts.details ? String(opts.details) : undefined;
    if (opts.specFile) {
      const buf = fs.readFileSync(String(opts.specFile));
      const hex = crypto.createHash("sha256").update(buf).digest("hex");
      details = hex;
    }
    if (!details) throw new Error("Cần -d details hoặc -f spec-file");
    await cmdJobStatus(details, Boolean(opts.json));
  });

cli
  .command("list-contracts")
  .description("Liệt kê các hợp đồng lưu trữ của ví hiện tại (mặc định)")
  .option("-a, --all", "Liệt kê tất cả hợp đồng của chương trình")
  .option("--json", "Xuất JSON máy-đọc")
  .action(async (opts: any) => {
    await cmdListJobs(Boolean(opts.all), Boolean(opts.json));
  });

cli.command("job-status")
  .description("Xem trạng thái job theo chi tiết (details)")
  .requiredOption("-d, --details <textOrHex>", "Chi tiết job (text hoặc hex 64 ký tự)")
  .option("--json", "Xuất JSON máy-đọc")
  .action(async (opts: any) => {
    await cmdJobStatus(String(opts.details), Boolean(opts.json));
  });

cli.command("list-jobs")
  .description("Liệt kê các job của ví hiện tại (mặc định)")
  .option("-a, --all", "Liệt kê tất cả job của chương trình")
  .option("--json", "Xuất JSON máy-đọc")
  .action(async (opts: any) => {
    await cmdListJobs(Boolean(opts.all), Boolean(opts.json));
  });

cli.addHelpText("after", `\nNhóm lệnh Provider:\n  register           Đăng ký node\n  daemon             Tiến trình nền nhận job\n  claim-payment      Yêu cầu thanh toán sau hạn verify\n\nNhóm lệnh Consumer:\n  create-job         Tạo job mới và nạp escrow\n  verify-job         Xác minh kết quả job\n  job-status         Xem trạng thái job\n  list-jobs          Liệt kê job của ví hiện tại hoặc tất cả\n\nNhóm alias Thuê ổ cứng:\n  offer-storage      Alias của register\n  storage-daemon     Alias của daemon\n  create-contract    Alias của create-job (hỗ trợ --spec-file)\n  verify-storage     Alias của verify-job (hỗ trợ --spec-file)\n  contract-status    Alias của job-status (hỗ trợ --spec-file)\n  list-contracts     Alias của list-jobs\n`);

// Lệnh nguyên gốc song song với alias
cli
  .command("create-job")
  .description("Tạo job mới và nạp escrow")
  .requiredOption("-r, --reward <lamports>", "Phần thưởng (lamports)", (v) => parseInt(v, 10))
  .requiredOption("-d, --details <textOrHex>", "Chi tiết job (text hoặc hex 64 ký tự)")
  .option("--json", "Xuất JSON máy-đọc")
  .action(async (opts: any) => {
    await cmdCreateJob(Number(opts.reward), String(opts.details), Boolean(opts.json));
  });

cli
  .command("verify-job")
  .description("Xác minh kết quả job")
  .requiredOption("-d, --details <textOrHex>", "Chi tiết job (text hoặc hex 64 ký tự)")
  .option("--accept", "Đánh dấu kết quả là đúng")
  .option("--reject", "Đánh dấu kết quả là sai")
  .option("--json", "Xuất JSON máy-đọc")
  .action(async (opts: any) => {
    const acceptFlag = opts.accept ? true : opts.reject ? false : true;
    await cmdVerifyJob(String(opts.details), acceptFlag, Boolean(opts.json));
  });

cli
  .command("claim-payment")
  .description("Yêu cầu thanh toán sau hạn verify")
  .requiredOption("-d, --details <textOrHex>", "Chi tiết job (text hoặc hex 64 ký tự)")
  .option("-r, --renter <base58>", "Public key của renter nếu không tự tìm được")
  .option("--json", "Xuất JSON máy-đọc")
  .action(async (opts: any) => {
    await cmdClaimPayment(String(opts.details), opts.renter ? String(opts.renter) : undefined, Boolean(opts.json));
  });

cli.parseAsync(process.argv);

async function cmdCreateJob(rewardLamports: number, details: string, outputJson: boolean = false) {
  const { program, Provider } = await loadProgram();
  const renter = (Provider.wallet as any).payer.publicKey as PublicKey;
  const jobDetails32 = toBytes32FromHexOrText(details);
  const jobAccount = deriveJobPda(program.programId, renter, jobDetails32);
  const escrow = deriveEscrowPda(program.programId, jobAccount);

  const tx = await (program as any).methods
    .create_job(rewardLamports, jobDetails32)
    .accounts({
      jobAccount,
      escrow,
      renter,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  if (outputJson) {
    console.log(
      JSON.stringify(
        {
          tx,
          jobAccount: jobAccount.toBase58(),
          escrow: escrow.toBase58(),
          renter: renter.toBase58(),
          rewardLamports: String(rewardLamports),
          detailsHex: toHex(jobDetails32),
        },
        null,
        2
      )
    );
    return;
  }
  console.log("Tạo job thành công. Tx:", tx);
  console.log("JobAccount:", jobAccount.toBase58());
  console.log("Escrow:", escrow.toBase58());
}

async function cmdVerifyJob(details: string, accept: boolean, outputJson: boolean = false) {
  const { program, Provider } = await loadProgram();
  const renter = (Provider.wallet as any).payer.publicKey as PublicKey;
  const jobDetails32 = toBytes32FromHexOrText(details);
  const jobAccount = deriveJobPda(program.programId, renter, jobDetails32);
  const escrow = deriveEscrowPda(program.programId, jobAccount);

  // Fetch job to get current provider
  let jobData: any;
  try {
    jobData = await (program as any).account.jobAccount.fetch(jobAccount);
  } catch (e) {
    throw new Error("Không tìm thấy JobAccount. Hãy kiểm tra chi tiết job hoặc renter.");
  }
  const providerPk = new PublicKey(jobData.provider);

  const tx = await (program as any).methods
    .verify_results(renter, jobDetails32, accept)
    .accounts({
      jobAccount,
      escrow,
      renter,
      provider: providerPk,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  if (outputJson) {
    console.log(
      JSON.stringify(
        {
          tx,
          jobAccount: jobAccount.toBase58(),
          renter: renter.toBase58(),
          provider: providerPk.toBase58(),
          decision: accept ? "accept" : "reject",
          detailsHex: toHex(jobDetails32),
        },
        null,
        2
      )
    );
    return;
  }
  console.log("Xác minh job thành công. Tx:", tx);
}

function statusToString(st: any): string {
  if (typeof st === "string") return st;
  if (typeof st === "number") {
    const map = ["Pending", "InProgress", "Completed", "PendingVerification"];
    return map[st] || `Unknown(${st})`;
  }
  if (st?.pending !== undefined) return "Pending";
  if (st?.inProgress !== undefined || st?.in_progress !== undefined) return "InProgress";
  if (st?.completed !== undefined) return "Completed";
  if (st?.pendingVerification !== undefined || st?.pending_verification !== undefined) return "PendingVerification";
  return "Unknown";
}

function fmtPubkey(pk: any): string {
  try {
    if (typeof pk === "string") return pk;
    return new PublicKey(pk).toBase58();
  } catch (_) {
    return String(pk);
  }
}

function toHex(arr: any): string {
  try {
    if (Buffer.isBuffer(arr)) return Buffer.from(arr).toString("hex");
    if (Array.isArray(arr)) return Buffer.from(arr).toString("hex");
    return String(arr);
  } catch (_) {
    return String(arr);
  }
}

async function cmdJobStatus(details: string, outputJson: boolean = false) {
  const { program, Provider } = await loadProgram();
  const renter = (Provider.wallet as any).payer.publicKey as PublicKey;
  const jobDetails32 = toBytes32FromHexOrText(details);
  const jobAccount = deriveJobPda(program.programId, renter, jobDetails32);

  let jobData: any;
  try {
    jobData = await (program as any).account.jobAccount.fetch(jobAccount);
  } catch (e) {
    throw new Error("Không tìm thấy JobAccount. Hãy kiểm tra chi tiết job hoặc renter.");
  }

  const status = statusToString(jobData.status);
  const rewardStr = jobData.reward?.toString ? jobData.reward.toString() : String(jobData.reward);
  const renterStr = fmtPubkey(jobData.renter);
  const providerStr = fmtPubkey(jobData.provider);
  const detailsHex = toHex(jobData.job_details || jobData.jobDetails);
  const resultsHex = toHex(jobData.results);
  const deadlineSec = jobData.verification_deadline?.toNumber
    ? jobData.verification_deadline.toNumber()
    : Number(jobData.verification_deadline || 0);
  const deadlineIso = deadlineSec ? new Date(deadlineSec * 1000).toISOString() : "0";
  const failedProvidersArr = Array.isArray(jobData.failed_providers)
    ? jobData.failed_providers.map((pk: any) => fmtPubkey(pk))
    : Array.isArray(jobData.failedProviders)
      ? jobData.failedProviders.map((pk: any) => fmtPubkey(pk))
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
}

async function cmdListJobs(all: boolean, outputJson: boolean = false) {
  const { program, Provider, idl } = await loadProgram();
  const coder = getAccountsCoder(idl);
  const me = (Provider.wallet as any).payer.publicKey.toBase58();
  const accounts = await program.provider.connection.getProgramAccounts(program.programId);
  const rows: Array<{ key: string; status: string; reward: string; renter: string; Provider: string }> = [];
  for (const acc of accounts) {
    const job = tryDecodeJob(coder, acc.account.data as Buffer);
    if (!job) continue;
    const renterStr = fmtPubkey(job.renter || job.renter?.toString());
    if (!all && renterStr !== me) continue;
    const status = statusToString(job.status);
    const rewardStr = job.reward?.toString ? job.reward.toString() : String(job.reward);
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
}

async function cmdClaimPayment(details: string, renterOpt?: string, outputJson: boolean = false) {
  const { program, Provider, idl } = await loadProgram();
  const authority = (Provider.wallet as any).payer.publicKey as PublicKey;
  const providerPda = deriveProviderPda(program.programId, authority);
  const jobDetails32 = toBytes32FromHexOrText(details);

  let renterPk: PublicKey | undefined = renterOpt ? new PublicKey(renterOpt) : undefined;
  let jobAccountPk: PublicKey | undefined;

  if (!renterPk) {
    const coder = getAccountsCoder(idl);
    const accounts = await program.provider.connection.getProgramAccounts(program.programId);
    for (const acc of accounts) {
      const job = tryDecodeJob(coder, acc.account.data as Buffer);
      if (!job) continue;
      const jd = (job.job_details || job.jobDetails) as number[];
      if (!jd || jd.length !== 32) continue;
      let match = true;
      for (let i = 0; i < 32; i++) {
        if (jd[i] !== jobDetails32[i]) { match = false; break; }
      }
      if (!match) continue;
      const providerStr = fmtPubkey(job.provider);
      if (providerStr !== authority.toBase58()) continue;
      renterPk = new PublicKey(job.renter || job.renter?.toString());
      jobAccountPk = acc.pubkey;
      break;
    }
  } else {
    jobAccountPk = deriveJobPda(program.programId, renterPk, jobDetails32);
  }

  if (!renterPk || !jobAccountPk) {
    throw new Error("Không tìm thấy job phù hợp để claim. Hãy cung cấp --renter hoặc đảm bảo details trùng khớp job của bạn.");
  }

  const escrowPda = deriveEscrowPda(program.programId, jobAccountPk);

  const tx = await (program as any).methods
    .claim_payment(renterPk, jobDetails32)
    .accounts({
      jobAccount: jobAccountPk,
      provider: providerPda,
      escrow: escrowPda,
      providerSigner: authority,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  if (outputJson) {
    console.log(
      JSON.stringify(
        {
          tx,
          jobAccount: jobAccountPk.toBase58(),
          renter: renterPk.toBase58(),
          Provider: authority.toBase58(),
          providerPda: providerPda.toBase58(),
          escrow: escrowPda.toBase58(),
          detailsHex: toHex(jobDetails32),
        },
        null,
        2
      )
    );
    return;
  }
  console.log("Claim payment thành công. Tx:", tx);
  console.log("Job:", jobAccountPk.toBase58());
}