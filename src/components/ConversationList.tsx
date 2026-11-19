import React, { useState } from 'react';
import { Clock, Search, ShieldCheck, UserPlus } from 'lucide-react';
import { ChatMessage, Contact } from '../types/pulselink';
import { formatClockTime } from '../lib/network';

interface ConversationListProps {
  contacts: Contact[];
  messages: ChatMessage[];
  activeContactId: string;
  onSelectContact: (contactId: string) => void;
  onOpenNewContact: () => void;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  contacts,
  messages,
  activeContactId,
  onSelectContact,
  onOpenNewContact,
}) => {
  const [query, setQuery] = useState('');

  const filtered = contacts.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.role.toLowerCase().includes(q) ||
      c.region.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Search & New Contact Toolbar */}
      <div className="p-3.5 border-b border-[#E2E8E5] space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold text-[#0F1714]">
            Encrypted Channels
          </h2>
          <button
            type="button"
            onClick={onOpenNewContact}
            aria-label="Add new encrypted contact"
            className="min-h-[38px] px-2.5 rounded-xl text-xs font-semibold text-[#047857] hover:bg-[#ECFDF5] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>New Peer</span>
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-[#6B7E76] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search field nodes…"
            aria-label="Search contacts"
            className="w-full min-h-[40px] pl-9 pr-3 rounded-xl bg-[#F8FAF9] border border-[#D5DFDA] text-sm text-[#0F1714] placeholder:text-[#6B7E76] focus:bg-white focus:border-[#047857] focus:outline-none"
          />
        </div>
      </div>

      {/* Contact Rows */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#EEF2F0]">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#4A5B54]">
            No contacts match &ldquo;{query}&rdquo;.
          </div>
        ) : (
          filtered.map((contact) => {
            const thread = messages.filter((m) => m.contactId === contact.id);
            const lastMsg = thread[thread.length - 1];
            const queuedCount = thread.filter(
              (m) => m.sender === 'me' && (m.delivery.status === 'queued' || m.delivery.status === 'sending')
            ).length;
            const isSelected = contact.id === activeContactId;

            const previewText = !lastMsg
              ? `ECDH P-256 ready · ${contact.region}`
              : lastMsg.type === 'image'
              ? `Tiny Image · ${lastMsg.text}`
              : lastMsg.type === 'voice'
              ? `Voice Note (${lastMsg.voice?.durationSec ?? 3}s)`
              : lastMsg.text;

            return (
              <button
                key={contact.id}
                type="button"
                onClick={() => onSelectContact(contact.id)}
                className={`w-full min-h-[72px] px-3.5 py-3 text-left flex items-center gap-3 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#ECFDF5]'
                    : 'bg-white hover:bg-[#F8FAF9]'
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${contact.avatarTone}`}
                >
                  {contact.initials}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-display text-sm font-semibold text-[#0F1714] truncate flex items-center gap-1">
                      <span className="truncate">{contact.name}</span>
                      {contact.verified && (
                        <ShieldCheck
                          className="w-3.5 h-3.5 text-[#047857] shrink-0"
                          aria-label="Verified identity"
                        />
                      )}
                    </span>
                    <span className="font-mono text-[11px] text-[#4A5B54] tabular-nums shrink-0">
                      {lastMsg ? formatClockTime(lastMsg.timestamp) : contact.lastActiveText}
                    </span>
                  </div>

                  <p className="mt-0.5 text-xs text-[#4A5B54] truncate">
                    {lastMsg?.sender === 'me' ? 'You: ' : ''}
                    {previewText}
                  </p>

                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#6B7E76]">
                    <span className="truncate">{contact.role}</span>
                    {queuedCount > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 text-[#B45309] font-semibold shrink-0">
                          <Clock className="w-3 h-3" />
                          <span>{queuedCount} queued</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
