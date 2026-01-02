import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { api, ReceiptRecord } from "../lib/api";
import { clsx } from "clsx";

export type ReceiptsListProps = {
  limit?: number;
  since?: number;
  compact?: boolean;
  className?: string;
};

export function ReceiptsList({
  limit = 20,
  since = 0,
  compact = false,
  className,
}: ReceiptsListProps) {
  const receiptsQuery = useQuery({
    queryKey: ["receipts", limit, since],
    queryFn: () => api.receipts.list(limit, since),
  });

  if (receiptsQuery.isLoading) {
    return <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />;
  }

  if (receiptsQuery.error) {
    return (
      <div className="text-red-400 flex items-center gap-2">
        <AlertCircle className="w-4 h-4" />
        Error: {receiptsQuery.error.message}
      </div>
    );
  }

  if ((receiptsQuery.data?.length ?? 0) === 0) {
    return <p className="text-gray-500 italic">No receipts found.</p>;
  }

  const rows = receiptsQuery.data as ReceiptRecord[];

  return (
    <div className={clsx("grid gap-3", className)}>
      {rows.map((receipt) => (
        <div
          key={receipt.id}
          className={clsx(
            "bg-gray-800 border border-gray-700 rounded-lg",
            compact ? "p-3" : "p-4",
            "flex flex-col gap-3",
          )}
        >
          <div className="flex items-start gap-3">
            <div className="mt-1">
              {receipt.allowed ? (
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
            </div>
            <div className="min-w-0">
              <div className="font-medium text-gray-200">
                {receipt.allowed ? "ALLOWED" : "DENIED"}
              </div>
              <div className="text-sm text-gray-400 mt-1">
                {new Date(receipt.timestamp).toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 font-mono mt-1 break-all">
                ID: {receipt.id}
              </div>
            </div>
          </div>

          <div className="flex gap-6 text-sm border-t border-gray-700 pt-3">
            <div className="min-w-0">
              <div className="text-gray-500 text-xs uppercase tracking-wider">
                Action
              </div>
              <div className="font-mono text-emerald-400 break-all">
                {receipt.action}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-gray-500 text-xs uppercase tracking-wider">
                Reason
              </div>
              <div
                className={clsx(
                  "font-mono text-gray-300",
                  compact ? "truncate" : "break-words",
                )}
                title={receipt.reason}
              >
                {receipt.reason || "N/A"}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
