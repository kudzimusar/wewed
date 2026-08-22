import { describe, expect, test } from 'bun:test'
import { encryptWebPushPayload, isSafeWebPushEndpoint } from '@/lib/notifications/web-push'

function b64url(value: string): Buffer {
  return Buffer.from(value, 'base64url')
}

describe('direct Web Push', () => {
  test('matches the RFC 8291 encryption example byte-for-byte', () => {
    const plaintext = Buffer.from('When I grow up, I want to be a watermelon', 'utf8')
    const body = encryptWebPushPayload(
      {
        p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
        auth: 'BTBZMqHH6r4Tts7J_aSIgg',
      },
      plaintext,
      {
        salt: b64url('DGv6ra1nlYgDCS1FRnbzlw'),
        serverPrivateKey: b64url('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw'),
      },
    )

    expect(body.toString('base64url')).toBe(
      'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
    )
  })

  test('rejects private/local push endpoints and accepts public HTTPS endpoints', () => {
    expect(isSafeWebPushEndpoint('http://push.example.test/subscription')).toBe(false)
    expect(isSafeWebPushEndpoint('https://localhost/push')).toBe(false)
    expect(isSafeWebPushEndpoint('https://127.0.0.1/push')).toBe(false)
    expect(isSafeWebPushEndpoint('https://10.0.0.8/push')).toBe(false)
    expect(isSafeWebPushEndpoint('https://192.168.1.2/push')).toBe(false)
    expect(isSafeWebPushEndpoint('https://[::1]/push')).toBe(false)
    expect(isSafeWebPushEndpoint('https://fcm.googleapis.com/fcm/send/example')).toBe(true)
  })
})
