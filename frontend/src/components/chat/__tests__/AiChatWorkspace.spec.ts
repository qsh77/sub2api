import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AiChatWorkspace from '../AiChatWorkspace.vue'

const sendChatCompletionMock = vi.hoisted(() => vi.fn())
const apiMocks = vi.hoisted(() => {
  const group = {
    id: 7,
    name: 'OpenAI pool',
    description: null,
    platform: 'openai',
    rate_multiplier: 1,
    is_exclusive: false,
    status: 'active',
    subscription_type: 'standard',
    daily_limit_usd: null,
    weekly_limit_usd: null,
    monthly_limit_usd: null,
    allow_image_generation: false,
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
    created_at: '',
    updated_at: '',
  }
  const key = {
    id: 1,
    user_id: 1,
    key: 'sk-test',
    name: 'Default key',
    group_id: 7,
    status: 'active',
    ip_whitelist: [],
    ip_blacklist: [],
    last_used_at: null,
    quota: 0,
    quota_used: 0,
    expires_at: null,
    created_at: '',
    updated_at: '',
    group,
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
  }
  const page = (items: unknown[]) => ({
    items,
    total: items.length,
    page: 1,
    page_size: 100,
    pages: 1,
  })
  return {
    group,
    key,
    page,
    keysList: vi.fn(),
    getAvailable: vi.fn(),
    adminGetAll: vi.fn(),
    adminGetGroupApiKeys: vi.fn(),
    adminImagesList: vi.fn(),
    adminImagesDelete: vi.fn(),
    listImageProjects: vi.fn(),
    deleteImageProject: vi.fn(),
  }
})

vi.mock('@/api', () => ({
  keysAPI: {
    list: apiMocks.keysList,
  },
  userChannelsAPI: {
    getAvailable: apiMocks.getAvailable,
  },
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    groups: {
      getAll: apiMocks.adminGetAll,
      getGroupApiKeys: apiMocks.adminGetGroupApiKeys,
    },
    images: {
      list: apiMocks.adminImagesList,
      delete: apiMocks.adminImagesDelete,
    },
  },
}))

vi.mock('@/api/aiChat', () => ({
  extractChatModelsForGroup: () => ['gpt-5.4'],
  fallbackChatModels: () => ['gpt-5.4'],
  sendChatCompletion: sendChatCompletionMock,
}))

vi.mock('@/api/imageGeneration', () => ({
  listImageProjects: apiMocks.listImageProjects,
  deleteImageProject: apiMocks.deleteImageProject,
}))

describe('AiChatWorkspace', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useRealTimers()
    apiMocks.keysList.mockReset()
    apiMocks.keysList.mockResolvedValue(apiMocks.page([{ ...apiMocks.key }]))
    apiMocks.getAvailable.mockReset()
    apiMocks.getAvailable.mockResolvedValue([{
      name: 'OpenAI',
      description: '',
      platforms: [{
        platform: 'openai',
        groups: [{
          id: 7,
          name: 'OpenAI pool',
          platform: 'openai',
          subscription_type: 'standard',
          rate_multiplier: 1,
          is_exclusive: false,
        }],
        supported_models: [{ name: 'gpt-5.4', platform: 'openai', pricing: null }],
      }],
    }])
    apiMocks.adminGetAll.mockReset()
    apiMocks.adminGetAll.mockResolvedValue([{ ...apiMocks.group }])
    apiMocks.adminGetGroupApiKeys.mockReset()
    apiMocks.adminGetGroupApiKeys.mockResolvedValue(apiMocks.page([{
      ...apiMocks.key,
      id: 99,
      user_id: 99,
      key: 'sk-other-secret',
      name: 'Other user key',
    }]))
    apiMocks.adminImagesList.mockReset()
    apiMocks.adminImagesList.mockResolvedValue(apiMocks.page([]))
    apiMocks.adminImagesDelete.mockReset()
    apiMocks.adminImagesDelete.mockResolvedValue(undefined)
    apiMocks.listImageProjects.mockReset()
    apiMocks.listImageProjects.mockResolvedValue(apiMocks.page([]))
    apiMocks.deleteImageProject.mockReset()
    apiMocks.deleteImageProject.mockResolvedValue(undefined)
    sendChatCompletionMock.mockReset()
    sendChatCompletionMock.mockImplementation(async (_key, _payload, options) => {
      options.onDelta('你好')
      return { content: '你好' }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders selectors and sends a chat completion', async () => {
    const wrapper = mount(AiChatWorkspace, {
      props: { scope: 'user' },
      global: {
        stubs: {
          AppLayout: { template: '<main><slot /></main>' },
          Icon: { template: '<span />' },
          Select: {
            props: ['modelValue', 'options'],
            emits: ['update:modelValue'],
            template: `
              <select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
                <option v-for="option in options" :key="String(option.value)" :value="option.value">{{ option.label }}</option>
              </select>
            `,
          },
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('分组')
    expect(wrapper.text()).toContain('密钥')
    expect(wrapper.text()).toContain('模型')
    expect(wrapper.text()).toContain('今天想聊什么')

    await wrapper.get('textarea').setValue('你好')
    await wrapper.get('button[title="发送"]').trigger('click')
    await flushPromises()

    expect(sendChatCompletionMock).toHaveBeenCalledWith(
      'sk-test',
      {
        model: 'gpt-5.4',
        messages: [{ role: 'user', content: '你好' }],
        reasoning_effort: 'medium',
      },
      expect.objectContaining({ onDelta: expect.any(Function) })
    )
    expect(wrapper.text()).toContain('你好')
  })

  it('does not load other users keys in admin chat', async () => {
    apiMocks.keysList.mockResolvedValueOnce(apiMocks.page([{
      ...apiMocks.key,
      id: 8,
      key: 'sk-admin-owned',
      name: 'Admin owned key',
    }]))

    const wrapper = mount(AiChatWorkspace, {
      props: { scope: 'admin' },
      global: {
        stubs: {
          AppLayout: { template: '<main><slot /></main>' },
          Icon: { template: '<span />' },
          Select: {
            props: ['modelValue', 'options'],
            emits: ['update:modelValue'],
            template: `
              <select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
                <option v-for="option in options" :key="String(option.value)" :value="option.value">{{ option.label }}</option>
              </select>
            `,
          },
        },
      },
    })

    await flushPromises()

    expect(apiMocks.adminGetGroupApiKeys).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Admin owned key')
    expect(wrapper.text()).not.toContain('Other user key')
    expect(wrapper.text()).not.toContain('sk-other-secret')

    await wrapper.get('textarea').setValue('管理员测试')
    await wrapper.get('button[title="发送"]').trigger('click')
    await flushPromises()

    expect(sendChatCompletionMock.mock.calls[0][0]).toBe('sk-admin-owned')
  })

  it('renders the unified creation mode switch without video or credits', async () => {
    const wrapper = mount(AiChatWorkspace, {
      props: { scope: 'user', activeMode: 'dialogue' },
      global: {
        stubs: {
          AppLayout: { template: '<main><slot /></main>' },
          Icon: { template: '<span />' },
          Select: {
            props: ['modelValue', 'options'],
            emits: ['update:modelValue'],
            template: `
              <select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
                <option v-for="option in options" :key="String(option.value)" :value="option.value">{{ option.label }}</option>
              </select>
            `,
          },
        },
      },
    })

    await flushPromises()

    expect(wrapper.get('[data-testid="ai-mode-tabs"]').text()).toContain('对话')
    expect(wrapper.get('[data-testid="ai-mode-tabs"]').text()).toContain('作画')
    expect(wrapper.text()).not.toContain('视频')
    expect(wrapper.text()).not.toContain('积分')

    await wrapper.get('[data-testid="ai-mode-image"]').trigger('click')

    expect(wrapper.emitted('mode-change')?.[0]).toEqual(['image'])
  })

  it('shows image projects in the shared record list and switches to image mode', async () => {
    apiMocks.listImageProjects.mockResolvedValueOnce(apiMocks.page([{
      id: 42,
      user_id: 1,
      title: 'Saved image idea',
      cover_version_id: 42,
      status: 'active',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
      version_count: 1,
    }]))
    const wrapper = mount(AiChatWorkspace, {
      props: { scope: 'user', activeMode: 'dialogue' },
      global: {
        stubs: {
          AppLayout: { template: '<main><slot /></main>' },
          Icon: { template: '<span />' },
          Select: {
            props: ['modelValue', 'options'],
            emits: ['update:modelValue'],
            template: `
              <select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
                <option v-for="option in options" :key="String(option.value)" :value="option.value">{{ option.label }}</option>
              </select>
            `,
          },
        },
      },
    })

    await flushPromises()

    const imageRecord = wrapper.findAll('button').find((button) => button.text().includes('Saved image idea'))
    expect(imageRecord).toBeTruthy()

    await imageRecord!.trigger('click')

    expect(localStorage.getItem('sub2api:ai-creation:user:selected-image-project:v1')).toBe('42')
    expect(wrapper.emitted('mode-change')?.[0]).toEqual(['image'])
  })

  it('deletes image projects from the shared sidebar', async () => {
    apiMocks.listImageProjects.mockResolvedValueOnce(apiMocks.page([{
      id: 42,
      user_id: 1,
      title: 'Saved image idea',
      cover_version_id: 42,
      status: 'active',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
      version_count: 1,
    }]))
    const wrapper = mount(AiChatWorkspace, {
      props: { scope: 'user', activeMode: 'dialogue' },
      global: {
        stubs: {
          AppLayout: { template: '<main><slot /></main>' },
          Icon: { template: '<span />' },
          Select: {
            props: ['modelValue', 'options'],
            emits: ['update:modelValue'],
            template: `
              <select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
                <option v-for="option in options" :key="String(option.value)" :value="option.value">{{ option.label }}</option>
              </select>
            `,
          },
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('Saved image idea')
    await wrapper.get('button[title="删除作画记录"]').trigger('click')
    await flushPromises()

    expect(apiMocks.deleteImageProject).toHaveBeenCalledWith(42)
    expect(wrapper.text()).not.toContain('Saved image idea')
  })

  it('shows reasoning and web search state during streaming', async () => {
    sendChatCompletionMock.mockImplementation(async (_key, _payload, options) => {
      options.onThoughtDelta('先看最新信息')
      options.onToolCall({ name: 'web_search', arguments: '{"query":"sub2api"}' })
      options.onDelta('搜索完成')
      return {
        content: '搜索完成',
        reasoning: '先看最新信息',
        toolCalls: [{ name: 'web_search', arguments: '{"query":"sub2api"}' }],
      }
    })

    const wrapper = mount(AiChatWorkspace, {
      props: { scope: 'user' },
      global: {
        stubs: {
          AppLayout: { template: '<main><slot /></main>' },
          Icon: { template: '<span />' },
          Select: {
            props: ['modelValue', 'options'],
            emits: ['update:modelValue'],
            template: `
              <select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
                <option v-for="option in options" :key="String(option.value)" :value="option.value">{{ option.label }}</option>
              </select>
            `,
          },
        },
      },
    })

    await flushPromises()
    await wrapper.get('button[title="联网搜索"]').trigger('click')
    await wrapper.get('textarea').setValue('查一下 sub2api')
    await wrapper.get('button[title="发送"]').trigger('click')
    await flushPromises()

    expect(sendChatCompletionMock.mock.calls[0][1]).toEqual({
      model: 'gpt-5.4',
      messages: [{ role: 'user', content: '查一下 sub2api' }],
      reasoning_effort: 'medium',
      tools: [{ type: 'web_search' }],
    })
    expect(wrapper.text()).toContain('思考链路')
    expect(wrapper.text()).toContain('先看最新信息')
    expect(wrapper.text()).toContain('联网搜索')
    expect(wrapper.text()).toContain('搜索完成')
  })

  it('shows public thinking steps when upstream does not return a reasoning summary', async () => {
    sendChatCompletionMock.mockImplementation(async (_key, _payload, options) => {
      options.onDelta('可以直接回答')
      return { content: '可以直接回答' }
    })

    const wrapper = mount(AiChatWorkspace, {
      props: { scope: 'user' },
      global: {
        stubs: {
          AppLayout: { template: '<main><slot /></main>' },
          Icon: { template: '<span />' },
          Select: {
            props: ['modelValue', 'options'],
            emits: ['update:modelValue'],
            template: `
              <select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
                <option v-for="option in options" :key="String(option.value)" :value="option.value">{{ option.label }}</option>
              </select>
            `,
          },
        },
      },
    })

    await flushPromises()
    await wrapper.get('textarea').setValue('帮我解释这个报错')
    await wrapper.get('button[title="发送"]').trigger('click')
    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain('可解释摘要')
    expect(text).toContain('理解需求')
    expect(text).toContain('帮我解释这个报错')
    expect(text).toContain('整理上下文')
    expect(text).toContain('选择路径')
    expect(text).toContain('形成回答')
    expect(text).toContain('可以直接回答')
  })

  it('collapses and expands the thinking trace details', async () => {
    sendChatCompletionMock.mockImplementation(async (_key, _payload, options) => {
      options.onDelta('可以直接回答')
      return { content: '可以直接回答' }
    })

    const wrapper = mount(AiChatWorkspace, {
      props: { scope: 'user' },
      global: {
        stubs: {
          AppLayout: { template: '<main><slot /></main>' },
          Icon: { template: '<span />' },
          Select: {
            props: ['modelValue', 'options'],
            emits: ['update:modelValue'],
            template: `
              <select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
                <option v-for="option in options" :key="String(option.value)" :value="option.value">{{ option.label }}</option>
              </select>
            `,
          },
        },
      },
    })

    await flushPromises()
    await wrapper.get('textarea').setValue('帮我解释这个报错')
    await wrapper.get('button[title="发送"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('理解需求')
    await wrapper.get('button[title="收起思考链路"]').trigger('click')
    expect(wrapper.text()).toContain('思考链路')
    expect(wrapper.text()).toContain('可以直接回答')
    expect(wrapper.text()).not.toContain('理解需求')

    await wrapper.get('button[title="展开思考链路"]').trigger('click')
    expect(wrapper.text()).toContain('理解需求')
  })

  it('shows full reasoning content and timing', async () => {
    const startedAt = new Date('2026-01-01T00:00:00.000Z')
    vi.useFakeTimers()
    vi.setSystemTime(startedAt)
    sendChatCompletionMock.mockImplementation(async (_key, _payload, options) => {
      vi.setSystemTime(new Date(startedAt.getTime() + 1200))
      options.onThoughtDelta('第一段')
      vi.setSystemTime(new Date(startedAt.getTime() + 2400))
      options.onThoughtDelta('第二段')
      vi.setSystemTime(new Date(startedAt.getTime() + 3200))
      options.onDelta('最终回答')
      vi.setSystemTime(new Date(startedAt.getTime() + 4500))
      return { content: '最终回答', reasoning: '第一段第二段' }
    })

    const wrapper = mount(AiChatWorkspace, {
      props: { scope: 'user' },
      global: {
        stubs: {
          AppLayout: { template: '<main><slot /></main>' },
          Icon: { template: '<span />' },
          Select: {
            props: ['modelValue', 'options'],
            emits: ['update:modelValue'],
            template: `
              <select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
                <option v-for="option in options" :key="String(option.value)" :value="option.value">{{ option.label }}</option>
              </select>
            `,
          },
        },
      },
    })

    await flushPromises()
    await wrapper.get('textarea').setValue('解释一下')
    await wrapper.get('button[title="发送"]').trigger('click')
    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain('第一段第二段')
    expect(text).toContain('思考时间 3.2s')
    expect(text).toContain('总耗时 4.5s')
  })
})
