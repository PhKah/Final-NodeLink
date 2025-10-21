import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { NodeLink } from "../target/types/node_link";

module.exports = async function (provider: anchor.AnchorProvider) {
  anchor.setProvider(provider);

  const program = anchor.workspace.NodeLink as anchor.Program<NodeLink>;

  const [counterPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("counter")],
    program.programId
  );

  const counterAccount = await program.account.jobCounter.fetchNullable(counterPda);

  if (counterAccount === null) {
    console.log("Initializing JobCounter...");
    await program.methods
      .initializeCounter()
      .accounts({
        counter: counterPda,
        user: provider.wallet.publicKey, 
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();
    console.log("JobCounter initialized successfully!");
  } else {
    console.log("JobCounter already initialized. Skipping.");
  }
};