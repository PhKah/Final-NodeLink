import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from './components/Header';
import ProviderDashboard from './components/ProviderDashboard';
import TaskList from './components/TaskList';
import { AlertCircle } from 'lucide-react';
import * as anchor from '@coral-xyz/anchor';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { getIdl, getProgramId } from '../../client/common.ts';

function App() {
  const [userRole, setUserRole] = useState('provider');
  const [program, setProgram] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [providerAccount, setProviderAccount] = useState(null);
  const [solBalance, setSolBalance] = useState(0);

  const { connection } = useConnection();
  const { connected, publicKey, wallet } = useWallet();
  const { setVisible } = useWalletModal();

  const walletAddress = useMemo(() => publicKey?.toBase58(), [publicKey]);

  // --- Program Initialization ---
  useEffect(() => {
    const initializeProgram = async () => {
      if (wallet && connected && connection) {
        const provider = new anchor.AnchorProvider(connection, wallet.adapter, anchor.AnchorProvider.defaultOptions());
        const idl = await getIdl();
        const programId = await getProgramId();
        const program = new anchor.Program(idl, programId, provider);
        setProgram(program);
      } else {
        setProgram(null);
      }
    };
    initializeProgram();
  }, [wallet, connected, connection]);

  // --- On-Chain Data Fetching ---
  const fetchOnChainData = useCallback(async () => {
    if (!program || !publicKey) return;

    try {
      // Fetch balance
      const balance = await connection.getBalance(publicKey);
      setSolBalance(balance / anchor.web3.LAMPORTS_PER_SOL);

      // Fetch all job accounts
      const jobAccounts = await program.account.jobAccount.all();
      setTasks(jobAccounts);

      // If user is a provider, fetch their provider account
      if (userRole === 'provider') {
        const [providerPda] = anchor.web3.PublicKey.findProgramAddressSync(
          [Buffer.from("provider"), publicKey.toBuffer()],
          program.programId
        );
        const account = await program.account.provider.fetch(providerPda);
        setProviderAccount(account);
      }
    } catch (error) {
      console.error("Error fetching on-chain data:", error);
      if (error.message.includes("Account does not exist")) {
        setProviderAccount(null);
      }
    }
  }, [program, publicKey, userRole, connection]);

  useEffect(() => {
    if (program) {
      fetchOnChainData();
      const interval = setInterval(fetchOnChainData, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [program, fetchOnChainData]);

  // --- Action Handlers ---
  const handleConnect = () => {
    setVisible(true);
  };

  const handleClaimPayment = useCallback(async (task) => {
    if (!program || !publicKey) return;
    console.log("Claiming payment for job:", task.jobId.toString());

    try {
      const [jobPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("job"), new anchor.BN(task.jobId).toArrayLike(Buffer, 'le', 8)],
        program.programId
      );

      const [escrowPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), jobPda.toBuffer()],
        program.programId
      );

      const [providerAccountPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("provider"), publicKey.toBuffer()],
        program.programId
      );

      const tx = await program.methods
        .claimPayment(task.jobId)
        .accounts({
          jobAccount: jobPda,
          escrow: escrowPda,
          provider: publicKey,
          providerAccount: providerAccountPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      console.log("Claim payment transaction success!", tx);
      alert(`Successfully claimed payment for job ${task.jobId.toString()}!`);
      fetchOnChainData(); // Refresh data
    } catch (error) {
      console.error("Failed to claim payment:", error);
      alert(`Error claiming payment: ${error.message}`);
    }
  }, [program, publicKey, fetchOnChainData]);

  // ... other handlers are placeholders ...

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Header 
        userRole={userRole}
        setUserRole={setUserRole}
        walletConnected={connected}
        walletAddress={walletAddress}
        solBalance={solBalance}
        onConnect={handleConnect}
      />
      <main className="max-w-7xl mx-auto px-6 py-8">
        {!connected ? (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-6 mb-8">
            <div className="flex items-start space-x-4">
              <AlertCircle className="w-6 h-6 text-yellow-400 mt-1" />
              <div>
                <h4 className="text-yellow-400 font-semibold text-lg mb-2">Connect Your Wallet</h4>
                <p className="text-gray-300">Please connect your wallet to view and manage tasks.</p>
              </div>
            </div>
          </div>
        ) : userRole === 'provider' ? (
          <ProviderDashboard 
            walletAddress={walletAddress}
            providerAccount={providerAccount}
            tasks={tasks}
            onClaimPayment={handleClaimPayment}
          />
        ) : (
          <TaskList 
            tasks={tasks}
            walletAddress={walletAddress}
            // onCancelJob={handleCancelJob}
            // onReclaimJob={handleReclaimJob}
            // onVerifyJob={handleVerifyJob}
          />
        )}
      </main>
    </div>
  );
}

export default App;
