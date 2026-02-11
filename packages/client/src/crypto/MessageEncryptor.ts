import {
  SessionBuilder,
  SessionCipher,
  SignalProtocolAddress,
  DeviceType,
  MessageType
} from '@privacyresearch/libsignal-protocol-typescript';
import { InMemorySignalProtocolStore } from './SignalStore';

export class MessageEncryptor {
  private store: InMemorySignalProtocolStore;
  private localAddress: SignalProtocolAddress;

  constructor(store: InMemorySignalProtocolStore, localAddress: SignalProtocolAddress) {
    this.store = store;
    this.localAddress = localAddress;
  }

  async buildSession(remoteAddress: SignalProtocolAddress, bundle: DeviceType): Promise<void> {
    const builder = new SessionBuilder(this.store, remoteAddress);
    await builder.processPreKey(bundle);
  }

  async encrypt(remoteAddress: SignalProtocolAddress, message: Uint8Array): Promise<MessageType> {
    const cipher = new SessionCipher(this.store, remoteAddress);
    // Convert Uint8Array to ArrayBuffer (copying to ensure we have a clean ArrayBuffer)
    const buffer = message.buffer.slice(message.byteOffset, message.byteOffset + message.byteLength) as ArrayBuffer;
    return await cipher.encrypt(buffer);
  }

  async decrypt(remoteAddress: SignalProtocolAddress, message: MessageType): Promise<Uint8Array> {
    const cipher = new SessionCipher(this.store, remoteAddress);
    let plaintext: ArrayBuffer;
    
    if (message.type === 3) { // PreKeyWhisperMessage
      plaintext = await cipher.decryptPreKeyWhisperMessage(message.body as any, 'binary');
    } else {
      plaintext = await cipher.decryptWhisperMessage(message.body as any, 'binary');
    }
    
    return new Uint8Array(plaintext);
  }
}
