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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIdl = getIdl;
exports.getAnchorConfig = getAnchorConfig;
exports.getProgramId = getProgramId;
exports.getConnection = getConnection;
exports.getProvider = getProvider;
exports.getWallet = getWallet;
exports.getProgram = getProgram;
const web3_js_1 = require("@solana/web3.js");
const anchor_1 = require("@coral-xyz/anchor");
const fs = __importStar(require("fs/promises"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
// @ts-ignore
const toml_1 = __importDefault(require("toml"));
// @ts-ignore
let idl = null;
function getIdl() {
    return __awaiter(this, void 0, void 0, function* () {
        if (idl)
            return idl;
        idl = JSON.parse(yield fs.readFile('./target/idl/compute_share.json', 'utf-8'));
        return idl;
    });
}
let anchorConfig = null;
function getAnchorConfig() {
    return __awaiter(this, void 0, void 0, function* () {
        if (anchorConfig)
            return anchorConfig;
        const tomlPath = "./Anchor.toml";
        const tomlContent = yield fs.readFile(tomlPath, "utf-8");
        anchorConfig = toml_1.default.parse(tomlContent);
        return anchorConfig;
    });
}
let programId = null;
function getProgramId() {
    return __awaiter(this, void 0, void 0, function* () {
        if (programId)
            return programId;
        const config = yield getAnchorConfig();
        programId = new web3_js_1.PublicKey(config.programs.localnet.compute_share);
        return programId;
    });
}
const CLUSTER_URLS = {
    localnet: "http://127.0.0.1:8899",
    devnet: "https://api.devnet.solana.com",
    mainnet: "https://api.mainnet-beta.solana.com",
};
function getConnection() {
    return __awaiter(this, void 0, void 0, function* () {
        const config = yield getAnchorConfig();
        const clusterName = config.provider.cluster;
        const clusterUrl = CLUSTER_URLS[clusterName];
        if (!clusterUrl) {
            throw new Error(`Unknown cluster: ${clusterName}`);
        }
        return new web3_js_1.Connection(clusterUrl, "confirmed");
    });
}
function getProvider(wallet) {
    return __awaiter(this, void 0, void 0, function* () {
        const connection = yield getConnection();
        return new anchor_1.AnchorProvider(connection, wallet, anchor_1.AnchorProvider.defaultOptions());
    });
}
function getWallet(keypairPath) {
    return __awaiter(this, void 0, void 0, function* () {
        let pathToLoad = keypairPath;
        if (!pathToLoad) {
            const config = yield getAnchorConfig();
            const walletPath = config.provider.wallet;
            if (walletPath) {
                pathToLoad = walletPath.replace('~', os.homedir());
            }
        }
        if (!pathToLoad) {
            pathToLoad = path.join(os.homedir(), ".config", "solana", "id.json");
        }
        const keypairData = JSON.parse(yield fs.readFile(pathToLoad, "utf-8"));
        return web3_js_1.Keypair.fromSecretKey(new Uint8Array(keypairData));
    });
}
function getProgram(wallet) {
    return __awaiter(this, void 0, void 0, function* () {
        const provider = yield getProvider(wallet);
        const pId = yield getProgramId();
        const i = yield getIdl();
        return new anchor_1.Program(i, provider);
    });
}
