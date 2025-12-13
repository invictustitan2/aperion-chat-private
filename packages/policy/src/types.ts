export type Decision = 'allow' | 'deny' | 'defer';

export interface Receipt {
  decision: Decision;
  reasonCodes: string[];
  timestamp: number;
  inputsHash: string;
}

export interface PolicyContext {
  userConfirmation?: boolean;
  confidence?: number;
  recurrence?: boolean;
  [key: string]: unknown;
}
