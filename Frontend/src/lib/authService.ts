import { login as loginApi, register as registerApi } from './api'
import { clearAccessToken, getAccessToken, setAccessToken } from './auth'

export type RegisterPayload = {
  email: string
  password: string
  name?: string
}

export async function login(email: string, password: string): Promise<string> {
  const response = await loginApi(email, password)
  setAccessToken(response.access_token)
  return response.access_token
}

export async function register(payload: RegisterPayload): Promise<string> {
  const response = await registerApi(payload.email, payload.password, payload.name)
  setAccessToken(response.access_token)
  return response.access_token
}

export function logout(): void {
  clearAccessToken()
}

export function getToken(): string | null {
  return getAccessToken()
}
