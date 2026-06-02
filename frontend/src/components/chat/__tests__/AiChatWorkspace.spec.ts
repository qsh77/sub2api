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
  },
}))

vi.mock('@/api/aiChat', () => ({
  extractChatModelsForGroup: () => ['gpt-5.4'],
  fallbackChatModels: () => ['gpt-5.4'],
  sendChatCompletion: sendChatCompletionMock,
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
