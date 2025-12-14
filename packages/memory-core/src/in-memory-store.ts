import { MemoryStore } from "./store";
import { EpisodicRecord, IdentityRecord, SemanticRecord, UUID } from "./types";
import { ImmutableError, ValidationError } from "./errors";

export class InMemoryStore implements MemoryStore {
  private episodic = new Map<UUID, EpisodicRecord>();
  private semantic = new Map<UUID, SemanticRecord>();
  private identity = new Map<string, IdentityRecord>(); // Keyed by identity key, not ID

  async putEpisodic(record: EpisodicRecord): Promise<void> {
    if (this.episodic.has(record.id)) {
      throw new ImmutableError(
        `Episodic record with ID ${record.id} already exists.`,
      );
    }
    this.episodic.set(record.id, record);
  }

  async getEpisodic(id: UUID): Promise<EpisodicRecord | null> {
    return this.episodic.get(id) || null;
  }

  async putSemantic(record: SemanticRecord): Promise<void> {
    if (!record.references || record.references.length === 0) {
      throw new ValidationError(
        "Semantic records must reference at least one episodic record.",
      );
    }
    // In a real store, we might verify that the referenced records exist.
    // For now, we just check the array is present and non-empty.
    this.semantic.set(record.id, record);
  }

  async getSemantic(id: UUID): Promise<SemanticRecord | null> {
    return this.semantic.get(id) || null;
  }

  async putIdentity(
    record: IdentityRecord,
    confirmIdentityWrite: boolean,
  ): Promise<void> {
    if (confirmIdentityWrite !== true) {
      throw new ValidationError(
        "Identity writes require explicit confirmation flag.",
      );
    }
    this.identity.set(record.key, record);
  }

  async getIdentity(key: string): Promise<IdentityRecord | null> {
    return this.identity.get(key) || null;
  }
}
