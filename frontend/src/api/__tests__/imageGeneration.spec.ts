import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  generateImage,
  normalizeImageGenerationResponse,
  imageToDownloadHref,
  type ImageGenerationResponse,
} from '../imageGeneration'

describe('imageGeneration API', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('posts to the gateway with x-api-key and json body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ b64_json: 'aGVsbG8=', mime_type: 'image/png' }],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateImage('sk-test', {
      model: 'gpt-image-1',
      prompt: 'draw a red cube',
      size: '1024x1024',
      n: 1,
      response_format: 'b64_json',
    })

    expect(fetchMock).toHaveBeenCalledWith('/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'sk-test',
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: 'draw a red cube',
        size: '1024x1024',
        n: 1,
        response_format: 'b64_json',
      }),
      signal: undefined,
    })
    expect(result.images).toEqual([
      {
        url: 'data:image/png;base64,aGVsbG8=',
        mimeType: 'image/png',
        revisedPrompt: undefined,
      },
    ])
  })

  it('normalizes url image responses', () => {
    const response: ImageGenerationResponse = {
      data: [{ url: 'https://example.com/image.png', revised_prompt: 'better prompt' }],
    }

    expect(normalizeImageGenerationResponse(response).images).toEqual([
      {
        url: 'https://example.com/image.png',
        mimeType: undefined,
        revisedPrompt: 'better prompt',
      },
    ])
  })

  it('extracts OpenAI-style error messages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: { message: 'Image generation is disabled for this group' },
      }),
    }))

    await expect(generateImage('sk-test', {
      model: 'gpt-image-1',
      prompt: 'draw',
      size: '1024x1024',
      n: 1,
      response_format: 'b64_json',
    })).rejects.toThrow('Image generation is disabled for this group')
  })

  it('builds download href for normalized images', () => {
    expect(imageToDownloadHref({ url: 'data:image/png;base64,aGVsbG8=' })).toBe('data:image/png;base64,aGVsbG8=')
    expect(imageToDownloadHref({ url: 'https://example.com/image.png' })).toBe('https://example.com/image.png')
  })
})
