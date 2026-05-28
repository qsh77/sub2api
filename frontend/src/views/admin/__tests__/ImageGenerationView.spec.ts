import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import ImageGenerationView from '../ImageGenerationView.vue'
import type { AdminGroup, ApiKey } from '@/types'

const { getGroups, getGroupApiKeys, listProjects, getProject, generateImage, uploadImageVersion, showError, showSuccess } = vi.hoisted(() => ({
  getGroups: vi.fn(),
  getGroupApiKeys: vi.fn(),
  listProjects: vi.fn(),
  getProject: vi.fn(),
  generateImage: vi.fn(),
  uploadImageVersion: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    groups: {
      getAll: getGroups,
      getGroupApiKeys,
    },
    images: {
      list: listProjects,
      get: getProject,
    },
  },
}))

vi.mock('@/api/imageGeneration', async () => {
  const actual = await vi.importActual<typeof import('@/api/imageGeneration')>('@/api/imageGeneration')
  return {
    ...actual,
    generateImage,
    uploadImageVersion,
  }
})

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showError, showSuccess }),
}))

const AppLayoutStub = { template: '<main><slot /></main>' }
const SelectStub = {
  props: ['modelValue', 'options', 'disabled', 'placeholder'],
  emits: ['update:modelValue'],
  methods: {
    update(event: Event) {
      this.$emit('update:modelValue', (event.target as HTMLSelectElement).value)
    },
  },
  template: `
    <select :value="modelValue" :disabled="disabled" @change="update">
      <option v-if="placeholder" value="">{{ placeholder }}</option>
      <option v-for="option in options" :key="String(option.value)" :value="option.value">
        {{ option.label }}
      </option>
    </select>
  `,
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
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
    models: ['gpt-image-2', 'gpt-image-1'],
  },
  sort_order: 0,
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
    ...overrides,
  }
}

const savedDetail = {
  project: { id: 9, user_id: 1, title: 'a diagnostic control panel', cover_version_id: 9, status: 'active', created_at: '', updated_at: '' },
  versions: [{
    id: 9,
    project_id: 9,
    user_id: 1,
    mode: 'generation' as const,
    prompt: 'a diagnostic control panel',
    model: 'gpt-image-2',
    size: '1024x1024',
    mime_type: 'image/png',
    file_size_bytes: 5,
    sha256: '',
    width: 1,
    height: 1,
    created_at: '',
  }],
}

async function mountView(groups = [baseGroup], keys = [apiKey()]) {
  getGroups.mockResolvedValue(groups)
  getGroupApiKeys.mockResolvedValue({ items: keys, total: keys.length, page: 1, page_size: 50, pages: 1 })
  listProjects.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50, pages: 1 })
  getProject.mockResolvedValue(savedDetail)
  uploadImageVersion.mockResolvedValue(savedDetail)

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

describe('admin ImageGenerationView', () => {
  beforeEach(() => {
    getGroups.mockReset()
    getGroupApiKeys.mockReset()
    listProjects.mockReset()
    getProject.mockReset()
    generateImage.mockReset()
    uploadImageVersion.mockReset()
    showError.mockReset()
    showSuccess.mockReset()
  })

  it('loads OpenAI image-enabled groups and active group API keys', async () => {
    const wrapper = await mountView()

    expect(getGroups).toHaveBeenCalledWith('openai')
    expect(getGroupApiKeys).toHaveBeenCalledWith(1, 1, 50)
    expect(wrapper.text()).toContain('Image Group')
    expect(wrapper.text()).toContain('Active Key')
    expect(wrapper.text()).toContain('对话式生成、编辑和管理图片')
  })

  it('filters out inactive keys and disabled groups', async () => {
    const wrapper = await mountView(
      [
        group({ id: 1, name: 'Enabled Group' }),
        group({ id: 2, name: 'Disabled Group', allow_image_generation: false }),
        group({ id: 3, name: 'Inactive Group', status: 'inactive' }),
      ],
      [
        apiKey({ id: 1, name: 'Active Key', key: 'sk-active' }),
        apiKey({ id: 2, name: 'Inactive Key', key: 'sk-inactive', status: 'inactive' }),
      ],
    )

    expect(wrapper.text()).toContain('Enabled Group')
    expect(wrapper.text()).not.toContain('Disabled Group')
    expect(wrapper.text()).not.toContain('Inactive Group')
    expect(wrapper.text()).toContain('Active Key')
    expect(wrapper.text()).not.toContain('Inactive Key')
  })

  it('ignores stale group API key loads', async () => {
    const firstLoad = deferred<unknown>()
    const secondLoad = deferred<unknown>()
    getGroups.mockResolvedValue([
      group({ id: 1, name: 'First Group' }),
      group({ id: 2, name: 'Second Group', models_list_config: { enabled: true, models: ['gpt-image-2'] } }),
    ])
    getGroupApiKeys
      .mockReturnValueOnce(firstLoad.promise)
      .mockReturnValueOnce(secondLoad.promise)
    listProjects.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50, pages: 1 })

    const wrapper = mount(ImageGenerationView, {
      global: {
        stubs: {
          AppLayout: AppLayoutStub,
          Select: SelectStub,
        },
      },
    })
    await flushPromises()

    await wrapper.findAll('select')[0].setValue('2')
    expect(getGroupApiKeys).toHaveBeenLastCalledWith(2, 1, 50)

    secondLoad.resolve({ items: [apiKey({ id: 2, name: 'Second Key', key: 'sk-second', group_id: 2 })], total: 1, page: 1, page_size: 50, pages: 1 })
    await flushPromises()
    firstLoad.resolve({ items: [apiKey({ id: 1, name: 'First Key', key: 'sk-first', group_id: 1 })], total: 1, page: 1, page_size: 50, pages: 1 })
    await flushPromises()

    expect(wrapper.text()).toContain('Second Key')
    expect(wrapper.text()).not.toContain('First Key')
  })

  it('generates with selected API key and renders the saved image message', async () => {
    generateImage.mockResolvedValue({
      images: [{ url: 'data:image/png;base64,aGVsbG8=' }],
      raw: {},
    })
    const wrapper = await mountView()

    await wrapper.find('textarea').setValue('a diagnostic control panel')
    await wrapper.find('[data-testid="admin-generate-image"]').trigger('click')
    await flushPromises()

    expect(generateImage).toHaveBeenCalledWith(
      'sk-active',
      {
        model: 'gpt-image-2',
        prompt: 'a diagnostic control panel',
        size: '1024x1024',
        n: 1,
        response_format: 'b64_json',
      },
      { signal: expect.any(AbortSignal) },
    )
    expect(uploadImageVersion).toHaveBeenCalled()
    expect(wrapper.find('img[alt="generated-image-9"]').attributes('src')).toBe('/api/v1/admin/images/versions/9/file')
    expect(showSuccess).toHaveBeenCalledWith('图片已保存')
  })

  it('shows raw error text and calls showError when generation fails', async () => {
    generateImage.mockRejectedValue(new Error('provider exploded'))
    const wrapper = await mountView()

    await wrapper.find('textarea').setValue('a failing prompt')
    await wrapper.find('[data-testid="admin-generate-image"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('provider exploded')
    expect(showError).toHaveBeenCalledWith('provider exploded')
  })
})
