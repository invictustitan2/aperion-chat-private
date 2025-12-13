import { describe, it, expect } from 'vitest';
import { MemoryStore } from '../src/episodic';

describe('MemoryStore', () => {
  it('should create an immutable episodic record', () => {
    const record = MemoryStore.createEpisodic('test content', 'user-input');
    
    expect(record.content).toBe('test content');
    expect(record.provenance).toBe('user-input');
    expect(record.id).toBeDefined();
    
    // Verify immutability
    expect(Object.isFrozen(record)).toBe(true);
    
    // TypeScript will prevent this at compile time, but we check runtime behavior
    expect(() => {
      // @ts-expect-error Testing runtime immutability
      record.content = 'modified';
    }).toThrow();
  });
});
