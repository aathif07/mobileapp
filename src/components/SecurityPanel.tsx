import React from 'react';
import { CheckCircle2, ChevronRight, KeyRound, RotateCcw, Shield, Smartphone } from 'lucide-react';
import { Contact, LocalIdentity } from '../types/pulselink';
import { PWAInstallButton } from './PWAInstallButton';

interface SecurityPanelProps {
  identity: LocalIdentity | null;
  contacts: Contact[];
  onOpenSafetyNumber: (contact: Contact) => void;
  onResetDemo: () => void;
}

export const SecurityPanel: React.FC<SecurityPanelProps> = ({
  identity,
  contacts,
  onOpenSafetyNumber,
  onResetDemo,
}) => {
  return (
    <div className="space-y-5">
      {/* Device Cryptographic Identity */}
      <section className="rounded-2xl bg-white border border-[#D5DFDA] p-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#ECFDF5] text-[#047857] flex items-center justify-center shrink-0">
            <KeyRound className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-sm font-semibold text-[#0F1714]">
              Local E2EE Identity
            </h3>
            <p className="text-xs text-[#4A5B54] truncate">
              {identity?.deviceName ?? 'Field Handset'} · ECDH P-256 + HKDF-SHA256
            </p>
          </div>
        </div>

        <div className="mt-3.5 rounded-xl bg-[#F8FAF9] border border-[#E2E8E5] p-3 space-y-1.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#4A5B54]">Cipher Suite</span>
            <span className="font-mono font-medium text-[#0F1714]">AES-GCM-256</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#4A5B54]">Public Key (X)</span>
            <span className="font-mono text-[#0F1714] truncate max-w-[165px]">
              {identity?.publicKeyJwk.x ?? 'Generating…'}
            </span>
          </div>
        </div>
      </section>

      {/* Contact Verification Roster */}
      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="font-display text-sm font-semibold text-[#0F1714]">
            Peer Safety Numbers
          </h3>
          <span className="text-[11px] text-[#4A5B54]">
            {contacts.filter((c) => c.verified).length}/{contacts.length} verified
          </span>
        </div>

        <div className="divide-y divide-[#E6ECE9] rounded-2xl bg-white border border-[#D5DFDA] overflow-hidden">
          {contacts.map((contact) => (
            <button
              key={contact.id}
              type="button"
              onClick={() => onOpenSafetyNumber(contact)}
              className="w-full min-h-[56px] px-3.5 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-[#F8FAF9] transition-colors cursor-pointer"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#0F1714] truncate">{contact.name}</p>
                <p className="mt-0.5 text-[11px] text-[#4A5B54] flex items-center gap-1.5">
                  {contact.verified ? (
                    <span className="inline-flex items-center gap-1 text-[#047857] font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[#B45309] font-medium">
                      <Shield className="w-3.5 h-3.5 shrink-0" />
                      Unverified
                    </span>
                  )}
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">Key #{contact.keyGeneration}</span>
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#7D8F87] shrink-0" />
            </button>
          ))}
        </div>
      </section>

      {/* Installable Mobile PWA Card */}
      <section className="rounded-2xl bg-white border border-[#D5DFDA] p-4">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-9 h-9 rounded-xl bg-[#ECFDF5] text-[#047857] flex items-center justify-center shrink-0">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold text-[#0F1714]">
              Mobile App (Offline PWA)
            </h3>
            <p className="text-xs text-[#4A5B54]">
              Standalone home-screen app with cached assets
            </p>
          </div>
        </div>
        <p className="text-xs text-[#4A5B54] leading-relaxed mb-3.5">
          Install PulseLink directly on Android or iOS for your capstone presentation. Service worker caching allows launching and queuing encrypted messages even in Airplane Mode.
        </p>
        <PWAInstallButton variant="card" />
      </section>

      {/* Capstone Demo Reset */}
      <section className="border-t border-[#E2E8E5] pt-4">
        <button
          type="button"
          onClick={onResetDemo}
          className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#D5DFDA] bg-white text-xs font-semibold text-[#4A5B54] hover:text-[#B91C1C] hover:border-[#FECACA] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Demo Conversations &amp; Regenerate Keys</span>
        </button>
      </section>
    </div>
  );
};
