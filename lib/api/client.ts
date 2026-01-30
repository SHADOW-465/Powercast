const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

class APIClient {
  private baseURL: string

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    }

    const response = await fetch(url, { ...options, headers })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.message || `API Error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" })
  }

  post<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  put<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE" })
  }

  async uploadFile<T>(endpoint: string, file: File, metadata: Record<string, string>): Promise<T> {
    const formData = new FormData()
    formData.append("file", file)
    Object.entries(metadata).forEach(([key, value]) => {
      formData.append(key, value)
    })

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.message || `Upload Error: ${response.status}`)
    }

    return response.json()
  }
}

export const apiClient = new APIClient(API_BASE)

// Typed API endpoints - ready for backend integration
export const api = {
  health: () => apiClient.get<{ status: string }>("/api/v1/health"),
  
  plants: {
    list: () => apiClient.get<{ plants: unknown[] }>("/api/v1/plants"),
    get: (id: string) => apiClient.get(`/api/v1/plants/${id}`),
    create: (data: unknown) => apiClient.post("/api/v1/plants", data),
    update: (id: string, data: unknown) => apiClient.put(`/api/v1/plants/${id}`, data),
    delete: (id: string) => apiClient.delete(`/api/v1/plants/${id}`),
  },
  
  forecasts: {
    generate: (plantId: string, horizon: number) =>
      apiClient.get(`/api/v1/forecast?plant_id=${plantId}&horizon=${horizon}`),
    getByPlant: (plantId: string) =>
      apiClient.get(`/api/v1/forecast/${plantId}`),
    getMultiPlant: (plantIds: string[], horizon: number) =>
      apiClient.post("/api/v1/forecast/multi", { plant_ids: plantIds, horizon }),
  },
  
  data: {
    upload: (file: File, plantType: string, plantName: string) =>
      apiClient.uploadFile("/api/v1/data/upload", file, {
        plant_type: plantType,
        plant_name: plantName,
      }),
    getHistory: (plantId: string) =>
      apiClient.get(`/api/v1/data/history/${plantId}`),
  },
  
  optimization: {
    generate: (plantIds: string[]) =>
      apiClient.post("/api/v1/optimization/generate", { plant_ids: plantIds }),
    apply: (suggestionId: string) =>
      apiClient.post(`/api/v1/optimization/apply/${suggestionId}`, {}),
    dismiss: (suggestionId: string) =>
      apiClient.post(`/api/v1/optimization/dismiss/${suggestionId}`, {}),
  },
}
