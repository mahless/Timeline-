import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { verifyPin, type PinHashRecord } from '../domain/cryptoVault';

interface PinLockScreenProps {
  pinRecord: PinHashRecord;
  onUnlock: () => void;
}

export const PinLockScreen: React.FC<PinLockScreenProps> = ({ pinRecord, onUnlock }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    setError(null);
    try {
      const ok = await verifyPin(pin, pinRecord.hashBase64, pinRecord.saltBase64);
      if (ok) {
        onUnlock();
      } else {
        setError('الرمز السري غير صحيح. حاول مرة أخرى.');
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF8F4] dark:bg-[#141413] px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-6 sm:p-8 shadow-xl space-y-5 text-center"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#8C3B2B]/10 dark:bg-[#E28A6D]/15 text-[#8C3B2B] dark:text-[#E28A6D]">
          <Lock className="w-7 h-7" aria-hidden="true" />
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">
            ذاكرتي مقفل
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400">
            أدخل رمز الحماية لفتح أرشيفك الشخصي.
          </p>
        </div>

        <input
          type="password"
          inputMode="numeric"
          autoFocus
          maxLength={8}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          aria-label="إدخال رمز القفل"
          placeholder="••••"
          className="w-full min-h-[48px] rounded-xl border border-stone-300 dark:border-stone-700 bg-[#FAF8F4] dark:bg-[#141413] px-4 text-center text-lg tracking-widest tabular-nums text-stone-900 dark:text-stone-100 focus:border-[#8C3B2B] focus:outline-none"
        />

        {error && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={checking || !pin}
          className="w-full min-h-[44px] rounded-xl bg-[#8C3B2B] hover:bg-[#732F21] text-sm font-medium text-white disabled:opacity-60 cursor-pointer"
        >
          {checking ? 'جارٍ التحقق...' : 'فتح الأرشيف'}
        </button>
      </form>
    </div>
  );
};
