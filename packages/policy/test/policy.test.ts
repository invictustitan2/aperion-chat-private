import { describe, it, expect } from 'vitest';
import { MemoryWriteGate } from '../src/memory-gate';
import { ActionGate } from '../src/action-gate';

describe('Policy Package', () => {
  describe('MemoryWriteGate', () => {
    it('should allow episodic writes by default', () => {
      const receipt = MemoryWriteGate.shouldWriteEpisodic({ content: 'hello' });
      expect(receipt.decision).toBe('allow');
      expect(receipt.reasonCodes).toContain('DEFAULT_ALLOW');
    });

    it('should defer semantic writes with low confidence', () => {
      const receipt = MemoryWriteGate.shouldWriteSemantic(
        { content: 'fact' },
        { confidence: 0.5, recurrence: true }
      );
      expect(receipt.decision).toBe('defer');
      expect(receipt.reasonCodes).toContain('LOW_CONFIDENCE');
    });

    it('should defer semantic writes without recurrence', () => {
      const receipt = MemoryWriteGate.shouldWriteSemantic(
        { content: 'fact' },
        { confidence: 0.9, recurrence: false }
      );
      expect(receipt.decision).toBe('defer');
      expect(receipt.reasonCodes).toContain('NO_RECURRENCE');
    });

    it('should allow semantic writes with high confidence and recurrence', () => {
      const receipt = MemoryWriteGate.shouldWriteSemantic(
        { content: 'fact' },
        { confidence: 0.8, recurrence: true }
      );
      expect(receipt.decision).toBe('allow');
    });

    it('should deny identity writes without explicit confirmation', () => {
      const receipt = MemoryWriteGate.shouldWriteIdentity(
        { key: 'name', value: 'User' },
        { userConfirmation: false }
      );
      expect(receipt.decision).toBe('deny');
      expect(receipt.reasonCodes).toContain('MISSING_CONFIRMATION');
    });

    it('should allow identity writes with explicit confirmation', () => {
      const receipt = MemoryWriteGate.shouldWriteIdentity(
        { key: 'name', value: 'User' },
        { userConfirmation: true }
      );
      expect(receipt.decision).toBe('allow');
      expect(receipt.reasonCodes).toContain('CONFIRMED');
    });
  });

  describe('ActionGate', () => {
    it('should deny destructive actions by default', () => {
      const receipt = ActionGate.shouldExecuteAction(
        'delete_file',
        { path: '/tmp/file' },
        {}
      );
      expect(receipt.decision).toBe('deny');
      expect(receipt.reasonCodes).toContain('DESTRUCTIVE_ACTION_REQUIRES_CONFIRMATION');
    });

    it('should allow destructive actions with confirmation', () => {
      const receipt = ActionGate.shouldExecuteAction(
        'delete_file',
        { path: '/tmp/file' },
        { userConfirmation: true }
      );
      expect(receipt.decision).toBe('allow');
      expect(receipt.reasonCodes).toContain('CONFIRMED_DESTRUCTIVE_ACTION');
    });

    it('should allow safe actions', () => {
      const receipt = ActionGate.shouldExecuteAction(
        'read_file',
        { path: '/tmp/file' },
        {}
      );
      expect(receipt.decision).toBe('allow');
      expect(receipt.reasonCodes).toContain('SAFE_ACTION');
    });
  });
});
