import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, CheckCircle, XCircle } from 'lucide-react';
import { api, Receipt } from '../lib/api';
import clsx from 'clsx';

export function Receipts() {
  const { data: receipts, isLoading, error } = useQuery({
    queryKey: ['receipts'],
    queryFn: api.receipts.list,
  });

  if (isLoading) return <div>Loading receipts...</div>;
  if (error) return <div className="text-red-400">Error loading receipts: {error.message}</div>;

  const sortedReceipts = [...(receipts || [])].sort((a: Receipt, b: Receipt) => b.timestamp - a.timestamp);

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Shield className="text-blue-400" />
        Policy Receipts
      </h2>

      <div className="space-y-4">
        {sortedReceipts.length === 0 ? (
          <div className="text-gray-500">No receipts found.</div>
        ) : (
          sortedReceipts.map((receipt: Receipt) => (
            <div 
              key={receipt.id}
              className="bg-gray-800 rounded-lg p-4 border border-gray-700 flex items-start gap-4"
            >
              <div className="mt-1">
                {receipt.allowed ? (
                  <CheckCircle className="text-green-500" size={24} />
                ) : (
                  <XCircle className="text-red-500" size={24} />
                )}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-medium text-lg">{receipt.action}</h3>
                    <div className="text-sm text-gray-400 font-mono">{receipt.id}</div>
                  </div>
                  <div className="text-sm text-gray-400">
                    {new Date(receipt.timestamp).toLocaleString()}
                  </div>
                </div>
                
                {receipt.reason && (
                  <div className="bg-gray-900/50 p-2 rounded text-sm text-gray-300 mb-2">
                    Reason: {receipt.reason}
                  </div>
                )}
                
                <div className="text-xs text-gray-500 font-mono">
                  Decision: {receipt.allowed ? 'ALLOWED' : 'DENIED'}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
