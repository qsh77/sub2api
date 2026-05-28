# 图片生成第一期设计

## 背景

系统已具备 OpenAI 图片网关基础能力，包括 `/v1/images/generations`、`/v1/images/edits`、图片权限、图片计费、图片并发限制和图片用量记录。第一期目标不是重建网关，而是在用户端和管理端提供可用入口。

## 目标

- 用户端提供正式文本生图页面。
- 管理端提供图片生成测试与诊断页面。
- 用户生成时必须选择自己的 API Key。
- 复用现有网关、调度、权限、余额/订阅、并发限制和用量记录。
- 不保存图片历史，不存储生成文件。

## 不做范围

- 不做图片编辑、参考图上传、mask 编辑。
- 不新增图库、任务表、对象存储。
- 不新增 JWT 生图接口。
- 不绕开现有 API Key 网关链路。

## 用户端设计

新增页面：

```text
/images
菜单：图片生成
```

页面包含：

- API Key 选择。
- 模型选择。
- 尺寸选择：1K、2K、4K。
- 数量选择：1-4。
- Prompt 输入。
- 生成按钮。
- 图片预览、下载、清空结果。

API Key 规则：

- 读取当前用户 API Key 列表。
- 只展示 active Key。
- 选择后显示分组名、平台、状态。
- 分组禁用图片生成时禁用生成按钮。
- 没有可用 Key 时引导用户创建 API Key。

## 管理端设计

新增页面：

```text
/admin/images
菜单：图片生成
```

页面定位为测试与诊断，包含：

- API Key 选择。
- 模型选择。
- 尺寸选择。
- 数量选择。
- Prompt 输入。
- 生成按钮。
- 图片预览、下载。
- 本次请求信息：模型、API Key、分组、耗时。
- 原始错误信息展示。

第一期管理端同样通过 API Key 调用 `/v1/images/generations`，确保测试路径与真实用户路径一致。

## 请求设计

新增前端请求模块：

```text
frontend/src/api/imageGeneration.ts
```

该模块不使用普通 `apiClient`，而是直接请求网关：

```http
POST /v1/images/generations
x-api-key: <selected key>
Content-Type: application/json
```

第一期请求体：

```json
{
  "model": "gpt-image-1",
  "prompt": "...",
  "size": "1024x1024",
  "n": 1,
  "response_format": "b64_json"
}
```

结果兼容：

- 优先处理 `b64_json`，转为 `data:image/png;base64,...` 展示和下载。
- 若返回 URL，也可直接预览和下载。
- 结果仅保存在当前页面内存中。

## 模型与尺寸

模型来源优先级：

1. 从用户可用渠道/模型中过滤图片计费模型。
2. 无可用数据时使用默认列表：

```text
gpt-image-1
gpt-image-1.5
gpt-image-2
```

尺寸映射：

```text
1K -> 1024x1024
2K -> 1536x1536
4K -> 2048x2048
```

## 权限与计费

复用现有分组字段：

```text
allow_image_generation
image_rate_independent
image_rate_multiplier
image_price_1k
image_price_2k
image_price_4k
```

复用现有后端链路：

- API Key 认证。
- 分组图片权限校验。
- 账号调度。
- 图片并发限制。
- 内容审核。
- 余额/订阅检查。
- 图片用量记录。
- 图片成本计算。

## 错误处理

前端按后端错误展示明确提示：

- API Key 无效、停用或过期：提示更换 Key。
- 分组不允许图片生成：提示更换分组或联系管理员。
- 余额或订阅不可用：提示充值或购买订阅。
- 无可用账号：提示稍后重试。
- 并发限制：提示当前生成繁忙。
- 内容审核失败：展示后端原因。
- 其他错误：展示后端 message。

## 前端改动范围

新增：

```text
frontend/src/views/user/ImageGenerationView.vue
frontend/src/views/admin/ImageGenerationView.vue
frontend/src/api/imageGeneration.ts
```

修改：

```text
frontend/src/router/index.ts
frontend/src/components/layout/AppSidebar.vue
frontend/src/i18n/locales/zh.ts
frontend/src/i18n/locales/en.ts
```

## 后端改动范围

第一期不改图片网关核心。

如前端需要的 API Key 分组字段不足，只补充 DTO 映射，不新增业务接口。

现有相关入口：

```text
backend/internal/server/routes/gateway.go
backend/internal/handler/openai_images.go
backend/internal/service/openai_images.go
```

## 测试

前端测试：

- 无 API Key 时显示空状态。
- 不允许图片生成的分组禁用生成按钮。
- `b64_json` 结果能展示和下载。
- URL 结果能展示。
- 网关错误能正确展示。
- 管理端能选择 Key 并发起测试。

后端测试：

- 未改后端时运行现有图片网关相关测试。
- 若补 DTO 字段，增加 mapper 或接口测试。

## 验收标准

- 用户能在 `/images` 选择 API Key 并完成文本生图。
- 管理员能在 `/admin/images` 通过 API Key 测试图片生成。
- 生成图片不落库、不上传、不保留历史。
- 成功请求会进入现有图片用量记录。
- 分组图片权限、余额/订阅和并发限制仍由现有后端控制。
