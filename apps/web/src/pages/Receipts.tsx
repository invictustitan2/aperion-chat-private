import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { api } from "../lib/api";

export function Receipts() {
  const receiptsQuery = useQuery({
    queryKey: ["receipts"],
    queryFn: () => api.receipts.list(20),
  });

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Decision Receipts</h1>
        <p className="text-gray-400 text-sm">
          Audit log of AI policy decisions
        </p>
      </header>

      <div className="space-y-4">
        {receiptsQuery.isLoading ? (
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        ) : receiptsQuery.error ? (
          <div className="text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Error: {receiptsQuery.error.message}
          </div>
        ) : receiptsQuery.data?.length === 0 ? (
          <p className="text-gray-500 italic">No receipts found.</p>
        ) : (
          <div className="grid gap-4">
            {receiptsQuery.data?.map((receipt) => (
              <div
                key={receipt.id}
                className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex flex-col md:flex-row gap-4 md:items-center justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {receipt.allowed ? (
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-gray-200">
                      {receipt.allowed ? "ALLOWED" : "DENIED"}
                    </div>
                    <div className="text-sm text-gray-400 mt-1">
                      {new Date(receipt.timestamp).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 font-mono mt-1">
                      ID: {receipt.id}
                    </div>
                  </div>
                </div>

                <div className="flex gap-6 text-sm border-t md:border-t-0 border-gray-700 pt-3 md:pt-0">
                  <div>
                    <div className="text-gray-500 text-xs uppercase tracking-wider">
                      Action
                    </div>
                    <div className="font-mono text-emerald-400">
                      {receipt.action}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs uppercase tracking-wider">
                      Reason
                    </div>
                    <div
                      className="font-mono text-gray-300 max-w-xs truncate"
                      title={receipt.reason}
                    >
                      {receipt.reason || "N/A"}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
