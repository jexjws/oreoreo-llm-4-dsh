# oreoreo-llm-4-dsh

DeepSeek Harness（DSH）插件：**一键接入 Oreo 大模型中转站**（`oreoreo.voyage200.top`）。

用户只需填入 API 密钥，插件自动写好 `baseURL`、协议（`openai-responses`）和模型目录，
不需要手动去「自定义模型 API」里逐项填写。

## 为什么需要这个插件

Oreo 中转站有两个特点让它很难手填：

1. **只支持 Responses 协议**（`POST /v1/responses`），已停止支持 `/v1/chat/completions`。
   DSH 的「自定义模型 API」默认选的是 `openai-completions`，选错会直接 503。
2. **模型名是自定义别名**（如 `gpt-astra-contributor`），内置目录里查不到，
   必须手写模型列表、上下文长度、输出上限、图片支持等元数据。

手填一次要改十几个字段、容易漏；这个插件把这些常量固化下来，用户只提供一个密钥。

## 安装

```bash
# 从本地目录链接（离线安装 / 开发）
dsh plugin add -w /path/to/oreoreo-llm-4-dsh

# 从 tarball 安装
dsh plugin add -w /path/to/oreoreo-llm-4-dsh-0.1.0.tgz
```

安装后在 **设置 → 模型 → 第三方模型提供商** 里会出现 `oreoreo` 卡片。

## 使用

1. 打开 **设置 → 模型**
2. 在「第三方模型提供商」中选择 **oreoreo**
3. 填入从 <https://oreoreo.voyage200.top> 获取的 API 密钥（`sk-...`）
4. 保存 —— 插件已写好端点、协议、模型列表

密钥走 DSH 的凭据服务（环境变量 `OREO_OREO_API_KEY`），不会写进配置文件明文。

## 扩展点

插件只用一个槽位：`settings.models.provider-card`，注册 key 是 provider 行的 `settingsNs`（`llm-pi-ai`），
因此该槽位会收到所有 pi-ai 路由，组件内部按路由 id 过滤，只对 `oreoreo` 渲染。

卡片里补充的是卡片自身无法知道的两件事：保存会自动写入端点与模型目录；配置完成后实际生效的协议与端点。
密钥缺失时的提示由卡片本身负责，插件不重复。

## 内置模型目录

默认写入以下 8 个模型，元数据取自上游 `GET /v1/models` 的 `limit` 与 `reasoning.effort`：

| 模型 | 上下文 | 输出 | 思考层级 |
|---|---|---|---|
| `deepseek-flash` | 1,000,000 | 384,000 | low / high / max |
| `gpt-astra-contributor` | 1,050,000 | 128,000 | low / medium / high / xhigh / max |
| `gpt-sol-contributor` | 1,050,000 | 128,000 | low / medium / high / xhigh / max |
| `gpt-terra-contributor` | 1,050,000 | 128,000 | none / low / medium / high / xhigh / max |
| `glm-5.3-flash` | 1,000,000 | 131,072 | low / high / max |
| `muse-spark-1.3-contributor` | 1,048,576 | 131,072 | minimal / low / medium / high / xhigh |
| `minimax-m3.1-flash` | 1,000,000 | 512,000 | low / medium / high / xhigh / max |
| `gemini-4-argon` | 1,048,576 | 65,536 | low / medium / high |

全部支持文本与图片输入。

## 配置

插件挂载在 `llm-pi-ai` 的 `providers` 下，配置写在 profile 的 `cordis.patch.yml` 里：

```yaml
- id: llm-pi-ai
  name: "@deepseek-ai/dsh-llm-pi-ai"
  config:
    providers:
      oreoreo:
        displayName: Oreo
        api: openai-responses
        baseURL: https://oreoreo.voyage200.top/v1
        apiKeyEnv: OREO_OREO_API_KEY
        models:
          - id: deepseek-flash
            contextWindow: 1000000
            maxTokens: 384000
            input: [text, image]
            reasoningEfforts: { low: low, high: high, max: max }
```

`models` 是对象数组，`id` 必须与中转站的模型名完全一致。省略 `models` 时使用内置的 9 个。

## 开发

```bash
npm install
npm run build     # tsc + lib/client.js 包装
npm run typecheck
npm pack          # 生成可分发的 tarball
```

## 许可

MIT
