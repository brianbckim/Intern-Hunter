import { getAccessToken } from './auth'

export const API_ENDPOINTS = {
  auth: {
    login: '/api/auth/login',
    register: '/api/auth/register',
  },
  profile: {
    me: '/api/profile/me',
  },
}

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
  return apiJson<TokenResponse>(API_ENDPOINTS.auth.login, {
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
  return apiJson<TokenResponse>(API_ENDPOINTS.auth.register, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, full_name: fullName ?? null }),
  })
}

export type UserProfile = {
  user_email: string
  name: string | null
  major_or_program: string | null
  career_interests: string | null
  skills: string[]
  graduation_year: number | null
  updated_at: string
}

export type UserProfileUpdate = {
  name: string | null
  major_or_program: string | null
  career_interests: string | null
  skills: string[]
  graduation_year: number | null
}

export async function getMyProfile(): Promise<UserProfile> {
  return apiJson<UserProfile>(API_ENDPOINTS.profile.me)
}

export async function updateMyProfile(payload: UserProfileUpdate): Promise<UserProfile> {
  return apiJson<UserProfile>(API_ENDPOINTS.profile.me, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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

type UploadProgressCallback = (percent: number) => void

export async function listMyResumes(): Promise<ResumeListItem[]> {
  return apiJson<ResumeListItem[]>('/api/resumes/me')
}

export async function getResume(resumeId: string): Promise<ResumeDetail> {
  return apiJson<ResumeDetail>(`/api/resumes/${resumeId}`)
}

export async function reextractResume(resumeId: string): Promise<ResumeDetail> {
  return apiJson<ResumeDetail>(`/api/resumes/${resumeId}/reextract`, {
    method: 'POST',
  })
}

export async function uploadResumeWithProgress(
  file: File,
  onProgress?: UploadProgressCallback
): Promise<ResumeUploadResponse> {
  const token = getAccessToken()
  const form = new FormData()
  form.append('file', file)

  return new Promise<ResumeUploadResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/resumes/upload')
    xhr.responseType = 'json'

    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    }

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return
      onProgress(Math.round((event.loaded / event.total) * 100))
    }

    xhr.onload = () => {
      const responseData = xhr.response
      if (xhr.status >= 200 && xhr.status < 300 && responseData) {
        resolve(responseData as ResumeUploadResponse)
        return
      }

      const detail =
        responseData && typeof responseData === 'object' && 'detail' in responseData
          ? (responseData as { detail?: unknown }).detail
          : null
      const message =
        typeof detail === 'string' ? detail : xhr.statusText || `Upload failed (HTTP ${xhr.status || 0})`
      reject(new ApiError(xhr.status || 0, message))
    }

    xhr.onerror = () => {
      reject(new ApiError(0, 'Network error while uploading resume'))
    }

    xhr.send(form)
  })
}

export async function uploadResume(file: File): Promise<ResumeUploadResponse> {
  return uploadResumeWithProgress(file)
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

export async function downloadResumePreviewFile(
  resumeId: string
): Promise<{ blob: Blob; filename: string; contentType: string | null }> {
  const res = await apiFetch(`/api/resumes/${resumeId}/preview-file`)
  if (!res.ok) {
    throw new ApiError(res.status, await readErrorMessage(res))
  }
  const blob = await res.blob()
  const contentType = res.headers.get('content-type')
  const cd = res.headers.get('content-disposition')
  const filename = parseFilenameFromContentDisposition(cd) || `resume-${resumeId}-preview.pdf`
  return { blob, filename, contentType }
}

export type ResumeFeedback = {
  user_email: string
  resume_id: string | null
  summary: string | null
  strong_points: string[]
  areas_to_improve: string[]
  suggested_edits: string[]
  skill_gaps: string[]
  created_at: string
  saved_notes: string | null
  notes_history?: Array<{ created_at: string; text: string }>
}

export type ResumeFeedbackListItem = {
  feedback_id: string
  resume_id: string | null
  summary: string | null
  created_at: string
}

export type GenerateResumeFeedbackResponse = {
  feedback_id: string
  feedback: ResumeFeedback
}

export async function generateResumeFeedback(resumeId?: string | null): Promise<GenerateResumeFeedbackResponse> {
  return apiJson<GenerateResumeFeedbackResponse>('/api/resume-feedback/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resume_id: resumeId ?? null }),
  })
}

export async function listMyResumeFeedback(limit = 20): Promise<ResumeFeedbackListItem[]> {
  const safeLimit = Math.max(1, Math.min(100, limit))
  return apiJson<ResumeFeedbackListItem[]>(`/api/resume-feedback/me?limit=${safeLimit}`)
}

export async function getResumeFeedback(feedbackId: string): Promise<ResumeFeedback> {
  return apiJson<ResumeFeedback>(`/api/resume-feedback/${encodeURIComponent(feedbackId)}`)
}

export async function updateResumeFeedbackNotes(
  feedbackId: string,
  savedNotes: string | null
): Promise<ResumeFeedback> {
  return apiJson<ResumeFeedback>(`/api/resume-feedback/${encodeURIComponent(feedbackId)}/notes`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ saved_notes: savedNotes }),
  })
}
