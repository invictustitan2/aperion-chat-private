export type UUID = string;

export interface BaseRecord {
  id: UUID;
  createdAt: Date;
}

export * from "./hash.js";
