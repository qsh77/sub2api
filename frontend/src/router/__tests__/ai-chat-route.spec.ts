import { describe, expect, it, vi } from 'vitest'

const authStore = vi.hoisted(() => ({
  checkAuth: vi.fn(),
  isAuthenticated: false,
  isAdmin: false,
  isSimpleMode: false,
}))

const appStore = vi.hoisted(() => ({
  siteName: 'Sub2API',
  backendModeEnabled: false,
  cachedPublicSettings: null as null | Record<string, unknown>,
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStore,
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => appStore,
}))

vi.mock('@/stores/adminSettings', () => ({
  useAdminSettingsStore: () => ({
    customMenuItems: [],
  }),
}))

vi.mock('@/composables/useNavigationLoading', () => ({
  useNavigationLoadingState: () => ({
    startNavigation: vi.fn(),
    endNavigation: vi.fn(),
    isLoading: { value: false },
  }),
}))

vi.mock('@/composables/useRoutePrefetch', () => ({
  useRoutePrefetch: () => ({
    triggerPrefetch: vi.fn(),
    cancelPendingPrefetch: vi.fn(),
    resetPrefetchState: vi.fn(),
  }),
}))

describe('AI chat routes', () => {
  it('registers the user AI chat route', async () => {
    const { default: router } = await import('@/router')
    const routes = router.getRoutes()
    const route = routes.find((record) => record.path === '/chat')
    const routeByName = routes.find((record) => record.name === 'AiChat')

    expect(route?.name).toBe('AiChat')
    expect(routeByName?.path).toBe('/chat')
    expect(route?.meta.requiresAuth).toBe(true)
    expect(route?.meta.requiresAdmin).toBe(false)
    expect(route?.meta.titleKey).toBe('aiChat.title')
    expect(route?.meta.descriptionKey).toBe('aiChat.description')
  })

  it('registers the admin AI chat route', async () => {
    const { default: router } = await import('@/router')
    const routes = router.getRoutes()
    const route = routes.find((record) => record.path === '/admin/chat')
    const routeByName = routes.find((record) => record.name === 'AdminAiChat')

    expect(route?.name).toBe('AdminAiChat')
    expect(routeByName?.path).toBe('/admin/chat')
    expect(route?.meta.requiresAuth).toBe(true)
    expect(route?.meta.requiresAdmin).toBe(true)
    expect(route?.meta.titleKey).toBe('aiChat.admin.title')
    expect(route?.meta.descriptionKey).toBe('aiChat.admin.description')
  })
})
