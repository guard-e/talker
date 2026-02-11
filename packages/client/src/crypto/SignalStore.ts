import {
  StorageType,
  Direction,
  SessionRecordType,
  KeyPairType,
  PreKeyPairType,
  SignedPreKeyPairType
} from '@privacyresearch/libsignal-protocol-typescript';

export class InMemorySignalProtocolStore implements StorageType {
  private identityKeyPair: KeyPairType | undefined;
  private localRegistrationId: number | undefined;
  private preKeys: Map<string | number, KeyPairType> = new Map();
  private signedPreKeys: Map<string | number, KeyPairType> = new Map();
  private sessions: Map<string, SessionRecordType> = new Map();
  private identityKeys: Map<string, ArrayBuffer> = new Map();

  constructor() {}

  async getIdentityKeyPair(): Promise<KeyPairType | undefined> {
    return this.identityKeyPair;
  }

  async getLocalRegistrationId(): Promise<number | undefined> {
    return this.localRegistrationId;
  }

  // Note: StorageType definition might use saveIdentity with 2 or 3 args
  // saveIdentity: (encodedAddress: string, publicKey: ArrayBuffer, nonblockingApproval?: boolean) => Promise<boolean>;
  async saveIdentity(encodedAddress: string, publicKey: ArrayBuffer, nonblockingApproval?: boolean): Promise<boolean> {
    const existing = this.identityKeys.get(encodedAddress);
    this.identityKeys.set(encodedAddress, publicKey);
    // Return true if replaced? Or true if trusted? 
    // Usually return true if new or same.
    return true; 
  }

  async isTrustedIdentity(identifier: string, identityKey: ArrayBuffer, direction: Direction): Promise<boolean> {
    return true; 
  }

  async loadPreKey(keyId: string | number): Promise<KeyPairType | undefined> {
    return this.preKeys.get(keyId);
  }

  async storePreKey(keyId: string | number, keyPair: KeyPairType): Promise<void> {
    this.preKeys.set(keyId, keyPair);
  }

  async removePreKey(keyId: string | number): Promise<void> {
    this.preKeys.delete(keyId);
  }

  async loadSignedPreKey(keyId: string | number): Promise<KeyPairType | undefined> {
    return this.signedPreKeys.get(keyId);
  }

  async storeSignedPreKey(keyId: string | number, keyPair: KeyPairType): Promise<void> {
    this.signedPreKeys.set(keyId, keyPair);
  }

  async removeSignedPreKey(keyId: string | number): Promise<void> {
    this.signedPreKeys.delete(keyId);
  }

  async loadSession(identifier: string): Promise<SessionRecordType | undefined> {
    return this.sessions.get(identifier);
  }

  async storeSession(identifier: string, record: SessionRecordType): Promise<void> {
    this.sessions.set(identifier, record);
  }

  async removeSession(identifier: string): Promise<void> {
    this.sessions.delete(identifier);
  }
  
  // Custom helper not in interface
  async putIdentityKeyPair(identityKeyPair: KeyPairType): Promise<void> {
    this.identityKeyPair = identityKeyPair;
  }

  async putLocalRegistrationId(registrationId: number): Promise<void> {
    this.localRegistrationId = registrationId;
  }

  // Custom method to clear all stored data
  async clear(): Promise<void> {
    this.identityKeyPair = undefined;
    this.localRegistrationId = undefined;
    this.preKeys.clear();
    this.signedPreKeys.clear();
    this.sessions.clear();
    this.identityKeys.clear();
  }
}
