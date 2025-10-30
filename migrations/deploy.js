var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
module.exports = function (provider) {
    return __awaiter(this, void 0, void 0, function* () {
        anchor.setProvider(provider);
        const program = anchor.workspace.NodeLink;
        const [counterPda] = PublicKey.findProgramAddressSync([Buffer.from("counter")], program.programId);
        const counterAccount = yield program.account.jobCounter.fetchNullable(counterPda);
        if (counterAccount === null) {
            console.log("Initializing JobCounter...");
            yield program.methods
                .initializeCounter()
                .accounts({
                counter: counterPda,
                user: provider.wallet.publicKey,
                systemProgram: SystemProgram.programId,
            })
                .rpc();
            console.log("JobCounter initialized successfully!");
        }
        else {
            console.log("JobCounter already initialized. Skipping.");
        }
    });
};
