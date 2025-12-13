import { BaseRecord } from '@aperion/shared';

export interface EpisodicRecord extends BaseRecord {
  content: string;
  provenance: string;
}

export class MemoryStore {
  static createEpisodic(content: string, provenance: string): Readonly<EpisodicRecord> {
    const record: EpisodicRecord = {
      id: crypto.randomUUID(),
      createdAt: new Date(),
      content,
      provenance,
    };
    return Object.freeze(record);
  }
}
