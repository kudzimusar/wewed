'use client';

import { motion } from 'framer-motion';
import { useWewedStore, type LifecycleMode } from '@/lib/store';

export function BeforeAfterToggle() {
  const lifecycle = useWewedStore((s) => s.lifecycle);
  const setLifecycle = useWewedStore((s) => s.setLifecycle);

  return (
    <div className="relative flex items-center rounded-full border border-gold/30 bg-espresso/40 p-0.5 backdrop-blur-sm">
      {/* Sliding indicator */}
      <motion.div
        className="absolute top-0.5 bottom-0.5 rounded-full"
        style={{ width: 'calc(50% - 2px)' }}
        animate={{
          left: lifecycle === 'before' ? '2px' : 'calc(50%)',
          backgroundColor: lifecycle === 'before' ? '#C0633F' : '#6B2D3A',
        }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 30,
        }}
      />

      <ToggleOption
        label="BEFORE"
        active={lifecycle === 'before'}
        onClick={() => setLifecycle('before')}
      />
      <ToggleOption
        label="AFTER"
        active={lifecycle === 'after'}
        onClick={() => setLifecycle('after')}
      />
    </div>
  );
}

function ToggleOption({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative z-10 px-4 py-1.5 text-xs font-sans font-medium tracking-widest transition-colors duration-200 ${
        active ? 'text-champagne' : 'text-gold-muted hover:text-gold'
      }`}
      aria-pressed={active}
      role="button"
    >
      {label}
    </button>
  );
}

export function BeforeAfterToggleInline({
  lifecycle,
  onToggle,
}: {
  lifecycle: LifecycleMode;
  onToggle: () => void;
}) {
  return (
    <div className="relative flex items-center rounded-full border border-gold/30 bg-espresso/40 p-0.5 backdrop-blur-sm">
      <motion.div
        className="absolute top-0.5 bottom-0.5 rounded-full"
        style={{ width: 'calc(50% - 2px)' }}
        animate={{
          left: lifecycle === 'before' ? '2px' : 'calc(50%)',
          backgroundColor: lifecycle === 'before' ? '#C0633F' : '#6B2D3A',
        }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 30,
        }}
      />

      <button
        onClick={lifecycle === 'after' ? onToggle : undefined}
        className={`relative z-10 px-4 py-1.5 text-xs font-sans font-medium tracking-widest transition-colors duration-200 ${
          lifecycle === 'before' ? 'text-champagne' : 'text-gold-muted hover:text-gold'
        }`}
        aria-pressed={lifecycle === 'before'}
      >
        BEFORE
      </button>
      <button
        onClick={lifecycle === 'before' ? onToggle : undefined}
        className={`relative z-10 px-4 py-1.5 text-xs font-sans font-medium tracking-widest transition-colors duration-200 ${
          lifecycle === 'after' ? 'text-champagne' : 'text-gold-muted hover:text-gold'
        }`}
        aria-pressed={lifecycle === 'after'}
      >
        AFTER
      </button>
    </div>
  );
}
