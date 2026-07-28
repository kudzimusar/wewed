'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Music, Music2, X, Volume2, Volume1, VolumeX } from 'lucide-react'

/**
 * AmbientMusicPlayer — a memorable, self-contained ambient ceremony player.
 *
 * Why procedural audio (Web Audio API) instead of an <audio src>:
 *  - No external assets to host, no licensing concerns, works offline.
 *  - Generates a soft, slow, evolving drone in C major (root + fifth + octave)
 *    with gentle bell-like overtones that fade in/out at long intervals — the
 *    emotional register of a candle-lit ceremony.
 *  - Tiny (a few KB of code), zero network, zero autoplay (browser gesture
 *    required before any audio plays — and the toggle requires a user click).
 *
 * UX:
 *  - Small floating control (bottom-left, well clear of the WhatsApp FAB
 *    bottom-right and the back-to-top / help buttons).
 *  - Default state is a compact circular "♪" button. Clicking toggles audio.
 *  - When playing, expands into a small pill with a volume slider and a
 *    subtle pulsing visualizer dot. Click the X to collapse back to compact.
 *  - Remembers mute preference in localStorage.
 *  - Respects prefers-reduced-motion (no pulsing dot if reduced).
 */

type Wave = 'sine' | 'triangle'

const STORAGE_KEY = 'wewed:ambient-muted'

// Soft C major pentatonic — root, third, fifth, octave + a "shimmer" higher.
// Frequencies (Hz): C3, E3, G3, C4, E4, G4 — gentle and unresolved.
const DRONE_FREQS = [
  { freq: 130.81, gain: 0.16, type: 'sine' as Wave, label: 'C3' },
  { freq: 196.0, gain: 0.10, type: 'sine' as Wave, label: 'G3' },
  { freq: 261.63, gain: 0.07, type: 'triangle' as Wave, label: 'C4' },
  { freq: 329.63, gain: 0.05, type: 'triangle' as Wave, label: 'E4' },
]

// Higher bell tones that fade in/out slowly, like wind chimes.
const BELL_TONES = [523.25, 659.25, 783.99, 1046.5] // C5, E5, G5, C6

export function AmbientMusicPlayer() {
  const [expanded, setExpanded] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(0.5)
  const [mutedByDefault, setMutedByDefault] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const droneNodesRef = useRef<{ osc: OscillatorNode; gain: GainNode }[]>([])
  const bellTimerRef = useRef<number | null>(null)
  const rafRef = useRef<number>(0)

  // Respect user's previous choice (mute by default if they muted before).
  useEffect(() => {
    // Lazy-init pattern: localStorage and matchMedia are only available
    // client-side, so we cannot read these values during initial render
    // (which also runs on the server for client components in Next.js 16).
    // Setting state inside the effect is intentional and only fires once
    // on mount — the disable below silences the cascading-render rule.
    let muted = false
    try {
      muted = localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMutedByDefault(muted)
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Build the audio graph (called lazily on first play).
  const buildAudioGraph = useCallback(() => {
    if (audioCtxRef.current) return
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctor()
    audioCtxRef.current = ctx

    const master = ctx.createGain()
    master.gain.value = 0 // start silent, fade in on play
    master.connect(ctx.destination)
    masterGainRef.current = master

    // Build sustained drone voices — each oscillator → gain → master.
    for (const v of DRONE_FREQS) {
      const osc = ctx.createOscillator()
      osc.type = v.type
      osc.frequency.value = v.freq
      // Very slow detune LFO for organic movement (±3 cents).
      const lfo = ctx.createOscillator()
      lfo.frequency.value = 0.07 + Math.random() * 0.06
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = 3
      lfo.connect(lfoGain)
      lfoGain.connect(osc.detune)
      osc.start()
      lfo.start()

      const g = ctx.createGain()
      g.gain.value = v.gain
      osc.connect(g)
      g.connect(master)
      droneNodesRef.current.push({ osc, gain: g })
    }
  }, [])

  // Schedule a soft bell tone (one of BELL_TONES) at random long intervals.
  const scheduleBell = useCallback(() => {
    const ctx = audioCtxRef.current
    const master = masterGainRef.current
    if (!ctx || !master) return
    const now = ctx.currentTime
    const freq = BELL_TONES[Math.floor(Math.random() * BELL_TONES.length)]
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    // Slight detune for a less synthetic, more chime-like timbre.
    osc.detune.value = (Math.random() - 0.5) * 8
    const g = ctx.createGain()
    // Bell envelope: 0 → peak → -60dB over ~6s
    const peak = 0.05 + Math.random() * 0.03
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(peak, now + 0.05)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 5.5 + Math.random() * 2)
    osc.connect(g)
    g.connect(master)
    osc.start(now)
    osc.stop(now + 7)
  }, [])

  const startBells = useCallback(() => {
    if (bellTimerRef.current) return
    const tick = () => {
      scheduleBell()
      // Schedule next bell at a long, random interval (8–16s).
      const delay = 8000 + Math.random() * 8000
      bellTimerRef.current = window.setTimeout(tick, delay)
    }
    // First bell after ~3s, then on the slow cadence above.
    bellTimerRef.current = window.setTimeout(tick, 3000)
  }, [scheduleBell])

  const stopBells = useCallback(() => {
    if (bellTimerRef.current) {
      window.clearTimeout(bellTimerRef.current)
      bellTimerRef.current = null
    }
  }, [])

  const play = useCallback(() => {
    buildAudioGraph()
    const ctx = audioCtxRef.current
    const master = masterGainRef.current
    if (!ctx || !master) return
    // Resume context (gesture-initiated).
    if (ctx.state === 'suspended') void ctx.resume()
    const now = ctx.currentTime
    const target = mutedByDefault ? 0 : volume * 0.5
    master.gain.cancelScheduledValues(now)
    master.gain.setValueAtTime(master.gain.value, now)
    master.gain.linearRampToValueAtTime(target, now + 1.5) // 1.5s fade-in
    startBells()
    setPlaying(true)
  }, [buildAudioGraph, startBells, volume, mutedByDefault])

  const pause = useCallback(() => {
    const ctx = audioCtxRef.current
    const master = masterGainRef.current
    if (!ctx || !master) return
    const now = ctx.currentTime
    const current = master.gain.value
    master.gain.cancelScheduledValues(now)
    master.gain.setValueAtTime(current, now)
    master.gain.linearRampToValueAtTime(0, now + 1.0) // 1s fade-out
    stopBells()
    setPlaying(false)
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
      setMutedByDefault(true)
    } catch {
      // ignore
    }
  }, [stopBells])

  // Keep volume in sync.
  useEffect(() => {
    const master = masterGainRef.current
    const ctx = audioCtxRef.current
    if (!master || !ctx || !playing) return
    const now = ctx.currentTime
    const target = mutedByDefault ? 0 : volume * 0.5
    master.gain.cancelScheduledValues(now)
    master.gain.setValueAtTime(master.gain.value, now)
    master.gain.linearRampToValueAtTime(target, now + 0.15)
  }, [volume, mutedByDefault, playing])

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      stopBells()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      const ctx = audioCtxRef.current
      if (ctx) void ctx.close()
    }
  }, [stopBells])

  const toggle = useCallback(() => {
    if (playing) pause()
    else play()
  }, [playing, play, pause])

  const VolIcon = mutedByDefault ? VolumeX : volume < 0.34 ? Volume1 : Volume2

  return (
    <div className="fixed bottom-24 left-6 z-40 sm:bottom-28">
      <AnimatePresence mode="wait" initial={false}>
        {expanded ? (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, x: -16, width: 0 }}
            animate={{ opacity: 1, x: 0, width: 'auto' }}
            exit={{ opacity: 0, x: -16, width: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-3 overflow-hidden rounded-full border border-gold/30 bg-espresso/95 p-1.5 pr-3 shadow-lg backdrop-blur-md"
          >
            {/* Play / pause */}
            <button
              onClick={toggle}
              aria-label={playing ? 'Pause ambient music' : 'Play ambient music'}
              aria-pressed={playing}
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-colors ${
                playing
                  ? 'bg-gold text-espresso'
                  : 'bg-gold/10 text-gold hover:bg-gold/20'
              }`}
            >
              {playing ? <Music2 className="h-4 w-4" /> : <Music className="h-4 w-4" />}
            </button>

            {/* Volume slider */}
            <div className="flex items-center gap-2 pl-1">
              <VolIcon className="h-3.5 w-3.5 flex-shrink-0 text-gold/70" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={mutedByDefault ? 0 : volume}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setVolume(v)
                  if (v > 0 && mutedByDefault) {
                    setMutedByDefault(false)
                    try {
                      localStorage.setItem(STORAGE_KEY, 'false')
                    } catch {
                      // ignore
                    }
                  }
                }}
                aria-label="Ambient music volume"
                className="wewed-volume-slider h-1 w-20 cursor-pointer appearance-none rounded-full bg-gold/20"
                style={{
                  background: `linear-gradient(to right, var(--color-gold) 0%, var(--color-gold) ${
                    (mutedByDefault ? 0 : volume) * 100
                  }%, rgba(191,155,95,0.2) ${
                    (mutedByDefault ? 0 : volume) * 100
                  }%, rgba(191,155,95,0.2) 100%)`,
                }}
              />
            </div>

            {/* Status pulse dot */}
            <span className="hidden items-center gap-1.5 pl-1 pr-1 sm:flex">
              <span className="relative flex h-2 w-2">
                {playing && !reducedMotion && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold/60" />
                )}
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    playing ? 'bg-gold' : 'bg-gold/30'
                  }`}
                />
              </span>
              <span className="font-sans text-[10px] uppercase tracking-[0.15em] text-champagne/60">
                {playing ? 'Ambience' : 'Muted'}
              </span>
            </span>

            {/* Collapse */}
            <button
              onClick={() => setExpanded(false)}
              aria-label="Collapse ambient music player"
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-champagne/40 transition-colors hover:bg-champagne/5 hover:text-champagne/80"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ) : (
          <motion.button
            key="compact"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => {
              setExpanded(true)
              // Auto-start on first expand if not muted.
              if (!playing && !mutedByDefault) {
                // Defer to next tick so the input has rendered.
                window.setTimeout(() => play(), 80)
              }
            }}
            aria-label="Open ambient music player"
            title="Ambient ceremony music"
            className="group relative flex h-11 w-11 items-center justify-center rounded-full border border-gold/40 bg-espresso/90 text-gold shadow-lg backdrop-blur-md transition-all hover:border-gold hover:bg-espresso hover:scale-110"
          >
            <Music className="h-4 w-4" />
            {/* Soft halo when playing */}
            {playing && (
              <span className="pointer-events-none absolute inset-0 rounded-full border border-gold/40 [animation:wewed-pulse_2s_ease-in-out_infinite]" />
            )}
            {/* Pulsing dot hint when not playing */}
            {!playing && (
              <span className="pointer-events-none absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold/60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-gold" />
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
