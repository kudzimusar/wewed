'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, Music, Send, Disc3, Radio } from 'lucide-react'
import { useWewedStore } from '@/lib/store'
import { useWewedLive } from '@/lib/useWewedLive'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SectionInfo } from '@/components/wedding/section-info'
import { SectionEyebrow } from '@/components/wedding/section-eyebrow'

/* ── Song Data ── */
interface Song {
  id: string
  title: string
  artist: string
  phase?: string
  isZimbabwean?: boolean
  spotifyUrl?: string
  appleUrl?: string
}

/* Helper: mock streaming link generator (deterministic) */
function mockStreamingUrls(song: Song): { spotify: string; apple: string } {
  const q = encodeURIComponent(`${song.title} ${song.artist}`)
  return {
    spotify: `https://open.spotify.com/search/${q}`,
    apple: `https://music.apple.com/search?term=${q}`,
  }
}

const ceremonySongs: Song[] = [
  { id: 'cer-1', title: 'Ave Maria', artist: 'Franz Schubert', phase: 'Processional' },
  { id: 'cer-2', title: 'Here Comes The Sun', artist: 'The Beatles', phase: 'Bridal Entrance' },
  { id: 'cer-3', title: 'All You Need Is Love', artist: 'The Beatles', phase: 'Recessional' },
]

const receptionSongs: Song[] = [
  { id: 'rec-1', title: 'September', artist: 'Earth, Wind & Fire' },
  { id: 'rec-2', title: 'Lovely Day', artist: 'Bill Withers' },
  { id: 'rec-3', title: "Isn't She Lovely", artist: 'Stevie Wonder' },
  { id: 'rec-4', title: 'We Are Family', artist: 'Sister Sledge' },
  { id: 'rec-5', title: 'Dancing in the Moonlight', artist: 'King Harvest' },
  { id: 'rec-6', title: 'Svikiro', artist: 'Mokoomba', isZimbabwean: true },
  { id: 'rec-7', title: 'Neria', artist: 'Oliver Mtukudzi', isZimbabwean: true },
  { id: 'rec-8', title: 'Chikwata', artist: 'Alick Macheso', isZimbabwean: true },
  { id: 'rec-9', title: 'Sweet Caroline', artist: 'Neil Diamond' },
  { id: 'rec-10', title: 'I Wanna Dance with Somebody', artist: 'Whitney Houston' },
  { id: 'rec-11', title: 'Hey Jude', artist: 'The Beatles' },
  { id: 'rec-12', title: "Don't Stop Me Now", artist: 'Queen' },
  { id: 'rec-13', title: 'Stand By Me', artist: 'Ben E. King' },
  { id: 'rec-14', title: "Put Your Records On", artist: 'Corinne Bailey Rae' },
  { id: 'rec-15', title: "You're My Best Friend", artist: 'Queen' },
  { id: 'rec-16', title: 'Saturday Night', artist: 'Whigfield' },
  { id: 'rec-17', title: 'Masquerade', artist: 'Alick Macheso', isZimbabwean: true },
  { id: 'rec-18', title: 'Chitekete', artist: 'Oliver Mtukudzi', isZimbabwean: true },
  { id: 'rec-19', title: 'Malaika', artist: 'Miriam Makeba', isZimbabwean: true },
]

const firstDanceSongs: Song[] = [
  { id: 'fd-1', title: 'At Last', artist: 'Etta James', phase: 'First Dance' },
  { id: 'fd-2', title: 'Perfect', artist: 'Ed Sheeran', phase: 'First Dance (backup)' },
  { id: 'fd-3', title: 'Thinking Out Loud', artist: 'Ed Sheeran' },
  { id: 'fd-4', title: 'A Thousand Years', artist: 'Christina Perri' },
]

/* ── Streaming Link Icons ── */
function StreamingLinks({ song }: { song: Song }) {
  const urls = mockStreamingUrls(song)
  return (
    <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
      <a
        href={urls.spotify}
        target="_blank"
        rel="noopener noreferrer"
        className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-sage/10 hover:text-sage"
        aria-label={`Play ${song.title} on Spotify`}
        title="Spotify"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-3.5"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z" />
        </svg>
      </a>
      <a
        href={urls.apple}
        target="_blank"
        rel="noopener noreferrer"
        className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-plum/10 hover:text-plum"
        aria-label={`Play ${song.title} on Apple Music`}
        title="Apple Music"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-3.5"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M23.997 6.124c0-.738-.065-1.47-.24-2.19-.317-1.31-1.062-2.31-2.18-3.043C21.003.517 20.373.285 19.7.164c-.517-.093-1.038-.135-1.564-.15-.04-.003-.083-.01-.124-.013H5.988c-.152.01-.303.02-.455.027C4.786.07 4.043.15 3.34.428 2.004.958 1.04 1.88.475 3.208c-.21.49-.333 1.005-.4 1.535-.052.4-.083.803-.1 1.206 0 .032-.007.062-.012.093v12.117c.01.14.02.283.03.424.05.8.183 1.59.5 2.33.692 1.604 1.882 2.62 3.55 3.062.51.13 1.033.2 1.56.232.366.022.733.03 1.1.033h11.55c.276-.005.55-.013.826-.022.847-.03 1.682-.16 2.482-.466 1.555-.587 2.66-1.623 3.282-3.156.236-.582.36-1.19.43-1.812.05-.455.07-.913.08-1.37 0-.043.005-.084.005-.126V6.124zM12.94 16.578c-.244.27-.583.42-.94.42-.36 0-.7-.15-.94-.42-.246-.27-.36-.62-.32-.99.04-.36.24-.69.51-.92.27-.24.62-.36.99-.32.36.04.69.24.92.51.24.27.36.62.32.99-.04.36-.24.69-.51.92z" />
        </svg>
      </a>
    </div>
  )
}

/* ── Song Card Component ── */
function SongCard({ song, index }: { song: Song; index: number }) {
  const { musicVotes, toggleVote } = useWewedStore()
  const { isConnected, songVotes, voteSong } = useWewedLive()
  const isVoted = (musicVotes[song.id] ?? 0) > 0
  // local vote contributes 1, plus any live votes from the socket
  const liveVotes = songVotes.find((s) => s.songId === song.id)?.votes ?? 0
  const totalVotes = (isVoted ? 1 : 0) + liveVotes
  // has received live votes from other guests (subtle indicator)
  const hasLiveVotes = liveVotes > 0

  const handleVote = () => {
    toggleVote(song.id)
    // Only emit an up-vote to the socket when toggling ON (not when removing)
    // and only when the socket is connected.
    if (!isVoted && isConnected) {
      voteSong(song.id, song.title, song.artist)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.04,
        duration: 0.4,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
    >
      <Card
        className={`wewed-photo-frame group relative border-gold/15 bg-white/70 ${
          hasLiveVotes ? 'border-gold/30 bg-gold/[0.03]' : ''
        }`}
      >
        {hasLiveVotes && (
          <span className="absolute -left-px top-3 h-[calc(100%-1.5rem)] w-[2px] rounded-full bg-gradient-to-b from-gold/60 via-clay/40 to-transparent" />
        )}
        <CardContent className="flex items-center gap-2 py-3 sm:gap-4">
          {/* Song Icon — with live pulse if it has live votes */}
          <div className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-gold/10 transition-colors group-hover:bg-gold/20">
            <Disc3 className="size-4 text-gold" />
            {hasLiveVotes && (
              <span className="absolute -right-0.5 -top-0.5 flex size-2.5 items-center justify-center">
                <span className="wewed-pulse-dot absolute inline-flex size-2 rounded-full bg-clay/60" />
                <span className="relative inline-flex size-1.5 rounded-full bg-clay" />
              </span>
            )}
          </div>

          {/* Song Info */}
          <div className="min-w-0 flex-1">
            <p className="wewed-heading truncate text-base text-espresso">
              {song.title}
            </p>
            <p className="font-sans text-sm text-muted-foreground truncate">
              {song.artist}
            </p>
          </div>

          {/* Streaming links (hover-revealed) — hidden on mobile to save space */}
          <div className="hidden sm:block">
            <StreamingLinks song={song} />
          </div>

          {/* Phase Badge */}
          {song.phase && (
            <Badge
              variant="secondary"
              className="shrink-0 border-gold/20 bg-gold/10 font-sans text-xs text-gold-muted"
            >
              {song.phase}
            </Badge>
          )}

          {/* Zimbabwean Badge */}
          {song.isZimbabwean && !song.phase && (
            <Badge
              variant="outline"
              className="shrink-0 border-clay/30 font-sans text-xs text-clay"
            >
              Zimbabwean
            </Badge>
          )}

          {/* Live indicator: small radio icon when socket-driven votes exist */}
          {hasLiveVotes && (
            <span
              className="hidden shrink-0 items-center gap-1 font-sans text-[10px] uppercase tracking-wider text-clay/80 md:inline-flex"
              title="Live votes"
            >
              <Radio className="size-3" />
              live
            </span>
          )}

          {/* Vote Button */}
          <button
            onClick={handleVote}
            className="group/vote flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 font-sans text-xs transition-all duration-200 hover:bg-gold/10"
            aria-label={isVoted ? 'Remove vote' : 'Vote for this song'}
            aria-pressed={isVoted}
          >
            <Heart
              className={`size-4 transition-all duration-200 ${
                isVoted
                  ? 'fill-clay text-clay wewed-vote-pop'
                  : 'text-muted-foreground group-hover/vote:text-clay'
              }`}
            />
            {totalVotes > 0 && (
              <span className="text-clay font-medium">{totalVotes}</span>
            )}
          </button>
        </CardContent>
      </Card>
    </motion.div>
  )
}

/* ── Song List Component ── */
function SongList({ songs }: { songs: Song[] }) {
  return (
    <div className="max-h-[500px] space-y-2 overflow-y-auto wewed-scroll pr-1">
      <AnimatePresence>
        {songs.map((song, i) => (
          <SongCard key={song.id} song={song} index={i} />
        ))}
      </AnimatePresence>
    </div>
  )
}

/* ── Guest Request Tab ── */
function GuestRequestTab() {
  const [songTitle, setSongTitle] = useState('')
  const [songArtist, setSongArtist] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!songTitle.trim()) return
    setSubmitted(true)
    setSongTitle('')
    setSongArtist('')
    setTimeout(() => setSubmitted(false), 3000)
  }

  return (
    <div className="space-y-6">
      {/* Request Form */}
      <Card className="border-gold/20 bg-champagne">
        <CardContent className="py-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Music className="size-4 text-gold" />
              <p className="font-sans text-sm font-medium text-espresso">
                Suggest a Song
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                placeholder="Song title"
                value={songTitle}
                onChange={(e) => setSongTitle(e.target.value)}
                className="flex-1 border-gold/30 bg-white/80 font-sans placeholder:text-muted-foreground/60 focus:border-gold focus:ring-gold/20"
              />
              <Input
                placeholder="Artist (optional)"
                value={songArtist}
                onChange={(e) => setSongArtist(e.target.value)}
                className="flex-1 border-gold/30 bg-white/80 font-sans placeholder:text-muted-foreground/60 focus:border-gold focus:ring-gold/20"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              className="bg-gold text-espresso hover:bg-gold-light font-sans"
            >
              <Send className="size-3.5" />
              Submit Request
            </Button>
            {submitted && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-sans text-sm text-sage"
              >
                Thank you! Your suggestion has been added to the playlist.
              </motion.p>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Existing guest requests placeholder */}
      <div className="space-y-2">
        <p className="font-sans text-sm font-medium text-espresso">
          Recent Requests
        </p>
        {[
          { title: 'Zvaitika', artist: 'Jah Prayzah', requester: 'Tendai M.' },
          { title: 'Kana Ndanyura', artist: 'Jah Prayzah', requester: 'Munashe M.' },
          { title: 'Waenda', artist: 'Oliver Mtukudzi', requester: 'Chiedza K.' },
        ].map((req, i) => (
          <motion.div
            key={req.title}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
          >
            <Card className="border-gold/10 bg-white/50">
              <CardContent className="flex items-center gap-3 py-2.5">
                <Disc3 className="size-4 shrink-0 text-gold/60" />
                <div className="min-w-0 flex-1">
                  <p className="wewed-heading text-sm text-espresso truncate">
                    {req.title}
                  </p>
                  <p className="font-sans text-xs text-muted-foreground truncate">
                    {req.artist} &middot; Requested by {req.requester}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="shrink-0 border-gold/20 font-sans text-xs text-gold"
                >
                  Guest Pick
                </Badge>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

/* ── Main Component ── */
export function Songbook() {
  return (
    <section id="songbook" className="wewed-section py-20 md:py-32">
      <div className="mx-auto max-w-4xl px-4">
        {/* Header */}
        <motion.div
          className="mb-12 text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7 }}
        >
          <SectionEyebrow>The Soundtrack</SectionEyebrow>
          <h2 className="wewed-heading wewed-heading-accent text-4xl md:text-5xl text-espresso">
            The Songbook <SectionInfo text="Click the heart icon on any song to vote for it. The DJ will see the live-ranked list on the wedding day. Switch tabs to browse Ceremony, Reception, First Dance, or submit your own request." />
          </h2>
          <p className="mt-4 font-sans text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Music is the soundtrack of our love. Here&apos;s what we&apos;ll be dancing to — and you can help shape the playlist.
          </p>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <Tabs defaultValue="ceremony" className="w-full">
            <TabsList className="mx-auto mb-8 flex w-full max-w-lg bg-champagne border border-gold/15 p-1">
              <TabsTrigger
                value="ceremony"
                className="font-sans text-xs sm:text-sm data-[state=active]:bg-gold/15 data-[state=active]:text-espresso"
              >
                Ceremony
              </TabsTrigger>
              <TabsTrigger
                value="reception"
                className="font-sans text-xs sm:text-sm data-[state=active]:bg-gold/15 data-[state=active]:text-espresso"
              >
                Reception
              </TabsTrigger>
              <TabsTrigger
                value="firstdance"
                className="font-sans text-xs sm:text-sm data-[state=active]:bg-gold/15 data-[state=active]:text-espresso"
              >
                First Dance
              </TabsTrigger>
              <TabsTrigger
                value="guest"
                className="font-sans text-xs sm:text-sm data-[state=active]:bg-gold/15 data-[state=active]:text-espresso"
              >
                Guest Requests
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ceremony">
              <div className="mb-3 flex items-center gap-2">
                <span className="font-sans text-xs text-muted-foreground uppercase tracking-wider">
                  {ceremonySongs.length} songs
                </span>
              </div>
              <SongList songs={ceremonySongs} />
            </TabsContent>

            <TabsContent value="reception">
              <div className="mb-3 flex items-center gap-2">
                <span className="font-sans text-xs text-muted-foreground uppercase tracking-wider">
                  {receptionSongs.length} songs
                </span>
              </div>
              <SongList songs={receptionSongs} />
            </TabsContent>

            <TabsContent value="firstdance">
              <div className="mb-3 flex items-center gap-2">
                <span className="font-sans text-xs text-muted-foreground uppercase tracking-wider">
                  {firstDanceSongs.length} songs
                </span>
              </div>
              <SongList songs={firstDanceSongs} />
            </TabsContent>

            <TabsContent value="guest">
              <GuestRequestTab />
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Footer monogram */}
        <motion.div
          className="mt-12 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="wewed-divider w-32 mx-auto" />
          <p className="mt-6 wewed-monogram text-xs tracking-widest">
            C&amp;K &middot; 23.12.26
          </p>
        </motion.div>
      </div>
    </section>
  )
}
