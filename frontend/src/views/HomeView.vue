<template>
  <!-- Custom Home Content: Full Page Mode -->
  <div v-if="homeContent" class="min-h-screen">
    <!-- iframe mode -->
    <iframe
      v-if="isHomeContentUrl"
      :src="homeContent.trim()"
      class="h-screen w-full border-0"
      allowfullscreen
    ></iframe>
    <!-- HTML mode - SECURITY: homeContent is admin-only setting, XSS risk is acceptable -->
    <div v-else v-html="homeContent"></div>
  </div>

  <!-- Default Home Page -->
  <div v-else class="homepage">
    <section class="hero-shell">
      <div class="surface-orb surface-orb-primary"></div>
      <div class="surface-orb surface-orb-secondary"></div>
      <div class="surface-sweep"></div>

      <header class="hero-header">
        <div class="brand">
          <div class="brand-logo">
            <img v-if="siteLogo" :src="siteLogo" alt="Logo" class="h-full w-full object-contain" />
            <span v-else>77</span>
          </div>
          <strong>{{ siteName }}</strong>
        </div>

        <nav class="hero-nav" aria-label="Homepage navigation">
          <a href="#experience">核心体验</a>
          <a href="#models">模型矩阵</a>
          <a href="#pricing">价格计费</a>
          <a v-if="docUrl" :href="docUrl" target="_blank" rel="noopener noreferrer">文档</a>
        </nav>

        <div class="hero-actions">
          <LocaleSwitcher />

          <a
            v-if="docUrl"
            :href="docUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="icon-action"
            :title="t('home.viewDocs')"
          >
            <Icon name="book" size="md" />
          </a>

          <button
            class="icon-action"
            :title="isDark ? t('home.switchToLight') : t('home.switchToDark')"
            @click="toggleTheme"
          >
            <Icon v-if="isDark" name="sun" size="md" />
            <Icon v-else name="moon" size="md" />
          </button>

          <router-link
            :to="isAuthenticated ? dashboardPath : '/login'"
            class="header-cta"
          >
            {{ isAuthenticated ? t('home.dashboard') : '开始使用' }}
          </router-link>
        </div>
      </header>

      <main class="hero-main">
        <div class="hero-copy">
          <div class="eyebrow">
            <span></span>
            AI CODING RELAY PLATFORM
          </div>

          <h1>
            <span>开发者首选</span>
            <span class="flowing-title">AI 编码中转平台</span>
          </h1>

          <p class="hero-subtitle">
            一个账号、一条稳定线路，统一调用 Claude Code、Codex 和 OpenClaw。更低成本、更稳链路、更透明计费。
          </p>

          <div class="hero-cta-row">
            <router-link :to="isAuthenticated ? dashboardPath : '/login'" class="primary-cta">
              {{ isAuthenticated ? t('home.goToDashboard') : '立即体验' }}
            </router-link>
            <a
              v-if="docUrl"
              :href="docUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="secondary-cta"
            >
              查看文档
            </a>
          </div>

          <div id="experience" class="feature-pills">
            <span>统一密钥</span>
            <span>会话保持</span>
            <span>调用明细</span>
            <span>额度控制</span>
          </div>
        </div>

        <div class="hero-product">
          <div class="terminal-card">
            <div class="terminal-bar">
              <div class="window-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span>codex setup</span>
            </div>
            <div class="terminal-lines">
              <div class="muted">// 1秒配置 Codex</div>
              <div>$ export OPENAI_BASE_URL="https://api.77code.cc"</div>
              <div>$ export OPENAI_API_KEY="sk-..."</div>
              <div class="line-gap"></div>
              <div class="muted"># 以光速开始编码</div>
              <div class="success">$ codex</div>
            </div>
          </div>

          <div id="models" class="tool-chips">
            <span>Claude Code</span>
            <span>Codex</span>
            <span>OpenClaw</span>
          </div>
        </div>
      </main>

      <div id="pricing" class="metric-grid">
        <div class="metric-card">
          <strong>核心用户</strong>
          <span>小规模稳定服务</span>
        </div>
        <div class="metric-card">
          <strong>99.9%</strong>
          <span>服务稳定性</span>
        </div>
        <div class="metric-card">
          <strong>100万+</strong>
          <span>累计调用次数</span>
        </div>
        <div class="metric-card">
          <strong>1v1</strong>
          <span>专属支持</span>
        </div>
      </div>
    </section>

    <footer class="home-footer">
      <span>&copy; {{ currentYear }} {{ siteName }}. {{ t('home.footer.allRightsReserved') }}</span>
      <a v-if="docUrl" :href="docUrl" target="_blank" rel="noopener noreferrer">
        {{ t('home.docs') }}
      </a>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore, useAppStore } from '@/stores'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'
import Icon from '@/components/icons/Icon.vue'

const { t } = useI18n()

const authStore = useAuthStore()
const appStore = useAppStore()

function resolveSiteName(name?: string) {
  const value = name?.trim()
  return !value || value === 'Sub2API' ? '77code' : value
}

// Site settings - directly from appStore (already initialized from injected config)
const siteName = computed(() => resolveSiteName(appStore.cachedPublicSettings?.site_name || appStore.siteName))
const siteLogo = computed(() => appStore.cachedPublicSettings?.site_logo || appStore.siteLogo || '')
const docUrl = computed(() => appStore.cachedPublicSettings?.doc_url || appStore.docUrl || '')
const homeContent = computed(() => appStore.cachedPublicSettings?.home_content || '')

// Check if homeContent is a URL (for iframe display)
const isHomeContentUrl = computed(() => {
  const content = homeContent.value.trim()
  return content.startsWith('http://') || content.startsWith('https://')
})

// Theme
const isDark = ref(document.documentElement.classList.contains('dark'))

// Auth state
const isAuthenticated = computed(() => authStore.isAuthenticated)
const isAdmin = computed(() => authStore.isAdmin)
const dashboardPath = computed(() => isAdmin.value ? '/admin/dashboard' : '/dashboard')

// Current year for footer
const currentYear = computed(() => new Date().getFullYear())

// Toggle theme
function toggleTheme() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

// Initialize theme
function initTheme() {
  const savedTheme = localStorage.getItem('theme')
  if (
    savedTheme === 'dark' ||
    (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)
  ) {
    isDark.value = true
    document.documentElement.classList.add('dark')
  }
}

onMounted(() => {
  initTheme()

  // Check auth state
  authStore.checkAuth()

  // Ensure public settings are loaded (will use cache if already loaded from injected config)
  if (!appStore.publicSettingsLoaded) {
    appStore.fetchPublicSettings()
  }
})
</script>

<style scoped>
.homepage {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  overflow: hidden;
  background: #f8fafc;
  color: #0f172a;
  padding: 0;
}

.hero-shell {
  position: relative;
  width: 100%;
  min-height: 100vh;
  margin: 0;
  overflow: hidden;
  border-bottom: 1px solid #d8eaff;
  background: linear-gradient(120deg, #f8fbff 0%, #ffffff 34%, #eef7ff 66%, #f8fbff 100%);
  background-size: 180% 180%;
  animation: surface-flow 11s ease-in-out infinite;
  padding: 34px;
}

.surface-orb,
.surface-sweep {
  pointer-events: none;
  position: absolute;
}

.surface-orb {
  border-radius: 999px;
}

.surface-orb-primary {
  inset: -160px -120px auto auto;
  width: 520px;
  height: 520px;
  background: radial-gradient(circle, rgba(51, 156, 255, 0.24), rgba(51, 156, 255, 0.06) 42%, transparent 70%);
  filter: blur(12px);
  animation: orb-drift-a 14s ease-in-out infinite;
}

.surface-orb-secondary {
  left: -120px;
  bottom: -180px;
  width: 520px;
  height: 360px;
  background: radial-gradient(circle, rgba(91, 189, 255, 0.18), rgba(51, 156, 255, 0.05) 48%, transparent 72%);
  filter: blur(18px);
  animation: orb-drift-b 16s ease-in-out infinite;
}

.surface-sweep {
  inset: 0;
  background: linear-gradient(112deg, transparent 0%, rgba(51, 156, 255, 0.02) 34%, rgba(51, 156, 255, 0.09) 48%, rgba(255, 255, 255, 0.18) 55%, rgba(51, 156, 255, 0.03) 66%, transparent 100%);
  background-size: 240% 100%;
  animation: surface-sweep 9s ease-in-out infinite;
}

.hero-header,
.hero-main,
.metric-grid {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 1200px;
  margin-right: auto;
  margin-left: auto;
}

.hero-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 58px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
}

.brand-logo {
  display: flex;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 11px;
  background: linear-gradient(135deg, #111827, #1b72ff);
  box-shadow: 0 12px 32px rgba(51, 156, 255, 0.28);
  color: #fff;
  font-weight: 900;
}

.brand strong {
  overflow: hidden;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  color: #334155;
  font-size: 13px;
  font-weight: 500;
}

.hero-nav a,
.home-footer a {
  transition: color 0.2s ease;
}

.hero-nav a:hover,
.home-footer a:hover {
  color: #1768bd;
}

.hero-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.icon-action {
  display: inline-flex;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: #475569;
  transition: background 0.2s ease, color 0.2s ease;
}

.icon-action:hover {
  background: rgba(255, 255, 255, 0.72);
  color: #155896;
}

.header-cta,
.primary-cta,
.secondary-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  font-weight: 700;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.header-cta {
  min-height: 40px;
  padding: 0 18px;
  background: #0f172a;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.16);
  color: #fff;
  font-size: 13px;
}

.header-cta:hover,
.primary-cta:hover,
.secondary-cta:hover {
  transform: translateY(-1px);
}

.hero-main {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(310px, 0.95fr);
  align-items: center;
  gap: 42px;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 18px;
  border: 1px solid rgba(51, 156, 255, 0.22);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  padding: 8px 12px;
  color: #1768bd;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.eyebrow span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #339cff;
  box-shadow: 0 0 18px #339cff;
}

.hero-copy h1 {
  margin-bottom: 18px;
  font-size: clamp(40px, 5vw, 64px);
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1.14;
}

.hero-copy h1 > span {
  display: block;
}

.flowing-title {
  position: relative;
  display: inline-block;
  background: linear-gradient(105deg, #0f172a 0%, #155896 24%, #339cff 42%, #8fcbff 52%, #1768bd 68%, #0f172a 100%);
  background-size: 240% 100%;
  background-clip: text;
  color: transparent;
  text-shadow: 0 18px 36px rgba(51, 156, 255, 0.12);
  -webkit-background-clip: text;
  animation: title-flow 7s ease-in-out infinite;
}

.flowing-title::after {
  content: 'AI 编码中转平台';
  position: absolute;
  inset: 0;
  background: linear-gradient(110deg, transparent 0%, rgba(255, 255, 255, 0.08) 38%, rgba(255, 255, 255, 0.72) 50%, rgba(255, 255, 255, 0.08) 62%, transparent 100%);
  background-size: 260% 100%;
  background-clip: text;
  color: transparent;
  pointer-events: none;
  -webkit-background-clip: text;
  animation: title-shine 4.8s ease-in-out infinite;
}

.hero-subtitle {
  max-width: 580px;
  margin-bottom: 28px;
  color: #536274;
  font-size: 17px;
  line-height: 1.9;
}

.hero-cta-row,
.feature-pills,
.tool-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.hero-cta-row {
  margin-bottom: 24px;
}

.primary-cta,
.secondary-cta {
  min-height: 52px;
  padding: 0 22px;
  font-size: 14px;
}

.primary-cta {
  background: linear-gradient(135deg, #339cff, #1768bd);
  box-shadow: 0 18px 36px rgba(51, 156, 255, 0.28);
  color: #fff;
}

.secondary-cta {
  border: 1px solid rgba(51, 156, 255, 0.28);
  background: rgba(255, 255, 255, 0.7);
  color: #155896;
}

.feature-pills span,
.tool-chips span {
  border: 1px solid rgba(51, 156, 255, 0.18);
  background: rgba(255, 255, 255, 0.76);
  box-shadow: 0 12px 28px rgba(51, 156, 255, 0.08);
  color: #334155;
  font-size: 12px;
}

.feature-pills span {
  border-radius: 999px;
  padding: 8px 12px;
}

.hero-product {
  min-width: 0;
}

.terminal-card {
  overflow: hidden;
  border: 1px solid rgba(15, 23, 42, 0.2);
  border-radius: 20px;
  background: linear-gradient(145deg, #111827 0%, #0f172a 58%, #161b2a 100%);
  box-shadow: 0 28px 70px rgba(15, 23, 42, 0.22);
  color: #e5e7eb;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  line-height: 1.9;
}

.terminal-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 18px 0;
  color: #94a3b8;
}

.window-dots {
  display: flex;
  gap: 7px;
}

.window-dots span {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.window-dots span:nth-child(1) {
  background: #ef4444;
}

.window-dots span:nth-child(2) {
  background: #f59e0b;
}

.window-dots span:nth-child(3) {
  background: #22c55e;
}

.terminal-lines {
  padding: 16px 18px 18px;
  overflow-wrap: anywhere;
}

.terminal-lines .muted {
  color: #94a3b8;
}

.terminal-lines .success {
  color: #86efac;
}

.line-gap {
  height: 8px;
}

.tool-chips {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.tool-chips span {
  border-radius: 13px;
  padding: 13px;
  text-align: center;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 46px;
}

.metric-card {
  border: 1px solid rgba(51, 156, 255, 0.15);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.7);
  padding: 15px;
}

.metric-card strong {
  display: block;
  color: #0f172a;
  font-size: 22px;
  font-weight: 800;
}

.metric-card span {
  color: #64748b;
  font-size: 12px;
}

.home-footer {
  display: flex;
  max-width: 1200px;
  margin: 18px auto 0;
  align-items: center;
  justify-content: center;
  gap: 18px;
  color: #64748b;
  font-size: 13px;
}

@keyframes title-flow {
  0%,
  100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

@keyframes title-shine {
  0%,
  28% {
    background-position: -160% 50%;
    opacity: 0;
  }
  42% {
    opacity: 0.72;
  }
  62% {
    background-position: 160% 50%;
    opacity: 0;
  }
  100% {
    background-position: 160% 50%;
    opacity: 0;
  }
}

@keyframes surface-flow {
  0%,
  100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

@keyframes orb-drift-a {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  50% {
    transform: translate3d(-36px, 28px, 0) scale(1.05);
  }
}

@keyframes orb-drift-b {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  50% {
    transform: translate3d(42px, -24px, 0) scale(1.04);
  }
}

@keyframes surface-sweep {
  0%,
  18% {
    background-position: -130% 50%;
    opacity: 0.55;
  }
  52% {
    opacity: 0.9;
  }
  82%,
  100% {
    background-position: 160% 50%;
    opacity: 0.45;
  }
}

.dark .homepage {
  background: #020617;
}

.dark .hero-shell {
  border-color: rgba(51, 156, 255, 0.22);
  background: linear-gradient(120deg, #0f172a 0%, #111827 42%, #0f2f4f 100%);
  color: #f8fafc;
}

.dark .brand strong,
.dark .hero-copy h1,
.dark .metric-card strong {
  color: #f8fafc;
}

.dark .hero-nav,
.dark .hero-subtitle {
  color: #cbd5e1;
}

.dark .feature-pills span,
.dark .tool-chips span,
.dark .metric-card,
.dark .secondary-cta,
.dark .icon-action:hover {
  border-color: rgba(51, 156, 255, 0.24);
  background: rgba(15, 23, 42, 0.68);
  color: #dbeafe;
}

.dark .metric-card span,
.dark .home-footer {
  color: #94a3b8;
}

@media (max-width: 1024px) {
  .hero-main {
    grid-template-columns: 1fr;
  }

  .hero-product {
    width: 100%;
  }
}

@media (max-width: 820px) {
  .homepage {
    padding: 0;
  }

  .hero-shell {
    padding: 20px;
  }

  .hero-header {
    flex-wrap: wrap;
    margin-bottom: 40px;
  }

  .hero-nav {
    order: 3;
    width: 100%;
    justify-content: flex-start;
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .hero-actions {
    margin-left: auto;
  }

  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .hero-copy h1 {
    font-size: 38px;
  }

  .hero-actions :deep(.locale-switcher),
  .hero-nav,
  .icon-action {
    display: none;
  }

  .hero-cta-row,
  .tool-chips,
  .metric-grid {
    grid-template-columns: 1fr;
  }

  .tool-chips {
    display: grid;
  }

  .primary-cta,
  .secondary-cta {
    width: 100%;
  }

  .home-footer {
    flex-direction: column;
    text-align: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .flowing-title,
  .flowing-title::after,
  .hero-shell,
  .surface-orb-primary,
  .surface-orb-secondary,
  .surface-sweep {
    animation: none;
  }
}
</style>
