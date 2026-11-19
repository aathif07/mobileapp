/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Clock,
  MessageSquare,
  ShieldCheck,
  Signal,
  SignalLow,
  SignalMedium,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  ChatMessage,
  Contact,
  DesktopInspectorTab,
  LocalIdentity,
  MessagePriority,
  MobileTab,
  NetworkProfileId,
  VoiceAttachment,
} from './types/pulselink';
import {
  computeSafetyNumber,
  deriveSessionKey,
  encryptBytes,
  generateIdentityKeyPair,
} from './lib/crypto';
import {
  compressImageSource,
  compressTextBytes,
  estimateStandardAppWireBytes,
  synthesizeCompactVoiceNote,
  TinyImageResult,
} from './lib/compression';
import {
  calculateTransmitDurationMs,
  NETWORK_PROFILES,
} from './lib/network';
import {
  generatePeerReply,
  SAMPLE_FIELD_PHOTOS,
  SEED_CONTACTS,
} from './lib/peers';
import {
  clearPersistedState,
  loadPersistedState,
  savePersistedState,
} from './lib/storage';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { PWAInstallButton } from './components/PWAInstallButton';
import { ConversationList } from './components/ConversationList';
import { ChatThreadView } from './components/ChatThreadView';
import { ByteMeterPanel } from './components/ByteMeterPanel';
import { OutboxQueuePanel } from './components/OutboxQueuePanel';
import { SecurityPanel } from './components/SecurityPanel';
import { PacketInspectorSheet } from './components/PacketInspectorSheet';
import { TinyImageLabSheet } from './components/TinyImageLabSheet';
import { SafetyNumberSheet } from './components/SafetyNumberSheet';
import { NewContactSheet } from './components/NewContactSheet';

const AVATAR_TONES = [
  'bg-[#047857] text-white',
  'bg-[#0F766E] text-white',
  'bg-[#1D4ED8] text-white',
  'bg-[#B45309] text-white',
  'bg-[#4338CA] text-white',
];

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function buildEncryptedPacket(
  localPrivateKeyJwk: JsonWebKey,
  peerPublicKeyJwk: JsonWebKey,
  localPublicKeyJwk: JsonWebKey,
  kind: 'text' | 'image' | 'voice',
  textPayload: string,
  mediaPayloadBytes?: { originalBytes: number; compressedBytes: number }
) {
  const sessionKey = await deriveSessionKey(localPrivateKeyJwk, peerPublicKeyJwk);
  const { rawBytes, compressedBytes } = await compressTextBytes(textPayload);
  const envelope = await encryptBytes(sessionKey, compressedBytes);
  const safety = await computeSafetyNumber(localPublicKeyJwk, peerPublicKeyJwk);

  if (kind === 'image' && mediaPayloadBytes) {
    const encryptedWireBytes = mediaPayloadBytes.compressedBytes + envelope.encryptedByteLength;
    const standardAppWireBytes = estimateStandardAppWireBytes(
      mediaPayloadBytes.originalBytes,
      'image'
    );
    const savingsPct = Math.max(
      0,
      Math.min(99.5, ((standardAppWireBytes - encryptedWireBytes) / standardAppWireBytes) * 100)
    );
    return {
      algorithm: 'ECDH-P256 + AES-GCM-256' as const,
      compressionMethod: 'CANVAS-JPEG' as const,
      ivHex: envelope.ivHex,
      ciphertextBase64: envelope.ciphertextBase64,
      ciphertextPreview: envelope.ciphertextPreview,
      rawBytes: mediaPayloadBytes.originalBytes,
      standardAppWireBytes,
      compressedBytes: mediaPayloadBytes.compressedBytes,
      encryptedWireBytes,
      savingsPct,
      keyFingerprintShort: safety.shortFingerprint,
    };
  }

  if (kind === 'voice' && mediaPayloadBytes) {
    const encryptedWireBytes = mediaPayloadBytes.compressedBytes + envelope.encryptedByteLength;
    const standardAppWireBytes = estimateStandardAppWireBytes(
      mediaPayloadBytes.originalBytes,
      'voice'
    );
    const savingsPct = Math.max(
      0,
      Math.min(99.5, ((standardAppWireBytes - encryptedWireBytes) / standardAppWireBytes) * 100)
    );
    return {
      algorithm: 'ECDH-P256 + AES-GCM-256' as const,
      compressionMethod: 'OPUS-8KBPS' as const,
      ivHex: envelope.ivHex,
      ciphertextBase64: envelope.ciphertextBase64,
      ciphertextPreview: envelope.ciphertextPreview,
      rawBytes: mediaPayloadBytes.originalBytes,
      standardAppWireBytes,
      compressedBytes: mediaPayloadBytes.compressedBytes,
      encryptedWireBytes,
      savingsPct,
      keyFingerprintShort: safety.shortFingerprint,
    };
  }

  const standardAppWireBytes = estimateStandardAppWireBytes(rawBytes.byteLength, 'text');
  const encryptedWireBytes = envelope.encryptedByteLength;
  const savingsPct = Math.max(
    0,
    Math.min(99.5, ((standardAppWireBytes - encryptedWireBytes) / standardAppWireBytes) * 100)
  );

  return {
    algorithm: 'ECDH-P256 + AES-GCM-256' as const,
    compressionMethod: 'DEFLATE-RAW' as const,
    ivHex: envelope.ivHex,
    ciphertextBase64: envelope.ciphertextBase64,
    ciphertextPreview: envelope.ciphertextPreview,
    rawBytes: rawBytes.byteLength,
    standardAppWireBytes,
    compressedBytes: compressedBytes.byteLength,
    encryptedWireBytes,
    savingsPct,
    keyFingerprintShort: safety.shortFingerprint,
  };
}

async function createSeedWorkspace(): Promise<{
  identity: LocalIdentity;
  contacts: Contact[];
  messages: ChatMessage[];
}> {
  const localKeys = await generateIdentityKeyPair();
  const identity: LocalIdentity = {
    deviceName: 'Field Handset #01',
    handle: 'relay-node-01',
    publicKeyJwk: localKeys.publicKeyJwk,
    privateKeyJwk: localKeys.privateKeyJwk,
    createdAt: Date.now(),
  };

  const contacts: Contact[] = [];
  const messages: ChatMessage[] = [];

  for (const spec of SEED_CONTACTS) {
    const peerKeys = await generateIdentityKeyPair();
    const safety = await computeSafetyNumber(identity.publicKeyJwk, peerKeys.publicKeyJwk);
    const contact: Contact = {
      id: spec.id,
      name: spec.name,
      role: spec.role,
      region: spec.region,
      initials: spec.initials,
      avatarTone: spec.avatarTone,
      verified: spec.verified,
      keyGeneration: 1,
      safetyNumber: safety.safetyNumber,
      safetyGrid: safety.safetyGrid,
      publicKeyJwk: peerKeys.publicKeyJwk,
      privateKeyJwk: peerKeys.privateKeyJwk,
      lastActiveText: spec.lastActiveText,
    };
    contacts.push(contact);

    for (const item of spec.openingMessages) {
      const ts = Date.now() - item.minutesAgo * 60 * 1000;

      if (item.includeSamplePhotoId) {
        const sample =
          SAMPLE_FIELD_PHOTOS.find((p) => p.id === item.includeSamplePhotoId) ??
          SAMPLE_FIELD_PHOTOS[1];
        let tinyImg: TinyImageResult;
        try {
          tinyImg = await compressImageSource(sample.src, 'standard_2g');
        } catch {
          tinyImg = {
            dataUrl: sample.src,
            originalBytes: 420 * 1024,
            compressedBytes: 14800,
            width: 400,
            height: 300,
            presetLabel: '2G Standard 400px',
            savingsPct: 96.4,
          };
        }

        const wirePacket = await buildEncryptedPacket(
          identity.privateKeyJwk,
          contact.publicKeyJwk,
          identity.publicKeyJwk,
          'image',
          item.text,
          {
            originalBytes: tinyImg.originalBytes,
            compressedBytes: tinyImg.compressedBytes,
          }
        );

        messages.push({
          id: makeId('msg'),
          contactId: contact.id,
          sender: item.sender,
          type: 'image',
          text: item.text,
          timestamp: ts,
          image: {
            dataUrl: tinyImg.dataUrl,
            originalBytes: tinyImg.originalBytes,
            compressedBytes: tinyImg.compressedBytes,
            width: tinyImg.width,
            height: tinyImg.height,
            presetLabel: tinyImg.presetLabel,
            caption: sample.title,
          },
          mediaDeferred: false,
          wirePacket,
          delivery: {
            status: 'delivered',
            progressPct: 100,
            priority: 'normal',
            retryCount: 0,
            transmitMs: calculateTransmitDurationMs(
              wirePacket.encryptedWireBytes,
              NETWORK_PROFILES.edge
            ),
            networkProfile: 'edge',
          },
        });
      } else if (item.includeVoiceHint) {
        const voice = synthesizeCompactVoiceNote(3.6, 2, item.includeVoiceHint);
        const wirePacket = await buildEncryptedPacket(
          identity.privateKeyJwk,
          contact.publicKeyJwk,
          identity.publicKeyJwk,
          'voice',
          item.includeVoiceHint,
          {
            originalBytes: voice.originalBytes,
            compressedBytes: voice.compressedBytes,
          }
        );

        messages.push({
          id: makeId('msg'),
          contactId: contact.id,
          sender: item.sender,
          type: 'voice',
          text: item.text,
          timestamp: ts,
          voice,
          wirePacket,
          delivery: {
            status: 'delivered',
            progressPct: 100,
            priority: 'normal',
            retryCount: 0,
            transmitMs: calculateTransmitDurationMs(
              wirePacket.encryptedWireBytes,
              NETWORK_PROFILES.gprs_2g
            ),
            networkProfile: 'gprs_2g',
          },
        });
      } else {
        const wirePacket = await buildEncryptedPacket(
          identity.privateKeyJwk,
          contact.publicKeyJwk,
          identity.publicKeyJwk,
          'text',
          item.text
        );
        messages.push({
          id: makeId('msg'),
          contactId: contact.id,
          sender: item.sender,
          type: 'text',
          text: item.text,
          timestamp: ts,
          wirePacket,
          delivery: {
            status: 'delivered',
            progressPct: 100,
            priority: 'normal',
            retryCount: 0,
            transmitMs: calculateTransmitDurationMs(
              wirePacket.encryptedWireBytes,
              NETWORK_PROFILES.gprs_2g
            ),
            networkProfile: 'gprs_2g',
          },
        });
      }
    }
  }

  return { identity, contacts, messages };
}

export default function App() {
  const deviceOnline = useOnlineStatus();

  const [isReady, setIsReady] = useState(false);
  const [identity, setIdentity] = useState<LocalIdentity | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeContactId, setActiveContactId] = useState<string>('');
  const [networkProfile, setNetworkProfile] = useState<NetworkProfileId>('gprs_2g');
  const [dataSaverMode, setDataSaverMode] = useState<boolean>(true);

  // Navigation state
  const [mobileTab, setMobileTab] = useState<MobileTab>('chats');
  const [mobileInThread, setMobileInThread] = useState<boolean>(false);
  const [desktopInspectorTab, setDesktopInspectorTab] = useState<DesktopInspectorTab>('meter');

  // Sheets & Modals
  const [inspectedMessage, setInspectedMessage] = useState<ChatMessage | null>(null);
  const [tinyImageOpen, setTinyImageOpen] = useState(false);
  const [safetyModalContactId, setSafetyModalContactId] = useState<string | null>(null);
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const transmittingIdRef = useRef<string | null>(null);
  const networkProfileRef = useRef<NetworkProfileId>(networkProfile);
  const deviceOnlineRef = useRef<boolean>(deviceOnline);
  const dataSaverRef = useRef<boolean>(dataSaverMode);

  useEffect(() => {
    networkProfileRef.current = networkProfile;
  }, [networkProfile]);

  useEffect(() => {
    deviceOnlineRef.current = deviceOnline;
  }, [deviceOnline]);

  useEffect(() => {
    dataSaverRef.current = dataSaverMode;
  }, [dataSaverMode]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 3200);
  }, []);

  // Boot & hydrate from IndexedDB or seed fresh Web Crypto keys
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadPersistedState();
      if (cancelled) return;
      if (saved && saved.identity && saved.contacts.length > 0) {
        // Recover any interrupted 'sending' messages back to 'queued' safely
        const recoveredMsgs = saved.messages.map((m) =>
          m.delivery.status === 'sending'
            ? { ...m, delivery: { ...m.delivery, status: 'queued' as const, progressPct: 0 } }
            : m
        );
        setIdentity(saved.identity);
        setContacts(saved.contacts);
        setMessages(recoveredMsgs);
        setActiveContactId(saved.contacts[0].id);
        setNetworkProfile(saved.networkProfile);
        setDataSaverMode(saved.dataSaverMode);
        setIsReady(true);
        return;
      }

      const seeded = await createSeedWorkspace();
      if (cancelled) return;
      setIdentity(seeded.identity);
      setContacts(seeded.contacts);
      setMessages(seeded.messages);
      setActiveContactId(seeded.contacts[0].id);
      setIsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist state changes to IndexedDB for real offline durability
  useEffect(() => {
    if (!isReady || !identity) return;
    savePersistedState({
      identity,
      contacts,
      messages,
      networkProfile,
      dataSaverMode,
    });
  }, [isReady, identity, contacts, messages, networkProfile, dataSaverMode]);

  const effectiveProfileId: NetworkProfileId = deviceOnline ? networkProfile : 'offline';
  const activeProfile = NETWORK_PROFILES[effectiveProfileId];

  const enqueueIncomingPeerReply = useCallback(
    async (contact: Contact, triggerText: string, kind: 'text' | 'image' | 'voice') => {
      if (!identity) return;
      const replyPlan = generatePeerReply(contact, triggerText, kind);
      const profile = NETWORK_PROFILES[networkProfileRef.current];
      if (!deviceOnlineRef.current || profile.id === 'offline') return;

      const wirePacket = await buildEncryptedPacket(
        identity.privateKeyJwk,
        contact.publicKeyJwk,
        identity.publicKeyJwk,
        'text',
        replyPlan.text
      );
      const transitMs = calculateTransmitDurationMs(wirePacket.encryptedWireBytes, profile);

      window.setTimeout(() => {
        if (!deviceOnlineRef.current || networkProfileRef.current === 'offline') return;
        const incomingMsg: ChatMessage = {
          id: makeId('msg'),
          contactId: contact.id,
          sender: 'peer',
          type: 'text',
          text: replyPlan.text,
          timestamp: Date.now(),
          wirePacket,
          delivery: {
            status: 'delivered',
            progressPct: 100,
            priority: 'normal',
            retryCount: 0,
            transmitMs: transitMs,
            networkProfile: networkProfileRef.current,
          },
        };
        setMessages((prev) => [...prev, incomingMsg]);
      }, Math.min(2600, Math.max(700, transitMs)));
    },
    [identity]
  );

  // Store-and-Forward Sequential Queue Engine
  useEffect(() => {
    if (!isReady) return;
    if (effectiveProfileId === 'offline') return;
    if (transmittingIdRef.current) return;

    const queued = messages
      .filter((m) => m.sender === 'me' && m.delivery.status === 'queued')
      .sort((a, b) => {
        if (a.delivery.priority === 'urgent' && b.delivery.priority !== 'urgent') return -1;
        if (b.delivery.priority === 'urgent' && a.delivery.priority !== 'urgent') return 1;
        return a.timestamp - b.timestamp;
      });

    if (queued.length === 0) return;

    const nextMsg = queued[0];
    const profile = NETWORK_PROFILES[effectiveProfileId];
    transmittingIdRef.current = nextMsg.id;

    // Simulate realistic packet-loss retry on 2G/EDGE
    const hadLoss =
      profile.packetLossPct > 0 && Math.random() * 100 < profile.packetLossPct;
    const baseDuration = calculateTransmitDurationMs(
      nextMsg.wirePacket.encryptedWireBytes,
      profile
    );
    const totalDuration = hadLoss ? Math.round(baseDuration * 1.45) : baseDuration;

    setMessages((prev) =>
      prev.map((m) =>
        m.id === nextMsg.id
          ? {
              ...m,
              delivery: {
                ...m.delivery,
                status: 'sending',
                progressPct: 8,
                retryCount: hadLoss ? m.delivery.retryCount + 1 : m.delivery.retryCount,
                networkProfile: profile.id,
              },
            }
          : m
      )
    );

    const startTime = performance.now();
    const intervalId = window.setInterval(() => {
      if (!deviceOnlineRef.current || networkProfileRef.current === 'offline') {
        window.clearInterval(intervalId);
        transmittingIdRef.current = null;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === nextMsg.id
              ? { ...m, delivery: { ...m.delivery, status: 'queued', progressPct: 0 } }
              : m
          )
        );
        return;
      }

      const elapsed = performance.now() - startTime;
      const pct = Math.min(99, Math.max(8, Math.round((elapsed / totalDuration) * 100)));

      if (elapsed >= totalDuration) {
        window.clearInterval(intervalId);
        transmittingIdRef.current = null;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === nextMsg.id
              ? {
                  ...m,
                  delivery: {
                    ...m.delivery,
                    status: 'delivered',
                    progressPct: 100,
                    transmitMs: totalDuration,
                    networkProfile: networkProfileRef.current,
                  },
                }
              : m
          )
        );

        const peerContact = contacts.find((c) => c.id === nextMsg.contactId);
        if (peerContact) {
          void enqueueIncomingPeerReply(peerContact, nextMsg.text, nextMsg.type);
        }
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === nextMsg.id
              ? { ...m, delivery: { ...m.delivery, progressPct: pct } }
              : m
          )
        );
      }
    }, 90);

    return () => {
      // Allow active transmission timer to settle cleanly unless unmounted
    };
  }, [isReady, effectiveProfileId, messages, contacts, enqueueIncomingPeerReply]);

  const activeContact = useMemo(
    () => contacts.find((c) => c.id === activeContactId) ?? contacts[0] ?? null,
    [contacts, activeContactId]
  );

  const activeThreadMessages = useMemo(
    () => messages.filter((m) => m.contactId === activeContact?.id),
    [messages, activeContact]
  );

  const queuedCount = useMemo(
    () =>
      messages.filter(
        (m) =>
          m.sender === 'me' &&
          (m.delivery.status === 'queued' || m.delivery.status === 'sending')
      ).length,
    [messages]
  );

  const handleSendText = async (text: string, priority: MessagePriority) => {
    if (!identity || !activeContact) return;
    const wirePacket = await buildEncryptedPacket(
      identity.privateKeyJwk,
      activeContact.publicKeyJwk,
      identity.publicKeyJwk,
      'text',
      text
    );

    const msg: ChatMessage = {
      id: makeId('msg'),
      contactId: activeContact.id,
      sender: 'me',
      type: 'text',
      text,
      timestamp: Date.now(),
      wirePacket,
      delivery: {
        status: 'queued',
        progressPct: 0,
        priority,
        retryCount: 0,
        transmitMs: 0,
        networkProfile: effectiveProfileId,
      },
    };
    setMessages((prev) => [...prev, msg]);
    if (effectiveProfileId === 'offline') {
      showToast('Encrypted packet saved to Store-and-Forward Queue.');
    }
  };

  const handleSendImage = async (imgResult: TinyImageResult, caption: string) => {
    if (!identity || !activeContact) return;
    const wirePacket = await buildEncryptedPacket(
      identity.privateKeyJwk,
      activeContact.publicKeyJwk,
      identity.publicKeyJwk,
      'image',
      caption,
      {
        originalBytes: imgResult.originalBytes,
        compressedBytes: imgResult.compressedBytes,
      }
    );

    const msg: ChatMessage = {
      id: makeId('msg'),
      contactId: activeContact.id,
      sender: 'me',
      type: 'image',
      text: caption,
      timestamp: Date.now(),
      image: {
        dataUrl: imgResult.dataUrl,
        originalBytes: imgResult.originalBytes,
        compressedBytes: imgResult.compressedBytes,
        width: imgResult.width,
        height: imgResult.height,
        presetLabel: imgResult.presetLabel,
        caption,
      },
      mediaDeferred: false,
      wirePacket,
      delivery: {
        status: 'queued',
        progressPct: 0,
        priority: 'normal',
        retryCount: 0,
        transmitMs: 0,
        networkProfile: effectiveProfileId,
      },
    };
    setMessages((prev) => [...prev, msg]);
    showToast(
      effectiveProfileId === 'offline'
        ? `Tiny image (${Math.round(imgResult.compressedBytes / 1024)} KB) queued offline.`
        : `Sending encrypted tiny image (-${imgResult.savingsPct.toFixed(0)}%).`
    );
  };

  const handleSendVoice = async (voice: VoiceAttachment, priority: MessagePriority) => {
    if (!identity || !activeContact) return;
    const label = voice.transcriptHint ?? `Ultra-compressed ${voice.durationSec}s voice note`;
    const wirePacket = await buildEncryptedPacket(
      identity.privateKeyJwk,
      activeContact.publicKeyJwk,
      identity.publicKeyJwk,
      'voice',
      label,
      {
        originalBytes: voice.originalBytes,
        compressedBytes: voice.compressedBytes,
      }
    );

    const msg: ChatMessage = {
      id: makeId('msg'),
      contactId: activeContact.id,
      sender: 'me',
      type: 'voice',
      text: label,
      timestamp: Date.now(),
      voice,
      wirePacket,
      delivery: {
        status: 'queued',
        progressPct: 0,
        priority,
        retryCount: 0,
        transmitMs: 0,
        networkProfile: effectiveProfileId,
      },
    };
    setMessages((prev) => [...prev, msg]);
    if (effectiveProfileId === 'offline') {
      showToast('Encrypted 8 kbps voice note queued for next signal window.');
    }
  };

  const handleTriggerDemoIncoming = async (contactId: string) => {
    if (!identity) return;
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;

    if (effectiveProfileId === 'offline') {
      showToast('Link is offline — reconnect to 2G/EDGE to receive incoming frames.');
      return;
    }

    // Alternate between a deferred 2G tiny field photo and a compact voice/text update
    const peerMsgCount = messages.filter(
      (m) => m.contactId === contactId && m.sender === 'peer'
    ).length;

    if (peerMsgCount % 2 === 0) {
      const sample = SAMPLE_FIELD_PHOTOS[peerMsgCount % SAMPLE_FIELD_PHOTOS.length];
      const tinyImg = await compressImageSource(sample.src, 'ultra_tiny');
      const wirePacket = await buildEncryptedPacket(
        identity.privateKeyJwk,
        contact.publicKeyJwk,
        identity.publicKeyJwk,
        'image',
        sample.caption,
        {
          originalBytes: tinyImg.originalBytes,
          compressedBytes: tinyImg.compressedBytes,
        }
      );

      const shouldDefer =
        dataSaverRef.current &&
        (effectiveProfileId === 'gprs_2g' || effectiveProfileId === 'edge');

      const incoming: ChatMessage = {
        id: makeId('msg'),
        contactId,
        sender: 'peer',
        type: 'image',
        text: sample.caption,
        timestamp: Date.now(),
        image: {
          dataUrl: tinyImg.dataUrl,
          originalBytes: tinyImg.originalBytes,
          compressedBytes: tinyImg.compressedBytes,
          width: tinyImg.width,
          height: tinyImg.height,
          presetLabel: tinyImg.presetLabel,
          caption: sample.title,
        },
        mediaDeferred: shouldDefer,
        wirePacket,
        delivery: {
          status: 'delivered',
          progressPct: 100,
          priority: 'normal',
          retryCount: 0,
          transmitMs: calculateTransmitDurationMs(
            wirePacket.encryptedWireBytes,
            activeProfile
          ),
          networkProfile: effectiveProfileId,
        },
      };
      setMessages((prev) => [...prev, incoming]);
      showToast(
        shouldDefer
          ? 'Incoming photo deferred by 2G Data-Saver — tap bubble to fetch.'
          : 'Encrypted compressed field photo received.'
      );
    } else {
      const voice = synthesizeCompactVoiceNote(
        2.9,
        peerMsgCount + 3,
        `${contact.role}: Signal holding steady on backup solar repeater. Over.`
      );
      const wirePacket = await buildEncryptedPacket(
        identity.privateKeyJwk,
        contact.publicKeyJwk,
        identity.publicKeyJwk,
        'voice',
        voice.transcriptHint ?? 'Incoming voice check',
        {
          originalBytes: voice.originalBytes,
          compressedBytes: voice.compressedBytes,
        }
      );
      const incoming: ChatMessage = {
        id: makeId('msg'),
        contactId,
        sender: 'peer',
        type: 'voice',
        text: voice.transcriptHint ?? 'Incoming voice check',
        timestamp: Date.now(),
        voice,
        wirePacket,
        delivery: {
          status: 'delivered',
          progressPct: 100,
          priority: 'normal',
          retryCount: 0,
          transmitMs: calculateTransmitDurationMs(
            wirePacket.encryptedWireBytes,
            activeProfile
          ),
          networkProfile: effectiveProfileId,
        },
      };
      setMessages((prev) => [...prev, incoming]);
      showToast('Incoming 8 kbps encrypted voice note received.');
    }
  };

  const handleDownloadDeferredMedia = (messageId: string) => {
    if (effectiveProfileId === 'offline') {
      showToast('Reconnect to 2G or EDGE to fetch this compressed image.');
      return;
    }
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, mediaDeferred: false } : m))
    );
  };

  const handlePrioritizeMessage = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, delivery: { ...m.delivery, priority: 'urgent' } }
          : m
      )
    );
    showToast('Moved encrypted packet to front of outbox queue.');
  };

  const handleCancelQueuedMessage = (messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    showToast('Removed packet from outbox queue.');
  };

  const handleToggleVerified = (contactId: string) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, verified: !c.verified } : c))
    );
  };

  const handleRotateKeys = async (contactId: string) => {
    if (!identity) return;
    const freshKeys = await generateIdentityKeyPair();
    const safety = await computeSafetyNumber(identity.publicKeyJwk, freshKeys.publicKeyJwk);
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId
          ? {
              ...c,
              verified: false,
              keyGeneration: c.keyGeneration + 1,
              publicKeyJwk: freshKeys.publicKeyJwk,
              privateKeyJwk: freshKeys.privateKeyJwk,
              safetyNumber: safety.safetyNumber,
              safetyGrid: safety.safetyGrid,
            }
          : c
      )
    );
    showToast('Session keys rotated — safety number updated and verification reset.');
  };

  const handleCreateContact = async (name: string, role: string, region: string) => {
    if (!identity) return;
    const keys = await generateIdentityKeyPair();
    const safety = await computeSafetyNumber(identity.publicKeyJwk, keys.publicKeyJwk);
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');

    const newContact: Contact = {
      id: makeId('contact'),
      name,
      role,
      region,
      initials: initials || 'FN',
      avatarTone: AVATAR_TONES[contacts.length % AVATAR_TONES.length],
      verified: false,
      keyGeneration: 1,
      safetyNumber: safety.safetyNumber,
      safetyGrid: safety.safetyGrid,
      publicKeyJwk: keys.publicKeyJwk,
      privateKeyJwk: keys.privateKeyJwk,
      lastActiveText: 'Just now',
    };

    setContacts((prev) => [newContact, ...prev]);
    setActiveContactId(newContact.id);
    setMobileTab('chats');
    setMobileInThread(true);
    showToast(`Generated ECDH P-256 keys for ${name}.`);
  };

  const handleResetDemo = async () => {
    await clearPersistedState();
    const seeded = await createSeedWorkspace();
    setIdentity(seeded.identity);
    setContacts(seeded.contacts);
    setMessages(seeded.messages);
    setActiveContactId(seeded.contacts[0].id);
    setNetworkProfile('gprs_2g');
    setDataSaverMode(true);
    setSafetyModalContactId(null);
    setInspectedMessage(null);
    showToast('Workspace reset with fresh Web Crypto identity keys.');
  };

  const handleChangeNetworkProfile = (nextId: NetworkProfileId) => {
    setNetworkProfile(nextId);
    if (nextId === 'offline') {
      showToast('Simulated link Offline — outgoing packets will queue locally.');
    } else if (queuedCount > 0) {
      showToast(
        `Reconnected on ${NETWORK_PROFILES[nextId].shortLabel} — flushing ${queuedCount} queued packet${queuedCount === 1 ? '' : 's'}.`
      );
    }
  };

  const renderLinkIcon = (id: NetworkProfileId) => {
    switch (id) {
      case 'offline':
        return <WifiOff className="w-3.5 h-3.5 shrink-0" />;
      case 'gprs_2g':
        return <SignalLow className="w-3.5 h-3.5 shrink-0" />;
      case 'edge':
        return <SignalMedium className="w-3.5 h-3.5 shrink-0" />;
      case 'basic_3g':
        return <Signal className="w-3.5 h-3.5 shrink-0" />;
      case 'fast_4g':
        return <Wifi className="w-3.5 h-3.5 shrink-0" />;
    }
  };

  const safetyModalContact = useMemo(
    () => contacts.find((c) => c.id === safetyModalContactId) ?? null,
    [contacts, safetyModalContactId]
  );

  const inspectedContact = useMemo(
    () =>
      inspectedMessage
        ? contacts.find((c) => c.id === inspectedMessage.contactId) ?? activeContact
        : null,
    [inspectedMessage, contacts, activeContact]
  );

  if (!isReady) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-[#F8FAF9] text-[#0F1714] p-6">
        <div className="w-12 h-12 rounded-2xl bg-[#047857] flex items-center justify-center shadow-xs">
          <img src="/icon.svg" alt="PulseLink" className="w-8 h-8" />
        </div>
        <h1 className="mt-4 font-display text-xl font-bold tracking-tight">PulseLink</h1>
        <p className="mt-1 text-sm text-[#4A5B54]">
          Initializing Web Crypto ECDH P-256 keys…
        </p>
      </div>
    );
  }

  return (
    <div className="h-dvh w-full flex flex-col bg-[#F8FAF9] text-[#0F1714] overflow-hidden">
      {/* Compact 3-Zone Top Bar (48px mobile / 56px desktop — strictly within mobile sticky cap) */}
      <header className="h-12 lg:h-14 shrink-0 px-3.5 lg:px-6 bg-white border-b border-[#D5DFDA] flex items-center justify-between gap-4 z-30">
        {/* Zone 1: Clean single-line brand wordmark */}
        <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <img src="/icon.svg" alt="" className="w-7 h-7 rounded-lg shrink-0" />
          <span className="font-display text-lg font-bold tracking-tight text-[#0F1714]">
            PulseLink
          </span>
        </div>

        {/* Zone 2: Desktop clean nav links to jump right-rail focus */}
        <nav
          aria-label="Workspace panels"
          className="hidden lg:flex items-center gap-7 text-sm font-medium text-[#4A5B54]"
        >
          <button
            type="button"
            onClick={() => setDesktopInspectorTab('meter')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              desktopInspectorTab === 'meter'
                ? 'border-[#047857] text-[#0F1714] font-semibold'
                : 'border-transparent hover:text-[#0F1714]'
            }`}
          >
            Bandwidth Meter
          </button>
          <button
            type="button"
            onClick={() => setDesktopInspectorTab('queue')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              desktopInspectorTab === 'queue'
                ? 'border-[#047857] text-[#0F1714] font-semibold'
                : 'border-transparent hover:text-[#0F1714]'
            }`}
          >
            Outbox Queue{queuedCount > 0 ? ` (${queuedCount})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setDesktopInspectorTab('security')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              desktopInspectorTab === 'security'
                ? 'border-[#047857] text-[#0F1714] font-semibold'
                : 'border-transparent hover:text-[#0F1714]'
            }`}
          >
            E2EE Security
          </button>
          <button
            type="button"
            onClick={() => setTinyImageOpen(true)}
            className="py-1 border-b-2 border-transparent hover:text-[#0F1714] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Tiny Image Lab
          </button>
        </nav>

        {/* Zone 3: Mobile network shortcut + Mandatory In-App PWA Install Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setMobileTab('meter');
              setMobileInThread(false);
              setDesktopInspectorTab('meter');
            }}
            className={`lg:hidden min-h-[36px] px-2.5 rounded-xl text-xs font-semibold font-mono tabular-nums inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              effectiveProfileId === 'offline'
                ? 'bg-[#FEF2F2] text-[#B91C1C]'
                : effectiveProfileId === 'gprs_2g' || effectiveProfileId === 'edge'
                ? 'bg-[#FFFBEB] text-[#92400E]'
                : 'bg-[#ECFDF5] text-[#065F46]'
            }`}
            title="Change simulated bandwidth profile"
          >
            {renderLinkIcon(effectiveProfileId)}
            <span>{activeProfile.shortLabel}</span>
          </button>

          <PWAInstallButton variant="header" />
        </div>
      </header>

      {/* Main Responsive Workspace: Mobile Single-Column vs Desktop 3-Column Full Viewport */}
      <main className="flex-1 min-h-0 flex overflow-hidden">
        {/* LEFT COLUMN: Conversations List (Always visible on desktop; visible on mobile Chats tab when not in thread) */}
        <aside
          className={`${
            mobileTab === 'chats' && !mobileInThread ? 'flex' : 'hidden'
          } lg:flex flex-col w-full lg:w-[276px] xl:w-[304px] shrink-0 border-r border-[#D5DFDA] bg-white min-h-0`}
        >
          <ConversationList
            contacts={contacts}
            messages={messages}
            activeContactId={activeContact?.id ?? ''}
            onSelectContact={(id) => {
              setActiveContactId(id);
              setMobileInThread(true);
            }}
            onOpenNewContact={() => setNewContactOpen(true)}
          />
        </aside>

        {/* CENTER COLUMN: Active Encrypted Chat Thread (Desktop always visible; Mobile when in thread) */}
        <section
          className={`${
            mobileTab === 'chats' && mobileInThread ? 'flex' : 'hidden'
          } lg:flex flex-1 flex-col min-w-0 min-h-0`}
        >
          {activeContact ? (
            <ChatThreadView
              contact={activeContact}
              messages={activeThreadMessages}
              activeProfile={activeProfile}
              onBackMobile={() => setMobileInThread(false)}
              onSendText={handleSendText}
              onSendVoice={handleSendVoice}
              onOpenTinyImageLab={() => setTinyImageOpen(true)}
              onOpenSafetyNumber={(c) => setSafetyModalContactId(c.id)}
              onInspectMessage={(m) => setInspectedMessage(m)}
              onDownloadDeferredMedia={handleDownloadDeferredMedia}
              onTriggerDemoIncoming={handleTriggerDemoIncoming}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center p-6 text-sm text-[#4A5B54]">
              Select a contact to start encrypted low-bandwidth messaging.
            </div>
          )}
        </section>

        {/* RIGHT COLUMN (Desktop Inspector) + Mobile Dedicated Views (Queue / Meter / Security) */}
        <aside
          className={`${
            mobileTab !== 'chats' ? 'flex' : 'hidden'
          } lg:flex flex-col w-full lg:w-[336px] xl:w-[376px] shrink-0 border-l border-[#D5DFDA] bg-[#F8FAF9] min-h-0`}
        >
          {/* Desktop Inspector Segmented Switcher */}
          <div className="hidden lg:block px-4 pt-3.5 pb-2.5 bg-white border-b border-[#E2E8E5]">
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#EFF3F1]">
              <button
                type="button"
                onClick={() => setDesktopInspectorTab('meter')}
                className={`min-h-[36px] rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  desktopInspectorTab === 'meter'
                    ? 'bg-white text-[#0F1714] shadow-xs'
                    : 'text-[#4A5B54] hover:text-[#0F1714]'
                }`}
              >
                Meter
              </button>
              <button
                type="button"
                onClick={() => setDesktopInspectorTab('queue')}
                className={`min-h-[36px] rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  desktopInspectorTab === 'queue'
                    ? 'bg-white text-[#0F1714] shadow-xs'
                    : 'text-[#4A5B54] hover:text-[#0F1714]'
                }`}
              >
                Queue{queuedCount > 0 ? ` (${queuedCount})` : ''}
              </button>
              <button
                type="button"
                onClick={() => setDesktopInspectorTab('security')}
                className={`min-h-[36px] rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  desktopInspectorTab === 'security'
                    ? 'bg-white text-[#0F1714] shadow-xs'
                    : 'text-[#4A5B54] hover:text-[#0F1714]'
                }`}
              >
                Security
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 pb-20 lg:pb-6">
            {/* Render matching view on Mobile vs Desktop */}
            <div className="lg:hidden">
              {mobileTab === 'meter' && (
                <ByteMeterPanel
                  networkProfile={effectiveProfileId}
                  onChangeNetworkProfile={handleChangeNetworkProfile}
                  dataSaverMode={dataSaverMode}
                  onToggleDataSaver={() => setDataSaverMode((v) => !v)}
                  messages={messages}
                  onInspectMessage={(m) => setInspectedMessage(m)}
                  deviceOnline={deviceOnline}
                />
              )}
              {mobileTab === 'queue' && (
                <OutboxQueuePanel
                  messages={messages}
                  contacts={contacts}
                  networkProfile={effectiveProfileId}
                  onChangeNetworkProfile={handleChangeNetworkProfile}
                  onPrioritizeMessage={handlePrioritizeMessage}
                  onCancelQueuedMessage={handleCancelQueuedMessage}
                  onInspectMessage={(m) => setInspectedMessage(m)}
                />
              )}
              {mobileTab === 'security' && (
                <SecurityPanel
                  identity={identity}
                  contacts={contacts}
                  onOpenSafetyNumber={(c) => setSafetyModalContactId(c.id)}
                  onResetDemo={handleResetDemo}
                />
              )}
            </div>

            <div className="hidden lg:block">
              {desktopInspectorTab === 'meter' && (
                <ByteMeterPanel
                  networkProfile={effectiveProfileId}
                  onChangeNetworkProfile={handleChangeNetworkProfile}
                  dataSaverMode={dataSaverMode}
                  onToggleDataSaver={() => setDataSaverMode((v) => !v)}
                  messages={messages}
                  onInspectMessage={(m) => setInspectedMessage(m)}
                  deviceOnline={deviceOnline}
                />
              )}
              {desktopInspectorTab === 'queue' && (
                <OutboxQueuePanel
                  messages={messages}
                  contacts={contacts}
                  networkProfile={effectiveProfileId}
                  onChangeNetworkProfile={handleChangeNetworkProfile}
                  onPrioritizeMessage={handlePrioritizeMessage}
                  onCancelQueuedMessage={handleCancelQueuedMessage}
                  onInspectMessage={(m) => setInspectedMessage(m)}
                />
              )}
              {desktopInspectorTab === 'security' && (
                <SecurityPanel
                  identity={identity}
                  contacts={contacts}
                  onOpenSafetyNumber={(c) => setSafetyModalContactId(c.id)}
                  onResetDemo={handleResetDemo}
                />
              )}
            </div>
          </div>
        </aside>
      </main>

      {/* Mobile Fixed Bottom Navigation Bar (56px, hidden when inside active chat thread so composer has thumb zone) */}
      {!(mobileTab === 'chats' && mobileInThread) && (
        <nav
          aria-label="Mobile navigation"
          className="lg:hidden shrink-0 h-14 pb-safe bg-white/95 backdrop-blur-md border-t border-[#D5DFDA] grid grid-cols-4 items-center z-40"
        >
          <button
            type="button"
            onClick={() => {
              setMobileTab('chats');
              setMobileInThread(false);
            }}
            className={`h-full min-h-[44px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
              mobileTab === 'chats' ? 'text-[#047857]' : 'text-[#4A5B54]'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-[10px] font-semibold tracking-tight">Chats</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMobileTab('queue');
              setMobileInThread(false);
            }}
            className={`h-full min-h-[44px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
              mobileTab === 'queue' ? 'text-[#047857]' : 'text-[#4A5B54]'
            }`}
          >
            <Clock className="w-5 h-5" />
            <span className="text-[10px] font-semibold tracking-tight">
              Queue{queuedCount > 0 ? ` (${queuedCount})` : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMobileTab('meter');
              setMobileInThread(false);
            }}
            className={`h-full min-h-[44px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
              mobileTab === 'meter' ? 'text-[#047857]' : 'text-[#4A5B54]'
            }`}
          >
            <Activity className="w-5 h-5" />
            <span className="text-[10px] font-semibold tracking-tight">Meter</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMobileTab('security');
              setMobileInThread(false);
            }}
            className={`h-full min-h-[44px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
              mobileTab === 'security' ? 'text-[#047857]' : 'text-[#4A5B54]'
            }`}
          >
            <ShieldCheck className="w-5 h-5" />
            <span className="text-[10px] font-semibold tracking-tight">Security</span>
          </button>
        </nav>
      )}

      {/* Real Device Offline Connectivity Banner */}
      {!deviceOnline && (
        <div
          role="status"
          className="fixed bottom-16 lg:bottom-4 left-3 right-3 sm:left-auto sm:right-4 z-40 flex items-center gap-2 rounded-xl bg-[#B45309] px-3.5 py-2 text-xs font-semibold text-white shadow-lg"
        >
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>Device Offline — Cached PWA active; messages queued locally.</span>
        </div>
      )}

      {/* Non-intrusive Action Feedback Toast */}
      {toastMessage && (
        <div
          role="status"
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-[92vw] rounded-xl bg-[#0F1714] px-4 py-2.5 text-xs font-medium text-white shadow-lg"
        >
          {toastMessage}
        </div>
      )}

      {/* Interactive Bottom Sheets & Modals */}
      <PacketInspectorSheet
        message={inspectedMessage}
        contact={inspectedContact}
        localPrivateKeyJwk={identity?.privateKeyJwk ?? null}
        onClose={() => setInspectedMessage(null)}
      />

      <TinyImageLabSheet
        open={tinyImageOpen}
        activeProfile={activeProfile}
        onClose={() => setTinyImageOpen(false)}
        onSendImage={handleSendImage}
      />

      <SafetyNumberSheet
        contact={safetyModalContact}
        onClose={() => setSafetyModalContactId(null)}
        onToggleVerified={handleToggleVerified}
        onRotateKeys={handleRotateKeys}
      />

      <NewContactSheet
        open={newContactOpen}
        onClose={() => setNewContactOpen(false)}
        onCreateContact={handleCreateContact}
      />
    </div>
  );
}
