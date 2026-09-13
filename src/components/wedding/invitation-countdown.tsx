'use client'

import { useEffect, useState } from 'react'

type TimeLeft = {
  days: number
  hours: number
  minutes: number
  total: number
}

function calculateTimeLeft(targetValue: string | Date): TimeLeft {
  const target = new Date(targetValue).getTime()
  if (Number.isNaN(target)) return { days: 0, hours: 0, minutes: 0, total: 0 }

  const total = target - Date.now()
  if (total <= 0) return { days: 0, hours: 0, minutes: 0, total: 0 }

  return {
    days: Math.floor(total / (1000 * 60 * 60 * 24)),
    hours: Math.floor((total / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((total / (1000 * 60)) % 60),
    total,
  }
}

function Segment({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <strong className="font-serif text-2xl font-normal tabular-nums text-[#f8f1e7] sm:text-3xl">
        {value}
      </strong>
      <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#c8a56b] sm:text-[10px]">
        {label}
      </span>
    </span>
  )
}

export function InvitationCountdown({
  date,
  className = '',
}: {
  date: string | Date
  className?: string
}) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null)

  useEffect(() => {
    const update = () => setTimeLeft(calculateTimeLeft(date))
    update()
    const timer = window.setInterval(update, 30_000)
    return () => window.clearInterval(timer)
  }, [date])

  if (!timeLeft) return null

  return (
    <section
      data-testid="invitation-countdown"
      aria-label="Countdown to the wedding"
      className={`mx-auto flex w-full max-w-[430px] items-center justify-between gap-3 rounded-2xl border border-[#b89155]/45 bg-[#211b16] px-4 py-3 text-[#f8f1e7] shadow-lg ${className}`}
    >
      {timeLeft.total > 0 ? (
        <>
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-[#c8a56b] sm:text-[10px]">
              Until the celebration
            </p>
            <p className="mt-1 text-xs text-[#d6cec5]">Counting the moments with you</p>
          </div>
          <div className="flex shrink-0 items-baseline gap-2 sm:gap-3">
            <Segment value={timeLeft.days} label="Days" />
            <span className="text-[#b89155]/55">·</span>
            <Segment value={timeLeft.hours} label="Hrs" />
            <span className="hidden text-[#b89155]/55 sm:inline">·</span>
            <span className="hidden sm:inline-flex">
              <Segment value={timeLeft.minutes} label="Min" />
            </span>
          </div>
        </>
      ) : (
        <p className="w-full text-center font-serif text-xl text-[#f8f1e7]">
          Forever has begun
        </p>
      )}
    </section>
  )
}
