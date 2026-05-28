import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  filterImageModels,
  generateImage,
  IMAGE_SIZE_OPTIONS,
  normalizeImageGenerationResponse,
  imageToDownloadHref,
  resolveKeyImageState,
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

  it('defaults missing b64_json mime type to image/png', () => {
    const response: ImageGenerationResponse = {
      data: [{ b64_json: 'aGVsbG8=' }],
    }

    expect(normalizeImageGenerationResponse(response).images).toEqual([
      {
        url: 'data:image/png;base64,aGVsbG8=',
        mimeType: 'image/png',
        revisedPrompt: undefined,
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

describe('image generation helpers', () => {
  it('exposes image size labels and values', () => {
    expect(IMAGE_SIZE_OPTIONS.map((item) => item.value)).toEqual(['1024x1024', '1536x1536', '2048x2048'])
    expect(IMAGE_SIZE_OPTIONS.map((item) => item.label)).toEqual(['1K', '2K', '4K'])
  })

  it('filters image-capable models and falls back to defaults', () => {
    expect(filterImageModels([
      { name: 'gpt-5.4', pricing: { billing_mode: 'token' } },
      { name: 'gpt-image-1', pricing: { billing_mode: 'image' } },
      { name: 'custom-image-model', pricing: null },
    ])).toEqual(['gpt-image-1', 'custom-image-model'])

    expect(filterImageModels([])).toEqual(['gpt-image-1', 'gpt-image-1.5', 'gpt-image-2'])
  })

  it('resolves key image availability from group fields', () => {
    expect(resolveKeyImageState(null)).toEqual({
      allowed: false,
      reason: 'missing_group',
    })
    expect(resolveKeyImageState({
      platform: 'openai',
      allow_image_generation: true,
      status: 'active',
    })).toEqual({
      allowed: true,
      reason: null,
    })
    expect(resolveKeyImageState({
      platform: 'anthropic',
      allow_image_generation: true,
      status: 'active',
    })).toEqual({
      allowed: false,
      reason: 'unsupported_platform',
    })
    expect(resolveKeyImageState({
      platform: 'openai',
      allow_image_generation: false,
      status: 'active',
    })).toEqual({
      allowed: false,
      reason: 'image_disabled',
    })
    expect(resolveKeyImageState({
      platform: 'openai',
      allow_image_generation: true,
      status: 'suspended',
    })).toEqual({
      allowed: false,
      reason: 'group_inactive',
    })
  })
})
