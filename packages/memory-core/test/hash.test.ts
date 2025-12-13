import { describe, it, expect } from 'vitest';
import { canonicalize, computeHash, hashRunbookTask } from '@aperion/shared';

describe('Hashing Utilities', () => {
  describe('canonicalize', () => {
    it('should produce stable JSON for objects with different key orders', () => {
      const obj1 = { b: 2, a: 1, c: { y: 2, x: 1 } };
      const obj2 = { a: 1, c: { x: 1, y: 2 }, b: 2 };
      expect(canonicalize(obj1)).toBe(canonicalize(obj2));
    });

    it('should handle arrays', () => {
      const arr = [1, 2, 3];
      expect(canonicalize(arr)).toBe('[1,2,3]');
    });

    it('should handle nested structures', () => {
      const obj = { a: [ { z: 1, y: 2 } ] };
      expect(canonicalize(obj)).toBe('{"a":[{"y":2,"z":1}]}');
    });
  });

  describe('computeHash', () => {
    it('should produce SHA-256 hash', () => {
      const input = 'test';
      // echo -n "test" | sha256sum
      // 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
      expect(computeHash(input)).toBe('9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08');
    });

    it('should be consistent for objects', () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { b: 2, a: 1 };
      expect(computeHash(obj1)).toBe(computeHash(obj2));
    });
  });

  describe('hashRunbookTask', () => {
    it('should normalize whitespace', () => {
      const task1 = '  Deploy   to \n production  ';
      const task2 = 'Deploy to production';
      expect(hashRunbookTask(task1)).toBe(hashRunbookTask(task2));
    });
  });
});
