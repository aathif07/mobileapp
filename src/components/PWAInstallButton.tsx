import React, { useState } from 'react';
import { Download, Smartphone, X, Share2, PlusSquare, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'card';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'header' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    if (variant === 'card') {
      return (
        <div className="flex items-center gap-2 text-sm text-[#047857] font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Installed as Standalone Mobile App</span>
        </div>
      );
    }
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuide(true);
  };

  return (
    <>
      {variant === 'header' ? (
        <button
          type="button"
          onClick={handleClick}
          className="inline-flex items-center justify-center gap-2 min-h-[40px] px-3.5 py-2 rounded-xl bg-[#047857] text-white text-xs font-semibold hover:bg-[#065F46] active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#047857]"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span>{isInstallable ? 'Install App' : 'Mobile App'}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#047857] text-white text-sm font-semibold hover:bg-[#065F46] active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#047857]"
        >
          <Smartphone className="w-4 h-4 shrink-0" />
          <span>{isInstallable ? 'Install PulseLink on Device' : 'How to Install on Phone'}</span>
        </button>
      )}

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0F1714]/50 backdrop-blur-xs p-0 sm:p-4"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white border border-[#D5DFDA] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-[#D5DFDA] rounded-full mx-auto mb-4 sm:hidden" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-lg font-semibold text-[#0F1714]">
                  Install PulseLink Mobile App
                </h3>
                <p className="mt-1 text-sm text-[#4A5B54]">
                  Run PulseLink full-screen from your phone home screen with offline service worker caching.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Close install guide"
                className="min-w-[44px] min-h-[44px] -mr-2 -mt-2 flex items-center justify-center rounded-xl text-[#4A5B54] hover:bg-[#EFF3F1] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4 text-sm text-[#0F1714]">
              {isIOS ? (
                <div className="space-y-3 bg-[#F8FAF9] border border-[#D5DFDA] rounded-xl p-4">
                  <p className="font-semibold text-[#065F46]">On iPhone / iPad (Safari)</p>
                  <ol className="space-y-2.5 text-[#4A5B54]">
                    <li className="flex items-start gap-2.5">
                      <Share2 className="w-4 h-4 text-[#047857] mt-0.5 shrink-0" />
                      <span>
                        1. Tap the <strong className="text-[#0F1714]">Share</strong> button in Safari&apos;s bottom toolbar.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <PlusSquare className="w-4 h-4 text-[#047857] mt-0.5 shrink-0" />
                      <span>
                        2. Scroll down and tap <strong className="text-[#0F1714]">Add to Home Screen</strong>, then tap <strong className="text-[#0F1714]">Add</strong>.
                      </span>
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-[#F8FAF9] border border-[#D5DFDA] rounded-xl p-4">
                    <p className="font-semibold text-[#065F46]">On Android (Chrome / Edge)</p>
                    <p className="mt-1 text-[#4A5B54]">
                      Open this app URL on your phone browser, tap the browser menu (<strong className="text-[#0F1714]">⋮</strong>), and choose <strong className="text-[#0F1714]">Install app</strong> or <strong className="text-[#0F1714]">Add to Home screen</strong>.
                    </p>
                  </div>
                  <div className="bg-[#F8FAF9] border border-[#D5DFDA] rounded-xl p-4">
                    <p className="font-semibold text-[#065F46]">On iPhone / iPad (Safari)</p>
                    <p className="mt-1 text-[#4A5B54]">
                      Tap the <strong className="text-[#0F1714]">Share</strong> icon in Safari, then select <strong className="text-[#0F1714]">Add to Home Screen</strong>.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full min-h-[44px] rounded-xl bg-[#0F1714] text-white text-sm font-semibold hover:bg-[#1F2D27] transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
};
