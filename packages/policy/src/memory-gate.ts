import { computeHash } from '@aperion/shared';
import { PolicyContext, Receipt } from './types';

export class MemoryWriteGate {
  static shouldWriteEpisodic(input: unknown): Receipt {
    return {
      decision: 'allow',
      reasonCodes: ['DEFAULT_ALLOW'],
      timestamp: Date.now(),
      inputsHash: computeHash(input),
    };
  }

  static shouldWriteSemantic(input: unknown, context: PolicyContext): Receipt {
    const reasons: string[] = [];
    const confidence = context.confidence ?? 0;
    const recurrence = context.recurrence ?? false;

    if (confidence < 0.7) {
      reasons.push('LOW_CONFIDENCE');
    }
    if (!recurrence) {
      reasons.push('NO_RECURRENCE');
    }

    if (reasons.length > 0) {
      return {
        decision: 'defer',
        reasonCodes: reasons,
        timestamp: Date.now(),
        inputsHash: computeHash(input),
      };
    }

    return {
      decision: 'allow',
      reasonCodes: ['CONFIDENCE_MET', 'RECURRENCE_VERIFIED'],
      timestamp: Date.now(),
      inputsHash: computeHash(input),
    };
  }

  static shouldWriteIdentity(input: unknown, context: PolicyContext): Receipt {
    if (context.userConfirmation !== true) {
      return {
        decision: 'deny',
        reasonCodes: ['MISSING_CONFIRMATION'],
        timestamp: Date.now(),
        inputsHash: computeHash(input),
      };
    }

    return {
      decision: 'allow',
      reasonCodes: ['CONFIRMED'],
      timestamp: Date.now(),
      inputsHash: computeHash(input),
    };
  }
}
