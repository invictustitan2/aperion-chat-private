import { computeHash } from '@aperion/shared';
import { PolicyContext, Receipt } from './types';

const DESTRUCTIVE_ACTIONS = new Set([
  'delete_file',
  'overwrite_file',
  'execute_command',
  'delete_memory',
]);

export class ActionGate {
  static shouldExecuteAction(actionName: string, params: unknown, context: PolicyContext): Receipt {
    const inputsHash = computeHash({ actionName, params });

    if (DESTRUCTIVE_ACTIONS.has(actionName)) {
      if (context.userConfirmation !== true) {
        return {
          decision: 'deny',
          reasonCodes: ['DESTRUCTIVE_ACTION_REQUIRES_CONFIRMATION'],
          timestamp: Date.now(),
          inputsHash,
        };
      }
      return {
        decision: 'allow',
        reasonCodes: ['CONFIRMED_DESTRUCTIVE_ACTION'],
        timestamp: Date.now(),
        inputsHash,
      };
    }

    return {
      decision: 'allow',
      reasonCodes: ['SAFE_ACTION'],
      timestamp: Date.now(),
      inputsHash,
    };
  }
}
