import { apiClient } from './client'

export type ImageSizeOption = '1024x1024' | '1536x1536' | '2048x2048'
export type ImageWorkspaceMode = 'generation' | 'edit' | 'mask_edit' | 'upload'

export interface ImageGenerationRequest {
  model: string
  prompt: string
  size?: ImageSizeOption | string
  n?: number
  response_format?: 'url' | 'b64_json'
  [key: string]: unknown
}

export interface ImageGenerationResponseItem {
  url?: string
  b64_json?: string
  mime_type?: string
  revised_prompt?: string
}

export interface ImageGenerationResponse {
  data?: ImageGenerationResponseItem[]
}

export interface GeneratedImage {
  url: string
  mimeType?: string
  revisedPrompt?: string
}

export interface NormalizedImageGenerationResult {
  images: GeneratedImage[]
  raw: ImageGenerationResponse
}

export interface ImageWorkspaceProject {
  id: number
  user_id: number
  title: string
  cover_version_id?: number | null
  status: string
  created_at: string
  updated_at: string
}

export interface ImageWorkspaceVersion {
  id: number
  project_id: number
  user_id: number
  parent_version_id?: number | null
  source_version_id?: number | null
  mode: ImageWorkspaceMode
  prompt: string
  revised_prompt?: string | null
  model: string
  size: string
  mime_type: string
  file_size_bytes: number
  sha256: string
  width: number
  height: number
  mask_mime_type?: string | null
  api_key_id?: number | null
  usage_log_id?: number | null
  created_at: string
}

export interface ImageWorkspaceProjectSummary extends ImageWorkspaceProject {
  version_count: number
  cover_version?: ImageWorkspaceVersion | null
}

export interface ImageWorkspaceProjectDetail {
  project: ImageWorkspaceProject
  versions: ImageWorkspaceVersion[]
}

export interface ImageWorkspaceListResponse {
  items: ImageWorkspaceProjectSummary[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface ImageModelCandidate {
  name: string
  pricing?: {
    billing_mode?: string
  } | null
}

export type ImageKeyUnavailableReason = 'missing_group' | 'unsupported_platform' | 'image_disabled' | 'group_inactive'

export interface ImageKeyGroupState {
  platform?: string
  status?: string
  allow_image_generation?: boolean
}

export const IMAGE_SIZE_OPTIONS = [
  { label: '1K', value: '1024x1024' },
  { label: '2K', value: '1536x1536' },
  { label: '4K', value: '2048x2048' },
] as const
export const DEFAULT_IMAGE_MODELS = ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1'] as const

interface GenerateImageOptions {
  signal?: AbortSignal
}

export function filterImageModels(models: ImageModelCandidate[]): string[] {
  const imageModels = models
    .filter((model) => {
      const name = model.name.toLowerCase()
      return model.pricing?.billing_mode === 'image' || name.includes('image')
    })
    .map((model) => model.name)

  return imageModels.length > 0 ? Array.from(new Set(imageModels)) : [...DEFAULT_IMAGE_MODELS]
}

export function resolveKeyImageState(group: ImageKeyGroupState | null | undefined): {
  allowed: boolean
  reason: ImageKeyUnavailableReason | null
} {
  if (!group) {
    return { allowed: false, reason: 'missing_group' }
  }
  if (group.platform !== 'openai') {
    return { allowed: false, reason: 'unsupported_platform' }
  }
  if (group.allow_image_generation === false) {
    return { allowed: false, reason: 'image_disabled' }
  }
  if (group.status && group.status !== 'active') {
    return { allowed: false, reason: 'group_inactive' }
  }
  return { allowed: true, reason: null }
}

export function normalizeImageGenerationResponse(response: ImageGenerationResponse): NormalizedImageGenerationResult {
  return {
    raw: response,
    images: (response.data || []).map((item) => {
      const mimeType = item.b64_json ? item.mime_type || 'image/png' : item.mime_type
      return {
        url: item.b64_json ? `data:${mimeType};base64,${item.b64_json}` : item.url || '',
        mimeType,
        revisedPrompt: item.revised_prompt,
      }
    }).filter((image) => image.url),
  }
}

export async function generateImage(
  apiKey: string,
  payload: ImageGenerationRequest,
  options: GenerateImageOptions = {}
): Promise<NormalizedImageGenerationResult> {
  const response = await fetch('/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(payload),
    signal: options.signal,
  })

  const data = await parseJson(response)
  if (!response.ok) {
    throw new Error(readErrorMessage(data) || `Image generation failed with status ${response.status}`)
  }

  return normalizeImageGenerationResponse(data as ImageGenerationResponse)
}

export async function editImage(
  apiKey: string,
  payload: {
    model: string
    prompt: string
    image: Blob
    mask?: Blob | null
    size?: ImageSizeOption | string
    n?: number
    response_format?: 'url' | 'b64_json'
  },
  options: GenerateImageOptions = {}
): Promise<NormalizedImageGenerationResult> {
  const form = new FormData()
  form.append('model', payload.model)
  form.append('prompt', payload.prompt)
  form.append('image', payload.image, 'source.png')
  if (payload.mask) form.append('mask', payload.mask, 'mask.png')
  if (payload.size) form.append('size', payload.size)
  if (payload.n) form.append('n', String(payload.n))
  form.append('response_format', payload.response_format || 'b64_json')

  const response = await fetch('/v1/images/edits', {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
    body: form,
    signal: options.signal,
  })
  const data = await parseJson(response)
  if (!response.ok) {
    throw new Error(readErrorMessage(data) || `Image edit failed with status ${response.status}`)
  }
  return normalizeImageGenerationResponse(data as ImageGenerationResponse)
}

export async function listImageProjects(params: Record<string, unknown> = {}): Promise<ImageWorkspaceListResponse> {
  const { data } = await apiClient.get('/images/projects', { params })
  return data as ImageWorkspaceListResponse
}

export async function getImageProject(id: number): Promise<ImageWorkspaceProjectDetail> {
  const { data } = await apiClient.get(`/images/projects/${id}`)
  return data as ImageWorkspaceProjectDetail
}

export async function uploadImageVersion(form: FormData): Promise<ImageWorkspaceProjectDetail> {
  const { data } = await apiClient.post('/images/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data as ImageWorkspaceProjectDetail
}

export async function deleteImageProject(id: number): Promise<void> {
  await apiClient.delete(`/images/projects/${id}`)
}

export async function deleteImageVersion(id: number): Promise<void> {
  await apiClient.delete(`/images/versions/${id}`)
}

export function imageVersionFileUrl(id: number, admin = false): string {
  return `/api/v1/${admin ? 'admin/images' : 'images'}/versions/${id}/file`
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, encoded] = dataUrl.split(',', 2)
  const mimeType = header.match(/^data:([^;]+);base64$/)?.[1] || 'image/png'
  const binary = atob(encoded || '')
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mimeType })
}

export function imageToDownloadHref(image: Pick<GeneratedImage, 'url'>): string {
  return image.url
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function readErrorMessage(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined

  const record = data as Record<string, unknown>
  const error = record.error
  if (error && typeof error === 'object') {
    const message = (error as Record<string, unknown>).message
    if (typeof message === 'string') return message
  }

  return typeof record.message === 'string' ? record.message : undefined
}
