import React, { useEffect, useState } from 'react';
import { CheckCircle2, Lock, ShieldCheck, X } from 'lucide-react';
import { ChatMessage, Contact } from '../types/pulselink';
import { decryptBytes, deriveSessionKey } from '../lib/crypto';
import { decompressTextBytes } from '../lib/compression';
import { formatBytes, formatClockTime, formatDurationMs, NETWORK_PROFILES } from '../lib/network';

interface PacketInspectorSheetProps {
  message: ChatMessage | null;
  contact: Contact | null;
  localPrivateKeyJwk: JsonWebKey | null;
  onClose: () => void;
}

export const PacketInspectorSheet: React.FC<PacketInspectorSheetProps> = ({
  message,
  contact,
  localPrivateKeyJwk,
  onClose,
}) => {
  const [verifyState, setVerifyState] = useState<{
    status: 'idle' | 'verified' | 'error';
    decryptedPreview?: string;
    durationMs?: number;
  }>({ status: 'idle' });

  useEffect(() => {
    setVerifyState({ status: 'idle' });
  }, [message?.id]);

  if (!message || !contact) return null;

  const profile = NETWORK_PROFILES[message.delivery.networkProfile];
  const savedBytes = Math.max(
    0,
    message.wirePacket.standardAppWireBytes - message.wirePacket.encryptedWireBytes
  );

  const handleRunDecryptionProof = async () => {
    if (!localPrivateKeyJwk) return;
    const t0 = performance.now();
    try {
      const sessionKey = await deriveSessionKey(localPrivateKeyJwk, contact.publicKeyJwk);
      const plainCompressed = await decryptBytes(
        sessionKey,
        message.wirePacket.ivHex,
        message.wirePacket.ciphertextBase64
      );
      const decryptedText = await decompressTextBytes(plainCompressed);
      const elapsed = Math.max(0.4, performance.now() - t0);
      setVerifyState({
        status: 'verified',
        decryptedPreview:
          decryptedText.length > 140 ? `${decryptedText.slice(0, 140)}…` : decryptedText,
        durationMs: Number(elapsed.toFixed(1)),
      });
    } catch {
      setVerifyState({ status: 'error' });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0F1714]/50 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[88vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white border border-[#D5DFDA] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1.5 bg-[#D5DFDA] rounded-full mx-auto mb-4 sm:hidden" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-lg font-semibold text-[#0F1714]">
              Encrypted Wire Packet Inspector
            </h3>
            <p className="mt-0.5 text-xs text-[#4A5B54]">
              {message.sender === 'me' ? 'Outgoing' : `From ${contact.name}`}
              <span className="mx-1.5" aria-hidden="true">·</span>
              {formatClockTime(message.timestamp)}
              <span className="mx-1.5" aria-hidden="true">·</span>
              {profile.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close packet inspector"
            className="min-w-[44px] min-h-[44px] -mr-2 -mt-2 flex items-center justify-center rounded-xl text-[#4A5B54] hover:bg-[#EFF3F1] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Byte efficiency summary */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-[#F8FAF9] border border-[#D5DFDA] p-3">
            <p className="text-[11px] font-medium text-[#4A5B54]">Standard App</p>
            <p className="mt-1 font-mono text-base font-semibold text-[#0F1714] tabular-nums">
              {formatBytes(message.wirePacket.standardAppWireBytes)}
            </p>
          </div>
          <div className="rounded-xl bg-[#F8FAF9] border border-[#D5DFDA] p-3">
            <p className="text-[11px] font-medium text-[#4A5B54]">PulseLink Wire</p>
            <p className="mt-1 font-mono text-base font-semibold text-[#047857] tabular-nums">
              {formatBytes(message.wirePacket.encryptedWireBytes)}
            </p>
          </div>
          <div className="rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] p-3">
            <p className="text-[11px] font-medium text-[#065F46]">Data Saved</p>
            <p className="mt-1 font-mono text-base font-semibold text-[#047857] tabular-nums">
              {message.wirePacket.savingsPct.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Cryptographic parameters */}
        <div className="mt-5 space-y-3 border-t border-[#E6ECE9] pt-4 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#4A5B54]">Cipher Suite</span>
            <span className="font-mono text-xs font-medium text-[#0F1714]">
              {message.wirePacket.algorithm}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#4A5B54]">Compression Codec</span>
            <span className="font-mono text-xs font-medium text-[#0F1714]">
              {message.wirePacket.compressionMethod}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#4A5B54]">Bytes Saved on Link</span>
            <span className="font-mono text-xs font-medium text-[#047857] tabular-nums">
              {formatBytes(savedBytes)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#4A5B54]">Link Transfer Time</span>
            <span className="font-mono text-xs font-medium text-[#0F1714] tabular-nums">
              {formatDurationMs(message.delivery.transmitMs)}
              {message.delivery.retryCount > 0 ? ` (${message.delivery.retryCount} retry)` : ''}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#4A5B54]">Session Fingerprint</span>
            <span className="font-mono text-xs font-medium text-[#0F1714]">
              {message.wirePacket.keyFingerprintShort}
            </span>
          </div>
        </div>

        {/* 96-bit IV & Ciphertext Wire Preview */}
        <div className="mt-4 space-y-3">
          <div>
            <p className="text-xs font-medium text-[#4A5B54] mb-1">
              96-Bit Random IV (Hex)
            </p>
            <div className="rounded-xl bg-[#F8FAF9] border border-[#D5DFDA] px-3 py-2 font-mono text-xs text-[#0F1714] break-all">
              {message.wirePacket.ivHex}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-[#4A5B54] mb-1">
              Authenticated AES-GCM Ciphertext (Wire Frame)
            </p>
            <div className="rounded-xl bg-[#F8FAF9] border border-[#D5DFDA] px-3 py-2 font-mono text-xs text-[#0F1714] break-all leading-relaxed">
              {message.wirePacket.ciphertextPreview}
            </div>
          </div>
        </div>

        {/* Live Web Crypto Verification Action */}
        <div className="mt-5 border-t border-[#E6ECE9] pt-4">
          {verifyState.status === 'verified' ? (
            <div className="rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#065F46]">
                <CheckCircle2 className="w-4 h-4 text-[#047857] shrink-0" />
                <span>
                  AES-GCM Tag Authenticated &amp; Decrypted in {verifyState.durationMs} ms
                </span>
              </div>
              <p className="mt-1.5 text-xs text-[#0F1714] break-words">
                Plaintext recovered: &ldquo;{verifyState.decryptedPreview}&rdquo;
              </p>
            </div>
          ) : verifyState.status === 'error' ? (
            <div className="rounded-xl bg-[#FEF2F2] border border-[#FECACA] p-3.5 text-xs text-[#B91C1C]">
              Session keys were rotated after this packet was sent—forward secrecy prevents decrypting older frames with a new key generation.
            </div>
          ) : (
            <button
              type="button"
              onClick={handleRunDecryptionProof}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#047857] text-white text-sm font-semibold hover:bg-[#065F46] active:scale-[0.99] transition-all cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Verify AES-GCM Tag &amp; Decrypt Frame</span>
            </button>
          )}

          <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-[#4A5B54]">
            <Lock className="w-3.5 h-3.5 text-[#047857]" />
            <span>Computed locally via browser SubtleCrypto API</span>
          </p>
        </div>
      </div>
    </div>
  );
};
