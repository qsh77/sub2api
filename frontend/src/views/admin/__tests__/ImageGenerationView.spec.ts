import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import ImageGenerationView from '../ImageGenerationView.vue'
import type { AdminGroup, ApiKey } from '@/types'

const { getGroups, getGroupApiKeys, generateImage, showError } = vi.hoisted(() => ({
  getGroups: vi.fn(),
  getGroupApiKeys: vi.fn(),
  generateImage: vi.fn(),
  showError: vi.fn()
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    groups: {
      getAll: getGroups,
      getGroupApiKeys
    }
  }
}))

vi.mock('@/api/imageGeneration', async () => {
  const actual = await vi.importActual<typeof import('@/api/imageGeneration')>('@/api/imageGeneration')
  return {
    ...actual,
    generateImage
  }
})

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showError })
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key })
  }
})

const AppLayoutStub = { template: '<main><slot /></main>' }
const SelectStub = {
  props: ['modelValue', 'options', 'disabled', 'placeholder'],
  emits: ['update:modelValue'],
  methods: {
    update(event: Event) {
      this.$emit('update:modelValue', (event.target as HTMLSelectElement).value)
    }
  },
  template: `
    <select :value="modelValue" :disabled="disabled" @change="update">
      <option v-if="placeholder" value="">{{ placeholder }}</option>
      <option v-for="option in options" :key="String(option.value)" :value="option.value">
        {{ option.label }}
      </option>
    </select>
  `
}

const baseGroup: AdminGroup = {
  id: 1,
  name: 'Image Group',
  description: null,
  platform: 'openai',
  rate_multiplier: 1,
  is_exclusive: false,
  status: 'active',
  subscription_type: 'standard',
  daily_limit_usd: null,
  weekly_limit_usd: null,
  monthly_limit_usd: null,
  allow_image_generation: true,
  image_rate_independent: false,
  image_rate_multiplier: 1,
  image_price_1k: null,
  image_price_2k: null,
  image_price_4k: null,
  claude_code_only: false,
  fallback_group_id: null,
  fallback_group_id_on_invalid_request: null,
  require_oauth_only: false,
  require_privacy_set: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  model_routing: null,
  model_routing_enabled: false,
  mcp_xml_inject: false,
  models_list_config: {
    enabled: true,
    models: ['gpt-image-1', 'gpt-image-2']
  },
  sort_order: 0
}

function group(overrides: Partial<AdminGroup> = {}): AdminGroup {
  return { ...baseGroup, ...overrides }
}

function apiKey(overrides: Partial<ApiKey> = {}): ApiKey {
  return {
    id: 1,
    user_id: 1,
    key: 'sk-active',
    name: 'Active Key',
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
    group: baseGroup,
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
    ...overrides
  }
}

async function mountView(groups = [baseGroup], keys = [apiKey()]) {
  getGroups.mockResolvedValue(groups)
  getGroupApiKeys.mockResolvedValue({
    items: keys,
    total: keys.length,
    page: 1,
    page_size: 50,
    pages: 1
  })

  const wrapper = mount(ImageGenerationView, {
    global: {
      stubs: {
        AppLayout: AppLayoutStub,
        Select: SelectStub
      }
    }
  })
  await flushPromises()
  return wrapper
}

describe('admin ImageGenerationView', () => {
  beforeEach(() => {
    getGroups.mockReset()
    getGroupApiKeys.mockReset()
    generateImage.mockReset()
    showError.mockReset()
  })

  it('loads OpenAI image-enabled groups and active group API keys', async () => {
    const wrapper = await mountView()

    expect(getGroups).toHaveBeenCalledWith('openai')
    expect(getGroupApiKeys).toHaveBeenCalledWith(1, 1, 50)
    expect(wrapper.text()).toContain('Image Group')
    expect(wrapper.text()).toContain('Active Key')
  })

  it('filters out inactive keys and disabled groups', async () => {
    const wrapper = await mountView(
      [
        group({ id: 1, name: 'Enabled Group' }),
        group({ id: 2, name: 'Disabled Group', allow_image_generation: false }),
        group({ id: 3, name: 'Inactive Group', status: 'inactive' })
      ],
      [
        apiKey({ id: 1, name: 'Active Key', key: 'sk-active' }),
        apiKey({ id: 2, name: 'Inactive Key', key: 'sk-inactive', status: 'inactive' })
      ]
    )

    expect(wrapper.text()).toContain('Enabled Group')
    expect(wrapper.text()).not.toContain('Disabled Group')
    expect(wrapper.text()).not.toContain('Inactive Group')
    expect(wrapper.text()).toContain('Active Key')
    expect(wrapper.text()).not.toContain('Inactive Key')
  })

  it('generates with selected API key, renders returned image, and shows diagnostics', async () => {
    generateImage.mockResolvedValue({
      images: [{ url: 'data:image/png;base64,aGVsbG8=' }],
      raw: {}
    })
    const wrapper = await mountView()

    await wrapper.find('textarea').setValue('  a diagnostic control panel  ')
    await wrapper.find('[data-testid="admin-generate-image"]').trigger('click')
    await flushPromises()

    expect(generateImage).toHaveBeenCalledWith(
      'sk-active',
      {
        model: 'gpt-image-1',
        prompt: 'a diagnostic control panel',
        size: '1024x1024',
        n: 1,
        response_format: 'b64_json'
      },
      { signal: expect.any(AbortSignal) }
    )
    expect(wrapper.find('img[alt="admin-generated-image-1"]').attributes('src')).toBe('data:image/png;base64,aGVsbG8=')
    expect(wrapper.find('a[download="admin-generated-image-1.png"]').attributes('href')).toBe('data:image/png;base64,aGVsbG8=')
    expect(wrapper.text()).toContain('imageGeneration.admin.diagnostics')
    expect(wrapper.text()).toContain('gpt-image-1')
    expect(wrapper.text()).toContain('Image Group')
    expect(wrapper.text()).toContain('Active Key')
    expect(wrapper.text()).toMatch(/\d+ ms/)
  })

  it('shows raw error text and calls showError when generation fails', async () => {
    generateImage.mockRejectedValue(new Error('provider exploded'))
    const wrapper = await mountView()

    await wrapper.find('textarea').setValue('broken request')
    await wrapper.find('[data-testid="admin-generate-image"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('provider exploded')
    expect(showError).toHaveBeenCalledWith('provider exploded')
  })
})
