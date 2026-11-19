import React, { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Send, Upload, X } from 'lucide-react';
import { ImagePresetId, NetworkProfile } from '../types/pulselink';
import { compressImageSource, IMAGE_PRESETS, TinyImageResult } from '../lib/compression';
import { SAMPLE_FIELD_PHOTOS } from '../lib/peers';
import { calculateTransmitDurationMs, formatBytes, formatDurationMs } from '../lib/network';

interface TinyImageLabSheetProps {
  open: boolean;
  activeProfile: NetworkProfile;
  onClose: () => void;
  onSendImage: (result: TinyImageResult, caption: string) => void;
}

export const TinyImageLabSheet: React.FC<TinyImageLabSheetProps> = ({
  open,
  activeProfile,
  onClose,
  onSendImage,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedSource, setSelectedSource] = useState<File | string>(SAMPLE_FIELD_PHOTOS[0].src);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(SAMPLE_FIELD_PHOTOS[0].id);
  const [presetId, setPresetId] = useState<ImagePresetId>(
    activeProfile.id === 'gprs_2g' || activeProfile.id === 'offline' ? 'ultra_tiny' : 'standard_2g'
  );
  const [caption, setCaption] = useState<string>(SAMPLE_FIELD_PHOTOS[0].caption);
  const [result, setResult] = useState<TinyImageResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setIsProcessing(true);
    compressImageSource(selectedSource, presetId)
      .then((res) => {
        if (!cancelled) {
          setResult(res);
          setIsProcessing(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsProcessing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, selectedSource, presetId]);

  if (!open) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedSource(file);
    setSelectedSampleId(null);
    setCaption(file.name.replace(/\.[^.]+$/, ''));
  };

  const handlePickSample = (sample: (typeof SAMPLE_FIELD_PHOTOS)[number]) => {
    setSelectedSource(sample.src);
    setSelectedSampleId(sample.id);
    setCaption(sample.caption);
  };

  const estimatedMs =
    result && activeProfile.kbps > 0
      ? calculateTransmitDurationMs(result.compressedBytes + 34, activeProfile)
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0F1714]/50 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white border border-[#D5DFDA] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1.5 bg-[#D5DFDA] rounded-full mx-auto mb-4 sm:hidden" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-lg font-semibold text-[#0F1714]">
              Adaptive Tiny Image Pipeline
            </h3>
            <p className="mt-0.5 text-xs text-[#4A5B54]">
              Downscales and re-encodes field photos locally before AES-GCM encryption.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close tiny image lab"
            className="min-w-[44px] min-h-[44px] -mr-2 -mt-2 flex items-center justify-center rounded-xl text-[#4A5B54] hover:bg-[#EFF3F1] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sample Field Photos + Upload Button */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[#4A5B54]">Choose Field Sample or Upload</span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#047857] hover:text-[#065F46] min-h-[36px] px-2 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Photo</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {SAMPLE_FIELD_PHOTOS.map((sample) => {
              const active = selectedSampleId === sample.id;
              return (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => handlePickSample(sample)}
                  className={`group text-left rounded-xl overflow-hidden border transition-all cursor-pointer ${
                    active
                      ? 'border-[#047857] ring-2 ring-[#047857]/20'
                      : 'border-[#D5DFDA] hover:border-[#9FB0A7]'
                  }`}
                >
                  <div className="aspect-[4/3] bg-[#EFF3F1] overflow-hidden">
                    <img
                      src={sample.src}
                      alt={sample.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="px-2 py-1.5 bg-white">
                    <p className="text-xs font-medium text-[#0F1714] truncate">{sample.title}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Compression Tier Presets */}
        <div className="mt-4">
          <p className="text-xs font-medium text-[#4A5B54] mb-2">Bandwidth Quality Preset</p>
          <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-[#EFF3F1]">
            {IMAGE_PRESETS.map((preset) => {
              const active = preset.id === presetId;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setPresetId(preset.id)}
                  className={`min-h-[44px] px-2 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                    active
                      ? 'bg-white text-[#0F1714] shadow-xs'
                      : 'text-[#4A5B54] hover:text-[#0F1714]'
                  }`}
                >
                  <span className="block text-xs font-semibold truncate">{preset.label}</span>
                  <span className="block text-[10px] font-mono text-[#4A5B54] truncate">
                    {preset.targetNote}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Compressed Output Preview + Exact Byte Comparison */}
        <div className="mt-4 rounded-2xl bg-[#F8FAF9] border border-[#D5DFDA] p-4">
          <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-4 items-center">
            <div className="aspect-[4/3] rounded-xl overflow-hidden bg-[#EFF3F1] border border-[#D5DFDA] flex items-center justify-center">
              {result ? (
                <img
                  src={result.dataUrl}
                  alt="Compressed tiny preview"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImageIcon className="w-6 h-6 text-[#9FB0A7]" />
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-[#4A5B54]">Original Photo</span>
                <span className="font-mono text-sm text-[#4A5B54] line-through tabular-nums">
                  {result ? formatBytes(result.originalBytes) : '—'}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-[#0F1714]">Compressed Frame</span>
                <span className="font-mono text-base font-bold text-[#047857] tabular-nums">
                  {isProcessing ? 'Encoding…' : result ? formatBytes(result.compressedBytes) : '—'}
                </span>
              </div>
              <div className="flex items-baseline justify-between border-t border-[#E6ECE9] pt-2">
                <span className="text-xs text-[#4A5B54]">Size Reduction</span>
                <span className="font-mono text-xs font-semibold text-[#047857] tabular-nums">
                  {result ? `-${result.savingsPct.toFixed(1)}% · ${result.width}×${result.height}px` : '—'}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-[#4A5B54]">Est. Send ({activeProfile.shortLabel})</span>
                <span className="font-mono text-xs font-medium text-[#0F1714] tabular-nums">
                  {activeProfile.id === 'offline'
                    ? 'Queues offline'
                    : estimatedMs
                    ? formatDurationMs(estimatedMs)
                    : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Caption & Send */}
        <div className="mt-4">
          <label htmlFor="tiny-image-caption" className="block text-xs font-medium text-[#4A5B54] mb-1.5">
            Caption (Compressed with DEFLATE)
          </label>
          <input
            id="tiny-image-caption"
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add concise field note…"
            className="w-full min-h-[44px] rounded-xl border border-[#D5DFDA] bg-white px-3.5 text-sm text-[#0F1714] placeholder:text-[#7D8F87] focus:border-[#047857] focus:outline-none"
          />
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 rounded-xl border border-[#D5DFDA] text-sm font-medium text-[#4A5B54] hover:bg-[#EFF3F1] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!result || isProcessing}
            onClick={() => {
              if (!result) return;
              onSendImage(result, caption.trim() || 'Compressed field photo');
              onClose();
            }}
            className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#047857] text-white text-sm font-semibold hover:bg-[#065F46] disabled:opacity-50 active:scale-[0.99] transition-all cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>
              {activeProfile.id === 'offline'
                ? 'Encrypt & Queue Tiny Image'
                : `Encrypt & Send (${result ? formatBytes(result.compressedBytes) : '…'})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
