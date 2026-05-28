import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      locale: { value: 'en' }
    })
  }
})

describe('LocaleSwitcher', () => {
  it('does not show the locale flag in the trigger', () => {
    const wrapper = mount(LocaleSwitcher, {
      global: {
        stubs: {
          Icon: true
        }
      }
    })

    expect(wrapper.find('button').text()).not.toContain('🇺🇸')
  })
})
