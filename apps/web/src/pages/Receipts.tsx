import React from "react";
import { ReceiptsList } from "../components/ReceiptsList";

export function Receipts() {
  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Decision Receipts</h1>
        <p className="text-gray-400 text-sm">
          Audit log of AI policy decisions
        </p>
      </header>

      <ReceiptsList limit={20} />
    </div>
  );
}
