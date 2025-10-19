/*
  Example provider script for NodeLink storage-daemon.
  - Reads job metadata from environment variables (NL_*)
  - Produces a payload to stdout; daemon will SHA-256 hash stdout and submit
  - Logs helpful context to stderr (not included in payload)
*/

const fs = require('fs');
const crypto = require('crypto');

function sha256Hex(input) {
  const h = crypto.createHash('sha256');
  if (Buffer.isBuffer(input)) h.update(input);
  else h.update(String(input));
  return h.digest('hex');
}

function safeReadFile(path) {
  try {
    if (!path) return null;
    return fs.readFileSync(path);
  } catch (_) {
    return null;
  }
}

const {
  NL_JOB_ACCOUNT,
  NL_RENTER,
  NL_DETAILS_HEX,
  NL_JOB_REWARD_LAMPORTS,
  NL_ESCROW_BALANCE,
  NL_ESCROW_PDA,
  NL_MIN_REWARD,
  NL_PROVIDER,
  NL_PROVIDER_PDA,
  NL_PROGRAM_ID,
  // Optional extras for custom proof composition
  NL_CHUNK_PATH,
  NL_PROOF_SALT,
} = process.env;

try {
  const chunkBuf = safeReadFile(NL_CHUNK_PATH);
  const chunkDigest = chunkBuf ? sha256Hex(chunkBuf) : '';

  // Compose a simple deterministic seed from available metadata
  const seed = [NL_DETAILS_HEX || '', chunkDigest, NL_PROOF_SALT || ''].join('|');

  // Our script payload (stdout). Keep it simple and compact.
  const payloadHex = sha256Hex(seed);

  // Log context to stderr for debugging/observability (daemon ignores stderr)
  console.error(
    JSON.stringify(
      {
        jobAccount: NL_JOB_ACCOUNT,
        renter: NL_RENTER,
        detailsHex: NL_DETAILS_HEX,
        rewardLamports: NL_JOB_REWARD_LAMPORTS,
        escrowBalance: NL_ESCROW_BALANCE,
        escrowPda: NL_ESCROW_PDA,
        minReward: NL_MIN_REWARD,
        provider: NL_PROVIDER,
        providerPda: NL_PROVIDER_PDA,
        programId: NL_PROGRAM_ID,
        chunkPath: NL_CHUNK_PATH,
        chunkDigest,
        payloadPreview: `${payloadHex.slice(0, 16)}...`,
      },
      null,
      2,
    ),
  );

  // IMPORTANT: Only write the payload to stdout.
  process.stdout.write(payloadHex);
} catch (e) {
  console.error('script_error', e && e.message ? e.message : String(e));
  process.exit(1);
}