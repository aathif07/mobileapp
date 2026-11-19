import React from 'react';
import { CheckCircle2, RefreshCw, Shield, ShieldCheck, X } from 'lucide-react';
import { Contact } from '../types/pulselink';

interface SafetyNumberSheetProps {
  contact: Contact | null;
  onClose: () => void;
  onToggleVerified: (contactId: string) => void;
  onRotateKeys: (contactId: string) => void;
}

export const SafetyNumberSheet: React.FC<SafetyNumberSheetProps> = ({
  contact,
  onClose,
  onToggleVerified,
  onRotateKeys,
}) => {
  if (!contact) return null;

  const blocks = contact.safetyNumber.split(' ');

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0F1714]/50 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white border border-[#D5DFDA] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1.5 bg-[#D5DFDA] rounded-full mx-auto mb-4 sm:hidden" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-lg font-semibold text-[#0F1714]">
              Verify Safety Number
            </h3>
            <p className="mt-0.5 text-xs text-[#4A5B54]">
              {contact.name} · ECDH P-256 Key Gen #{contact.keyGeneration}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close safety number sheet"
            className="min-w-[44px] min-h-[44px] -mr-2 -mt-2 flex items-center justify-center rounded-xl text-[#4A5B54] hover:bg-[#EFF3F1] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Visual Deterministic Identity Grid */}
        <div className="mt-5 flex flex-col items-center">
          <div
            className="grid grid-cols-8 gap-1 p-3 rounded-2xl bg-[#F8FAF9] border border-[#D5DFDA]"
            aria-label="Cryptographic visual fingerprint"
          >
            {contact.safetyGrid.map((filled, idx) => (
              <span
                key={idx}
                className={`w-3.5 h-3.5 rounded-[3px] ${
                  filled ? 'bg-[#047857]' : 'bg-[#E2E9E5]'
                }`}
              />
            ))}
          </div>
          <p className="mt-2.5 text-xs text-center text-[#4A5B54] max-w-xs">
            Compare these 60 digits with {contact.name} in person or over voice radio to confirm zero man-in-the-middle interception.
          </p>
        </div>

        {/* 60-Digit Monospace Safety Number */}
        <div className="mt-4 rounded-2xl bg-[#F8FAF9] border border-[#D5DFDA] p-4">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-y-2.5 gap-x-2 text-center font-mono text-sm font-semibold text-[#0F1714] tabular-nums tracking-wider">
            {blocks.map((block, i) => (
              <span key={i}>{block}</span>
            ))}
          </div>
        </div>

        {/* Public Key Excerpt */}
        <div className="mt-4 text-xs text-[#4A5B54] flex items-center justify-between gap-3 border-t border-[#E6ECE9] pt-3">
          <span>Peer ECDH P-256 X-Coord</span>
          <span className="font-mono text-[#0F1714] truncate max-w-[180px]">
            {contact.publicKeyJwk.x ?? '—'}
          </span>
        </div>

        {/* Actions */}
        <div className="mt-5 space-y-2.5">
          <button
            type="button"
            onClick={() => onToggleVerified(contact.id)}
            className={`w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              contact.verified
                ? 'bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] hover:bg-[#D1FAE5]'
                : 'bg-[#047857] text-white hover:bg-[#065F46]'
            }`}
          >
            {contact.verified ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Verified Identity (Tap to Clear)</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Mark Safety Number as Verified</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => onRotateKeys(contact.id)}
            className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#D5DFDA] bg-white text-sm font-medium text-[#0F1714] hover:bg-[#EFF3F1] transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-[#4A5B54]" />
            <span>Rotate Session Keys (Forward Secrecy Demo)</span>
          </button>
        </div>

        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-[#4A5B54]">
          <Shield className="w-3.5 h-3.5 text-[#047857]" />
          <span>Rotating keys generates a fresh P-256 pair and invalidates old verification</span>
        </p>
      </div>
    </div>
  );
};
