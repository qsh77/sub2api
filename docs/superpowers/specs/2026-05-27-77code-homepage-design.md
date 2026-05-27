# 77code Homepage Design

## Goal

Redesign the default frontend homepage for 77code as an AI coding relay platform. The page should feel close to DragonCode's clean product rhythm and AIGoCode's blue developer-tool energy, without copying either site.

## Brand Direction

- Brand name: `77code`.
- Positioning: AI coding relay platform for developers.
- Core phrase: `开发者首选 AI 编码中转平台`.
- Primary color: `#339CFF`.
- Visual tone: white and very light blue, with restrained flowing blue light. Avoid full dark theme, heavy blue overlays, and decorative clutter.

## Hero Layout

Use a two-column first screen.

Left column:
- Badge: `AI CODING RELAY PLATFORM`.
- Heading:
  - First line: `开发者首选`
  - Second line: `AI 编码中转平台`
- Subtitle: `一个账号、一条稳定线路，统一调用 Claude Code、Codex 和 OpenClaw。更低成本、更稳链路、更透明计费。`
- Primary CTA: `立即体验`
- Secondary CTA: `查看文档`
- Feature pills: `统一密钥`, `会话保持`, `调用明细`, `额度控制`

Right column:
- Neutral dark terminal card, without blue filter.
- Terminal title: `codex setup`
- Code content:

```bash
// 1秒配置 Codex
$ export OPENAI_BASE_URL="https://api.77code.cc"
$ export OPENAI_API_KEY="sk-..."

# 以光速开始编码
$ codex
```

Below terminal:
- Tool chips: `Claude Code`, `Codex`, `OpenClaw`

## Motion

Motion should create a flowing light feel while keeping content still.

Title motion:
- Use gradient text with `background-clip: text`.
- Animate `background-position` slowly.
- Add a subtle highlight sweep on the title only.
- Respect `prefers-reduced-motion`.

Background motion:
- Use a light blue-white gradient surface.
- Add low-opacity blue light spots that drift slowly.
- Add a soft diagonal sweep with very low opacity.
- Do not tint the terminal with blue.

## Metrics Cards

Use four cards below the hero content. Main metric text should be black, not blue.

- `核心用户` / `小规模稳定服务`
- `99.9%` / `服务稳定性`
- `100万+` / `累计调用次数`
- `1v1` / `专属支持`

The intent is to present stable, careful operation rather than exaggerated growth.

## Existing Behavior To Preserve

- Keep custom `home_content` behavior:
  - URL content renders as iframe.
  - HTML content renders as admin-defined content.
- Preserve header actions:
  - language switcher
  - docs link
  - theme toggle
  - login or dashboard routing
- Preserve auth-based CTA behavior:
  - unauthenticated users go to login
  - authenticated users go to dashboard/admin dashboard
- Keep existing dark-mode support reasonable, even though the visual direction is light-first.

## Implementation Notes

- Primary implementation target: `frontend/src/views/HomeView.vue`.
- Keep copy in i18n files when practical.
- Do not add external font dependencies unless necessary.
- Use system sans-serif for the headline.
- Use scoped CSS for the flowing title and background animation.
- Use `prefers-reduced-motion` to disable motion.
- Keep terminal text static; no typing animation is required.

## Acceptance Criteria

- Default homepage matches the v16 design direction.
- `home_content` override still works exactly as before.
- Header language, docs, theme, login, and dashboard actions still work.
- The title and background have subtle flowing motion.
- Terminal card is dark neutral, not blue-filtered.
- Data card primary text is black.
- The page remains responsive on mobile and desktop.
- Build and type checks pass.
