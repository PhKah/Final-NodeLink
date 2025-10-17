import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { NodeLink } from "../target/types/node_link";
import { Keypair, SystemProgram } from "@solana/web3.js";

describe("node-link", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.nodeLink as Program<NodeLink>;

  it("Registers a node", async () => {
    // Generate a new keypair for the authority.
    const authority = Keypair.generate();

    // Airdrop SOL to the authority to pay for the transaction.
    const airdropSignature = await provider.connection.requestAirdrop(
      authority.publicKey,
      1000000000
    );
    await provider.connection.confirmTransaction(airdropSignature);

    // Find the PDA for the node account.
    const [nodeAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("node"), authority.publicKey.toBuffer()],
      program.programId
    );

    // Call the register_node instruction.
    const tx = await program.methods
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
    const account = await program.account.nodeAccount.fetch(nodeAccount);
    console.log("Node account created:", account);

    // Assert that the authority is set correctly.
    if (!account.authority.equals(authority.publicKey)) {
      throw new Error("Authority does not match");
    }
  });
});
