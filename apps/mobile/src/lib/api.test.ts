import { describe, expect, test } from 'bun:test'
import { buildWewedHeaders } from './api'

describe('buildWewedHeaders', () => {
  test('adds the native bearer and JSON content type for JSON mutations', () => {
    expect(buildWewedHeaders({ token: 'native-session', body: JSON.stringify({ title: 'Task' }) })).toMatchObject({
      Accept: 'application/json',
      Authorization: 'Bearer native-session',
      'Content-Type': 'application/json',
      'x-wewed-client': 'native',
    })
  })

  test('does not set Content-Type for FormData so fetch can supply the multipart boundary', () => {
    const form = new FormData()
    form.append('caption', 'Wedding photo')
    const headers = buildWewedHeaders({ token: 'native-session', body: form })

    expect(headers.Authorization).toBe('Bearer native-session')
    expect(Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')).toBe(false)
  })

  test('preserves an explicit caller content type', () => {
    const headers = buildWewedHeaders({
      body: 'plain text',
      headers: { 'content-type': 'text/plain' },
    })
    expect(headers['content-type']).toBe('text/plain')
    expect(headers['Content-Type']).toBeUndefined()
  })
})
