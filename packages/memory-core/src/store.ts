import { EpisodicRecord, IdentityRecord, SemanticRecord, UUID } from './types';

export interface MemoryStore {
  /**
   * Stores an episodic memory.
   * Throws if a record with the same ID already exists (append-only).
   */
  putEpisodic(record: EpisodicRecord): Promise<void>;

  /**
   * Retrieves an episodic memory by ID.
   */
  getEpisodic(id: UUID): Promise<EpisodicRecord | null>;

  /**
   * Stores a semantic memory.
   * Throws if references are empty.
   */
  putSemantic(record: SemanticRecord): Promise<void>;

  /**
   * Retrieves a semantic memory by ID.
   */
  getSemantic(id: UUID): Promise<SemanticRecord | null>;

  /**
   * Stores or updates an identity memory.
   * Requires explicit confirmation flag to be true.
   */
  putIdentity(record: IdentityRecord, confirmIdentityWrite: boolean): Promise<void>;

  /**
   * Retrieves an identity memory by key.
   */
  getIdentity(key: string): Promise<IdentityRecord | null>;
}
