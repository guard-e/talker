import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: number;
}

interface EncryptedData {
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

interface MessageRecord {
  id: string;
  timestamp: number;
  data: EncryptedData;
}

interface TalkerDB extends DBSchema {
  messages: {
    key: string;
    value: MessageRecord;
    indexes: { 'by-timestamp': number };
  };
  keyval: {
    key: string;
    value: EncryptedData;
  };
}

export class LocalStorage {
  private dbPromise: Promise<IDBPDatabase<TalkerDB>>;
  private masterKeyPromise: Promise<CryptoKey>;

  constructor(masterKeyRaw: Uint8Array) {
    this.dbPromise = openDB<TalkerDB>('talker-db', 1, {
      upgrade(db) {
        const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
        msgStore.createIndex('by-timestamp', 'timestamp');
        
        db.createObjectStore('keyval');
      },
    });

    this.masterKeyPromise = window.crypto.subtle.importKey(
      'raw',
      masterKeyRaw as any,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async saveMessage(message: Message): Promise<void> {
    const key = await this.masterKeyPromise;
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(message));
    
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );

    await (await this.dbPromise).put('messages', {
      id: message.id,
      timestamp: message.timestamp,
      data: {
        iv,
        ciphertext: new Uint8Array(ciphertext)
      }
    });
  }

  async getMessages(limit: number = 50, offset: number = 0): Promise<Message[]> {
    const db = await this.dbPromise;
    const key = await this.masterKeyPromise;
    
    const tx = db.transaction('messages', 'readonly');
    const index = tx.store.index('by-timestamp');
    let cursor = await index.openCursor(null, 'prev');
    
    const records: MessageRecord[] = [];
    
    // Skip offset
    if (offset > 0 && cursor) {
      await cursor.advance(offset);
    }
    
    while (cursor && records.length < limit) {
      records.push(cursor.value);
      cursor = await cursor.continue();
    }
    
    const messages: Message[] = [];
    for (const record of records) {
      try {
        const decrypted = await window.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: record.data.iv as any },
          key,
          record.data.ciphertext as any
        );
        const msg = JSON.parse(new TextDecoder().decode(decrypted));
        messages.push(msg);
      } catch (e) {
        console.error('Failed to decrypt message', record.id, e);
      }
    }
    
    return messages;
  }

  async deleteMessage(id: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete('messages', id);
  }

  async close(): Promise<void> {
    const db = await this.dbPromise;
    db.close();
  }
}
