'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

/* ============================================================
   useWewedLive — Real-time wedding socket hook
   Connects to the wewed-live mini-service (socket.io on port 3003)
   Exposes reactive state + emit helpers for the live features.
   ============================================================ */

export type LiveMessageType = 'message' | 'applause' | 'photo'

export interface LiveMessage {
  id: string
  authorName: string
  content: string
  timestamp: string
  type: LiveMessageType
  photoUrl?: string
}

export interface CheckedInGuest {
  guestName: string
  token: string
  timestamp: string
  table?: number
}

export interface SongVote {
  songId: string
  title: string
  artist: string
  votes: number
}

export interface CeremonyState {
  currentItem: string
  nextItem?: string
  timestamp: string
}

interface IdentifyOptions {
  isDJ?: boolean
  isCouple?: boolean
}

interface UseWewedLiveReturn {
  isConnected: boolean
  connectedGuests: number
  checkedInCount: number
  checkedInGuests: CheckedInGuest[]
  liveMessages: LiveMessage[]
  songVotes: SongVote[]
  currentCeremonyItem: string | null
  nextCeremonyItem: string | null
  /** Emit guest:identify */
  identify: (name: string, opts?: IdentifyOptions) => void
  /** Emit checkin:scan */
  checkIn: (token: string, guestName: string, table?: number) => void
  /** Emit message:send */
  sendMessage: (authorName: string, content: string) => void
  /** Emit applause:send */
  sendApplause: (authorName?: string) => void
  /** Emit photo:share */
  sharePhoto: (guestName: string, photoUrl: string, caption?: string) => void
  /** Emit song:vote */
  voteSong: (songId: string, title: string, artist: string) => void
  /** Emit ceremony:progress (couple/DJ only) */
  updateCeremony: (current: string, next?: string) => void
}

const MAX_MESSAGES = 50
const MAX_CHECKINS = 20

export function useWewedLive(): UseWewedLiveReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [connectedGuests, setConnectedGuests] = useState(0)
  const [checkedInCount, setCheckedInCount] = useState(0)
  const [checkedInGuests, setCheckedInGuests] = useState<CheckedInGuest[]>([])
  const [liveMessages, setLiveMessages] = useState<LiveMessage[]>([])
  const [songVotes, setSongVotes] = useState<SongVote[]>([])
  const [currentCeremonyItem, setCurrentCeremonyItem] = useState<string | null>(null)
  const [nextCeremonyItem, setNextCeremonyItem] = useState<string | null>(null)

  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    // IMPORTANT: connect via the gateway. NEVER use http://localhost:3003 directly.
    const socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    })
    socketRef.current = socket

    const onConnect = () => setIsConnected(true)
    const onDisconnect = () => setIsConnected(false)
    const onReconnectAttempt = () => setIsConnected(false)

    const onStateInit = (payload: {
      checkedInCount: number
      checkedInGuests: CheckedInGuest[]
      messages: LiveMessage[]
      songVotes: SongVote[]
      connectedCount: number
    }) => {
      if (typeof payload.checkedInCount === 'number') setCheckedInCount(payload.checkedInCount)
      if (Array.isArray(payload.checkedInGuests)) {
        setCheckedInGuests(payload.checkedInGuests.slice(-MAX_CHECKINS))
      }
      if (Array.isArray(payload.messages)) {
        setLiveMessages(payload.messages.slice(-MAX_MESSAGES))
      }
      if (Array.isArray(payload.songVotes)) {
        setSongVotes([...payload.songVotes].sort((a, b) => b.votes - a.votes))
      }
      if (typeof payload.connectedCount === 'number') setConnectedGuests(payload.connectedCount)
    }

    const onMessageNew = (msg: LiveMessage) => {
      setLiveMessages((prev) => {
        const next = [...prev, msg]
        return next.slice(-MAX_MESSAGES)
      })
    }

    const onApplauseBurst = (_payload: { id: string; authorName: string }) => {
      // Applause is also delivered as a message via message:new, so no
      // additional state update is required here. The dedicated event is
      // useful for triggering burst animations on the wall (handled in
      // the component via a separate listener if needed).
    }

    const onCheckInNew = (checkIn: CheckedInGuest) => {
      setCheckedInGuests((prev) => [...prev, checkIn].slice(-MAX_CHECKINS))
    }

    const onCheckInCount = (payload: { count: number }) => {
      if (typeof payload.count === 'number') setCheckedInCount(payload.count)
    }

    const onSongsRanked = (list: SongVote[]) => {
      if (Array.isArray(list)) {
        setSongVotes([...list].sort((a, b) => b.votes - a.votes))
      }
    }

    const onCeremonyUpdate = (payload: CeremonyState) => {
      if (payload?.currentItem) setCurrentCeremonyItem(payload.currentItem)
      setNextCeremonyItem(payload?.nextItem ?? null)
    }

    const onGuestsCount = (payload: { count: number }) => {
      if (typeof payload.count === 'number') setConnectedGuests(payload.count)
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('reconnect_attempt', onReconnectAttempt)
    socket.on('state:init', onStateInit)
    socket.on('message:new', onMessageNew)
    socket.on('applause:burst', onApplauseBurst)
    socket.on('checkin:new', onCheckInNew)
    socket.on('checkin:count', onCheckInCount)
    socket.on('songs:ranked', onSongsRanked)
    socket.on('ceremony:update', onCeremonyUpdate)
    socket.on('guests:count', onGuestsCount)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('reconnect_attempt', onReconnectAttempt)
      socket.off('state:init', onStateInit)
      socket.off('message:new', onMessageNew)
      socket.off('applause:burst', onApplauseBurst)
      socket.off('checkin:new', onCheckInNew)
      socket.off('checkin:count', onCheckInCount)
      socket.off('songs:ranked', onSongsRanked)
      socket.off('ceremony:update', onCeremonyUpdate)
      socket.off('guests:count', onGuestsCount)
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  const identify = useCallback((name: string, opts?: IdentifyOptions) => {
    socketRef.current?.emit('guest:identify', {
      name,
      isDJ: opts?.isDJ ?? false,
      isCouple: opts?.isCouple ?? false,
    })
  }, [])

  const checkIn = useCallback(
    (token: string, guestName: string, table?: number) => {
      socketRef.current?.emit('checkin:scan', { token, guestName, table })
    },
    []
  )

  const sendMessage = useCallback((authorName: string, content: string) => {
    socketRef.current?.emit('message:send', { authorName, content })
  }, [])

  const sendApplause = useCallback((authorName?: string) => {
    socketRef.current?.emit('applause:send', { authorName })
  }, [])

  const sharePhoto = useCallback(
    (guestName: string, photoUrl: string, caption?: string) => {
      socketRef.current?.emit('photo:share', { guestName, photoUrl, caption })
    },
    []
  )

  const voteSong = useCallback(
    (songId: string, title: string, artist: string) => {
      socketRef.current?.emit('song:vote', { songId, title, artist })
    },
    []
  )

  const updateCeremony = useCallback((current: string, next?: string) => {
    socketRef.current?.emit('ceremony:progress', { currentItem: current, nextItem: next })
  }, [])

  return {
    isConnected,
    connectedGuests,
    checkedInCount,
    checkedInGuests,
    liveMessages,
    songVotes,
    currentCeremonyItem,
    nextCeremonyItem,
    identify,
    checkIn,
    sendMessage,
    sendApplause,
    sharePhoto,
    voteSong,
    updateCeremony,
  }
}
