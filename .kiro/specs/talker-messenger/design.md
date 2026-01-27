# Документ дизайна: Защищенный мессенджер TALKER

## Обзор

TALKER - это защищенное кроссплатформенное приложение для коммуникации с end-to-end шифрованием. Система построена на архитектуре клиент-сервер, где сервер выступает исключительно как ретранслятор сообщений без хранения пользовательского контента. Все данные (сообщения, файлы, история) хранятся только на устройствах пользователей в зашифрованном виде.

### Ключевые принципы дизайна

1. **Zero-knowledge архитектура**: Сервер не имеет доступа к расшифрованным данным пользователей
2. **End-to-end шифрование**: Все коммуникации шифруются на устройстве отправителя и дешифруются только на устройстве получателя
3. **Локальное хранение**: Вся история и файлы хранятся только на устройствах пользователей
4. **Perfect Forward Secrecy**: Компрометация одного ключа не раскрывает предыдущие сообщения
5. **Минимизация метаданных**: Сервер хранит только минимум метаданных для маршрутизации

## Архитектура

### Общая архитектура системы

```
┌─────────────────────────────────────────────────────────────┐
│                    Клиентское приложение                     │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ UI Layer     │  │ Media Layer  │  │ Crypto Layer │      │
│  │              │  │              │  │              │      │
│  │ - Chat UI    │  │ - Audio      │  │ - E2E Crypto │      │
│  │ - Call UI    │  │ - Video      │  │ - Key Mgmt   │      │
│  │ - Settings   │  │ - Screen     │  │ - SRTP       │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Message      │  │ File         │  │ Local        │      │
│  │ Manager      │  │ Manager      │  │ Storage      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌─────────────────────────────────────────────────┐        │
│  │         Network Layer (WebSocket/WebRTC)        │        │
│  │         + Anti-Censorship Transport Layer       │        │
│  └─────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ TLS 1.3
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Сервер ретрансляции                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Auth Service │  │ Message      │  │ Presence     │      │
│  │              │  │ Relay        │  │ Service      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ DDoS         │  │ Rate         │  │ Admin        │      │
│  │ Protection   │  │ Limiter      │  │ Service      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌─────────────────────────────────────────────────┐        │
│  │         Metadata Store (Redis/PostgreSQL)       │        │
│  │         (только метаданные, не контент)         │        │
│  └─────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### Архитектура шифрования

```
Регистрация пользователя:
1. Генерация Identity Key Pair (Curve25519)
2. Генерация Signed Pre-Key
3. Генерация набора One-Time Pre-Keys
4. Публичные ключи → Сервер
5. Приватные ключи → Локальное хранилище (зашифровано)

Установка сессии (Signal Protocol):
1. Отправитель получает публичные ключи получателя с сервера
2. Выполняется X3DH (Extended Triple Diffie-Hellman)
3. Генерируется общий секрет
4. Инициализируется Double Ratchet для сессии
5. Каждое сообщение использует новый ключ (Perfect Forward Secrecy)

Шифрование медиапотоков:
1. Установка P2P соединения через WebRTC
2. Обмен ключами через Diffie-Hellman
3. Генерация SRTP мастер-ключа
4. Шифрование потоков с AES-128-GCM
```

### Архитектура противодействия блокировкам

```
Многоуровневая система обхода блокировок:

Уровень 1: Транспортный
├── WebSocket (стандартный)
├── WebSocket over TLS (маскировка)
├── WebRTC Data Channels (P2P)
├── QUIC (UDP-based, быстрое переключение)
└── HTTP/3 (современный, сложно блокировать)

Уровень 2: Обфускация
├── Domain Fronting (маскировка под CDN)
├── DPI Obfuscation (маскировка паттернов трафика)
├── Traffic Padding (скрытие размеров пакетов)
└── Protocol Mimicry (имитация HTTPS трафика)

Уровень 3: Прокси и туннели
├── SOCKS5 Proxy
├── HTTP Proxy
├── Shadowsocks
├── V2Ray/VMess
├── Встроенный VPN (WireGuard)
└── Tor (опционально)

Уровень 4: Инфраструктура
├── Распределенная сеть серверов
├── Динамическое изменение IP через CDN
├── Альтернативные DNS (DoH, DoT)
├── Децентрализованное распространение списков серверов
└── Автоматическое переключение при блокировке

Процесс подключения:
1. Попытка прямого подключения
2. При неудаче → Попытка через альтернативный транспорт
3. При неудаче → Попытка через прокси
4. При неудаче → Попытка через VPN
5. При неудаче → Попытка через Tor
6. Параллельно: Запрос обновленного списка серверов
```

## Компоненты и интерфейсы

### 1. Клиентское приложение

#### 1.1 UI Layer (Слой пользовательского интерфейса)

**Назначение**: Предоставление пользовательского интерфейса для всех функций приложения.

**Компоненты**:
- `ChatView`: Отображение списка чатов и сообщений
- `CallView`: Интерфейс аудио/видеозвонков
- `ConferenceView`: Интерфейс групповых конференций
- `SettingsView`: Настройки приложения и безопасности
- `ContactsView`: Управление контактами

**Интерфейсы**:
```typescript
interface ChatView {
  displayMessages(messages: Message[]): void;
  sendMessage(text: string): Promise<void>;
  sendFile(file: File): Promise<void>;
  showTypingIndicator(userId: string): void;
}

interface CallView {
  initiateCall(contactId: string, type: 'audio' | 'video'): Promise<void>;
  acceptCall(callId: string): Promise<void>;
  rejectCall(callId: string): Promise<void>;
  toggleMute(): void;
  toggleCamera(): void;
  endCall(): void;
}

interface ConferenceView {
  createConference(): Promise<string>;
  joinConference(conferenceId: string): Promise<void>;
  displayParticipants(participants: Participant[]): void;
  startScreenShare(): Promise<void>;
  stopScreenShare(): void;
}
```

#### 1.2 Crypto Layer (Криптографический слой)

**Назначение**: Обеспечение end-to-end шифрования всех коммуникаций.

**Компоненты**:
- `KeyManager`: Управление криптографическими ключами
- `MessageEncryptor`: Шифрование/дешифрование сообщений
- `FileEncryptor`: Шифрование/дешифрование файлов
- `MediaEncryptor`: Шифрование медиапотоков (SRTP)

**Интерфейсы**:
```typescript
interface KeyManager {
  generateIdentityKeyPair(): Promise<KeyPair>;
  generateSessionKey(recipientPublicKey: PublicKey): Promise<SessionKey>;
  deriveSharedSecret(privateKey: PrivateKey, publicKey: PublicKey): Promise<SharedSecret>;
  rotateKeys(): Promise<void>;
  secureDelete(key: Key): void;
}

interface MessageEncryptor {
  encrypt(plaintext: string, recipientPublicKey: PublicKey): Promise<EncryptedMessage>;
  decrypt(ciphertext: EncryptedMessage, senderPublicKey: PublicKey): Promise<string>;
  verifySignature(message: Message, signature: Signature): boolean;
}

interface FileEncryptor {
  encryptFile(file: File, recipientPublicKey: PublicKey): Promise<EncryptedFile>;
  decryptFile(encryptedFile: EncryptedFile, senderPublicKey: PublicKey): Promise<File>;
  encryptChunk(chunk: Uint8Array, key: SymmetricKey): Promise<Uint8Array>;
}

interface MediaEncryptor {
  initializeSRTP(masterKey: Uint8Array): SRTPContext;
  encryptRTPPacket(packet: RTPPacket, context: SRTPContext): EncryptedRTPPacket;
  decryptRTPPacket(packet: EncryptedRTPPacket, context: SRTPContext): RTPPacket;
}
```

#### 1.3 Message Manager (Менеджер сообщений)

**Назначение**: Управление отправкой, получением и хранением сообщений.

**Интерфейсы**:
```typescript
interface MessageManager {
  sendMessage(chatId: string, content: string): Promise<MessageId>;
  receiveMessage(message: EncryptedMessage): Promise<void>;
  getMessageHistory(chatId: string, limit: number): Promise<Message[]>;
  deleteMessage(messageId: MessageId): Promise<void>;
  markAsRead(messageId: MessageId): Promise<void>;
  retryFailedMessage(messageId: MessageId): Promise<void>;
}

interface Message {
  id: MessageId;
  chatId: string;
  senderId: string;
  content: string;
  timestamp: number;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  encryptedContent?: Uint8Array;
}
```

#### 1.4 File Manager (Менеджер файлов)

**Назначение**: Управление передачей файлов.

**Интерфейсы**:
```typescript
interface FileManager {
  sendFile(chatId: string, file: File): Promise<FileTransferId>;
  receiveFile(transfer: FileTransfer): Promise<void>;
  pauseTransfer(transferId: FileTransferId): Promise<void>;
  resumeTransfer(transferId: FileTransferId): Promise<void>;
  cancelTransfer(transferId: FileTransferId): Promise<void>;
  getTransferProgress(transferId: FileTransferId): number;
}

interface FileTransfer {
  id: FileTransferId;
  fileName: string;
  fileSize: number;
  mimeType: string;
  senderId: string;
  recipientId: string;
  progress: number;
  status: 'pending' | 'transferring' | 'paused' | 'completed' | 'failed';
}
```

#### 1.5 Media Layer (Медиа слой)

**Назначение**: Обработка аудио, видео и демонстрации экрана.

**Интерфейсы**:
```typescript
interface MediaManager {
  initializeAudioCall(contactId: string): Promise<CallSession>;
  initializeVideoCall(contactId: string): Promise<CallSession>;
  captureAudioStream(): Promise<MediaStream>;
  captureVideoStream(): Promise<MediaStream>;
  captureScreenStream(): Promise<MediaStream>;
  adaptBitrate(quality: NetworkQuality): void;
}

interface CallSession {
  id: string;
  participants: string[];
  type: 'audio' | 'video';
  localStream: MediaStream;
  remoteStreams: Map<string, MediaStream>;
  startTime: number;
  status: 'connecting' | 'active' | 'ended';
}

interface ConferenceManager {
  createConference(): Promise<Conference>;
  joinConference(conferenceId: string): Promise<void>;
  leaveConference(): Promise<void>;
  addParticipant(userId: string): Promise<void>;
  removeParticipant(userId: string): Promise<void>;
  getActiveParticipants(): Participant[];
}
```

#### 1.6 Local Storage (Локальное хранилище)

**Назначение**: Безопасное хранение данных на устройстве пользователя.

**Интерфейсы**:
```typescript
interface LocalStorage {
  saveMessage(message: Message): Promise<void>;
  loadMessages(chatId: string, limit: number, offset: number): Promise<Message[]>;
  saveFile(file: File, metadata: FileMetadata): Promise<void>;
  loadFile(fileId: string): Promise<File>;
  saveKeys(keys: KeyBundle): Promise<void>;
  loadKeys(): Promise<KeyBundle>;
  deleteAllData(): Promise<void>;
  encrypt(data: Uint8Array): Promise<Uint8Array>;
  decrypt(data: Uint8Array): Promise<Uint8Array>;
}

interface KeyBundle {
  identityKeyPair: KeyPair;
  signedPreKey: SignedPreKey;
  oneTimePreKeys: OneTimePreKey[];
  sessionKeys: Map<string, SessionKey>;
}
```

#### 1.7 Anti-Censorship Transport Layer (Слой противодействия цензуре)

**Назначение**: Обеспечение доступности мессенджера при попытках блокировки.

**Компоненты**:
- `TransportManager`: Управление множественными транспортными протоколами
- `ProxyManager`: Управление прокси-соединениями
- `DPIObfuscator`: Обфускация трафика для обхода DPI
- `ServerListManager`: Управление списком доступных серверов
- `ConnectionStrategy`: Стратегия подключения с автоматическим переключением

**Интерфейсы**:
```typescript
interface TransportManager {
  connect(serverList: Server[]): Promise<Connection>;
  switchTransport(transport: TransportType): Promise<void>;
  getSupportedTransports(): TransportType[];
  testTransport(transport: TransportType): Promise<boolean>;
}

type TransportType = 
  | 'websocket'
  | 'websocket-tls'
  | 'webrtc'
  | 'quic'
  | 'http3';

interface ProxyManager {
  addProxy(proxy: ProxyConfig): Promise<void>;
  removeProxy(proxyId: string): Promise<void>;
  connectThroughProxy(proxy: ProxyConfig, target: Server): Promise<Connection>;
  testProxy(proxy: ProxyConfig): Promise<boolean>;
  getWorkingProxies(): Promise<ProxyConfig[]>;
}

interface ProxyConfig {
  type: 'socks5' | 'http' | 'shadowsocks' | 'v2ray' | 'vpn' | 'tor';
  host: string;
  port: number;
  credentials?: {
    username: string;
    password: string;
  };
  config?: any; // Специфичная конфигурация для типа прокси
}

interface DPIObfuscator {
  obfuscatePacket(packet: Uint8Array): Uint8Array;
  deobfuscatePacket(packet: Uint8Array): Uint8Array;
  mimicProtocol(protocol: 'https' | 'http2' | 'quic'): void;
  addTrafficPadding(packet: Uint8Array, targetSize: number): Uint8Array;
}

interface ServerListManager {
  getServerList(): Promise<Server[]>;
  updateServerList(source: UpdateSource): Promise<void>;
  markServerAsBlocked(serverId: string): Promise<void>;
  markServerAsWorking(serverId: string): Promise<void>;
  getWorkingServers(): Promise<Server[]>;
}

type UpdateSource = 
  | 'telegram'
  | 'email'
  | 'qr-code'
  | 'p2p'
  | 'dht';

interface ConnectionStrategy {
  attemptConnection(serverList: Server[]): Promise<Connection>;
  onConnectionFailed(reason: FailureReason): Promise<void>;
  getNextStrategy(): ConnectionMethod;
}

interface ConnectionMethod {
  type: 'direct' | 'proxy' | 'vpn' | 'tor';
  transport: TransportType;
  proxy?: ProxyConfig;
  priority: number;
}

interface DNSResolver {
  resolve(domain: string): Promise<string[]>;
  useDoH(provider: string): void;  // DNS over HTTPS
  useDoT(provider: string): void;  // DNS over TLS
  getAlternativeDNS(): string[];
}
```

### 2. Серверные компоненты

#### 2.1 Auth Service (Сервис аутентификации)

**Назначение**: Управление регистрацией и аутентификацией пользователей.

**Интерфейсы**:
```typescript
interface AuthService {
  register(username: string, passwordHash: string, publicKeys: PublicKeyBundle): Promise<UserId>;
  login(username: string, passwordHash: string): Promise<SessionToken>;
  logout(sessionToken: SessionToken): Promise<void>;
  verify2FA(sessionToken: SessionToken, code: string): Promise<boolean>;
  refreshSession(sessionToken: SessionToken): Promise<SessionToken>;
  archiveInactiveUser(userId: UserId): Promise<void>;
  requestReactivation(userId: UserId): Promise<ReactivationRequest>;
}

interface PublicKeyBundle {
  identityKey: PublicKey;
  signedPreKey: SignedPreKey;
  oneTimePreKeys: OneTimePreKey[];
  signature: Signature;
}
```

#### 2.2 Message Relay (Ретранслятор сообщений)

**Назначение**: Маршрутизация зашифрованных сообщений между клиентами.

**Интерфейсы**:
```typescript
interface MessageRelay {
  relayMessage(from: UserId, to: UserId, encryptedPayload: Uint8Array): Promise<void>;
  storeOfflineMessage(userId: UserId, message: EncryptedMessage, ttl: number): Promise<void>;
  deliverOfflineMessages(userId: UserId): Promise<EncryptedMessage[]>;
  confirmDelivery(messageId: MessageId): Promise<void>;
}
```

#### 2.3 Presence Service (Сервис присутствия)

**Назначение**: Отслеживание статуса пользователей онлайн/офлайн.

**Интерфейсы**:
```typescript
interface PresenceService {
  updateStatus(userId: UserId, status: PresenceStatus): Promise<void>;
  getStatus(userId: UserId): Promise<PresenceStatus>;
  subscribeToPresence(userId: UserId, subscriberId: UserId): Promise<void>;
  notifyStatusChange(userId: UserId, status: PresenceStatus): Promise<void>;
}

type PresenceStatus = 'online' | 'away' | 'dnd' | 'offline';
```

#### 2.4 DDoS Protection (Защита от DDoS)

**Назначение**: Защита сервера от атак типа отказ в обслуживании.

**Интерфейсы**:
```typescript
interface DDoSProtection {
  checkRateLimit(ipAddress: string): Promise<boolean>;
  blockIP(ipAddress: string, duration: number): Promise<void>;
  detectAnomalies(trafficPattern: TrafficPattern): Promise<boolean>;
  activateDefenseMode(): Promise<void>;
  deactivateDefenseMode(): Promise<void>;
  logBlockedRequest(ipAddress: string, reason: string): Promise<void>;
}

interface RateLimiter {
  incrementCounter(ipAddress: string): Promise<number>;
  resetCounter(ipAddress: string): Promise<void>;
  isBlocked(ipAddress: string): Promise<boolean>;
}
```

#### 2.5 Admin Service (Административный сервис)

**Назначение**: Управление системой и пользователями.

**Интерфейсы**:
```typescript
interface AdminService {
  approveReactivation(requestId: string): Promise<void>;
  rejectReactivation(requestId: string, reason: string): Promise<void>;
  getSystemMetrics(): Promise<SystemMetrics>;
  getBlockedIPs(): Promise<BlockedIP[]>;
  unblockIP(ipAddress: string): Promise<void>;
  getArchivedUsers(): Promise<ArchivedUser[]>;
}

interface SystemMetrics {
  activeUsers: number;
  messagesPerSecond: number;
  activeCalls: number;
  serverLoad: number;
  blockedRequests: number;
}
```

## Модели данных

### Клиентские модели

```typescript
// Пользователь
interface User {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  publicKey: PublicKey;
  status: PresenceStatus;
  lastSeen: number;
}

// Контакт
interface Contact {
  userId: string;
  displayName: string;
  publicKey: PublicKey;
  addedAt: number;
  blocked: boolean;
}

// Чат
interface Chat {
  id: string;
  type: 'direct' | 'group';
  participants: string[];
  lastMessage?: Message;
  unreadCount: number;
  createdAt: number;
}

// Сообщение (локальное хранилище)
interface StoredMessage {
  id: string;
  chatId: string;
  senderId: string;
  encryptedContent: Uint8Array;  // Зашифровано локальным ключом
  timestamp: number;
  status: MessageStatus;
  attachments?: FileAttachment[];
}

// Файл
interface StoredFile {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  encryptedData: Uint8Array;  // Зашифровано локальным ключом
  thumbnail?: Uint8Array;
  uploadedAt: number;
}

// Ключи (локальное хранилище)
interface StoredKeys {
  identityKeyPair: EncryptedKeyPair;  // Зашифровано паролем пользователя
  signedPreKey: EncryptedSignedPreKey;
  oneTimePreKeys: EncryptedOneTimePreKey[];
  sessionKeys: Map<string, EncryptedSessionKey>;
}
```

### Серверные модели (только метаданные)

```typescript
// Учетная запись пользователя (сервер)
interface UserAccount {
  id: string;
  username: string;
  passwordHash: string;  // bcrypt
  salt: string;
  publicKeyBundle: PublicKeyBundle;
  createdAt: number;
  lastLoginAt: number;
  status: 'active' | 'archived';
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
}

// Офлайн сообщение (временное хранение)
interface OfflineMessage {
  id: string;
  recipientId: string;
  encryptedPayload: Uint8Array;  // Зашифровано E2E, сервер не может прочитать
  createdAt: number;
  expiresAt: number;
}

// Сессия
interface Session {
  token: string;
  userId: string;
  deviceId: string;
  createdAt: number;
  expiresAt: number;
  ipAddress: string;
}

// Заблокированный IP
interface BlockedIP {
  ipAddress: string;
  reason: string;
  blockedAt: number;
  expiresAt: number;
  requestCount: number;
}

// Запрос на реактивацию
interface ReactivationRequest {
  id: string;
  userId: string;
  requestedAt: number;
  status: 'pending' | 'approved' | 'rejected';
  adminNotes?: string;
}
```

## Протоколы коммуникации

### WebSocket протокол (клиент-сервер)

```typescript
// Сообщения от клиента к серверу
type ClientMessage =
  | { type: 'send_message'; to: string; payload: Uint8Array }
  | { type: 'delivery_receipt'; messageId: string }
  | { type: 'read_receipt'; messageId: string }
  | { type: 'presence_update'; status: PresenceStatus }
  | { type: 'typing_indicator'; chatId: string; isTyping: boolean };

// Сообщения от сервера к клиенту
type ServerMessage =
  | { type: 'message'; from: string; payload: Uint8Array; messageId: string }
  | { type: 'delivery_receipt'; messageId: string }
  | { type: 'read_receipt'; messageId: string }
  | { type: 'presence_update'; userId: string; status: PresenceStatus }
  | { type: 'typing_indicator'; userId: string; chatId: string; isTyping: boolean }
  | { type: 'call_signal'; from: string; signal: RTCSignal };
```

### WebRTC сигнализация (для звонков)

```typescript
interface RTCSignal {
  type: 'offer' | 'answer' | 'ice_candidate';
  sdp?: string;
  candidate?: RTCIceCandidate;
  callId: string;
}

// Процесс установки звонка:
// 1. Инициатор → Сервер: offer
// 2. Сервер → Получатель: offer
// 3. Получатель → Сервер: answer
// 4. Сервер → Инициатор: answer
// 5. Обмен ICE candidates через сервер
// 6. Установка P2P соединения
// 7. Обмен ключами Diffie-Hellman
// 8. Начало зашифрованной передачи медиа
```


## Свойства корректности

*Свойство - это характеристика или поведение, которое должно выполняться для всех валидных выполнений системы - по сути, формальное утверждение о том, что система должна делать. Свойства служат мостом между человекочитаемыми спецификациями и машинно-проверяемыми гарантиями корректности.*

### Property Reflection (Анализ избыточности)

После анализа всех критериев приемки, я выявил следующие группы свойств, которые можно объединить:

1. **Шифрование сообщений и файлов** - оба используют E2E шифрование и round-trip паттерн, можно объединить в одно свойство о round-trip шифровании контента
2. **Шифрование медиапотоков** - аудио, видео, конференции и демонстрация экрана все используют SRTP с AES-128-GCM, можно объединить
3. **Очистка ключей при завершении** - звонки, видеозвонки и сессии все требуют очистки ключей, можно объединить
4. **Уникальность идентификаторов** - ключи пользователей и идентификаторы конференций требуют уникальности

### Свойства

#### Property 1: Round-trip шифрование контента
*Для любого* контента (текстовое сообщение или файл), зашифрованного для получателя и затем дешифрованного получателем, результат должен быть идентичен исходному контенту.

**Validates: Requirements 3.1, 3.2, 4.1, 4.6**

#### Property 2: Аутентификация round-trip
*Для любого* пользователя с валидными учетными данными, создание учетной записи с последующей аутентификацией с теми же учетными данными должно успешно создать защищенную сессию.

**Validates: Requirements 1.1, 1.2**

#### Property 3: Отклонение некорректных учетных данных
*Для любых* некорректных учетных данных (неправильный пароль или несуществующий пользователь), попытка аутентификации должна быть отклонена.

**Validates: Requirements 1.3**

#### Property 4: Уникальность криптографических ключей
*Для любых* двух различных пользователей или сессий, сгенерированные криптографические ключи должны быть уникальными.

**Validates: Requirements 1.4, 7.1, 9.1**

#### Property 5: Очистка ключей при завершении сессии
*Для любой* завершенной сессии (выход пользователя, завершение звонка, закрытие конференции), все временные ключи шифрования должны быть безопасно удалены из памяти.

**Validates: Requirements 1.5, 5.7, 9.4**

#### Property 6: Управление контактами сохраняет историю
*Для любого* контакта в списке пользователя, удаление контакта должно удалить его из списка, но сохранить всю историю сообщений с этим контактом в локальном хранилище.

**Validates: Requirements 2.2**

#### Property 7: Добавление существующих контактов
*Для любого* существующего пользователя в системе, добавление его в контакты должно успешно добавить его в список контактов. Для несуществующего пользователя операция должна быть отклонена.

**Validates: Requirements 2.1**

#### Property 8: Локальность удаления сообщений
*Для любого* сообщения, удаленного пользователем, сообщение должно быть удалено только из локального хранилища этого пользователя и оставаться доступным для других участников чата.

**Validates: Requirements 3.7**

#### Property 9: Возобновление передачи файлов
*Для любого* файла и любой точки прерывания передачи, возобновление передачи должно продолжить с той же точки, где произошло прерывание, без повторной передачи уже переданных данных.

**Validates: Requirements 4.4**

#### Property 10: Сканирование файлов на вредоносное содержимое
*Для любого* полученного файла, система должна выполнить сканирование на вредоносное содержимое перед дешифрованием и сохранением в локальное хранилище.

**Validates: Requirements 4.7**

#### Property 11: Шифрование медиапотоков SRTP
*Для любого* медиапотока (аудио, видео, демонстрация экрана) в звонке или конференции, поток должен быть зашифрован с использованием протокола SRTP и алгоритма AES-128-GCM.

**Validates: Requirements 5.2, 6.2, 7.4, 8.2**

#### Property 12: Установка зашифрованных P2P соединений
*Для любого* инициированного звонка или видеозвонка, система должна установить зашифрованное P2P соединение между участниками с использованием ключей, сгенерированных через алгоритм Диффи-Хеллмана.

**Validates: Requirements 5.1, 6.1**

#### Property 13: Адаптация качества при ухудшении соединения
*Для любого* активного видеозвонка или конференции, когда качество сетевого соединения ухудшается, система должна автоматически снижать разрешение видео или битрейт аудио для поддержания стабильности соединения.

**Validates: Requirements 5.6, 6.4**

#### Property 14: Управление камерой и микрофоном
*Для любого* активного видеозвонка, пользователь должен иметь возможность отключать и включать камеру и микрофон в любой момент времени.

**Validates: Requirements 6.5, 6.6**

#### Property 15: Зашифрованные соединения в конференциях
*Для любого* участника, присоединяющегося к групповой конференции, система должна установить зашифрованные соединения со всеми активными участниками с использованием уникальных сеансовых ключей для каждого участника.

**Validates: Requirements 7.3, 7.5**

#### Property 16: Удаление участников конференции
*Для любого* участника конференции (кроме организатора), организатор должен иметь возможность удалить этого участника из конференции в любой момент.

**Validates: Requirements 7.8**

#### Property 17: Единственная демонстрация экрана
*Для любой* активной групповой конференции, в любой момент времени только один участник может демонстрировать свой экран.

**Validates: Requirements 8.8**

#### Property 18: Perfect Forward Secrecy
*Для любых* двух последовательных сообщений в одной сессии, компрометация ключа шифрования одного сообщения не должна позволять дешифровать другое сообщение.

**Validates: Requirements 9.5**

#### Property 19: Шифрование данных в покое
*Для любых* данных, сохраненных в локальном хранилище (сообщения, файлы, ключи), данные должны быть зашифрованы.

**Validates: Requirements 11.1**

#### Property 20: Синхронизация между устройствами
*Для любого* пользователя с несколькими активными устройствами, список контактов и история сообщений должны синхронизироваться между всеми устройствами в зашифрованном виде через P2P соединение.

**Validates: Requirements 12.2, 12.3**

#### Property 21: Отклонение входа архивированных пользователей
*Для любого* пользователя с архивированной учетной записью, попытка входа в систему должна быть отклонена с сообщением о необходимости разрешения суперадминистратора.

**Validates: Requirements 13.3**

#### Property 22: Rate limiting по IP-адресам
*Для любого* IP-адреса, количество запросов к системе должно быть ограничено до 100 запросов в минуту, с временной блокировкой при превышении лимита.

**Validates: Requirements 14.1**

#### Property 23: Автоматическое переподключение
*Для любого* активного соединения, которое было прервано из-за сетевых проблем, система должна автоматически переподключиться при восстановлении сетевого соединения.

**Validates: Requirements 16.4**

#### Property 24: Автоматическое переключение транспорта при блокировке
*Для любого* транспортного протокола, который становится недоступным из-за блокировки, система должна автоматически переключиться на альтернативный доступный транспорт без потери соединения.

**Validates: Requirements 15.4**

#### Property 25: Обфускация трафика
*Для любого* сетевого пакета, отправленного через систему, пакет должен быть обфусцирован для предотвращения обнаружения через Deep Packet Inspection.

**Validates: Requirements 15.6**

#### Property 26: Работа через прокси
*Для любого* поддерживаемого типа прокси-сервера (SOCKS5, HTTP, Shadowsocks, VPN, Tor), система должна иметь возможность установить соединение через этот прокси.

**Validates: Requirements 15.3, 15.7, 15.10**

#### Property 27: Переключение на резервные серверы
*Для любого* основного сервера, который становится недоступным, система должна автоматически переключиться на резервный сервер из распределенного списка.

**Validates: Requirements 15.5**

#### Property 28: Альтернативные DNS
*Для любой* блокировки DNS, система должна автоматически переключиться на альтернативные DNS-серверы (DoH или DoT) для разрешения доменных имен.

**Validates: Requirements 15.11**

## Обработка ошибок

### Сетевые ошибки

**Стратегия**: Экспоненциальная задержка с повторными попытками

```typescript
interface RetryStrategy {
  maxRetries: number;        // 3 для сообщений, бесконечно для соединений
  initialDelay: number;      // 1 секунда
  maxDelay: number;          // 30 секунд
  backoffMultiplier: number; // 2.0
}
```

**Обработка**:
- Сообщения: до 3 попыток, затем пометить как "failed"
- Файлы: сохранить состояние для возобновления
- Звонки: уведомить пользователя о проблемах с соединением
- Автоматическое переподключение при восстановлении сети

### Ошибки блокировки и цензуры

**Типы блокировок**:
- Блокировка по IP-адресу
- Блокировка по DNS
- DPI (Deep Packet Inspection) блокировка
- Блокировка протокола
- Throttling (замедление) трафика

**Обнаружение блокировки**:
```typescript
interface BlockageDetector {
  detectIPBlock(): Promise<boolean>;
  detectDNSBlock(): Promise<boolean>;
  detectDPIBlock(): Promise<boolean>;
  detectProtocolBlock(protocol: TransportType): Promise<boolean>;
  detectThrottling(): Promise<boolean>;
}
```

**Стратегия обхода**:
1. **IP блокировка**:
   - Переключение на резервные серверы
   - Использование CDN с динамическими IP
   - Подключение через прокси/VPN

2. **DNS блокировка**:
   - Переключение на DoH (DNS over HTTPS)
   - Переключение на DoT (DNS over TLS)
   - Использование альтернативных DNS (1.1.1.1, 8.8.8.8)
   - Прямое использование IP-адресов

3. **DPI блокировка**:
   - Обфускация трафика
   - Имитация HTTPS трафика
   - Domain fronting
   - Traffic padding

4. **Блокировка протокола**:
   - Автоматическое переключение на альтернативный транспорт
   - Использование менее распространенных протоколов (QUIC, HTTP/3)
   - Туннелирование через разрешенные протоколы

5. **Throttling**:
   - Обнаружение замедления
   - Переключение на альтернативный маршрут
   - Использование сжатия данных

**Каскадная стратегия подключения**:
```typescript
const connectionCascade = [
  { method: 'direct', transport: 'websocket' },
  { method: 'direct', transport: 'webrtc' },
  { method: 'direct', transport: 'quic' },
  { method: 'proxy', type: 'socks5', transport: 'websocket' },
  { method: 'proxy', type: 'shadowsocks', transport: 'websocket' },
  { method: 'vpn', transport: 'websocket' },
  { method: 'tor', transport: 'websocket' }
];
```

**Обработка**:
- Параллельное тестирование нескольких методов
- Кэширование работающих методов
- Автоматическое обновление списка серверов
- Уведомление пользователя о проблемах с доступом
- Предложение ручной настройки прокси при неудаче всех методов

### Криптографические ошибки

**Типы ошибок**:
- Невалидная подпись сообщения
- Ошибка дешифрования
- Компрометация ключа
- Истечение срока действия ключа

**Обработка**:
- Отклонить сообщение с невалидной подписью
- Запросить повторную отправку при ошибке дешифрования
- Немедленная ротация ключей при компрометации
- Уведомление пользователя о проблемах безопасности

### Ошибки хранилища

**Типы ошибок**:
- Недостаточно места на диске
- Ошибка чтения/записи
- Повреждение данных

**Обработка**:
- Уведомить пользователя о нехватке места
- Попытка восстановления из резервной копии
- Проверка целостности данных при загрузке
- Graceful degradation (работа без истории при критических ошибках)

### Ошибки медиа

**Типы ошибок**:
- Недоступность камеры/микрофона
- Ошибка кодирования/декодирования
- Потеря пакетов

**Обработка**:
- Запрос разрешений у пользователя
- Fallback на аудио при проблемах с видео
- FEC (Forward Error Correction) для восстановления потерянных пакетов
- Адаптивный битрейт

### Ошибки безопасности

**Типы ошибок**:
- Превышение rate limit
- Подозрительная активность
- Вредоносный файл
- Попытка несанкционированного доступа

**Обработка**:
- Временная блокировка IP
- Требование CAPTCHA
- Блокировка файла и уведомление
- Немедленное завершение сессии и уведомление

## Стратегия тестирования

### Двойной подход к тестированию

Система требует как unit-тестов, так и property-based тестов для комплексного покрытия:

**Unit-тесты** фокусируются на:
- Конкретные примеры корректного поведения
- Граничные случаи (edge cases)
- Обработка ошибок
- Интеграционные точки между компонентами

**Property-based тесты** фокусируются на:
- Универсальные свойства, которые должны выполняться для всех входных данных
- Комплексное покрытие входных данных через рандомизацию
- Криптографические свойства (round-trip, Perfect Forward Secrecy)
- Инварианты системы

### Конфигурация Property-Based тестов

**Библиотеки**:
- TypeScript/JavaScript: `fast-check`
- Python: `hypothesis`
- Rust: `proptest`
- Java: `jqwik`

**Конфигурация**:
- Минимум 100 итераций на каждый property-тест
- Каждый тест должен ссылаться на свойство из документа дизайна
- Формат тега: `Feature: talker-messenger, Property {number}: {property_text}`

**Пример**:
```typescript
// Feature: talker-messenger, Property 1: Round-trip шифрование контента
test('message encryption round-trip', () => {
  fc.assert(
    fc.property(
      fc.string(), // произвольное сообщение
      fc.record({ publicKey: fc.string(), privateKey: fc.string() }), // ключи
      (message, keys) => {
        const encrypted = encrypt(message, keys.publicKey);
        const decrypted = decrypt(encrypted, keys.privateKey);
        return decrypted === message;
      }
    ),
    { numRuns: 100 }
  );
});
```

### Тестовые сценарии

#### 1. Криптография

**Unit-тесты**:
- Генерация ключей создает валидные ключи
- Шифрование пустой строки
- Шифрование очень длинных сообщений
- Обработка невалидных ключей

**Property-тесты**:
- Property 1: Round-trip шифрование
- Property 4: Уникальность ключей
- Property 18: Perfect Forward Secrecy

#### 2. Аутентификация

**Unit-тесты**:
- Регистрация с минимальными требованиями к паролю
- Вход с 2FA
- Блокировка после нескольких неудачных попыток
- Истечение сессии

**Property-тесты**:
- Property 2: Аутентификация round-trip
- Property 3: Отклонение некорректных учетных данных

#### 3. Обмен сообщениями

**Unit-тесты**:
- Отправка сообщения офлайн пользователю
- Индикаторы доставки и прочтения
- Удаление сообщения
- Повторная отправка при ошибке

**Property-тесты**:
- Property 1: Round-trip шифрование
- Property 8: Локальность удаления

#### 4. Передача файлов

**Unit-тесты**:
- Передача файла размером 0 байт
- Передача файла максимального размера (2 ГБ)
- Отмена передачи
- Обнаружение вредоносного файла

**Property-тесты**:
- Property 1: Round-trip шифрование файлов
- Property 9: Возобновление передачи
- Property 10: Сканирование файлов

#### 5. Звонки и конференции

**Unit-тесты**:
- Инициация звонка
- Отклонение звонка
- Завершение звонка
- Отключение камеры/микрофона

**Property-тесты**:
- Property 11: Шифрование медиапотоков
- Property 12: Зашифрованные P2P соединения
- Property 13: Адаптация качества
- Property 15: Зашифрованные соединения в конференциях

#### 6. Безопасность

**Unit-тесты**:
- Блокировка IP после превышения лимита
- CAPTCHA для подозрительных запросов
- Обнаружение DDoS атаки
- Архивация неактивных пользователей

**Property-тесты**:
- Property 5: Очистка ключей
- Property 19: Шифрование данных в покое
- Property 22: Rate limiting

### Интеграционное тестирование

**Сценарии**:
1. End-to-end отправка сообщения между двумя клиентами
2. Установка видеозвонка с обменом медиа
3. Групповая конференция с 16 участниками
4. Синхронизация между несколькими устройствами
5. Восстановление после сетевого сбоя
6. Обработка DDoS атаки
7. Обход блокировки по IP-адресу
8. Обход DNS блокировки
9. Обход DPI блокировки
10. Автоматическое переключение транспортов
11. Подключение через различные типы прокси
12. Работа через Tor

**Инструменты**:
- Playwright/Cypress для UI тестов
- WebRTC тестовые фреймворки для медиа
- Сетевые симуляторы для тестирования в условиях плохого соединения
- Симуляторы блокировок (iptables, DNS hijacking)

### Тестирование противодействия блокировкам

**Сценарии блокировок**:
1. **IP блокировка**: Блокировка всех IP-адресов основных серверов
2. **DNS блокировка**: Подмена DNS записей
3. **DPI блокировка**: Фильтрация по сигнатурам протокола
4. **Протокольная блокировка**: Блокировка WebSocket соединений
5. **Throttling**: Искусственное замедление трафика

**Тестовые проверки**:
- Система успешно обходит каждый тип блокировки
- Время переключения на альтернативный метод < 5 секунд
- Пользователь получает уведомление о проблемах с доступом
- Автоматическое обновление списка серверов работает
- Обфускация трафика не обнаруживается DPI

**Property-тесты**:
- Property 24: Автоматическое переключение транспорта
- Property 25: Обфускация трафика
- Property 26: Работа через прокси
- Property 27: Переключение на резервные серверы
- Property 28: Альтернативные DNS

**Инструменты**:
- Сетевые симуляторы (tc, iptables)
- DPI симуляторы
- DNS hijacking tools
- Прокси-серверы для тестирования

### Нагрузочное тестирование

**Метрики**:
- 10,000 одновременных пользователей на сервер
- Задержка сообщений < 500ms
- Установка звонка < 3 секунды
- Задержка медиа < 150ms

**Инструменты**:
- k6 или Artillery для нагрузочного тестирования
- WebRTC stress testing tools

### Тестирование безопасности

**Проверки**:
- Penetration testing
- Анализ криптографических протоколов
- Аудит кода на уязвимости
- Тестирование на известные атаки (replay, MITM, etc.)

**Инструменты**:
- OWASP ZAP
- Burp Suite
- Cryptographic protocol analyzers

