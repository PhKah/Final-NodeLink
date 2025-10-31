import React from 'react';
import { Cpu, Clock, Zap, AlertCircle, CheckCircle, Power, PowerOff, Shield, ShieldOff } from 'lucide-react';
import * as anchor from '@coral-xyz/anchor';

// --- HELPER COMPONENTS ---

const ProviderStatusBadge = ({ providerAccount }) => {
  const now = Math.floor(Date.now() / 1000);
  const isBanned = providerAccount?.bannedUntil.toNumber() > now;

  let status, color, Icon;
  if (isBanned) {
    status = 'Banned';
    color = 'bg-red-500/20 text-red-400 border-red-500/30';
    Icon = ShieldOff;
  } else if (providerAccount?.status.available) {
    status = 'Available';
    color = 'bg-green-500/20 text-green-400 border-green-500/30';
    Icon = Shield;
  } else if (providerAccount?.status.busy) {
    status = 'Busy';
    color = 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    Icon = Zap;
  } else {
    status = 'Unknown';
    color = 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    Icon = AlertCircle;
  }

  return (
    <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-semibold ${color}`}>
      <Icon className="w-4 h-4" />
      <span>{status}</span>
    </div>
  );
};

const formatSol = (lamports) => {
  if (!lamports) return '0';
  return (lamports / anchor.web3.LAMPORTS_PER_SOL).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 9,
  });
};

const JobCard = ({ task, walletAddress, onClaim, onSubmit }) => {
  const getStatusInfo = (status) => {
    if (status.inProgress) return { text: 'In Progress', color: 'text-blue-400' };
    if (status.completed) return { text: 'Completed', color: 'text-gray-400' };
    if (status.pendingVerification) return { text: 'Pending Verification', color: 'text-purple-400' };
    return { text: 'Pending', color: 'text-yellow-400' };
  };

  const statusInfo = getStatusInfo(task.status);

  return (
    <div key={task.publicKey?.toString()} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 transition-all hover:border-white/20">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-4">
            <h3 className="text-xl font-bold text-white">{`Job #${task.jobId.toString()}`}</h3>
            <span className={`font-semibold ${statusInfo.color}`}>{statusInfo.text}</span>
          </div>
          <p className="text-gray-400 text-sm mt-1">Renter: {task.renter.toBase58()}</p>
          <div className="flex items-center flex-wrap gap-4 text-sm mt-3">
            <div className="flex items-center space-x-1 text-purple-400">
              <Cpu className="w-4 h-4" />
              <span>{task.hardwareTags}</span>
            </div>
            <div className="flex items-center space-x-1 text-cyan-400">
              <Clock className="w-4 h-4" />
              <span>Due: {new Date(task.submissionDeadline.toNumber() * 1000).toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-2xl font-bold text-green-400">{formatSol(task.reward)} SOL</div>
          <div className="mt-2">
            {task.status.inProgress && task.provider.equals(walletAddress) && (
              <button
                onClick={() => onSubmit(task)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-500 transition-colors w-full sm:w-auto"
              >
                Submit Results
              </button>
            )}
            {task.status.completed && task.provider.equals(walletAddress) && (
              <button
                onClick={() => onClaim(task)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-500 transition-colors w-full sm:w-auto"
              >
                Claim Payment
              </button>
            )}
             {task.status.pendingVerification && task.provider.equals(walletAddress) && (
               <div className="text-sm text-purple-400">Awaiting renter verification</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


// --- MAIN COMPONENT ---

export default function ProviderDashboard({
  walletAddress,
  providerAccount,
  tasks,
  onClaimPayment,
}) {

  const myAddress = new anchor.web3.PublicKey(walletAddress);
  const claimableJobs = tasks.filter(t => t.account.provider.equals(myAddress) && t.account.status.completed);

  return (
    <div className="space-y-8">
      {/* Claimable Jobs */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">Jobs to Claim Payment</h2>
        {claimableJobs.length > 0 ? (
          <div className="space-y-4">
            {claimableJobs.map(job => (
              <JobCard key={job.publicKey.toString()} task={job.account} walletAddress={myAddress} onClaim={onClaimPayment} />
            ))}
          </div>
        ) : (
          <div className="text-center py-10 bg-white/5 border-2 border-dashed border-white/10 rounded-2xl">
            <p className="text-gray-400">No payments to claim.</p>
          </div>
        )}
      </div>
    </div>
  );
}
