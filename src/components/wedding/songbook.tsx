'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, Music, Send, Disc3, Radio, Loader2 } from 'lucide-react'
import { useWewedStore } from '@/lib/store'
import { useWewedLive } from '@/lib/useWewedLive'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SectionInfo } from '@/components/wedding/section-info'
import { SectionEyebrow } from '@/components/wedding/section-eyebrow'
import { useWeddingContextSafe } from '@/components/wedding/wedding-data-provider'
import { compactWeddingDate, coupleNames } from '@/lib/wedding-template-defaults'

interface Song {
  id: string
  title: string
  artist: string
  phase?: string
  moment?: string
  spotifyUrl?: string
  appleUrl?: string
  baseVotes?: number
  starter?: boolean
}

const STARTER_CEREMONY: Song[] = [
  { id: 'starter-ceremony-1', title: 'Example Processional Song', artist: 'Add your chosen artist', phase: 'Processional', starter: true },
  { id: 'starter-ceremony-2', title: 'Example Entrance Song', artist: 'Add your chosen artist', phase: 'Entrance', starter: true },
  { id: 'starter-ceremony-3', title: 'Example Recessional Song', artist: 'Add your chosen artist', phase: 'Recessional', starter: true },
]

const STARTER_RECEPTION: Song[] = [
  { id: 'starter-reception-1', title: 'Example Welcome Song', artist: 'Add your chosen artist', starter: true },
  { id: 'starter-reception-2', title: 'Example Dance-Floor Favourite', artist: 'Add your chosen artist', starter: true },
  { id: 'starter-reception-3', title: 'Example Closing Song', artist: 'Add your chosen artist', starter: true },
]

const STARTER_FIRST_DANCE: Song[] = [
  { id: 'starter-firstdance-1', title: 'Example First-Dance Song', artist: 'Add your chosen artist', phase: 'First Dance', starter: true },
]

function streamingUrls(song: Song): { spotify: string; apple: string } {
  const q = encodeURIComponent(`${song.title} ${song.artist}`)
  return {
    spotify: song.spotifyUrl || `https://open.spotify.com/search/${q}`,
    apple: song.appleUrl || `https://music.apple.com/search?term=${q}`,
  }
}

function StreamingLinks({ song }: { song: Song }) {
  if (song.starter) return null
  const urls = streamingUrls(song)
  return (
    <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
      <a
        href={urls.spotify}
        target="_blank"
        rel="noopener noreferrer"
        className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-sage/10 hover:text-sage"
        aria-label={`Find ${song.title} on Spotify`}
        title="Spotify"
      >
        <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden="true">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2z" />
        </svg>
      </a>
      <a
        href={urls.apple}
        target="_blank"
        rel="noopener noreferrer"
        className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-plum/10 hover:text-plum"
        aria-label={`Find ${song.title} on Apple Music`}
        title="Apple Music"
      >
        <Music className="size-3.5" />
      </a>
    </div>
  )
}

function SongCard({ song, index }: { song: Song; index: number }) {
  const { musicVotes, toggleVote } = useWewedStore()
  const { isConnected, songVotes, voteSong } = useWewedLive()
  const isVoted = (musicVotes[song.id] ?? 0) > 0
  const liveVotes = songVotes.find((s) => s.songId === song.id)?.votes ?? 0
  const totalVotes = (song.baseVotes ?? 0) + (isVoted ? 1 : 0) + liveVotes
  const hasLiveVotes = liveVotes > 0

  const handleVote = () => {
    if (song.starter) return
    toggleVote(song.id)
    if (!isVoted && isConnected) voteSong(song.id, song.title, song.artist)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Card className={`wewed-photo-frame group relative border-gold/15 bg-white/70 ${hasLiveVotes ? 'border-gold/30 bg-gold/[0.03]' : ''}`}>
        {hasLiveVotes && <span className="absolute -left-px top-3 h-[calc(100%-1.5rem)] w-[2px] rounded-full bg-gradient-to-b from-gold/60 via-clay/40 to-transparent" />}
        <CardContent className="flex items-center gap-2 py-3 sm:gap-4">
          <div className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-gold/10 transition-colors group-hover:bg-gold/20">
            <Disc3 className="size-4 text-gold" />
            {hasLiveVotes && (
              <span className="absolute -right-0.5 -top-0.5 flex size-2.5 items-center justify-center">
                <span className="wewed-pulse-dot absolute inline-flex size-2 rounded-full bg-clay/60" />
                <span className="relative inline-flex size-1.5 rounded-full bg-clay" />
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="wewed-heading truncate text-base text-espresso">{song.title}</p>
            <p className="truncate font-sans text-sm text-muted-foreground">{song.artist}</p>
          </div>

          <div className="hidden sm:block"><StreamingLinks song={song} /></div>

          {song.phase && (
            <Badge variant="secondary" className="shrink-0 border-gold/20 bg-gold/10 font-sans text-xs text-gold-muted">
              {song.phase}
            </Badge>
          )}

          {song.starter ? (
            <Badge variant="outline" className="shrink-0 border-dashed border-gold/30 text-[10px] text-gold-muted">Example</Badge>
          ) : (
            <button
              onClick={handleVote}
              className="group/vote flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 font-sans text-xs transition-all duration-200 hover:bg-gold/10"
              aria-label={isVoted ? 'Remove vote' : 'Vote for this song'}
              aria-pressed={isVoted}
            >
              <Heart className={`size-4 transition-all duration-200 ${isVoted ? 'fill-clay text-clay wewed-vote-pop' : 'text-muted-foreground group-hover/vote:text-clay'}`} />
              {totalVotes > 0 && <span className="font-medium text-clay">{totalVotes}</span>}
            </button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

function SongList({ songs }: { songs: Song[] }) {
  return (
    <div className="max-h-[500px] space-y-2 overflow-y-auto wewed-scroll pr-1">
      <AnimatePresence>
        {songs.map((song, i) => <SongCard key={song.id} song={song} index={i} />)}
      </AnimatePresence>
    </div>
  )
}

function GuestRequestTab({ requestedSongs }: { requestedSongs: Song[] }) {
  const ctx = useWeddingContextSafe()
  const [songTitle, setSongTitle] = useState('')
  const [songArtist, setSongArtist] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!songTitle.trim() || !songArtist.trim() || !ctx?.slug) return
    setSubmitting(true)
    setMessage(null)
    try {
      const response = await fetch('/api/songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-wewed-wedding-slug': ctx.slug },
        body: JSON.stringify({
          slug: ctx.slug,
          title: songTitle.trim(),
          artist: songArtist.trim(),
          phase: 'requested',
          moment: 'Guest Request',
        }),
      })
      const body = (await response.json().catch(() => null)) as { success?: boolean; error?: string } | null
      if (!response.ok || !body?.success) throw new Error(body?.error || 'Unable to submit song request.')
      setSongTitle('')
      setSongArtist('')
      setMessage('Thank you — your song request has been added to this wedding.')
      ctx.refetch()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to submit song request.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-gold/20 bg-champagne">
        <CardContent className="py-4">
          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
            <div className="mb-2 flex items-center gap-2">
              <Music className="size-4 text-gold" />
              <p className="font-sans text-sm font-medium text-espresso">Suggest a Song</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input placeholder="Song title" value={songTitle} onChange={(e) => setSongTitle(e.target.value)} className="flex-1 border-gold/30 bg-white/80 font-sans" />
              <Input placeholder="Artist" value={songArtist} onChange={(e) => setSongArtist(e.target.value)} className="flex-1 border-gold/30 bg-white/80 font-sans" />
            </div>
            <Button type="submit" size="sm" disabled={submitting || !songTitle.trim() || !songArtist.trim()} className="bg-gold font-sans text-espresso hover:bg-gold-light">
              {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              Submit Request
            </Button>
            {message && <p className="font-sans text-sm text-espresso/65">{message}</p>}
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <p className="font-sans text-sm font-medium text-espresso">Guest Requests</p>
        {requestedSongs.length > 0 ? (
          <SongList songs={requestedSongs} />
        ) : (
          <Card className="border-dashed border-gold/20 bg-white/40">
            <CardContent className="py-5 text-center font-sans text-sm text-muted-foreground">
              No guest requests yet — be the first to suggest a song.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export function Songbook() {
  const ctx = useWeddingContextSafe()
  const wedding = ctx?.wedding
  const heading = ctx?.getContent('songbook', 'heading', 'The Songbook') ?? 'The Songbook'
  const subtitle = ctx?.getContent(
    'songbook',
    'subtitle',
    'Music becomes part of the memory. Browse the couple’s choices, vote for favourites and suggest a song.',
  ) ?? 'Music becomes part of the memory. Browse the couple’s choices, vote for favourites and suggest a song.'

  const grouped = useMemo(() => {
    const rows: Song[] = (ctx?.songs ?? []).map((song) => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      phase: song.moment || song.phase.replaceAll('_', ' '),
      moment: song.moment || undefined,
      spotifyUrl: song.spotifyUrl || undefined,
      appleUrl: song.appleUrl || undefined,
      baseVotes: song.votes,
    }))
    return {
      ceremony: rows.filter((song) => {
        const source = (ctx?.songs.find((item) => item.id === song.id)?.phase || '').toLowerCase()
        return ['ceremony', 'bridal_entrance', 'recessional', 'processional'].includes(source)
      }),
      reception: rows.filter((song) => (ctx?.songs.find((item) => item.id === song.id)?.phase || '').toLowerCase() === 'reception'),
      firstDance: rows.filter((song) => (ctx?.songs.find((item) => item.id === song.id)?.phase || '').toLowerCase() === 'first_dance'),
      requested: rows.filter((song) => (ctx?.songs.find((item) => item.id === song.id)?.phase || '').toLowerCase() === 'requested'),
    }
  }, [ctx?.songs])

  const ceremonySongs = grouped.ceremony.length ? grouped.ceremony : STARTER_CEREMONY
  const receptionSongs = grouped.reception.length ? grouped.reception : STARTER_RECEPTION
  const firstDanceSongs = grouped.firstDance.length ? grouped.firstDance : STARTER_FIRST_DANCE
  const footerMark = [wedding?.monogram || coupleNames(wedding), compactWeddingDate(wedding?.date)].filter(Boolean).join(' · ')

  return (
    <section id="songbook" className="wewed-section py-20 md:py-32">
      <div className="mx-auto max-w-4xl px-4">
        <motion.div className="mb-12 text-center" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-100px' }} transition={{ duration: 0.7 }}>
          <SectionEyebrow>The Soundtrack</SectionEyebrow>
          <h2 className="wewed-heading wewed-heading-accent text-4xl text-espresso md:text-5xl">
            {heading} <SectionInfo text="Click the heart icon on any real song to vote for it. Browse ceremony, reception and first-dance choices, or submit a guest request." />
          </h2>
          <p className="mx-auto mt-4 max-w-2xl font-sans leading-relaxed text-muted-foreground">{subtitle}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.6, delay: 0.1 }}>
          <Tabs defaultValue="ceremony" className="w-full">
            <TabsList className="mx-auto mb-8 flex w-full max-w-lg border border-gold/15 bg-champagne p-1">
              <TabsTrigger value="ceremony" className="font-sans text-xs sm:text-sm">Ceremony</TabsTrigger>
              <TabsTrigger value="reception" className="font-sans text-xs sm:text-sm">Reception</TabsTrigger>
              <TabsTrigger value="firstdance" className="font-sans text-xs sm:text-sm">First Dance</TabsTrigger>
              <TabsTrigger value="guest" className="font-sans text-xs sm:text-sm">Guest Requests</TabsTrigger>
            </TabsList>

            <TabsContent value="ceremony"><SongList songs={ceremonySongs} /></TabsContent>
            <TabsContent value="reception"><SongList songs={receptionSongs} /></TabsContent>
            <TabsContent value="firstdance"><SongList songs={firstDanceSongs} /></TabsContent>
            <TabsContent value="guest"><GuestRequestTab requestedSongs={grouped.requested} /></TabsContent>
          </Tabs>
        </motion.div>

        <motion.div className="mt-12 text-center" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.3 }}>
          <div className="wewed-divider mx-auto w-32" />
          {footerMark && <p className="mt-6 wewed-monogram text-xs tracking-widest">{footerMark}</p>}
        </motion.div>
      </div>
    </section>
  )
}
