export type NetworkProfileId = 'offline' | 'gprs_2g' | 'edge' | 'basic_3g' | 'fast_4g';

export interface NetworkProfile {
  id: NetworkProfileId;
  name: string;
  shortLabel: string;
  kbps: number;
  rttMs: number;
  packetLossPct: number;
  description: string;
  autoDownloadLimitBytes: number;
}

export type MessageType = 'text' | 'image' | 'voice';
export type DeliveryStatus = 'queued' | 'sending' | 'sent' | 'delivered' | 'failed';
export type MessagePriority = 'normal' | 'urgent';

export interface WirePacketMeta {
  algorithm: 'ECDH-P256 + AES-GCM-256';
  compressionMethod: 'DEFLATE-RAW' | 'CANVAS-JPEG' | 'OPUS-8KBPS' | 'PCM-8KHZ';
  ivHex: string;
  ciphertextBase64: string;
  ciphertextPreview: string;
  rawBytes: number;
  standardAppWireBytes: number;
  compressedBytes: number;
  encryptedWireBytes: number;
  savingsPct: number;
  keyFingerprintShort: string;
}

export interface ImageAttachment {
  dataUrl: string;
  originalBytes: number;
  compressedBytes: number;
  width: number;
  height: number;
  presetLabel: string;
  caption?: string;
}

export interface VoiceAttachment {
  dataUrl: string;
  durationSec: number;
  bitrateKbps: number;
  originalBytes: number;
  compressedBytes: number;
  peaks: number[];
  transcriptHint?: string;
}

export interface ChatMessage {
  id: string;
  contactId: string;
  sender: 'me' | 'peer';
  type: MessageType;
  text: string;
  timestamp: number;
  image?: ImageAttachment;
  voice?: VoiceAttachment;
  mediaDeferred?: boolean;
  wirePacket: WirePacketMeta;
  delivery: {
    status: DeliveryStatus;
    progressPct: number;
    priority: MessagePriority;
    retryCount: number;
    transmitMs: number;
    networkProfile: NetworkProfileId;
  };
}

export interface Contact {
  id: string;
  name: string;
  role: string;
  region: string;
  initials: string;
  avatarTone: string;
  verified: boolean;
  keyGeneration: number;
  safetyNumber: string;
  safetyGrid: boolean[];
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
  lastActiveText: string;
}

export interface LocalIdentity {
  deviceName: string;
  handle: string;
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
  createdAt: number;
}

export interface SampleFieldPhoto {
  id: string;
  title: string;
  location: string;
  src: string;
  caption: string;
}

export type ImagePresetId = 'ultra_tiny' | 'standard_2g' | 'clear_640';

export interface ImagePreset {
  id: ImagePresetId;
  label: string;
  maxDim: number;
  quality: number;
  targetNote: string;
}

export type MobileTab = 'chats' | 'queue' | 'meter' | 'security';
export type DesktopInspectorTab = 'meter' | 'queue' | 'security';
