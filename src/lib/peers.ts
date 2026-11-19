import { Contact, SampleFieldPhoto } from '../types/pulselink';

export const SAMPLE_FIELD_PHOTOS: SampleFieldPhoto[] = [
  {
    id: 'clinic',
    title: 'Highland Solar Clinic',
    location: 'Kinetu Ridge · Sector 4',
    src: '/src/assets/images/field_rural_clinic_1795057268077.jpg',
    caption: 'Solar inverter array running steady at 94% battery. Cold-chain vaccine fridge holding 4.2°C.',
  },
  {
    id: 'pump',
    title: 'Valley Water Pump',
    location: 'North Basin Co-op',
    src: '/src/assets/images/field_water_pump_1795057270984.jpg',
    caption: 'Main valve repaired and tank refilling after sunrise. Flow meter reads 18 L/min.',
  },
  {
    id: 'bridge',
    title: 'East River Truss Bridge',
    location: 'Route 9 Crossing',
    src: '/src/assets/images/field_bridge_road_1795057268833.jpg',
    caption: 'Water levels receded 40 cm below deck. Safe for light supply vehicles under 3.5 tons.',
  },
];

export interface SeedContactSpec {
  id: string;
  name: string;
  role: string;
  region: string;
  initials: string;
  avatarTone: string;
  verified: boolean;
  lastActiveText: string;
  openingMessages: Array<{
    sender: 'peer' | 'me';
    text: string;
    minutesAgo: number;
    includeVoiceHint?: string;
    includeSamplePhotoId?: string;
  }>;
}

export const SEED_CONTACTS: SeedContactSpec[] = [
  {
    id: 'contact-amara',
    name: 'Dr. Amara Okafor',
    role: 'Highland Health Clinic',
    region: 'Kinetu Ridge · 2G Cell',
    initials: 'AO',
    avatarTone: 'bg-[#047857] text-white',
    verified: true,
    lastActiveText: '2m ago',
    openingMessages: [
      {
        sender: 'peer',
        text: 'Morning dispatch: insulin & pediatric amoxicillin crates arrived safely. Solar cold-chain is holding at 4.1°C despite cloudy weather.',
        minutesAgo: 28,
      },
      {
        sender: 'me',
        text: 'Confirmed, logging cold-chain status. Do you need additional oral rehydration packets on Thursday’s courier run?',
        minutesAgo: 24,
      },
      {
        sender: 'peer',
        text: 'Yes—20 cartons would cover both upper ridge posts. Signal just dropped to 2G GPRS here so keeping updates text-first.',
        minutesAgo: 18,
      },
    ],
  },
  {
    id: 'contact-mateo',
    name: 'Mateo Silva',
    role: 'Valley Water Co-op',
    region: 'North Basin · EDGE',
    initials: 'MS',
    avatarTone: 'bg-[#0F766E] text-white',
    verified: true,
    lastActiveText: '11m ago',
    openingMessages: [
      {
        sender: 'peer',
        text: 'Completed pressure check on Borehole Station #2. Replacing the intake gasket restored full gravity feed to the lower terrace.',
        minutesAgo: 62,
      },
      {
        sender: 'peer',
        text: 'Attached a compressed 14 KB inspection photo from the solar pump tank so you can verify the valve fitting.',
        minutesAgo: 59,
        includeSamplePhotoId: 'pump',
      },
    ],
  },
  {
    id: 'contact-priya',
    name: 'Priya Nair',
    role: 'District Relay Hub',
    region: 'Central Dispatch · 3G',
    initials: 'PN',
    avatarTone: 'bg-[#1D4ED8] text-white',
    verified: false,
    lastActiveText: '19m ago',
    openingMessages: [
      {
        sender: 'peer',
        text: 'Weather desk issued a heavy rain advisory for East River corridor starting 20:00. Please queue bridge checks before crossing.',
        minutesAgo: 95,
      },
      {
        sender: 'me',
        text: 'Copy that. Switching to data-saver mode and queuing route checkpoints offline if cell tower drops.',
        minutesAgo: 88,
      },
    ],
  },
  {
    id: 'contact-kofi',
    name: 'Kofi Mensah',
    role: 'Regional Supply Truck',
    region: 'Route 9 · Intermittent',
    initials: 'KM',
    avatarTone: 'bg-[#B45309] text-white',
    verified: false,
    lastActiveText: '34m ago',
    openingMessages: [
      {
        sender: 'peer',
        text: 'Cleared checkpoint 3 with clinic solar batteries and grain sacks. Sending a quick 8 kbps voice memo from the bridge approach.',
        minutesAgo: 46,
        includeVoiceHint: 'Audio check from Route 9 — East River bridge is clear, ETA 45 minutes.',
      },
    ],
  },
];

export const QUICK_FIELD_PROMPTS = [
  'Check-in: signal weak, battery 62%, all clear.',
  'Requesting weather & road clearance before departure.',
  'Cold-chain temperature verified at 4.0°C.',
  'Urgent: relay clinic supply ETA when connected.',
];

/**
 * Deterministic, domain-authentic peer responder so capstone demos work 100% offline
 * with zero external API keys while simulating real encrypted peer replies.
 */
export function generatePeerReply(
  contact: Contact,
  userMessageText: string,
  kind: 'text' | 'image' | 'voice'
): { text: string; replyType: 'text' | 'voice'; voiceHint?: string } {
  const lower = userMessageText.toLowerCase();

  if (kind === 'image') {
    return {
      text: `Received your compressed image clearly (${contact.role}). Tiny-frame resolution is plenty to verify field conditions—saved ~95% airtime on our 2G link.`,
      replyType: 'text',
    };
  }

  if (kind === 'voice') {
    return {
      text: `Voice note decoded cleanly over the low-bitrate channel. Logging your audio update now and sending back an encrypted acknowledgment.`,
      replyType: 'text',
    };
  }

  if (lower.includes('urgent') || lower.includes('sos') || lower.includes('emergency')) {
    return {
      text: `Priority packet received by ${contact.name}. Escalating to the regional relay log immediately—keep your device in 2G data-saver mode for next update.`,
      replyType: 'text',
    };
  }

  if (lower.includes('bridge') || lower.includes('road') || lower.includes('eta') || lower.includes('weather')) {
    return {
      text: `Route 9 bridge deck is passable for light trucks; river crest is dropping steadily. Next checkpoint sync scheduled in 20 minutes.`,
      replyType: 'text',
    };
  }

  if (lower.includes('clinic') || lower.includes('cold') || lower.includes('medicine') || lower.includes('vaccine')) {
    return {
      text: `Cold-chain manifest updated. Pharmacy stock is confirmed for the morning courier—zero packet loss on this encrypted exchange.`,
      replyType: 'text',
    };
  }

  if (lower.includes('water') || lower.includes('pump') || lower.includes('solar') || lower.includes('battery')) {
    return {
      text: `Telemetry logged: solar charge controller steady at 13.4V and reservoir at 78% capacity. Ready for evening distribution.`,
      replyType: 'text',
    };
  }

  const fallbackReplies: Record<string, string[]> = {
    'contact-amara': [
      'Acknowledged from Highland Clinic. Decrypted cleanly on our end—standing by for the afternoon patient count.',
      'Received over 2G relay. Clinic solar reserve is healthy and triage supplies are ready.',
    ],
    'contact-mateo': [
      'Copy from North Basin Co-op. Valve pressure is stable and field crew is heading to Station #3.',
      'Message verified with our shared key. I will queue the evening flow meter readings before sundown.',
    ],
    'contact-priya': [
      'Logged at District Relay Hub. Your compressed packet arrived in under a second with intact AES-GCM auth tag.',
      'Dispatch confirmed. Forwarding summary to the regional corridor board on the next sync window.',
    ],
    'contact-kofi': [
      'Copy that from Route 9. Passing kilometer marker 14 now—will ping again at the ridge crest.',
      'Got your encrypted update on the cab handset. Cargo secure and fuel above half tank.',
    ],
  };

  const bank = fallbackReplies[contact.id] ?? [
    `Encrypted packet received by ${contact.name}. Signal strength is modest here, but compact framing came through cleanly.`,
    `Acknowledged from ${contact.region}. Ready for your next field update.`,
  ];

  const idx = Math.abs(userMessageText.length + contact.name.length) % bank.length;
  return { text: bank[idx], replyType: 'text' };
}
