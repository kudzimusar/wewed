'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Music, Heart, Disc3, Radio } from 'lucide-react'
import { useWewedLive } from '@/lib/useWewedLive'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useWeddingContextSafe } from '@/components/wedding/wedding-data-provider'
import { compactWeddingDate, coupleNames } from '@/lib/wedding-template-defaults'

function rankBadgeClass(rank: number): string {
  if (rank === 1) return 'bg-gold text-espresso'
  if (rank === 2) return 'bg-gold-light text-espresso'
  if (rank === 3) return 'bg-gold/60 text-espresso'
  return 'bg-gold/10 text-gold-muted'
}

export function SongbookLive() {
  const { isConnected, songVotes } = useWewedLive()
  const ctx = useWeddingContextSafe()
  const wedding = ctx?.wedding

  const topSongs = songVotes.slice(0, 10)
  const totalVotes = songVotes.reduce((sum, s) => sum + s.votes, 0)
  const footerMark = [
    wedding?.monogram || coupleNames(wedding),
    compactWeddingDate(wedding?.date),
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Card className="border border-gold/30 bg-champagne/80 shadow-sm">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-gold/10">
              <Music className="size-4 text-gold" />
            </div>
            <div>
              <h3 className="wewed-heading text-lg text-espresso leading-tight">
                Live DJ Requests
              </h3>
              <p className="font-sans text-[10px] text-muted-foreground">
                {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'} &middot;{' '}
                {songVotes.length} {songVotes.length === 1 ? 'song' : 'songs'}
              </p>
            </div>
          </div>

          {isConnected ? (
            <Badge
              className="border-gold/30 bg-gold/10 font-sans text-[10px] text-gold-muted"
              variant="outline"
            >
              <span className="wewed-pulse-dot mr-1 inline-block size-1.5 rounded-full bg-gold" />
              LIVE
            </Badge>
          ) : (
            <Badge
              className="border-muted-foreground/20 bg-muted/40 font-sans text-[10px] text-muted-foreground"
              variant="outline"
            >
              <Radio className="mr-1 size-2.5" />
              OFFLINE
            </Badge>
          )}
        </div>

        {!isConnected && songVotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Disc3 className="size-6 text-gold/40" />
            <p className="font-sans text-xs text-muted-foreground">
              Voting opens on the day
            </p>
            <p className="font-sans text-[10px] text-muted-foreground/70">
              Live requests appear here during the reception
            </p>
          </div>
        ) : topSongs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Heart className="size-6 text-gold/40" />
            <p className="font-sans text-xs text-muted-foreground">
              No votes yet — be the first to request a song!
            </p>
          </div>
        ) : (
          <motion.div
            className="space-y-1.5"
            layout
            transition={{ layout: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } }}
          >
            <AnimatePresence initial={false}>
              {topSongs.map((song, idx) => {
                const rank = idx + 1
                return (
                  <motion.div
                    key={song.songId}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{
                      duration: 0.35,
                      delay: Math.min(idx * 0.03, 0.3),
                    }}
                    className={`group flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                      rank <= 3
                        ? 'border-gold/30 bg-white/70'
                        : 'border-gold/10 bg-white/40'
                    }`}
                  >
                    <div
                      className={`flex size-7 shrink-0 items-center justify-center rounded-full font-sans text-xs font-semibold ${rankBadgeClass(
                        rank,
                      )}`}
                    >
                      {rank}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="wewed-heading truncate text-sm text-espresso leading-tight">
                        {song.title}
                      </p>
                      <p className="font-sans text-[11px] text-muted-foreground truncate">
                        {song.artist}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <Heart className="size-3 fill-clay text-clay" />
                      <span className="font-sans text-xs font-medium text-clay">
                        {song.votes}
                      </span>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>

            {songVotes.length > 10 && (
              <p className="pt-2 text-center font-sans text-[10px] text-muted-foreground">
                + {songVotes.length - 10} more songs in the queue
              </p>
            )}
          </motion.div>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-gold/15 pt-3">
          <p className="font-sans text-[10px] text-muted-foreground">
            {isConnected
              ? 'Updates live as guests vote'
              : 'Will refresh when connected'}
          </p>
          {footerMark && (
            <span className="wewed-monogram text-[10px] tracking-widest">
              {footerMark}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
