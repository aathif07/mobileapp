import React, { useState } from 'react';
import { UserPlus, X } from 'lucide-react';

interface NewContactSheetProps {
  open: boolean;
  onClose: () => void;
  onCreateContact: (name: string, role: string, region: string) => Promise<void>;
}

export const NewContactSheet: React.FC<NewContactSheetProps> = ({
  open,
  onClose,
  onCreateContact,
}) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [region, setRegion] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsCreating(true);
    try {
      await onCreateContact(
        name.trim(),
        role.trim() || 'Community Field Node',
        region.trim() || 'Remote Relay · 2G'
      );
      setName('');
      setRole('');
      setRegion('');
      onClose();
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0F1714]/50 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white border border-[#D5DFDA] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1.5 bg-[#D5DFDA] rounded-full mx-auto mb-4 sm:hidden" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-lg font-semibold text-[#0F1714]">
              Add Encrypted Peer Contact
            </h3>
            <p className="mt-0.5 text-xs text-[#4A5B54]">
              Generates a fresh ECDH P-256 key pair and 60-digit safety number automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close new contact modal"
            className="min-w-[44px] min-h-[44px] -mr-2 -mt-2 flex items-center justify-center rounded-xl text-[#4A5B54] hover:bg-[#EFF3F1] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="peer-name" className="block text-xs font-medium text-[#4A5B54] mb-1.5">
              Contact Name
            </label>
            <input
              id="peer-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Elena Rostova"
              className="w-full min-h-[44px] rounded-xl border border-[#D5DFDA] bg-white px-3.5 text-sm text-[#0F1714] placeholder:text-[#7D8F87] focus:border-[#047857] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="peer-role" className="block text-xs font-medium text-[#4A5B54] mb-1.5">
              Station or Role
            </label>
            <input
              id="peer-role"
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. South Ridge Weather Post"
              className="w-full min-h-[44px] rounded-xl border border-[#D5DFDA] bg-white px-3.5 text-sm text-[#0F1714] placeholder:text-[#7D8F87] focus:border-[#047857] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="peer-region" className="block text-xs font-medium text-[#4A5B54] mb-1.5">
              Region &amp; Link Type
            </label>
            <input
              id="peer-region"
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="e.g. East Valley · 2G GPRS"
              className="w-full min-h-[44px] rounded-xl border border-[#D5DFDA] bg-white px-3.5 text-sm text-[#0F1714] placeholder:text-[#7D8F87] focus:border-[#047857] focus:outline-none"
            />
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 rounded-xl border border-[#D5DFDA] text-sm font-medium text-[#4A5B54] hover:bg-[#EFF3F1] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isCreating}
              className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#047857] text-white text-sm font-semibold hover:bg-[#065F46] disabled:opacity-50 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>{isCreating ? 'Generating Keys…' : 'Generate Keys & Add'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
