/**
 * Admin image workspace API.
 *
 * Admin endpoints for browsing/managing conversational image projects
 * across all users.
 */

import { apiClient } from '../client'
import type {
  ImageWorkspaceProjectDetail,
  ImageWorkspaceListResponse
} from '../imageGeneration'

export interface ImageVersionFileResponse {
  filename: string
  content_type: string
  data: string // base64-encoded
}

const adminAPI = {
  async list(params: Record<string, unknown> = {}): Promise<ImageWorkspaceListResponse> {
    const { data } = await apiClient.get('/admin/images/projects', { params })
    return data as ImageWorkspaceListResponse
  },

  async get(id: number): Promise<ImageWorkspaceProjectDetail> {
    const { data } = await apiClient.get(`/admin/images/projects/${id}`)
    return data as ImageWorkspaceProjectDetail
  },

  async getVersionFile(id: number): Promise<ImageVersionFileResponse> {
    const { data } = await apiClient.get(`/admin/images/versions/${id}/file`)
    return data as ImageVersionFileResponse
  },

  async deleteProject(id: number): Promise<void> {
    await apiClient.delete(`/admin/images/projects/${id}`)
  }
}

export default adminAPI
