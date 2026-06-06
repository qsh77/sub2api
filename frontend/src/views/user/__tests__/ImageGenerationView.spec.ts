import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import ImageGenerationView from '../ImageGenerationView.vue'

const { list, getAvailable, generateImage, editImage, fetchImageVersionBlob, listImageProjects, getImageProject, uploadImageVersion, showError, showSuccess } = vi.hoisted(() => ({
  list: vi.fn(),
  getAvailable: vi.fn(),
  generateImage: vi.fn(),
  editImage: vi.fn(),
  fetchImageVersionBlob: vi.fn(),
  listImageProjects: vi.fn(),
  getImageProject: vi.fn(),
  uploadImageVersion: vi.fn(),
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
    editImage,
    fetchImageVersionBlob,
    listImageProjects,
    getImageProject,
    uploadImageVersion,
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

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
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
            { name: 'gpt-image-2', platform: 'openai', pricing: { billing_mode: 'image' } },
          ],
        },
      ],
    },
  ]
}

async function mountView(keys = [apiKey()], workspace: {
  projects?: unknown
  detail?: unknown | ((id: number) => unknown)
} = {}) {
  list.mockResolvedValue({ items: keys, total: keys.length, page: 1, page_size: 100, pages: 1 })
  getAvailable.mockResolvedValue(channels())
  listImageProjects.mockResolvedValue(workspace.projects || { items: [], total: 0, page: 1, page_size: 50, pages: 1 })
  const detail = workspace.detail || { project: { id: 1, user_id: 1, title: 'Saved', status: 'active', created_at: '', updated_at: '' }, versions: [] }
  if (typeof detail === 'function') {
    getImageProject.mockImplementation(async (id: number) => detail(id))
  } else {
    getImageProject.mockResolvedValue(detail)
  }
  uploadImageVersion.mockResolvedValue({
    project: { id: 1, user_id: 1, title: 'Saved', cover_version_id: 1, status: 'active', created_at: '', updated_at: '' },
    versions: [{
      id: 1,
      project_id: 1,
      user_id: 1,
      mode: 'generation',
      prompt: 'a compact control room',
      model: 'gpt-image-2',
      size: '1024x1024',
      mime_type: 'image/png',
      file_size_bytes: 5,
      sha256: '',
      width: 1,
      height: 1,
      created_at: '',
    }],
  })

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
    let objectUrlIndex = 0
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => `blob:mock-${++objectUrlIndex}`),
      revokeObjectURL: vi.fn(),
    })
    list.mockReset()
    getAvailable.mockReset()
    generateImage.mockReset()
    editImage.mockReset()
    fetchImageVersionBlob.mockReset()
    listImageProjects.mockReset()
    getImageProject.mockReset()
    uploadImageVersion.mockReset()
    showError.mockReset()
    showSuccess.mockReset()
    fetchImageVersionBlob.mockResolvedValue(new Blob(['saved'], { type: 'image/png' }))
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('renders active API keys and enables generation for image-enabled OpenAI group', async () => {
    const wrapper = await mountView([
      apiKey({ id: 1, key: 'sk-enabled', name: 'Enabled key' }),
      apiKey({ id: 2, key: 'sk-inactive', name: 'Inactive key', status: 'inactive' }),
    ])

    expect(wrapper.text()).toContain('Enabled key')
    expect(wrapper.text()).toContain('OpenAI Images')
    expect(wrapper.text()).not.toContain('Inactive key')
    expect(list).toHaveBeenCalledWith(1, 100, { status: 'active' })

    await wrapper.find('textarea').setValue('a clean vector dashboard')

    expect(wrapper.find('[data-testid="generate-image"]').attributes('disabled')).toBeUndefined()
  })

  it('selects an image-enabled key when other active keys cannot generate images', async () => {
    generateImage.mockResolvedValue({
      images: [{ url: 'data:image/png;base64,aGVsbG8=' }],
      raw: {},
    })
    const wrapper = await mountView([
      apiKey({
        id: 1,
        key: 'sk-disabled',
        name: 'Disabled key',
        group: { ...activeGroup, name: 'No Images', allow_image_generation: false },
      }),
      apiKey({
        id: 2,
        key: 'sk-enabled',
        name: 'Enabled key',
      }),
    ])

    expect(wrapper.text()).not.toContain('Disabled key')
    expect(wrapper.text()).toContain('Enabled key')

    await wrapper.find('textarea').setValue('a city at dusk')
    await wrapper.find('[data-testid="generate-image"]').trigger('click')
    await flushPromises()

    expect(generateImage).toHaveBeenCalledWith('sk-enabled', expect.objectContaining({
      model: 'gpt-image-2',
      prompt: 'a city at dusk',
    }), expect.any(Object))
  })

  it('disables generation when there is no image-enabled group key', async () => {
    const wrapper = await mountView([
      apiKey({
        group: { ...activeGroup, allow_image_generation: false },
      }),
    ])

    await wrapper.find('textarea').setValue('a city at dusk')

    expect(wrapper.text()).toContain('没有可用的 OpenAI 生图分组密钥')
    expect(wrapper.find('[data-testid="generate-image"]').attributes('disabled')).toBeDefined()
  })

  it('disables generation when there is no active image group key', async () => {
    const wrapper = await mountView([
      apiKey({
        group: { ...activeGroup, status: 'suspended' },
      }),
    ])

    await wrapper.find('textarea').setValue('a city at dawn')

    expect(wrapper.text()).toContain('没有可用的 OpenAI 生图分组密钥')
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
        model: 'gpt-image-2',
        prompt: 'a compact control room',
        size: '1024x1024',
        n: 1,
        response_format: 'b64_json',
      },
      { signal: expect.any(AbortSignal) },
    )
    expect(uploadImageVersion).toHaveBeenCalled()
    expect(fetchImageVersionBlob).toHaveBeenCalledWith(1, false)
    expect(wrapper.find('img[alt="generated-image-1"]').attributes('src')).toBe('blob:mock-1')
    expect(wrapper.find('img[alt="generated-image-1"]').classes()).toContain('max-w-[560px]')
    expect(wrapper.find('a[download="image-1.png"]').attributes('href')).toBe('blob:mock-1')
    expect(showSuccess).toHaveBeenCalledWith('图片已保存')
  })

  it('waits for authenticated saved image blobs instead of rendering protected file URLs', async () => {
    const imageBlob = deferred<Blob>()
    fetchImageVersionBlob.mockReturnValue(imageBlob.promise)
    const wrapper = await mountView([apiKey()], {
      projects: {
        items: [{ id: 7, user_id: 1, title: 'Saved', cover_version_id: 7, status: 'active', created_at: '', updated_at: '', version_count: 1 }],
        total: 1,
        page: 1,
        page_size: 50,
        pages: 1,
      },
      detail: {
        project: { id: 7, user_id: 1, title: 'Saved', cover_version_id: 7, status: 'active', created_at: '', updated_at: '' },
        versions: [{
          id: 7,
          project_id: 7,
          user_id: 1,
          mode: 'generation',
          prompt: 'saved image',
          model: 'gpt-image-2',
          size: '1024x1024',
          mime_type: 'image/png',
          file_size_bytes: 5,
          sha256: '',
          width: 1,
          height: 1,
          created_at: '',
        }],
      },
    })

    expect(wrapper.find('img[alt="generated-image-7"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('图片加载中')

    imageBlob.resolve(new Blob(['saved'], { type: 'image/png' }))
    await flushPromises()

    expect(wrapper.find('img[alt="generated-image-7"]').attributes('src')).toBe('blob:mock-1')
  })

  it('moves prompt into chat immediately and clears the composer while generating', async () => {
    const generation = deferred<unknown>()
    generateImage.mockReturnValue(generation.promise)
    const wrapper = await mountView()

    await wrapper.find('textarea').setValue('a fast blue cat')
    await wrapper.find('[data-testid="generate-image"]').trigger('click')

    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('')
    expect(wrapper.text()).toContain('a fast blue cat')
    expect(wrapper.text()).toContain('Thought for 0s')
    expect(uploadImageVersion).not.toHaveBeenCalled()

    generation.resolve({ images: [{ url: 'data:image/png;base64,aGVsbG8=' }], raw: {} })
    await flushPromises()
  })

  it('stops thought timing when generation finishes and save begins', async () => {
    vi.useFakeTimers()
    const generation = deferred<{ images: Array<{ url: string }>; raw: Record<string, never> }>()
    const saving = deferred<Awaited<ReturnType<typeof uploadImageVersion>>>()
    generateImage.mockReturnValue(generation.promise)
    const wrapper = await mountView()
    uploadImageVersion.mockReturnValue(saving.promise)

    await wrapper.find('textarea').setValue('a stopwatch image')
    await wrapper.find('[data-testid="generate-image"]').trigger('click')
    await vi.advanceTimersByTimeAsync(2000)

    expect(wrapper.text()).toContain('Thought for 2s')
    generation.resolve({ images: [{ url: 'data:image/png;base64,aGVsbG8=' }], raw: {} })
    await flushPromises()
    await vi.advanceTimersByTimeAsync(5000)

    expect(wrapper.text()).toContain('Thought for 2s')
    expect(wrapper.text()).not.toContain('Thought for 7s')

    saving.resolve({
      project: { id: 1, user_id: 1, title: 'Saved', cover_version_id: 1, status: 'active', created_at: '', updated_at: '' },
      versions: [{
        id: 1,
        project_id: 1,
        user_id: 1,
        mode: 'generation',
        prompt: 'a stopwatch image',
        model: 'gpt-image-2',
        size: '1024x1024',
        mime_type: 'image/png',
        file_size_bytes: 5,
        sha256: '',
        width: 1,
        height: 1,
        created_at: '',
      }],
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Thought for 2s')
    const thoughtButton = wrapper.findAll('button').find((button) => button.text().includes('Thought for 2s'))
    expect(thoughtButton).toBeTruthy()
    expect(thoughtButton!.classes()).toContain('block')
    await thoughtButton!.trigger('click')

    expect(wrapper.text()).toContain('收到提示')
    expect(wrapper.text()).toContain('生成图片')
    expect(wrapper.text()).toContain('结果已保存')
    expect(localStorage.getItem('sub2api:image-thoughts:v1')).toContain('"1"')
    vi.useRealTimers()
  })

  it('does not leave a running thought when saving a generated image fails', async () => {
    generateImage.mockResolvedValue({
      images: [{ url: 'data:image/png;base64,aGVsbG8=' }],
      raw: {},
    })
    const wrapper = await mountView()
    uploadImageVersion.mockRejectedValue(new Error('save exploded'))

    await wrapper.find('textarea').setValue('a long prompt that generates but fails to save')
    await wrapper.find('[data-testid="generate-image"]').trigger('click')
    await flushPromises()

    expect(showError).toHaveBeenCalledWith('save exploded')
    expect(wrapper.text()).toContain('保存失败')
    expect(wrapper.text()).not.toContain('Thought for')
    expect(wrapper.find('img[alt="pending-image-1"]').exists()).toBe(true)
  })

  it('restores saved thought timing after reload', async () => {
    localStorage.setItem('sub2api:image-thoughts:v1', JSON.stringify({
      1: {
        seconds: 4,
        steps: [
          { label: '收到提示', detail: 'a persisted image' },
          { label: '生成图片', detail: 'gpt-image-2 · 1K 方图' },
          { label: '结果已保存', detail: 'image-1' },
        ],
      },
    }))
    const wrapper = await mountView([apiKey()], {
      projects: {
        items: [{ id: 1, user_id: 1, title: 'Saved', cover_version_id: 1, status: 'active', created_at: '', updated_at: '', version_count: 1 }],
        total: 1,
        page: 1,
        page_size: 50,
        pages: 1,
      },
      detail: {
        project: { id: 1, user_id: 1, title: 'Saved', cover_version_id: 1, status: 'active', created_at: '', updated_at: '' },
        versions: [{
          id: 1,
          project_id: 1,
          user_id: 1,
          mode: 'generation',
          prompt: 'a persisted image',
          model: 'gpt-image-2',
          size: '1024x1024',
          mime_type: 'image/png',
          file_size_bytes: 5,
          sha256: '',
          width: 1,
          height: 1,
          created_at: '',
        }],
      },
    })

    expect(wrapper.text()).toContain('Thought for 4s')
  })

  it('shows follow-up context without destructive delete control', async () => {
    generateImage.mockResolvedValue({
      images: [{ url: 'data:image/png;base64,aGVsbG8=' }],
      raw: {},
    })
    const wrapper = await mountView()

    await wrapper.find('textarea').setValue('a follow-up source')
    await wrapper.find('[data-testid="generate-image"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).not.toContain('正在修改：image-1')
    expect(wrapper.text()).not.toContain('取消修改')
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).placeholder).toBe('')
    expect(wrapper.text()).not.toContain('继续改')
    expect(wrapper.find('button[title="删除"]').exists()).toBe(false)
    expect(wrapper.find('button[title="画局部区域"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('◌')
  })

  it('edits the latest image directly from natural language', async () => {
    generateImage.mockResolvedValue({
      images: [{ url: 'data:image/png;base64,aGVsbG8=' }],
      raw: {},
    })
    editImage.mockResolvedValue({
      images: [{ url: 'data:image/png;base64,aGVsbG8=' }],
      raw: {},
    })
    const wrapper = await mountView()

    await wrapper.find('textarea').setValue('a source image')
    await wrapper.find('[data-testid="generate-image"]').trigger('click')
    await flushPromises()

    await wrapper.find('textarea').setValue('改大点')
    await wrapper.find('[data-testid="generate-image"]').trigger('click')
    await flushPromises()

    expect(editImage).toHaveBeenCalledWith(
      'sk-enabled',
      expect.objectContaining({
        model: 'gpt-image-2',
        prompt: expect.stringContaining('用户要求：改大点'),
        image: expect.any(Blob),
        size: '1024x1024',
        n: 1,
        response_format: 'b64_json',
      }),
      { signal: expect.any(AbortSignal) },
    )
  })

  it('previews an uploaded image while it is being saved', async () => {
    const saving = deferred<Awaited<ReturnType<typeof uploadImageVersion>>>()
    uploadImageVersion.mockReturnValue(saving.promise)
    const wrapper = await mountView()
    const file = new File(['image'], 'upload.png', { type: 'image/png' })
    const input = wrapper.find('input[type="file"]').element as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [file] })

    await wrapper.find('input[type="file"]').trigger('change')

    expect(wrapper.text()).not.toContain('待上传')
    expect(wrapper.find('img[alt="selected-upload-image"]').attributes('src')).toBe('blob:mock-1')

    await wrapper.find('[data-testid="generate-image"]').trigger('click')

    expect(wrapper.text()).toContain('upload.png')
    expect(wrapper.find('img[alt="selected-upload-image"]').exists()).toBe(false)
    expect(wrapper.find('img[alt="uploaded-source-image-1"]').attributes('src')).toBe('blob:mock-1')
    expect(wrapper.find('img[alt="pending-image-1"]').exists()).toBe(false)

    saving.resolve({
      project: { id: 2, user_id: 1, title: 'upload.png', cover_version_id: 2, status: 'active', created_at: '', updated_at: '' },
      versions: [{
        id: 2,
        project_id: 2,
        user_id: 1,
        mode: 'upload',
        prompt: 'upload.png',
        model: 'gpt-image-2',
        size: '1024x1024',
        mime_type: 'image/png',
        file_size_bytes: 5,
        sha256: '',
        width: 1,
        height: 1,
        created_at: '',
      }],
    })
    await flushPromises()
  })

  it('edits an uploaded image with the typed prompt instead of saving the original', async () => {
    const editing = deferred<{ images: Array<{ url: string }>; raw: Record<string, never> }>()
    editImage.mockReturnValue(editing.promise)
    const wrapper = await mountView()
    const file = new File(['source-image'], 'source.png', { type: 'image/png' })
    const input = wrapper.find('input[type="file"]').element as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [file] })

    await wrapper.find('input[type="file"]').trigger('change')
    await wrapper.find('textarea').setValue('把背景换成蓝色')
    await wrapper.find('[data-testid="generate-image"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('img[alt="selected-upload-image"]').exists()).toBe(false)
    expect(wrapper.find('img[alt="uploaded-source-image-1"]').attributes('src')).toBe('blob:mock-1')
    expect(wrapper.text()).toContain('把背景换成蓝色')
    expect(wrapper.text()).not.toContain('待上传')

    expect(editImage).toHaveBeenCalledWith(
      'sk-enabled',
      expect.objectContaining({
        model: 'gpt-image-2',
        prompt: '把背景换成蓝色',
        image: file,
        size: '1024x1024',
        n: 1,
        response_format: 'b64_json',
      }),
      { signal: expect.any(AbortSignal) },
    )

    editing.resolve({
      images: [{ url: 'data:image/png;base64,ZWRpdGVk' }],
      raw: {},
    })
    await flushPromises()

    expect(uploadImageVersion).toHaveBeenCalled()
    const form = uploadImageVersion.mock.calls.at(-1)?.[0] as FormData
    expect(form.get('mode')).toBe('edit')
    expect(form.get('prompt')).toBe('把背景换成蓝色')
  })

  it('does not attach uploaded prompt edits to a previously selected saved image', async () => {
    editImage.mockResolvedValue({
      images: [{ url: 'data:image/png;base64,ZWRpdGVk' }],
      raw: {},
    })
    const wrapper = await mountView([apiKey()], {
      projects: {
        items: [{ id: 7, user_id: 1, title: 'Old image', cover_version_id: 7, status: 'active', created_at: '', updated_at: '', version_count: 1 }],
        total: 1,
        page: 1,
        page_size: 50,
        pages: 1,
      },
      detail: {
        project: { id: 7, user_id: 1, title: 'Old image', cover_version_id: 7, status: 'active', created_at: '', updated_at: '' },
        versions: [{
          id: 7,
          project_id: 7,
          user_id: 1,
          mode: 'generation',
          prompt: 'old image',
          model: 'gpt-image-2',
          size: '1024x1024',
          mime_type: 'image/png',
          file_size_bytes: 5,
          sha256: '',
          width: 1,
          height: 1,
          created_at: '',
        }],
      },
    })
    const file = new File(['source-image'], 'source.png', { type: 'image/png' })
    const input = wrapper.find('input[type="file"]').element as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [file] })

    await wrapper.find('input[type="file"]').trigger('change')
    await wrapper.find('textarea').setValue('换成绿色')
    await wrapper.find('[data-testid="generate-image"]').trigger('click')
    await flushPromises()

    const form = uploadImageVersion.mock.calls.at(-1)?.[0] as FormData
    expect(form.get('mode')).toBe('edit')
    expect(form.has('parent_version_id')).toBe(false)
    expect(form.has('source_version_id')).toBe(false)
  })

  it('does not carry an unsent upload draft into another conversation', async () => {
    const detailFor = (id: number) => ({
      project: { id, user_id: 1, title: id === 7 ? 'Old image' : 'Other image', cover_version_id: id, status: 'active', created_at: '', updated_at: '' },
      versions: [{
        id,
        project_id: id,
        user_id: 1,
        mode: 'generation',
        prompt: id === 7 ? 'old image' : 'other image',
        model: 'gpt-image-2',
        size: '1024x1024',
        mime_type: 'image/png',
        file_size_bytes: 5,
        sha256: '',
        width: 1,
        height: 1,
        created_at: '',
      }],
    })
    const wrapper = await mountView([apiKey()], {
      projects: {
        items: [
          { id: 7, user_id: 1, title: 'Old image', cover_version_id: 7, status: 'active', created_at: '', updated_at: '', version_count: 1 },
          { id: 8, user_id: 1, title: 'Other image', cover_version_id: 8, status: 'active', created_at: '', updated_at: '', version_count: 1 },
        ],
        total: 2,
        page: 1,
        page_size: 50,
        pages: 1,
      },
      detail: detailFor,
    })
    const newConversation = wrapper.findAll('button').find((button) => button.text() === '新对话')
    await newConversation!.trigger('click')
    const file = new File(['source-image'], 'source.png', { type: 'image/png' })
    const input = wrapper.find('input[type="file"]').element as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [file] })

    await wrapper.find('input[type="file"]').trigger('change')
    expect(wrapper.find('img[alt="selected-upload-image"]').exists()).toBe(true)

    const otherProject = wrapper.findAll('button').find((button) => button.text() === 'Other image')
    await otherProject!.trigger('click')
    await flushPromises()

    expect(wrapper.find('img[alt="selected-upload-image"]').exists()).toBe(false)
    expect(wrapper.find('img[alt="generated-image-8"]').exists()).toBe(true)
    expect(wrapper.find('img[alt="generated-image-7"]').exists()).toBe(false)
  })

  it('keeps an in-flight new conversation result out of another selected conversation', async () => {
    const generation = deferred<{ images: Array<{ url: string }>; raw: Record<string, never> }>()
    generateImage.mockReturnValue(generation.promise)
    const oldDetail = {
      project: { id: 7, user_id: 1, title: 'Old image', cover_version_id: 7, status: 'active', created_at: '', updated_at: '' },
      versions: [{
        id: 7,
        project_id: 7,
        user_id: 1,
        mode: 'generation',
        prompt: 'old image',
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
    const savedNewDetail = {
      project: { id: 2, user_id: 1, title: 'new draft image', cover_version_id: 2, status: 'active', created_at: '', updated_at: '' },
      versions: [{
        id: 2,
        project_id: 2,
        user_id: 1,
        mode: 'generation',
        prompt: 'new draft image',
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
    const wrapper = await mountView([apiKey()], {
      projects: {
        items: [{ id: 7, user_id: 1, title: 'Old image', cover_version_id: 7, status: 'active', created_at: '', updated_at: '', version_count: 1 }],
        total: 1,
        page: 1,
        page_size: 50,
        pages: 1,
      },
      detail: oldDetail,
    })
    uploadImageVersion.mockResolvedValue(savedNewDetail)
    listImageProjects.mockResolvedValue({
      items: [
        { id: 2, user_id: 1, title: 'new draft image', cover_version_id: 2, status: 'active', created_at: '', updated_at: '', version_count: 1 },
        { id: 7, user_id: 1, title: 'Old image', cover_version_id: 7, status: 'active', created_at: '', updated_at: '', version_count: 1 },
      ],
      total: 2,
      page: 1,
      page_size: 50,
      pages: 1,
    })

    const newConversation = wrapper.findAll('button').find((button) => button.text() === '新对话')
    await newConversation!.trigger('click')
    await wrapper.find('textarea').setValue('new draft image')
    await wrapper.find('[data-testid="generate-image"]').trigger('click')

    const oldProject = wrapper.findAll('button').find((button) => button.text() === 'Old image')
    await oldProject!.trigger('click')
    await flushPromises()
    generation.resolve({ images: [{ url: 'data:image/png;base64,ZHJhZnQ=' }], raw: {} })
    await flushPromises()

    const form = uploadImageVersion.mock.calls.at(-1)?.[0] as FormData
    expect(form.has('project_id')).toBe(false)
    expect(wrapper.find('img[alt="generated-image-7"]').exists()).toBe(true)
    expect(wrapper.find('img[alt="generated-image-2"]').exists()).toBe(false)
  })

  it('does not abort an in-flight generation when leaving the page', async () => {
    const generation = deferred<{ images: Array<{ url: string }>; raw: Record<string, never> }>()
    generateImage.mockReturnValue(generation.promise)
    const wrapper = await mountView()

    await wrapper.find('textarea').setValue('persist this image')
    await wrapper.find('[data-testid="generate-image"]').trigger('click')
    const signal = generateImage.mock.calls.at(-1)?.[2]?.signal as AbortSignal

    wrapper.unmount()

    expect(signal.aborted).toBe(false)
  })
})
