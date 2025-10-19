/// <reference types="mocha" />
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
/* Generated types not found locally; omit the import and use a generic Program<any> below */
import { Keypair, SystemProgram } from "@solana/web3.js";

describe("node-link", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.nodeLink as Program<any>;

  it("Registers a node", async () => {
    // Generate a new keypair for the authority.
    const authority = Keypair.generate();

    // Airdrop SOL to the authority to pay for the transaction.
    await provider.connection.requestAirdrop(authority.publicKey, 1000000000);

    // Find the PDA for the node account.
    const [nodeAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("node"), authority.publicKey.toBuffer()],
      program.programId
    );

    // Call the register_node instruction.
    const tx = await (program as any).methods
      .registerNode()
      .accounts({
        nodeAccount,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    console.log("Your transaction signature", tx);

    // Fetch the created account.
    const account = await (program as any).account.nodeAccount.fetch(nodeAccount);
    console.log("Node account created:", account);

    // Assert that the authority is set correctly.
    if (!account.authority.equals(authority.publicKey)) {
      throw new Error("Authority does not match");
    }
  });
});