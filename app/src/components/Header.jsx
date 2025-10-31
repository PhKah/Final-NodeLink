import React, { useState } from 'react';
import { Cloud, Wallet, Check, ChevronDown, LogOut } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';

export default function Header({
  userRole,
  setUserRole,
  walletConnected,
  walletAddress,
  solBalance,
  onConnect,
}) {
  const { disconnect } = useWallet();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleUserRoleChange = (e) => {
    setUserRole(e.target.value);
  };

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <nav className="relative border-b border-white/10 backdrop-blur-xl bg-black/20">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-br from-purple-500 to-cyan-500 p-2 rounded-xl">
              <Cloud className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
              Compute Share
            </span>
          </div>
          
          <div className="flex items-center space-x-4">
            <select 
              value={userRole}
              onChange={handleUserRoleChange}
              className="bg-white/10 text-white px-4 py-2 rounded-lg border border-white/20 focus:outline-none focus:border-purple-500"
              disabled={!walletConnected}
            >
              <option value="requester">Task Requester</option>
              <option value="provider">Compute Provider</option>
            </select>
            
            {walletConnected ? (
              <div className="relative">
                <button 
                  onClick={() => setDropdownOpen(prev => !prev)}
                  className="flex items-center space-x-2 bg-green-500/20 border border-green-500/30 px-4 py-2 rounded-lg"
                >
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-green-400 font-mono text-sm">{formatAddress(walletAddress)}</span>
                  <ChevronDown className="w-4 h-4 text-green-400" />
                </button>
                {dropdownOpen && (
                  <div className="absolute top-full right-0 mt-2 w-56 bg-gray-800 border border-white/10 rounded-lg shadow-lg z-10">
                    <div className="p-3 border-b border-white/10">
                      <p className="text-sm text-gray-300">Balance</p>
                      <p className="font-semibold text-white">{solBalance.toFixed(4)} SOL</p>
                    </div>
                    <button 
                      onClick={() => { disconnect(); setDropdownOpen(false); }}
                      className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
                    >
                      <LogOut className="w-4 h-4" />
                      Disconnect
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button 
                onClick={onConnect}
                className="flex items-center space-x-2 px-6 py-2 rounded-lg font-semibold transition-all duration-300 bg-gradient-to-r from-purple-500 to-cyan-500 text-white hover:shadow-lg hover:shadow-purple-500/50"
              >
                <Wallet className="w-5 h-5" />
                <span>Connect Wallet</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
