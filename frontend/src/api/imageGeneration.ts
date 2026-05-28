export type ImageSizeOption = '1024x1024' | '1536x1536' | '2048x2048'

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

export const IMAGE_SIZE_OPTIONS: ImageSizeOption[] = ['1024x1024', '1536x1536', '2048x2048']
export const DEFAULT_IMAGE_MODELS = ['gpt-image-1'] as const

interface GenerateImageOptions {
  signal?: AbortSignal
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
