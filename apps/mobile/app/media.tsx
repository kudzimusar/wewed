import { useQuery } from '@tanstack/react-query'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import { Stack } from 'expo-router'
import React, { useEffect, useMemo, useState } from 'react'
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSession } from '@/auth/session'
import { ActionButton, Body, Eyebrow, Field, Pill, Screen, Surface, Title } from '@/components/core'
import { appendNativeFile, wewedRequest } from '@/lib/api'
import { colors, radius, spacing } from '@/theme/tokens'

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024
const MOMENTS = ['candid', 'preparation', 'ceremony', 'reception', 'group_photo'] as const
const VAULT_CATEGORIES = ['wedding_document', 'inspiration', 'couple_media'] as const
const VAULT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  txt: 'text/plain',
  csv: 'text/csv',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

type MediaMoment = typeof MOMENTS[number]
type VaultCategory = typeof VAULT_CATEGORIES[number]

type MediaItem = {
  id: string
  type: string
  caption?: string | null
  moment?: string | null
  uploadedAt?: string | null
  mediaGovernance?: {
    provenanceState?: string
    publicationState?: string
    privacyState?: string
  }
}

type VaultObject = {
  id: string
  displayName: string
  originalFilename: string
  mimeType: string
  byteSize: number
  storageState: string
  scanState: string
  category: string
  createdAt: string
  available: boolean
}

function pretty(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function bytes(value?: number | null) {
  if (!value) return 'Size unavailable'
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function inferredMime(name: string, fallback = '') {
  const extension = name.toLowerCase().split('.').pop() ?? ''
  return MIME_BY_EXTENSION[extension] ?? fallback
}

function imageUploadFile(asset: ImagePicker.ImagePickerAsset) {
  const mimeType = asset.mimeType || inferredMime(asset.fileName || asset.uri, 'image/jpeg')
  const extension = Object.entries(MIME_BY_EXTENSION).find(([, mime]) => mime === mimeType)?.[0] || 'jpg'
  return {
    uri: asset.uri,
    name: asset.fileName?.trim() || `wedding-photo-${Date.now()}.${extension}`,
    mimeType,
  }
}

function documentUploadFile(asset: DocumentPicker.DocumentPickerAsset) {
  return {
    uri: asset.uri,
    name: asset.name,
    mimeType: asset.mimeType || inferredMime(asset.name),
  }
}

function Choice<T extends string>({ value, selected, onPress }: { value: T; selected: boolean; onPress: (value: T) => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onPress(value)}
      style={({ pressed }) => [styles.choice, selected && styles.choiceSelected, pressed && styles.pressed]}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{pretty(value)}</Text>
    </Pressable>
  )
}

export default function MediaScreen() {
  const { token, session } = useSession()
  const wedding = session?.activeWedding ?? null
  const role = session?.user.role
  const permittedRole = role === 'couple' || role === 'planner'
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null)
  const [caption, setCaption] = useState('')
  const [moment, setMoment] = useState<MediaMoment>('candid')
  const [mediaBusy, setMediaBusy] = useState(false)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [mediaSuccess, setMediaSuccess] = useState<string | null>(null)
  const [cameraBlocked, setCameraBlocked] = useState(false)
  const [document, setDocument] = useState<DocumentPicker.DocumentPickerAsset | null>(null)
  const [category, setCategory] = useState<VaultCategory>('wedding_document')
  const [documentBusy, setDocumentBusy] = useState(false)
  const [documentError, setDocumentError] = useState<string | null>(null)
  const [documentSuccess, setDocumentSuccess] = useState<string | null>(null)

  const mediaQuery = useQuery({
    queryKey: ['native-media', wedding?.id],
    enabled: Boolean(token && wedding && permittedRole),
    queryFn: () => wewedRequest<{ data: MediaItem[] }>(`/api/media?slug=${encodeURIComponent(wedding!.slug)}&limit=12`, { token }),
  })

  const vaultQuery = useQuery({
    queryKey: ['native-vault', wedding?.id],
    enabled: Boolean(token && wedding && permittedRole),
    queryFn: () => wewedRequest<{ data: VaultObject[]; context: { canUpload: boolean } }>(`/api/vault?weddingId=${encodeURIComponent(wedding!.id)}`, { token }),
  })

  const documents = useMemo(
    () => (vaultQuery.data?.data ?? []).filter((item) => VAULT_CATEGORIES.includes(item.category as VaultCategory)),
    [vaultQuery.data?.data],
  )

  useEffect(() => {
    let alive = true
    void ImagePicker.getPendingResultAsync()
      .then((result) => {
        if (!alive || !result) return
        if ('canceled' in result && !result.canceled && result.assets?.[0]) {
          setPhoto(result.assets[0])
          setMediaError(null)
          setMediaSuccess('Recovered the photo you selected before Android restarted Wewed.')
          return
        }
        if ('message' in result) setMediaError(result.message)
      })
      .catch(() => undefined)
    return () => { alive = false }
  }, [])

  async function choosePhoto() {
    setMediaError(null)
    setMediaSuccess(null)
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.86,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    })
    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0])
  }

  async function takePhoto() {
    setMediaError(null)
    setMediaSuccess(null)
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      setCameraBlocked(permission.canAskAgain === false)
      setMediaError(permission.canAskAgain === false
        ? 'Camera access is blocked in device settings. You can still choose a photo from your library.'
        : 'Camera permission is required only when you choose Take a photo.')
      return
    }
    setCameraBlocked(false)
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      cameraType: ImagePicker.CameraType.back,
      allowsEditing: false,
      quality: 0.86,
    })
    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0])
  }

  async function uploadPhoto() {
    if (!photo || !token || !wedding) return
    if (photo.fileSize && photo.fileSize > MAX_UPLOAD_BYTES) {
      setMediaError('Wedding media must be 25 MB or smaller.')
      return
    }
    const file = imageUploadFile(photo)
    if (!VAULT_MIME_TYPES.includes(file.mimeType)) {
      setMediaError('This photo format is not supported by the governed Wewed media pipeline.')
      return
    }

    setMediaBusy(true)
    setMediaError(null)
    setMediaSuccess(null)
    try {
      const form = new FormData()
      form.append('slug', wedding.slug)
      form.append('moment', moment)
      if (caption.trim()) form.append('caption', caption.trim())
      appendNativeFile(form, 'file', file)
      await wewedRequest('/api/media', { method: 'POST', body: form, token })
      setPhoto(null)
      setCaption('')
      setMediaSuccess('Photo stored privately in Wewed and attached to this wedding.')
      await mediaQuery.refetch()
    } catch (cause) {
      setMediaError(cause instanceof Error ? cause.message : 'Could not upload this wedding photo.')
    } finally {
      setMediaBusy(false)
    }
  }

  async function chooseDocument() {
    setDocumentError(null)
    setDocumentSuccess(null)
    const result = await DocumentPicker.getDocumentAsync({
      type: VAULT_MIME_TYPES,
      copyToCacheDirectory: true,
      multiple: false,
    })
    if (!result.canceled && result.assets[0]) setDocument(result.assets[0])
  }

  async function uploadDocument() {
    if (!document || !token || !wedding) return
    if (document.size && document.size > MAX_UPLOAD_BYTES) {
      setDocumentError('Wewed Vault files must be 25 MB or smaller.')
      return
    }
    const file = documentUploadFile(document)
    if (!file.mimeType || !VAULT_MIME_TYPES.includes(file.mimeType)) {
      setDocumentError('This file type is not supported by Wewed Vault.')
      return
    }

    setDocumentBusy(true)
    setDocumentError(null)
    setDocumentSuccess(null)
    try {
      const form = new FormData()
      form.append('weddingId', wedding.id)
      form.append('category', category)
      appendNativeFile(form, 'file', file)
      const response = await wewedRequest<{ data: { displayName: string; available: boolean; scanState: string } }>('/api/vault', {
        method: 'POST',
        body: form,
        token,
      })
      setDocument(null)
      setDocumentSuccess(response.data.available
        ? `${response.data.displayName} is stored privately and available to authorized Wewed users.`
        : `${response.data.displayName} is stored privately and quarantined until the required scan completes.`)
      await vaultQuery.refetch()
    } catch (cause) {
      setDocumentError(cause instanceof Error ? cause.message : 'Could not upload this wedding document.')
    } finally {
      setDocumentBusy(false)
    }
  }

  if (!wedding || !permittedRole) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Media & documents' }} />
        <Eyebrow>Governed wedding files</Eyebrow>
        <Title>Media & documents</Title>
        <Surface><Body muted>Select a Couple or Planner wedding workspace to use native media and Wewed Vault uploads.</Body></Surface>
      </Screen>
    )
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Media & documents' }} />
      <View style={styles.heading}>
        <Eyebrow>Native capture · private storage</Eyebrow>
        <Title>Media & documents</Title>
        <Body muted>Capture wedding moments and move important files into Wewed without exposing storage credentials. Every upload still passes the same server-side wedding access, file validation and governance rules as the web app.</Body>
      </View>

      <Surface>
        <View style={styles.row}><Text style={styles.sectionTitle}>Wedding photo</Text><Pill tone="sage">Private first</Pill></View>
        <Body muted>Use the system photo picker or camera. Camera permission is requested only when you choose to take a photo. Android can recover a completed picker result if the activity is interrupted.</Body>
        <View style={styles.actions}>
          <ActionButton label="Choose from library" variant="secondary" onPress={choosePhoto} />
          <ActionButton label="Take a photo" variant="secondary" onPress={takePhoto} />
        </View>
        {cameraBlocked ? <ActionButton label="Open device settings" variant="quiet" onPress={async () => { await Linking.openSettings() }} /> : null}
        {photo ? (
          <View style={styles.selection}>
            <Image accessible accessibilityLabel="Selected wedding photo preview" source={{ uri: photo.uri }} style={styles.preview} />
            <View style={styles.flexOne}>
              <Text numberOfLines={2} style={styles.fileName}>{photo.fileName || 'New wedding photo'}</Text>
              <Text style={styles.meta}>{bytes(photo.fileSize)} · upload limit 25 MB</Text>
            </View>
          </View>
        ) : null}
        <Field label="Caption (optional)" value={caption} onChangeText={setCaption} maxLength={500} placeholder="A short memory or context for the wedding" />
        <Text style={styles.label}>Moment</Text>
        <View style={styles.choices}>{MOMENTS.map((value) => <Choice key={value} value={value} selected={moment === value} onPress={setMoment} />)}</View>
        {mediaError ? <Text accessibilityRole="alert" style={styles.error}>{mediaError}</Text> : null}
        {mediaSuccess ? <Text accessibilityRole="alert" style={styles.success}>{mediaSuccess}</Text> : null}
        <ActionButton label="Upload photo privately" loading={mediaBusy} disabled={!photo} onPress={uploadPhoto} />
      </Surface>

      <Surface>
        <View style={styles.row}><Text style={styles.sectionTitle}>Wewed Vault</Text><Pill tone="gold">25 MB max</Pill></View>
        <Body muted>PDF, supported images/video, TXT/CSV, DOCX and XLSX are accepted. Office documents remain quarantined until the existing external scan requirement is satisfied; the app never labels them safe early.</Body>
        <ActionButton label="Choose document" variant="secondary" onPress={chooseDocument} />
        {document ? (
          <View style={styles.fileBox}>
            <Text numberOfLines={2} style={styles.fileName}>{document.name}</Text>
            <Text style={styles.meta}>{document.mimeType || inferredMime(document.name, 'Unknown type')} · {bytes(document.size)}</Text>
          </View>
        ) : null}
        <Text style={styles.label}>Document purpose</Text>
        <View style={styles.choices}>{VAULT_CATEGORIES.map((value) => <Choice key={value} value={value} selected={category === value} onPress={setCategory} />)}</View>
        {documentError ? <Text accessibilityRole="alert" style={styles.error}>{documentError}</Text> : null}
        {documentSuccess ? <Text accessibilityRole="alert" style={styles.success}>{documentSuccess}</Text> : null}
        <ActionButton
          label="Upload to private Vault"
          loading={documentBusy}
          disabled={!document || vaultQuery.data?.context.canUpload === false}
          onPress={uploadDocument}
        />
      </Surface>

      <Surface>
        <View style={styles.row}><Text style={styles.sectionTitle}>Recent wedding media</Text><Pill>{mediaQuery.data?.data.length ?? 0}</Pill></View>
        {mediaQuery.isLoading ? <Body muted>Loading recent media…</Body> : null}
        {mediaQuery.isError ? <><Body muted>Recent media could not be loaded.</Body><ActionButton label="Retry media" variant="secondary" onPress={async () => { await mediaQuery.refetch() }} /></> : null}
        {!mediaQuery.isLoading && !mediaQuery.isError && (mediaQuery.data?.data.length ?? 0) === 0 ? <Body muted>No governed wedding media has been uploaded yet.</Body> : null}
        {(mediaQuery.data?.data ?? []).map((item) => (
          <View key={item.id} style={styles.listItem}>
            <View style={styles.flexOne}>
              <Text style={styles.fileName}>{item.caption || `${pretty(item.moment || 'candid')} ${pretty(item.type)}`}</Text>
              <Text style={styles.meta}>{item.uploadedAt ? new Date(item.uploadedAt).toLocaleString() : 'Upload time unavailable'}</Text>
            </View>
            <Pill tone={item.mediaGovernance?.publicationState === 'PUBLISHED' ? 'sage' : 'gold'}>{pretty(item.mediaGovernance?.publicationState || 'private')}</Pill>
          </View>
        ))}
      </Surface>

      <Surface>
        <View style={styles.row}><Text style={styles.sectionTitle}>Wedding documents</Text><Pill>{documents.length}</Pill></View>
        {vaultQuery.isLoading ? <Body muted>Loading Vault…</Body> : null}
        {vaultQuery.isError ? <><Body muted>Wewed Vault could not be loaded.</Body><ActionButton label="Retry Vault" variant="secondary" onPress={async () => { await vaultQuery.refetch() }} /></> : null}
        {!vaultQuery.isLoading && !vaultQuery.isError && documents.length === 0 ? <Body muted>No general wedding documents have been uploaded yet.</Body> : null}
        {documents.map((item) => (
          <View key={item.id} style={styles.listItem}>
            <View style={styles.flexOne}>
              <Text numberOfLines={2} style={styles.fileName}>{item.displayName || item.originalFilename}</Text>
              <Text style={styles.meta}>{pretty(item.category)} · {bytes(item.byteSize)}</Text>
              <Text style={styles.meta}>{item.available ? 'Available to authorized users' : `Protected: ${pretty(item.scanState)}`}</Text>
            </View>
            <Pill tone={item.available ? 'sage' : 'clay'}>{item.available ? 'Ready' : 'Quarantined'}</Pill>
          </View>
        ))}
      </Surface>
    </Screen>
  )
}

const styles = StyleSheet.create({
  heading: { gap: spacing.xs },
  sectionTitle: { color: colors.espresso, fontFamily: 'serif', fontSize: 22, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  actions: { gap: spacing.xs },
  selection: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  preview: { width: 88, height: 88, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  flexOne: { flex: 1 },
  fileName: { color: colors.espresso, fontSize: 14, fontWeight: '800', lineHeight: 20 },
  meta: { color: colors.inkMuted, fontSize: 12, lineHeight: 18 },
  label: { color: colors.espresso, fontSize: 13, fontWeight: '700' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  choice: { minHeight: 44, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, backgroundColor: colors.white },
  choiceSelected: { backgroundColor: colors.ivory, borderColor: colors.goldMuted },
  choiceText: { color: colors.inkMuted, fontSize: 12, fontWeight: '700' },
  choiceTextSelected: { color: colors.espresso },
  pressed: { opacity: 0.72 },
  fileBox: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, gap: spacing.xxs },
  listItem: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  success: { color: colors.success, fontSize: 13, lineHeight: 19, fontWeight: '700' },
})
