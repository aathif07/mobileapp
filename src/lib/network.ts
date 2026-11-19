import { ChatMessage, NetworkProfile, NetworkProfileId } from '../types/pulselink';

export const NETWORK_PROFILES: Record<NetworkProfileId, NetworkProfile> = {
  offline: {
    id: 'offline',
    name: 'Offline (No Signal)',
    shortLabel: 'Offline',
    kbps: 0,
    rttMs: 0,
    packetLossPct: 100,
    description: 'Messages encrypt locally and hold in the persistent Store-and-Forward queue.',
    autoDownloadLimitBytes: 0,
  },
  gprs_2g: {
    id: 'gprs_2g',
    name: '2G GPRS (32 kbps)',
    shortLabel: '2G · 32 kbps',
    kbps: 32,
    rttMs: 850,
    packetLossPct: 8,
    description: 'Remote rural cell tower edge. High latency; deferred images & ultra-tiny payloads.',
    autoDownloadLimitBytes: 8 * 1024,
  },
  edge: {
    id: 'edge',
    name: 'EDGE (128 kbps)',
    shortLabel: 'EDGE · 128 kbps',
    kbps: 128,
    rttMs: 420,
    packetLossPct: 3,
    description: 'Constrained regional coverage. Compact binary framing & low-bitrate voice.',
    autoDownloadLimitBytes: 24 * 1024,
  },
  basic_3g: {
    id: 'basic_3g',
    name: '3G Basic (512 kbps)',
    shortLabel: '3G · 512 kbps',
    kbps: 512,
    rttMs: 160,
    packetLossPct: 1,
    description: 'Town center relay. Fast encrypted text and rapid compressed media delivery.',
    autoDownloadLimitBytes: 128 * 1024,
  },
  fast_4g: {
    id: 'fast_4g',
    name: '4G / Wi-Fi (4 Mbps)',
    shortLabel: '4G · Fast',
    kbps: 4000,
    rttMs: 45,
    packetLossPct: 0,
    description: 'Full broadband link for rapid queue flushing and instant sync.',
    autoDownloadLimitBytes: 2 * 1024 * 1024,
  },
};

export const NETWORK_PROFILE_LIST: NetworkProfile[] = [
  NETWORK_PROFILES.offline,
  NETWORK_PROFILES.gprs_2g,
  NETWORK_PROFILES.edge,
  NETWORK_PROFILES.basic_3g,
  NETWORK_PROFILES.fast_4g,
];

/**
 * Calculates realistic transmission time in milliseconds for a wire payload
 * given a network profile's throughput (kbps) and round-trip latency (rttMs).
 */
export function calculateTransmitDurationMs(
  wireBytes: number,
  profile: NetworkProfile
): number {
  if (profile.kbps <= 0) return Infinity;
  const bytesPerSec = (profile.kbps * 1000) / 8;
  const serializationMs = (wireBytes / bytesPerSec) * 1000;
  // Cap demo ceiling slightly for massive files while keeping 2G noticeably slower than 4G
  return Math.round(Math.min(9500, Math.max(180, profile.rttMs + serializationMs)));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function formatClockTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function exportBenchmarkCsv(messages: ChatMessage[]): void {
  const header = [
    'Message ID',
    'Timestamp',
    'Direction',
    'Type',
    'Network Profile',
    'Status',
    'Compression',
    'Standard App Wire (B)',
    'PulseLink Encrypted Wire (B)',
    'Data Saved (%)',
    'Transmit Time (ms)',
    'Retries',
    'AES-GCM IV (Hex)',
  ];

  const rows = messages.map((m) => [
    m.id,
    new Date(m.timestamp).toISOString(),
    m.sender,
    m.type,
    m.delivery.networkProfile,
    m.delivery.status,
    m.wirePacket.compressionMethod,
    m.wirePacket.standardAppWireBytes,
    m.wirePacket.encryptedWireBytes,
    m.wirePacket.savingsPct.toFixed(1),
    m.delivery.transmitMs,
    m.delivery.retryCount,
    m.wirePacket.ivHex,
  ]);

  const csv = [header, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pulselink-bandwidth-benchmark-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
