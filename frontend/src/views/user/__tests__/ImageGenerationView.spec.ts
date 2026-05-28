import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import ImageGenerationView from '../ImageGenerationView.vue'

const { list, getAvailable, generateImage, showError, showSuccess } = vi.hoisted(() => ({
  list: vi.fn(),
  getAvailable: vi.fn(),
  generateImage: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}))

vi.mock('@/api', () => ({
  keysAPI: { list },
  userChannelsAPI: { getAvailable },
}))

vi.mock('@/api/imageGeneration', async () => {
  const actual = await vi.importActual<typeof import('@/api/imageGeneration')>('@/api/imageGeneration')
  return {
    ...actual,
    generateImage,
  }
})

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showError, showSuccess }),
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

const AppLayoutStub = { template: '<main><slot /></main>' }
const SelectStub = {
  props: ['modelValue', 'options', 'disabled'],
  emits: ['update:modelValue'],
  methods: {
    update(event: Event) {
      this.$emit('update:modelValue', (event.target as HTMLSelectElement).value)
    },
  },
  template: `
    <select
      :value="modelValue"
      :disabled="disabled"
      @change="update"
    >
      <option v-for="option in options" :key="String(option.value)" :value="option.value">
        {{ option.label }}
      </option>
    </select>
  `,
}

const activeGroup = {
  id: 1,
  name: 'OpenAI Images',
  platform: 'openai',
  status: 'active',
  allow_image_generation: true,
}

function apiKey(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    user_id: 1,
    key: 'sk-enabled',
    name: 'Enabled key',
    group_id: 1,
    status: 'active',
    ip_whitelist: [],
    ip_blacklist: [],
    last_used_at: null,
    quota: 0,
    quota_used: 0,
    expires_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    group: activeGroup,
    rate_limit_5h: 0,
    rate_limit_1d: 0,
    rate_limit_7d: 0,
    usage_5h: 0,
    usage_1d: 0,
    usage_7d: 0,
    window_5h_start: null,
    window_1d_start: null,
    window_7d_start: null,
    reset_5h_at: null,
    reset_1d_at: null,
    reset_7d_at: null,
    ...overrides,
  }
}

function channels() {
  return [
    {
      name: 'Images',
      description: '',
      platforms: [
        {
          platform: 'openai',
          groups: [],
          supported_models: [
            { name: 'gpt-image-1', platform: 'openai', pricing: { billing_mode: 'image' } },
          ],
        },
      ],
    },
  ]
}

async function mountView(keys = [apiKey()]) {
  list.mockResolvedValue({ items: keys, total: keys.length, page: 1, page_size: 100, pages: 1 })
  getAvailable.mockResolvedValue(channels())

  const wrapper = mount(ImageGenerationView, {
    global: {
      stubs: {
        AppLayout: AppLayoutStub,
        Select: SelectStub,
      },
    },
  })
  await flushPromises()
  return wrapper
}

describe('ImageGenerationView', () => {
  beforeEach(() => {
    list.mockReset()
    getAvailable.mockReset()
    generateImage.mockReset()
    showError.mockReset()
    showSuccess.mockReset()
  })

  it('renders active API keys and enables generation for image-enabled OpenAI group', async () => {
    const wrapper = await mountView([
      apiKey({ id: 1, key: 'sk-enabled', name: 'Enabled key' }),
      apiKey({ id: 2, key: 'sk-inactive', name: 'Inactive key', status: 'inactive' }),
    ])

    expect(wrapper.text()).toContain('Enabled key')
    expect(wrapper.text()).not.toContain('Inactive key')
    expect(wrapper.text()).toContain('OpenAI Images')
    expect(wrapper.text()).toContain('openai')
    expect(list).toHaveBeenCalledWith(1, 100, { status: 'active' })

    await wrapper.find('textarea').setValue('a clean vector dashboard')

    expect(wrapper.find('[data-testid="generate-image"]').attributes('disabled')).toBeUndefined()
  })

  it('disables generation when image generation is disabled for selected group', async () => {
    const wrapper = await mountView([
      apiKey({
        group: { ...activeGroup, allow_image_generation: false },
      }),
    ])

    await wrapper.find('textarea').setValue('a city at dusk')

    expect(wrapper.text()).toContain('imageGeneration.errors.imageDisabled')
    expect(wrapper.find('[data-testid="generate-image"]').attributes('disabled')).toBeDefined()
  })

  it('disables generation when selected group is inactive', async () => {
    const wrapper = await mountView([
      apiKey({
        group: { ...activeGroup, status: 'suspended' },
      }),
    ])

    await wrapper.find('textarea').setValue('a city at dawn')

    expect(wrapper.text()).toContain('imageGeneration.errors.groupInactive')
    expect(wrapper.find('[data-testid="generate-image"]').attributes('disabled')).toBeDefined()
  })

  it('calls gateway with selected key and renders returned image', async () => {
    generateImage.mockResolvedValue({
      images: [{ url: 'data:image/png;base64,aGVsbG8=' }],
      raw: {},
    })
    const wrapper = await mountView()

    await wrapper.find('textarea').setValue('a compact control room')
    await wrapper.find('[data-testid="generate-image"]').trigger('click')
    await flushPromises()

    expect(generateImage).toHaveBeenCalledWith(
      'sk-enabled',
      {
        model: 'gpt-image-1',
        prompt: 'a compact control room',
        size: '1024x1024',
        n: 1,
        response_format: 'b64_json',
      },
      { signal: expect.any(AbortSignal) },
    )
    expect(wrapper.find('img[alt="generated-image-1"]').attributes('src')).toBe('data:image/png;base64,aGVsbG8=')
    expect(wrapper.find('a[download="generated-image-1.png"]').attributes('href')).toBe('data:image/png;base64,aGVsbG8=')
    expect(showSuccess).toHaveBeenCalledWith('imageGeneration.success')
  })
})
