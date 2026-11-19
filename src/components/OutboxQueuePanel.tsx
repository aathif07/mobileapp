import React from 'react';
import { ArrowUp, Clock, Radio, Trash2, WifiOff } from 'lucide-react';
import { ChatMessage, Contact, NetworkProfileId } from '../types/pulselink';
import { formatBytes, formatClockTime, NETWORK_PROFILES } from '../lib/network';

interface OutboxQueuePanelProps {
  messages: ChatMessage[];
  contacts: Contact[];
  networkProfile: NetworkProfileId;
  onChangeNetworkProfile: (id: NetworkProfileId) => void;
  onPrioritizeMessage: (messageId: string) => void;
  onCancelQueuedMessage: (messageId: string) => void;
  onInspectMessage: (msg: ChatMessage) => void;
}

export const OutboxQueuePanel: React.FC<OutboxQueuePanelProps> = ({
  messages,
  contacts,
  networkProfile,
  onChangeNetworkProfile,
  onPrioritizeMessage,
  onCancelQueuedMessage,
  onInspectMessage,
}) => {
  const pendingMessages = messages
    .filter(
      (m) =>
        m.sender === 'me' &&
        (m.delivery.status === 'queued' ||
          m.delivery.status === 'sending' ||
          m.delivery.status === 'failed')
    )
    .sort((a, b) => {
      if (a.delivery.status === 'sending' && b.delivery.status !== 'sending') return -1;
      if (b.delivery.status === 'sending' && a.delivery.status !== 'sending') return 1;
      if (a.delivery.priority === 'urgent' && b.delivery.priority !== 'urgent') return -1;
      if (b.delivery.priority === 'urgent' && a.delivery.priority !== 'urgent') return 1;
      return a.timestamp - b.timestamp;
    });

  const queuedBytes = pendingMessages.reduce(
    (sum, m) => sum + m.wirePacket.encryptedWireBytes,
    0
  );

  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const profile = NETWORK_PROFILES[networkProfile];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-[#D5DFDA] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-sm font-semibold text-[#0F1714]">
              Store-and-Forward Outbox
            </h3>
            <p className="mt-0.5 text-xs text-[#4A5B54]">
              Encrypted packets persist locally in IndexedDB and auto-flush when signal returns.
            </p>
          </div>
          <span className="font-mono text-lg font-bold text-[#0F1714] tabular-nums shrink-0">
            {pendingMessages.length}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-[#4A5B54] border-t border-[#E6ECE9] pt-3">
          <span>Active Link: <strong className="text-[#0F1714]">{profile.shortLabel}</strong></span>
          <span className="font-mono tabular-nums">{formatBytes(queuedBytes)} queued</span>
        </div>

        <div className="mt-3">
          {networkProfile === 'offline' ? (
            <button
              type="button"
              onClick={() => onChangeNetworkProfile('gprs_2g')}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#047857] text-white text-xs font-semibold hover:bg-[#065F46] active:scale-[0.99] transition-all cursor-pointer"
            >
              <Radio className="w-4 h-4" />
              <span>Reconnect 2G (32 kbps) &amp; Flush Queue</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onChangeNetworkProfile('offline')}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#D5DFDA] bg-[#F8FAF9] text-[#0F1714] text-xs font-semibold hover:bg-[#EFF3F1] transition-colors cursor-pointer"
            >
              <WifiOff className="w-4 h-4 text-[#B45309]" />
              <span>Switch Offline to Test Store-and-Forward</span>
            </button>
          )}
        </div>
      </div>

      {/* Pending Packet List */}
      {pendingMessages.length === 0 ? (
        <div className="rounded-2xl bg-white border border-[#D5DFDA] p-6 text-center">
          <Clock className="w-6 h-6 text-[#9FB0A7] mx-auto" />
          <p className="mt-2 text-sm font-medium text-[#0F1714]">Outbox Queue Clear</p>
          <p className="mt-1 text-xs text-[#4A5B54] max-w-xs mx-auto leading-relaxed">
            Switch the link to Offline, then send texts, voice notes, or tiny images to watch encrypted packets wait safely for reconnection.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {pendingMessages.map((msg) => {
            const peer = contactById.get(msg.contactId);
            const isSending = msg.delivery.status === 'sending';
            const isUrgent = msg.delivery.priority === 'urgent';
            return (
              <div
                key={msg.id}
                className="rounded-xl bg-white border border-[#D5DFDA] p-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onInspectMessage(msg)}
                    className="text-left min-w-0 flex-1 cursor-pointer"
                  >
                    <p className="text-xs font-semibold text-[#0F1714] truncate">
                      To {peer?.name ?? 'Field Contact'}
                      {isUrgent && (
                        <span className="ml-2 text-[#B45309]">· Urgent Priority</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-[#4A5B54] truncate">
                      {msg.type === 'image'
                        ? `[Tiny Image] ${msg.text}`
                        : msg.type === 'voice'
                        ? `[Voice ${msg.voice?.durationSec ?? 3}s] ${msg.text}`
                        : msg.text}
                    </p>
                  </button>
                  <span className="font-mono text-xs font-semibold text-[#047857] tabular-nums shrink-0">
                    {formatBytes(msg.wirePacket.encryptedWireBytes)}
                  </span>
                </div>

                {isSending ? (
                  <div className="mt-2.5">
                    <div className="flex items-center justify-between text-[11px] font-mono text-[#047857] mb-1 tabular-nums">
                      <span>Transmitting over {profile.shortLabel}…</span>
                      <span>{msg.delivery.progressPct}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[#E2E8E5] overflow-hidden">
                      <div
                        className="h-full bg-[#047857] rounded-full transition-all duration-150"
                        style={{ width: `${msg.delivery.progressPct}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#E6ECE9] pt-2.5">
                    <span className="text-[11px] text-[#B45309] font-medium">
                      Encrypted &amp; Queued · {formatClockTime(msg.timestamp)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {!isUrgent && (
                        <button
                          type="button"
                          onClick={() => onPrioritizeMessage(msg.id)}
                          className="inline-flex items-center gap-1 min-h-[34px] px-2.5 rounded-lg border border-[#D5DFDA] text-[11px] font-semibold text-[#0F1714] hover:bg-[#EFF3F1] cursor-pointer"
                        >
                          <ArrowUp className="w-3 h-3" />
                          <span>Prioritize</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onCancelQueuedMessage(msg.id)}
                        aria-label="Cancel queued message"
                        className="inline-flex items-center justify-center min-h-[34px] min-w-[34px] rounded-lg border border-[#D5DFDA] text-[#B91C1C] hover:bg-[#FEF2F2] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
