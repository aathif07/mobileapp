import React from 'react';
import { Download, Signal, SignalLow, SignalMedium, Wifi, WifiOff } from 'lucide-react';
import { ChatMessage, NetworkProfileId } from '../types/pulselink';
import {
  exportBenchmarkCsv,
  formatBytes,
  formatDurationMs,
  NETWORK_PROFILE_LIST,
  NETWORK_PROFILES,
} from '../lib/network';

interface ByteMeterPanelProps {
  networkProfile: NetworkProfileId;
  onChangeNetworkProfile: (id: NetworkProfileId) => void;
  dataSaverMode: boolean;
  onToggleDataSaver: () => void;
  messages: ChatMessage[];
  onInspectMessage: (msg: ChatMessage) => void;
  deviceOnline: boolean;
}

export const ByteMeterPanel: React.FC<ByteMeterPanelProps> = ({
  networkProfile,
  onChangeNetworkProfile,
  dataSaverMode,
  onToggleDataSaver,
  messages,
  onInspectMessage,
  deviceOnline,
}) => {
  const active = NETWORK_PROFILES[networkProfile];

  const totalStandardBytes = messages.reduce(
    (sum, m) => sum + m.wirePacket.standardAppWireBytes,
    0
  );
  const totalPulseBytes = messages.reduce(
    (sum, m) => sum + m.wirePacket.encryptedWireBytes,
    0
  );
  const netSavedBytes = Math.max(0, totalStandardBytes - totalPulseBytes);
  const overallSavingsPct =
    totalStandardBytes > 0 ? (netSavedBytes / totalStandardBytes) * 100 : 0;

  // Airtime saved on a 32 kbps 2G GPRS link
  const airtimeSavedSec = netSavedBytes / ((32 * 1000) / 8);

  const recentPackets = [...messages].reverse().slice(0, 8);

  const renderProfileIcon = (id: NetworkProfileId) => {
    switch (id) {
      case 'offline':
        return <WifiOff className="w-4 h-4 shrink-0" />;
      case 'gprs_2g':
        return <SignalLow className="w-4 h-4 shrink-0" />;
      case 'edge':
        return <SignalMedium className="w-4 h-4 shrink-0" />;
      case 'basic_3g':
        return <Signal className="w-4 h-4 shrink-0" />;
      case 'fast_4g':
        return <Wifi className="w-4 h-4 shrink-0" />;
    }
  };

  return (
    <div className="space-y-5">
      {/* Network Throttle Simulator */}
      <section>
        <div className="flex items-baseline justify-between gap-2 mb-2.5">
          <h3 className="font-display text-sm font-semibold text-[#0F1714]">
            Bandwidth Throttle Simulator
          </h3>
          {!deviceOnline && (
            <span className="text-xs font-semibold text-[#B91C1C]">
              Device Offline
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          {NETWORK_PROFILE_LIST.map((profile) => {
            const isSelected = profile.id === networkProfile;
            const isOffline = profile.id === 'offline';
            const isConstrained = profile.id === 'gprs_2g' || profile.id === 'edge';
            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => onChangeNetworkProfile(profile.id)}
                className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                  isSelected
                    ? isOffline
                      ? 'bg-[#FEF2F2] border-[#DC2626] text-[#991B1B]'
                      : isConstrained
                      ? 'bg-[#FFFBEB] border-[#D97706] text-[#92400E]'
                      : 'bg-[#ECFDF5] border-[#047857] text-[#065F46]'
                    : 'bg-white border-[#D5DFDA] text-[#0F1714] hover:bg-[#F8FAF9]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {renderProfileIcon(profile.id)}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{profile.name}</p>
                    <p className="text-[11px] opacity-80 font-mono tabular-nums truncate">
                      {profile.id === 'offline'
                        ? '0 kbps · Store & Forward'
                        : `${profile.rttMs} ms RTT · ${profile.packetLossPct}% loss`}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold shrink-0">
                  {isSelected ? 'Active' : 'Select'}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-2 text-xs text-[#4A5B54] leading-relaxed">
          {active.description}
        </p>

        {/* Adaptive Data-Saver Toggle */}
        <div className="mt-3.5 flex items-center justify-between gap-3 rounded-xl bg-white border border-[#D5DFDA] px-3.5 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#0F1714]">Adaptive Data-Saver Mode</p>
            <p className="text-[11px] text-[#4A5B54]">
              Defer incoming images on 2G/EDGE until tapped
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={dataSaverMode}
            onClick={onToggleDataSaver}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
              dataSaverMode ? 'bg-[#047857]' : 'bg-[#CBD6D0]'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform ${
                dataSaverMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </section>

      {/* Live Byte Savings Meter */}
      <section className="border-t border-[#E2E8E5] pt-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="font-display text-sm font-semibold text-[#0F1714]">
            Live Byte Meter &amp; Benchmark
          </h3>
          <button
            type="button"
            onClick={() => exportBenchmarkCsv(messages)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#047857] hover:text-[#065F46] min-h-[36px] px-2 rounded-lg hover:bg-[#ECFDF5] transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl bg-white border border-[#D5DFDA] p-3">
            <p className="text-[11px] text-[#4A5B54]">PulseLink Sent</p>
            <p className="mt-1 font-mono text-lg font-bold text-[#047857] tabular-nums">
              {formatBytes(totalPulseBytes)}
            </p>
            <p className="mt-0.5 text-[11px] text-[#4A5B54] font-mono tabular-nums">
              vs {formatBytes(totalStandardBytes)} std
            </p>
          </div>

          <div className="rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] p-3">
            <p className="text-[11px] text-[#065F46]">Bandwidth Saved</p>
            <p className="mt-1 font-mono text-lg font-bold text-[#047857] tabular-nums">
              {overallSavingsPct.toFixed(1)}%
            </p>
            <p className="mt-0.5 text-[11px] text-[#065F46] font-mono tabular-nums">
              {formatBytes(netSavedBytes)} · {airtimeSavedSec.toFixed(0)}s 2G
            </p>
          </div>
        </div>

        {/* Visual comparison bar */}
        <div className="mt-3.5 rounded-xl bg-white border border-[#D5DFDA] p-3.5 space-y-2.5">
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-[#4A5B54]">Conventional Chat App</span>
              <span className="font-mono text-[#4A5B54] tabular-nums">
                {formatBytes(totalStandardBytes)}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#E2E8E5] overflow-hidden">
              <div className="h-full w-full bg-[#94A39B] rounded-full" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-semibold text-[#0F1714]">PulseLink Encrypted Wire</span>
              <span className="font-mono font-semibold text-[#047857] tabular-nums">
                {formatBytes(totalPulseBytes)}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#E2E8E5] overflow-hidden">
              <div
                className="h-full bg-[#047857] rounded-full transition-all duration-300"
                style={{
                  width: `${Math.max(
                    4,
                    totalStandardBytes > 0 ? (totalPulseBytes / totalStandardBytes) * 100 : 0
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Per-Packet Telemetry Log */}
      <section className="border-t border-[#E2E8E5] pt-5">
        <div className="flex items-baseline justify-between mb-2.5">
          <h3 className="font-display text-sm font-semibold text-[#0F1714]">
            Recent Wire Frames
          </h3>
          <span className="text-[11px] text-[#4A5B54]">Tap to inspect</span>
        </div>

        <div className="divide-y divide-[#E6ECE9] rounded-xl bg-white border border-[#D5DFDA] overflow-hidden">
          {recentPackets.length === 0 ? (
            <p className="p-4 text-xs text-[#4A5B54] text-center">
              Send a message to record encrypted wire telemetry.
            </p>
          ) : (
            recentPackets.map((msg) => (
              <button
                key={msg.id}
                type="button"
                onClick={() => onInspectMessage(msg)}
                className="w-full min-h-[48px] px-3.5 py-2.5 text-left hover:bg-[#F8FAF9] transition-colors flex items-center justify-between gap-3 cursor-pointer"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#0F1714] truncate">
                    {msg.type === 'image'
                      ? 'Tiny Image Frame'
                      : msg.type === 'voice'
                      ? '8 kbps Voice Frame'
                      : msg.text}
                  </p>
                  <p className="text-[11px] text-[#4A5B54] font-mono tabular-nums mt-0.5">
                    {msg.wirePacket.compressionMethod} · {formatDurationMs(msg.delivery.transmitMs)}
                  </p>
                </div>
                <div className="text-right shrink-0 font-mono tabular-nums">
                  <p className="text-xs font-semibold text-[#047857]">
                    {formatBytes(msg.wirePacket.encryptedWireBytes)}
                  </p>
                  <p className="text-[10px] text-[#4A5B54]">
                    -{msg.wirePacket.savingsPct.toFixed(0)}%
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
};
