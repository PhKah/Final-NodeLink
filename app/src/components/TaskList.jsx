import React from 'react';
import { Cpu, Clock, CheckCircle, XCircle, AlertTriangle, RotateCw, PlusCircle } from 'lucide-react';
import * as anchor from '@coral-xyz/anchor';

// Helper to format lamports to SOL
const formatSol = (lamports) => {
  if (!lamports) return '0';
  return (lamports / anchor.web3.LAMPORTS_PER_SOL).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 9,
  });
};

// Helper to format the job status enum
const formatJobStatus = (status) => {
    if (status.pending) return { text: 'Pending', color: 'text-yellow-400', Icon: Clock };
    if (status.inProgress) return { text: 'In Progress', color: 'text-blue-400', Icon: RotateCw };
    if (status.pendingVerification) return { text: 'Pending Verification', color: 'text-purple-400', Icon: AlertTriangle };
    if (status.completed) return { text: 'Completed', color: 'text-green-400', Icon: CheckCircle };
    if (status.cancelled) return { text: 'Cancelled', color: 'text-gray-500', Icon: XCircle };
    return { text: 'Unknown', color: 'text-gray-400', Icon: AlertCircle };
};


export default function TaskList({ tasks, walletAddress, onCancelJob, onReclaimJob, onVerifyJob }) {
  const myTasks = tasks.filter(task => task.account.renter.toBase58() === walletAddress);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-white">My Created Tasks</h2>
        <button className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-cyan-500 text-white px-6 py-2 rounded-lg font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-300">
            <PlusCircle className="w-5 h-5"/>
            <span>Create New Job</span>
        </button>
      </div>
      
      {myTasks.length === 0 ? (
        <div className="text-center py-16 bg-white/5 border-2 border-dashed border-white/10 rounded-2xl">
            <p className="text-gray-400">You haven't created any tasks yet.</p>
        </div>
      ) : (
        myTasks.map(({ publicKey, account: task }) => {
          const { text: statusText, color: statusColor, Icon: StatusIcon } = formatJobStatus(task.status);
          return (
            <div key={publicKey.toString()} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 transition-all hover:border-white/20">
              <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-4">
                     <h3 className="text-xl font-bold text-white">{`Job #${task.jobId.toString()}`}</h3>
                     <div className={`flex items-center space-x-1.5 ${statusColor} font-semibold`}>
                        <StatusIcon className="w-5 h-5" />
                        <span>{statusText}</span>
                    </div>
                  </div>
                  <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-sm mt-3 text-gray-300">
                    <div className="flex items-center space-x-1.5">
                      <Cpu className="w-4 h-4 text-purple-400" />
                      <span>{task.hardwareTags}</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Clock className="w-4 h-4 text-cyan-400" />
                      <span>Deadline: {new Date(task.submissionDeadline.toNumber() * 1000).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end flex-shrink-0">
                  <div className="text-2xl font-bold text-green-400">{formatSol(task.reward)} SOL</div>
                  <div className="flex flex-wrap justify-end gap-2 mt-4">
                    {task.status.pending && (
                      <button
                        onClick={() => onCancelJob({ publicKey, account: task })}
                        className="bg-red-600/80 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors text-sm font-semibold"
                      >
                        Cancel Job
                      </button>
                    )}
                    {task.status.inProgress && (
                      <button
                        onClick={() => onReclaimJob({ publicKey, account: task })}
                        className="bg-yellow-600/80 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg transition-colors text-sm font-semibold"
                      >
                        Reclaim Job
                      </button>
                    )}
                    {task.status.pendingVerification && (
                      <>
                        <button
                          onClick={() => onVerifyJob({ publicKey, account: task }, true)}
                          className="bg-green-600/80 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-1 text-sm font-semibold"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Accept
                        </button>
                        <button
                          onClick={() => onVerifyJob({ publicKey, account: task }, false)}
                          className="bg-red-600/80 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-1 text-sm font-semibold"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  );
}
