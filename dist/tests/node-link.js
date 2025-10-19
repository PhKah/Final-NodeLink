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
/// <reference types="mocha" />
const anchor = __importStar(require("@coral-xyz/anchor"));
/* Generated types not found locally; omit the import and use a generic Program<any> below */
const web3_js_1 = require("@solana/web3.js");
describe("node-link", () => {
    // Configure the client to use the local cluster.
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.nodeLink;
    it("Registers a node", () => __awaiter(void 0, void 0, void 0, function* () {
        // Generate a new keypair for the authority.
        const authority = web3_js_1.Keypair.generate();
        // Airdrop SOL to the authority to pay for the transaction.
        yield provider.connection.requestAirdrop(authority.publicKey, 1000000000);
        // Find the PDA for the node account.
        const [nodeAccount] = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from("node"), authority.publicKey.toBuffer()], program.programId);
        // Call the register_node instruction.
        const tx = yield program.methods
            .registerNode()
            .accounts({
            nodeAccount,
            authority: authority.publicKey,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .signers([authority])
            .rpc();
        console.log("Your transaction signature", tx);
        // Fetch the created account.
        const account = yield program.account.nodeAccount.fetch(nodeAccount);
        console.log("Node account created:", account);
        // Assert that the authority is set correctly.
        if (!account.authority.equals(authority.publicKey)) {
            throw new Error("Authority does not match");
        }
    }));
});
