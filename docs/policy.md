# Policy & Governance

The `policy` package acts as the "Superego" of the Aperion system. It enforces rules and invariants to ensure safety, privacy, and data quality.

## Philosophy

1.  **Safety First**: Destructive actions are denied by default.
2.  **Explicit Consent**: Changes to identity or high-stakes memory require explicit user confirmation.
3.  **Quality Control**: Semantic memory (knowledge) is only finalized when confidence is high and patterns recur.
4.  **Auditability**: Every decision produces a `Receipt` containing the decision, reasons, timestamp, and input hash.

## Gates

### MemoryWriteGate

Controls writes to the memory system.

| Memory Type | Rule | Reason |
| :--- | :--- | :--- |
| **Episodic** | `DEFAULT_ALLOW` | Raw experience is always recorded. |
| **Semantic** | `CONFIDENCE > 0.7` AND `RECURRENCE` | Only high-quality, verified facts become knowledge. |
| **Identity** | `EXPLICIT_CONFIRMATION` | Core beliefs and user traits are sacred. |

### ActionGate

Controls tool execution.

| Action Type | Rule | Example |
| :--- | :--- | :--- |
| **Safe** | `DEFAULT_ALLOW` | `read_file`, `search`, `calculate` |
| **Destructive** | `EXPLICIT_CONFIRMATION` | `delete_file`, `execute_command`, `delete_memory` |

## Receipt Model

Every policy decision returns a receipt:

```typescript
interface Receipt {
  decision: 'allow' | 'deny' | 'defer';
  reasonCodes: string[];
  timestamp: number;
  inputsHash: string;
}
```

This receipt can be logged for audit trails or used to explain refusals to the user.
