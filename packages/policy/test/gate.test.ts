import { describe, it, expect } from 'vitest';
import { MemoryWriteGate } from '../src/gate';

describe('MemoryWriteGate', () => {
  it('should allow write with explicit confirmation', () => {
    expect(MemoryWriteGate.canWriteIdentity(true)).toBe(true);
  });

  it('should throw error without explicit confirmation', () => {
    expect(() => MemoryWriteGate.canWriteIdentity(false)).toThrow('Identity memory writes require explicit confirmation.');
  });
});
