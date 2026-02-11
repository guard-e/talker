import {
  KeyHelper
} from '@privacyresearch/libsignal-protocol-typescript';

export interface EncryptedFile {
  key: Uint8Array;
  iv: Uint8Array;
  chunks: Uint8Array[];
  originalSize: number;
}

export class FileEncryptor {
  static readonly CHUNK_SIZE = 64 * 1024; // 64KB
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;

  /**
   * Encrypts data by splitting it into chunks and encrypting each chunk with AES-GCM.
   * Uses the same key for all chunks, but a derived IV for each chunk (BaseIV + ChunkIndex).
   */
  async encrypt(data: Uint8Array): Promise<EncryptedFile> {
    const key = await window.crypto.subtle.generateKey(
      {
        name: FileEncryptor.ALGORITHM,
        length: FileEncryptor.KEY_LENGTH,
      },
      true,
      ['encrypt', 'decrypt']
    );

    const baseIv = window.crypto.getRandomValues(new Uint8Array(12));
    const chunks: Uint8Array[] = [];
    
    const totalChunks = Math.ceil(data.length / FileEncryptor.CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * FileEncryptor.CHUNK_SIZE;
      const end = Math.min(start + FileEncryptor.CHUNK_SIZE, data.length);
      const chunkData = data.slice(start, end);
      
      const chunkIv = this.deriveChunkIv(baseIv, i);
      
      const encryptedChunk = await window.crypto.subtle.encrypt(
        {
          name: FileEncryptor.ALGORITHM,
          iv: chunkIv as any,
        },
        key,
        chunkData as any
      );
      
      chunks.push(new Uint8Array(encryptedChunk));
    }

    const exportedKey = await window.crypto.subtle.exportKey('raw', key);

    return {
      key: new Uint8Array(exportedKey),
      iv: baseIv,
      chunks,
      originalSize: data.length
    };
  }

  /**
   * Decrypts file chunks.
   */
  async decrypt(encryptedFile: EncryptedFile): Promise<Uint8Array> {
    const key = await window.crypto.subtle.importKey(
      'raw',
      encryptedFile.key as any,
      {
        name: FileEncryptor.ALGORITHM,
        length: FileEncryptor.KEY_LENGTH,
      },
      false,
      ['decrypt']
    );

    const decryptedChunks: Uint8Array[] = [];
    
    for (let i = 0; i < encryptedFile.chunks.length; i++) {
      const chunkIv = this.deriveChunkIv(encryptedFile.iv, i);
      
      try {
        const decryptedChunk = await window.crypto.subtle.decrypt(
          {
            name: FileEncryptor.ALGORITHM,
            iv: chunkIv as any,
          },
          key,
          encryptedFile.chunks[i] as any
        );
        decryptedChunks.push(new Uint8Array(decryptedChunk));
      } catch (e) {
        throw new Error(`Failed to decrypt chunk ${i}: ${e}`);
      }
    }

    // Combine chunks
    const result = new Uint8Array(encryptedFile.originalSize);
    let offset = 0;
    for (const chunk of decryptedChunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  /**
   * Derives a unique IV for a chunk by combining base IV and chunk index.
   * Strategy: XOR the last 4 bytes of IV with the chunk index (Big Endian).
   * This limits us to 2^32 chunks, which is plenty for 64KB chunks (256TB file).
   */
  private deriveChunkIv(baseIv: Uint8Array, chunkIndex: number): Uint8Array {
    const iv = new Uint8Array(baseIv);
    const view = new DataView(iv.buffer, iv.byteOffset, iv.byteLength);
    
    // Get last 4 bytes as integer
    const last4Bytes = view.getUint32(8, false); // Big Endian
    
    // XOR with chunk index
    const newLast4Bytes = last4Bytes ^ chunkIndex;
    
    // Write back
    view.setUint32(8, newLast4Bytes, false);
    
    return iv;
  }
}
