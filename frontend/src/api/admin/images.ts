import { apiClient } from '../client'
import type { ImageWorkspaceListResponse, ImageWorkspaceProjectDetail } from '../imageGeneration'

const imagesAPI = {
  async list(params: Record<string, unknown> = {}): Promise<ImageWorkspaceListResponse> {
    const { data } = await apiClient.get('/admin/images/projects', { params })
    return data as ImageWorkspaceListResponse
  },

  async get(id: number): Promise<ImageWorkspaceProjectDetail> {
    const { data } = await apiClient.get(`/admin/images/projects/${id}`)
    return data as ImageWorkspaceProjectDetail
  },

  async delete(id: number): Promise<void> {
    await apiClient.delete(`/admin/images/projects/${id}`)
  },
}

export default imagesAPI
