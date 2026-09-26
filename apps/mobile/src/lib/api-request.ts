export interface WewedRequestHeadersInput {
  token?: string | null
  headers?: Record<string, string>
  body?: RequestInit['body']
}

export interface NativeUploadFile {
  uri: string
  name: string
  mimeType: string
}

export function buildWewedHeaders(init: WewedRequestHeadersInput = {}): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'x-wewed-client': 'native',
    ...init.headers,
  }

  if (init.token) headers.Authorization = `Bearer ${init.token}`

  const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')
  const multipartBody = typeof FormData !== 'undefined' && init.body instanceof FormData
  if (init.body && !multipartBody && !hasContentType) headers['Content-Type'] = 'application/json'

  return headers
}

export function appendNativeFile(form: FormData, field: string, file: NativeUploadFile): void {
  form.append(field, {
    uri: file.uri,
    name: file.name,
    type: file.mimeType,
  } as unknown as Blob)
}
