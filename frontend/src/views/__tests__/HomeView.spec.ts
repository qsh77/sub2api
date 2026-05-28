import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'

import HomeView from '../HomeView.vue'

const { appState, authState } = vi.hoisted(() => ({
  appState: {
    cachedPublicSettings: null as null | {
      site_name?: string
      site_logo?: string
      site_subtitle?: string
      doc_url?: string
      home_content?: string
    },
    siteName: '77code',
    siteLogo: '',
    docUrl: '',
    publicSettingsLoaded: true,
    fetchPublicSettings: vi.fn()
  },
  authState: {
    isAuthenticated: false,
    isAdmin: false,
    user: null as null | { email?: string },
    checkAuth: vi.fn()
  }
}))

const messages: Record<string, string> = {
  'home.viewDocs': 'View docs',
  'home.switchToLight': 'Switch to light',
  'home.switchToDark': 'Switch to dark',
  'home.login': 'Login',
  'home.dashboard': 'Dashboard',
  'home.getStarted': 'Get started',
  'home.goToDashboard': 'Go to dashboard',
  'home.docs': 'Docs',
  'home.footer.allRightsReserved': 'All rights reserved.'
}

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => messages[key] ?? key
    })
  }
})

vi.mock('@/stores', () => ({
  useAppStore: () => appState,
  useAuthStore: () => authState
}))

function mountHome() {
  return mount(HomeView, {
    global: {
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
        LocaleSwitcher: true,
        Icon: true
      }
    }
  })
}

describe('HomeView', () => {
  beforeEach(() => {
    appState.cachedPublicSettings = null
    appState.siteName = '77code'
    appState.siteLogo = ''
    appState.docUrl = ''
    appState.publicSettingsLoaded = true
    appState.fetchPublicSettings.mockReset()

    authState.isAuthenticated = false
    authState.isAdmin = false
    authState.user = null
    authState.checkAuth.mockReset()

    localStorage.clear()
    document.documentElement.className = ''

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false })
    })
  })

  it('renders the 77code coding relay homepage by default', () => {
    const wrapper = mountHome()
    const text = wrapper.text()

    expect(text).toContain('开发者首选')
    expect(text).toContain('AI 编码中转平台')
    expect(text).toContain('一个账号、一条稳定线路')
    expect(text).toContain('Claude Code')
    expect(text).toContain('Codex')
    expect(text).toContain('OpenClaw')
    expect(text).toContain('OPENAI_BASE_URL="https://api.77code.cc"')
    expect(text).toContain('OPENAI_API_KEY="sk-..."')
    expect(text).toContain('$ codex')
    expect(text).toContain('核心用户')
    expect(text).toContain('100万+')
    expect(text).not.toContain('Gemini CLI')

    expect(authState.checkAuth).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('lets the default landing surface fill the viewport', () => {
    const source = readFileSync('src/views/HomeView.vue', 'utf8')

    expect(source).toMatch(/\.homepage\s*{[^}]*padding:\s*0;/s)
    expect(source).toMatch(/\.hero-shell\s*{[^}]*width:\s*100%;/s)
    expect(source).not.toMatch(/\.hero-shell\s*{[^}]*max-width:/s)
  })

  it('keeps URL home_content rendered as an iframe', () => {
    appState.cachedPublicSettings = {
      home_content: 'https://example.com/custom-home',
      site_name: '77code'
    }

    const wrapper = mountHome()
    const iframe = wrapper.find('iframe')

    expect(iframe.exists()).toBe(true)
    expect(iframe.attributes('src')).toBe('https://example.com/custom-home')
    expect(wrapper.text()).not.toContain('AI 编码中转平台')

    wrapper.unmount()
  })
})
