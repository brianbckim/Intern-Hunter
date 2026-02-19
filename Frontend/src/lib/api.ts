import { getAccessToken } from './auth'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = getAccessToken()
  const headers = new Headers(init?.headers)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  return fetch(input, { ...init, headers })
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data: unknown = await response.json()
    if (data && typeof data === 'object' && 'detail' in data) {
      const detail = (data as { detail?: unknown }).detail
      if (typeof detail === 'string') return detail
    }
  } catch {
    // ignore
  }

  try {
    const text = await response.text()
    if (text) return text
  } catch {
    // ignore
  }

  return response.statusText || `HTTP ${response.status}`
}

async function apiJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await apiFetch(input, init)
  if (!res.ok) {
    throw new ApiError(res.status, await readErrorMessage(res))
  }
  return (await res.json()) as T
}

export type TokenResponse = { access_token: string; token_type: string }

export async function login(email: string, password: string): Promise<TokenResponse> {
  return apiJson<TokenResponse>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}

export async function register(
  email: string,
  password: string,
  fullName?: string
): Promise<TokenResponse> {
  return apiJson<TokenResponse>('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, full_name: fullName ?? null }),
  })
}

export type ResumeListItem = {
  resume_id: string
  original_filename: string
  content_type?: string | null
  uploaded_at: string
  analyzed_at?: string | null
}

export type ResumeDetail = {
  resume_id: string
  user_email?: string
  original_filename: string
  content_type?: string | null
  storage_ref?: string | null
  extracted_text?: string | null
  uploaded_at?: string
  analyzed_at?: string | null
}

export type ResumeUploadResponse = {
  resume_id: string
  resume: {
    user_email: string
    original_filename: string
    content_type?: string | null
    storage_ref?: string | null
    extracted_text?: string | null
    uploaded_at: string
    analyzed_at?: string | null
  }
}

export async function listMyResumes(): Promise<ResumeListItem[]> {
  return apiJson<ResumeListItem[]>('/api/resumes/me')
}

export async function getResume(resumeId: string): Promise<ResumeDetail> {
  return apiJson<ResumeDetail>(`/api/resumes/${resumeId}`)
}

export async function uploadResume(file: File): Promise<ResumeUploadResponse> {
  const form = new FormData()
  form.append('file', file)

  const res = await apiFetch('/api/resumes/upload', { method: 'POST', body: form })
  if (!res.ok) {
    throw new ApiError(res.status, await readErrorMessage(res))
  }
  return (await res.json()) as ResumeUploadResponse
}

function parseFilenameFromContentDisposition(value: string | null): string | null {
  if (!value) return null
  const match = value.match(/filename\*?=(?:UTF-8''|"?)([^";]+)"?/i)
  if (!match) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

export async function downloadResumeFile(
  resumeId: string
): Promise<{ blob: Blob; filename: string; contentType: string | null }> {
  const res = await apiFetch(`/api/resumes/${resumeId}/file`)
  if (!res.ok) {
    throw new ApiError(res.status, await readErrorMessage(res))
  }
  const blob = await res.blob()
  const contentType = res.headers.get('content-type')
  const cd = res.headers.get('content-disposition')
  const filename =
    parseFilenameFromContentDisposition(cd) ||
    `resume-${resumeId}.${contentType?.includes('pdf') ? 'pdf' : 'bin'}`
  return { blob, filename, contentType }
}
