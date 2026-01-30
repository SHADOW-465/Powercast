export * from "./plant"
export * from "./forecast"
export * from "./optimization"

export interface APIResponse<T> {
  data: T
  status: number
  message?: string
}

export interface APIError {
  status: number
  message: string
  details?: unknown
}
