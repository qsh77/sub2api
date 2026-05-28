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

describe('image generation routes', () => {
  it('registers the user image generation route', async () => {
    const { default: router } = await import('@/router')
    const routes = router.getRoutes()
    const route = routes.find((record) => record.path === '/images')
    const routeByName = routes.find((record) => record.name === 'ImageGeneration')

    expect(route?.name).toBe('ImageGeneration')
    expect(routeByName?.path).toBe('/images')
    expect(route?.meta.requiresAuth).toBe(true)
    expect(route?.meta.requiresAdmin).toBe(false)
    expect(route?.meta.titleKey).toBe('imageGeneration.title')
    expect(route?.meta.descriptionKey).toBe('imageGeneration.description')
  })

  it('registers the admin image generation route', async () => {
    const { default: router } = await import('@/router')
    const routes = router.getRoutes()
    const route = routes.find((record) => record.path === '/admin/images')
    const routeByName = routes.find((record) => record.name === 'AdminImageGeneration')

    expect(route?.name).toBe('AdminImageGeneration')
    expect(routeByName?.path).toBe('/admin/images')
    expect(route?.meta.requiresAuth).toBe(true)
    expect(route?.meta.requiresAdmin).toBe(true)
    expect(route?.meta.titleKey).toBe('imageGeneration.admin.title')
    expect(route?.meta.descriptionKey).toBe('imageGeneration.admin.description')
  })
})
