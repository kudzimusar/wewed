'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ExternalLink,
  ChevronDown,
  Send,
  Bell,
  CalendarCheck,
  Music,
  HelpCircle,
  Sparkles,
} from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import {
  SOCIAL_PLATFORMS,
  type SocialPlatform,
} from '@/lib/social'
import { useWeddingContextSafe } from '@/components/wedding/wedding-data-provider'

function TelegramGlyph({ className }: { className?: string }) {
  const platform: SocialPlatform = SOCIAL_PLATFORMS.telegram
  return (
    <svg
      viewBox={platform.iconViewBox}
      className={className}
      fill="currentColor"
      fillRule={platform.iconFillRule || 'nonzero'}
      aria-hidden="true"
    >
      {platform.iconPaths.map((path, index) => (
        <path key={index} d={path} />
      ))}
    </svg>
  )
}

interface BotCommand {
  cmd: string
  description: string
  icon: React.ReactNode
}

const BOT_COMMANDS: BotCommand[] = [
  {
    cmd: '/start',
    description: 'Welcome message + command list',
    icon: <Sparkles className="h-3.5 w-3.5" />,
  },
  {
    cmd: '/info',
    description: 'Date, venue, time, dress code',
    icon: <CalendarCheck className="h-3.5 w-3.5" />,
  },
  {
    cmd: '/rsvp',
    description: 'Direct link to the RSVP form',
    icon: <Send className="h-3.5 w-3.5" />,
  },
  {
    cmd: '/song',
    description: 'Request a dance-floor track',
    icon: <Music className="h-3.5 w-3.5" />,
  },
  {
    cmd: '/help',
    description: 'Full list of bot commands',
    icon: <HelpCircle className="h-3.5 w-3.5" />,
  },
]

export interface TelegramWidgetProps {
  channelUrl?: string
  className?: string
  showCommands?: boolean
}

export function TelegramWidget({
  channelUrl,
  className = '',
  showCommands = true,
}: TelegramWidgetProps) {
  const [commandsOpen, setCommandsOpen] = useState(false)
  const ctx = useWeddingContextSafe()
  const configuredUrl =
    channelUrl?.trim() || ctx?.getContent('social', 'telegramUrl', '').trim() || ''
  const configuredHandle =
    ctx?.getContent('social', 'telegramHandle', '').trim() || ''

  if (!configuredUrl) return null

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-gold/40 bg-champagne/70 p-5 shadow-[0_10px_30px_-18px_rgba(0,136,204,0.4)] backdrop-blur-sm sm:p-6 ${className}`}
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-0.5"
        style={{
          background:
            'linear-gradient(90deg, transparent, #0088cc 30%, #0088cc 70%, transparent)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-20 blur-2xl"
        style={{ background: '#0088cc' }}
      />

      <div className="relative flex items-start gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-md"
          style={{ background: '#0088cc' }}
        >
          <TelegramGlyph className="h-6 w-6" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="mb-1 inline-flex items-center gap-1.5 font-sans text-[11px] uppercase tracking-[0.18em] text-gold-muted">
            <Bell className="h-3 w-3" />
            Live updates
          </p>
          <h3 className="wewed-heading text-xl text-espresso sm:text-2xl">
            Join our Telegram Channel
          </h3>
          <p className="mt-2 font-sans text-sm leading-relaxed text-espresso/70">
            Get instant updates about this wedding — programme changes, live
            moments, and day-of photos.
          </p>

          {configuredHandle && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/60 px-2.5 py-1 font-sans text-[11px] text-espresso/70 ring-1 ring-gold/20">
              <span style={{ color: '#0088cc' }}>
                <TelegramGlyph className="h-3 w-3" />
              </span>
              <span className="font-medium">{configuredHandle}</span>
            </p>
          )}

          <Button
            type="button"
            asChild
            className="mt-4 h-10 w-full border-transparent text-white shadow-md transition-all hover:brightness-105 active:scale-[0.98] sm:w-auto"
            style={{ background: '#0088cc' }}
          >
            <a
              href={configuredUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Join this wedding's Telegram channel (opens in a new tab)"
            >
              <TelegramGlyph className="mr-2 h-4 w-4" />
              Join Channel
              <ExternalLink className="ml-1.5 h-3.5 w-3.5 opacity-80" />
            </a>
          </Button>
        </div>
      </div>

      {showCommands && (
        <Collapsible
          open={commandsOpen}
          onOpenChange={setCommandsOpen}
          className="relative mt-5 border-t border-gold/20 pt-4"
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="group flex w-full items-center justify-between text-left"
              aria-expanded={commandsOpen}
            >
              <span className="font-sans text-xs uppercase tracking-[0.18em] text-espresso/60 group-hover:text-espresso/80">
                Bot Commands
              </span>
              <motion.span
                animate={{ rotate: commandsOpen ? 180 : 0 }}
                transition={{ duration: 0.25 }}
                className="text-espresso/50"
              >
                <ChevronDown className="h-4 w-4" />
              </motion.span>
            </button>
          </CollapsibleTrigger>

          <AnimatePresence initial={false}>
            {commandsOpen && (
              <CollapsibleContent asChild>
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <p className="mt-3 font-sans text-xs text-espresso/55">
                    Message the configured wedding bot directly on Telegram for
                    the relevant link or detail.
                  </p>
                  <ul className="mt-3 space-y-2">
                    {BOT_COMMANDS.map((command) => (
                      <li
                        key={command.cmd}
                        className="flex items-center gap-3 rounded-lg bg-white/50 px-3 py-2 ring-1 ring-gold/15"
                      >
                        <code
                          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-xs font-semibold"
                          style={{
                            background: 'rgba(0,136,204,0.10)',
                            color: '#0088cc',
                          }}
                        >
                          {command.icon}
                          {command.cmd}
                        </code>
                        <span className="font-sans text-xs text-espresso/70">
                          {command.description}
                        </span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              </CollapsibleContent>
            )}
          </AnimatePresence>
        </Collapsible>
      )}
    </div>
  )
}

export default TelegramWidget
