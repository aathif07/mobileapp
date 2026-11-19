import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { VoiceAttachment } from '../types/pulselink';
import { formatBytes } from '../lib/network';

interface VoiceNotePlayerProps {
  voice: VoiceAttachment;
  isOutgoing: boolean;
}

export const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({ voice, isOutgoing }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const handleTime = () => {
      if (el.duration && Number.isFinite(el.duration)) {
        setProgress(el.currentTime / el.duration);
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    el.addEventListener('timeupdate', handleTime);
    el.addEventListener('ended', handleEnded);
    return () => {
      el.removeEventListener('timeupdate', handleTime);
      el.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
      try {
        await el.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    }
  };

  return (
    <div className="w-full min-w-[210px] max-w-[280px]">
      <audio ref={audioRef} src={voice.dataUrl} preload="metadata" />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause voice note' : 'Play voice note'}
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer ${
            isOutgoing
              ? 'bg-white text-[#047857] hover:bg-[#ECFDF5]'
              : 'bg-[#047857] text-white hover:bg-[#065F46]'
          }`}
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-end gap-[2.5px] h-7" aria-hidden="true">
            {voice.peaks.map((peak, i) => {
              const barRatio = i / Math.max(1, voice.peaks.length - 1);
              const active = barRatio <= progress;
              const barHeight = Math.max(5, Math.round(peak * 26));
              return (
                <span
                  key={i}
                  style={{ height: `${barHeight}px` }}
                  className={`flex-1 rounded-full transition-colors ${
                    isOutgoing
                      ? active
                        ? 'bg-white'
                        : 'bg-white/40'
                      : active
                      ? 'bg-[#047857]'
                      : 'bg-[#CBD6D0]'
                  }`}
                />
              );
            })}
          </div>
          <div
            className={`mt-1.5 flex items-center gap-1.5 text-[11px] font-mono tabular-nums ${
              isOutgoing ? 'text-[#D1FAE5]' : 'text-[#4A5B54]'
            }`}
          >
            <span>{voice.durationSec.toFixed(1)}s</span>
            <span aria-hidden="true">·</span>
            <span>{voice.bitrateKbps} kbps</span>
            <span aria-hidden="true">·</span>
            <span>{formatBytes(voice.compressedBytes)}</span>
          </div>
        </div>
      </div>

      {voice.transcriptHint && (
        <p
          className={`mt-2 text-xs leading-relaxed ${
            isOutgoing ? 'text-[#ECFDF5]' : 'text-[#4A5B54]'
          }`}
        >
          {voice.transcriptHint}
        </p>
      )}
    </div>
  );
};
