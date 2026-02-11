import {
  KeyHelper,
  SignedPreKeyPairType,
  PreKeyPairType,
  KeyPairType
} from '@privacyresearch/libsignal-protocol-typescript';
import { InMemorySignalProtocolStore } from './SignalStore';

export class KeyManager {
  private store: InMemorySignalProtocolStore;

  constructor(store: InMemorySignalProtocolStore) {
    this.store = store;
  }

  async generateIdentity(): Promise<void> {
    const registrationId = KeyHelper.generateRegistrationId();
    const identityKeyPair = await KeyHelper.generateIdentityKeyPair();
    
    await this.store.putLocalRegistrationId(registrationId);
    await this.store.putIdentityKeyPair(identityKeyPair);
  }

  async generatePreKeys(start: number, count: number): Promise<PreKeyPairType[]> {
    const preKeys: PreKeyPairType[] = [];
    for (let i = 0; i < count; i++) {
      const preKey = await KeyHelper.generatePreKey(start + i);
      await this.store.storePreKey(preKey.keyId, preKey.keyPair);
      preKeys.push(preKey);
    }
    return preKeys;
  }

  async generateSignedPreKey(identityKeyPair: KeyPairType, keyId: number): Promise<SignedPreKeyPairType> {
    const signedPreKey = await KeyHelper.generateSignedPreKey(identityKeyPair, keyId);
    await this.store.storeSignedPreKey(keyId, signedPreKey.keyPair);
    return signedPreKey;
  }

  getStore(): InMemorySignalProtocolStore {
    return this.store;
  }
}
