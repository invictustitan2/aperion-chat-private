import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryStore } from '../src/in-memory-store';
import { EpisodicRecord, SemanticRecord, IdentityRecord } from '../src/types';
import { ImmutableError, ValidationError } from '../src/errors';
import { computeHash } from '../src/hash';

describe('InMemoryStore', () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  describe('Episodic Memory', () => {
    it('should store and retrieve episodic records', async () => {
      const record: EpisodicRecord = {
        id: 'uuid-1',
        createdAt: Date.now(),
        type: 'episodic',
        content: 'User said hello',
        provenance: {
          source_type: 'user',
          source_id: 'user-1',
          timestamp: Date.now(),
          confidence: 1.0,
        },
        hash: '',
      };
      record.hash = computeHash(record);

      await store.putEpisodic(record);
      const retrieved = await store.getEpisodic('uuid-1');
      expect(retrieved).toEqual(record);
    });

    it('should throw ImmutableError on duplicate ID', async () => {
      const record: EpisodicRecord = {
        id: 'uuid-1',
        createdAt: Date.now(),
        type: 'episodic',
        content: 'Original',
        provenance: {
          source_type: 'user',
          source_id: 'user-1',
          timestamp: Date.now(),
          confidence: 1.0,
        },
        hash: '',
      };
      record.hash = computeHash(record);

      await store.putEpisodic(record);

      const update = { ...record, content: 'Updated' };
      await expect(store.putEpisodic(update)).rejects.toThrow(ImmutableError);
    });
  });

  describe('Semantic Memory', () => {
    it('should store semantic records with references', async () => {
      const record: SemanticRecord = {
        id: 'sem-1',
        createdAt: Date.now(),
        type: 'semantic',
        content: 'User is friendly',
        references: ['uuid-1'],
        provenance: {
          source_type: 'model',
          source_id: 'model-1',
          timestamp: Date.now(),
          confidence: 0.8,
        },
        hash: '',
      };
      record.hash = computeHash(record);

      await store.putSemantic(record);
      const retrieved = await store.getSemantic('sem-1');
      expect(retrieved).toEqual(record);
    });

    it('should throw ValidationError if references are missing', async () => {
      const record: SemanticRecord = {
        id: 'sem-2',
        createdAt: Date.now(),
        type: 'semantic',
        content: 'Invalid',
        references: [], // Empty references
        provenance: {
          source_type: 'model',
          source_id: 'model-1',
          timestamp: Date.now(),
          confidence: 0.8,
        },
        hash: '',
      };
      record.hash = computeHash(record);

      await expect(store.putSemantic(record)).rejects.toThrow(ValidationError);
    });
  });

  describe('Identity Memory', () => {
    it('should store identity records with explicit confirmation', async () => {
      const record: IdentityRecord = {
        id: 'id-1',
        createdAt: Date.now(),
        type: 'identity',
        key: 'user_name',
        value: 'Dreamboat',
        provenance: {
          source_type: 'user',
          source_id: 'user-1',
          timestamp: Date.now(),
          confidence: 1.0,
        },
        hash: '',
      };
      record.hash = computeHash(record);

      await store.putIdentity(record, true);
      const retrieved = await store.getIdentity('user_name');
      expect(retrieved).toEqual(record);
    });

    it('should throw ValidationError without explicit confirmation', async () => {
      const record: IdentityRecord = {
        id: 'id-2',
        createdAt: Date.now(),
        type: 'identity',
        key: 'theme',
        value: 'dark',
        provenance: {
          source_type: 'user',
          source_id: 'user-1',
          timestamp: Date.now(),
          confidence: 1.0,
        },
        hash: '',
      };
      record.hash = computeHash(record);

      await expect(store.putIdentity(record, false)).rejects.toThrow(ValidationError);
    });
  });
});
