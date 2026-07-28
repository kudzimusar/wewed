import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: '/',
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ============================================================
// WEWED LIVE — Real-time wedding features
// - Guest check-ins (QR scan at Imba Manor)
// - Live photo wall updates
// - Songbook voting (live sorted list for DJ)
// - Guest wall messages
// - "Applause" / reaction moments
// - Live ceremony timeline progress
// ============================================================

interface CheckIn {
  guestName: string
  token: string
  timestamp: string
  table?: number
}

interface LiveMessage {
  id: string
  authorName: string
  content: string
  timestamp: string
  type: 'message' | 'applause' | 'photo'
  photoUrl?: string
}

interface SongVote {
  songId: string
  title: string
  artist: string
  votes: number
}

// In-memory state (wedding-day ephemeral; persisted via API for permanence)
const checkedInGuests = new Map<string, CheckIn>()
const liveMessages: LiveMessage[] = []
const songVotes = new Map<string, SongVote>()
const connectedGuests = new Map<string, { name: string; isDJ: boolean; isCouple: boolean }>()

const generateId = () => Math.random().toString(36).substring(2, 11)

// Seed some initial live messages for demo
const seedMessages = [
  { id: generateId(), authorName: 'Tendai M.', content: 'The venue looks absolutely magical! ✨', timestamp: new Date(Date.now() - 3600000).toISOString(), type: 'message' as const },
  { id: generateId(), authorName: 'Rumbidzai C.', content: 'Charity, you are the most beautiful bride! 💍', timestamp: new Date(Date.now() - 1800000).toISOString(), type: 'message' as const },
  { id: generateId(), authorName: 'Anonymous Guest', content: '👏👏👏', timestamp: new Date(Date.now() - 900000).toISOString(), type: 'applause' as const },
]
liveMessages.push(...seedMessages)

// Seed some song votes
const seedVotes: SongVote[] = [
  { songId: 'seed-1', title: 'At Last', artist: 'Etta James', votes: 12 },
  { songId: 'seed-2', title: 'Neria', artist: 'Oliver Mtukudzi', votes: 9 },
  { songId: 'seed-3', title: 'September', artist: 'Earth, Wind & Fire', votes: 7 },
]
seedVotes.forEach(v => songVotes.set(v.songId, v))

io.on('connection', (socket) => {
  console.log(`[wewed-live] Guest connected: ${socket.id}`)

  // Send current state on connect
  socket.emit('state:init', {
    checkedInCount: checkedInGuests.size,
    checkedInGuests: Array.from(checkedInGuests.values()).slice(-20),
    messages: liveMessages.slice(-50),
    songVotes: Array.from(songVotes.values()).sort((a, b) => b.votes - a.votes),
    connectedCount: connectedGuests.size,
  })

  // Guest identifies themselves
  socket.on('guest:identify', (data: { name: string; isDJ?: boolean; isCouple?: boolean }) => {
    connectedGuests.set(socket.id, {
      name: data.name || 'Guest',
      isDJ: data.isDJ || false,
      isCouple: data.isCouple || false,
    })
    io.emit('guests:count', { count: connectedGuests.size })
    console.log(`[wewed-live] ${data.name} identified (DJ: ${data.isDJ}, Couple: ${data.isCouple})`)
  })

  // ===== QR Check-in =====
  socket.on('checkin:scan', (data: { token: string; guestName: string; table?: number }) => {
    const checkIn: CheckIn = {
      guestName: data.guestName,
      token: data.token,
      timestamp: new Date().toISOString(),
      table: data.table,
    }
    checkedInGuests.set(data.token, checkIn)
    
    // Broadcast to all (couple dashboard + live wall)
    io.emit('checkin:new', checkIn)
    io.emit('checkin:count', { count: checkedInGuests.size })
    console.log(`[wewed-live] Check-in: ${data.guestName} (total: ${checkedInGuests.size})`)
  })

  // ===== Live Photo Wall =====
  socket.on('photo:share', (data: { guestName: string; photoUrl: string; caption?: string }) => {
    const msg: LiveMessage = {
      id: generateId(),
      authorName: data.guestName,
      content: data.caption || '',
      timestamp: new Date().toISOString(),
      type: 'photo',
      photoUrl: data.photoUrl,
    }
    liveMessages.push(msg)
    if (liveMessages.length > 200) liveMessages.shift()
    io.emit('message:new', msg)
    console.log(`[wewed-live] Photo shared by ${data.guestName}`)
  })

  // ===== Guest Wall Message =====
  socket.on('message:send', (data: { authorName: string; content: string }) => {
    if (!data.content || data.content.trim().length === 0) return
    const msg: LiveMessage = {
      id: generateId(),
      authorName: data.authorName || 'Anonymous Guest',
      content: data.content.trim().slice(0, 500),
      timestamp: new Date().toISOString(),
      type: 'message',
    }
    liveMessages.push(msg)
    if (liveMessages.length > 200) liveMessages.shift()
    io.emit('message:new', msg)
    console.log(`[wewed-live] Message from ${msg.authorName}: ${msg.content.slice(0, 50)}...`)
  })

  // ===== Applause / Reactions =====
  socket.on('applause:send', (data: { authorName?: string }) => {
    const msg: LiveMessage = {
      id: generateId(),
      authorName: data.authorName || 'Anonymous Guest',
      content: '👏',
      timestamp: new Date().toISOString(),
      type: 'applause',
    }
    liveMessages.push(msg)
    if (liveMessages.length > 200) liveMessages.shift()
    // Applause gets a special broadcast for burst animation
    io.emit('applause:burst', { id: msg.id, authorName: msg.authorName })
    io.emit('message:new', msg)
  })

  // ===== Songbook Live Voting =====
  socket.on('song:vote', (data: { songId: string; title: string; artist: string }) => {
    const existing = songVotes.get(data.songId)
    if (existing) {
      existing.votes += 1
    } else {
      songVotes.set(data.songId, {
        songId: data.songId,
        title: data.title,
        artist: data.artist,
        votes: 1,
      })
    }
    // Broadcast updated sorted list (DJ sees this live)
    const sorted = Array.from(songVotes.values()).sort((a, b) => b.votes - a.votes)
    io.emit('songs:ranked', sorted)
    console.log(`[wewed-live] Vote for "${data.title}" — now ${songVotes.get(data.songId)?.votes} votes`)
  })

  // ===== Ceremony Timeline Progress =====
  socket.on('ceremony:progress', (data: { currentItem: string; nextItem?: string }) => {
    // Only couple/DJ should emit this — broadcast to all guests
    io.emit('ceremony:update', {
      currentItem: data.currentItem,
      nextItem: data.nextItem,
      timestamp: new Date().toISOString(),
    })
    console.log(`[wewed-live] Ceremony progress: ${data.currentItem}`)
  })

  socket.on('disconnect', () => {
    const guest = connectedGuests.get(socket.id)
    if (guest) {
      connectedGuests.delete(socket.id)
      io.emit('guests:count', { count: connectedGuests.size })
      console.log(`[wewed-live] ${guest.name} disconnected`)
    }
  })

  socket.on('error', (error) => {
    console.error(`[wewed-live] Socket error (${socket.id}):`, error)
  })
})

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`[wewed-live] WebSocket server running on port ${PORT}`)
  console.log(`[wewed-live] Seeded ${seedMessages.length} messages and ${seedVotes.length} song votes`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[wewed-live] Received SIGTERM, shutting down...')
  httpServer.close(() => {
    console.log('[wewed-live] Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('[wewed-live] Received SIGINT, shutting down...')
  httpServer.close(() => {
    console.log('[wewed-live] Server closed')
    process.exit(0)
  })
})
