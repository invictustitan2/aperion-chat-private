export class MemoryWriteGate {
  static canWriteIdentity(confirmation: boolean): boolean {
    if (confirmation !== true) {
      throw new Error('Identity memory writes require explicit confirmation.');
    }
    return true;
  }
}
