/**
 * Oreo (oreoreo.voyage200.top) one-click provider onboarding for DeepSeek Harness.
 *
 * ## What this plugin does
 *
 * The Models settings page lets a user add a "自定义模型 API" (hand-declared
 * route). Doing that by hand for Oreo means getting five things right at once:
 *
 *  1. the endpoint is `https://oreoreo.voyage200.top/v1`, not the bare origin;
 *  2. the wire protocol is `openai-responses` — the station has retired
 *     `/v1/chat/completions`, so the page's default (`openai-completions`)
 *     answers 503;
 *  3. every model id is a house alias (`gpt-astra-contributor`), absent from
 *     pi-ai's installed catalog;
 *  4. each alias needs its own context window, output cap and modality facts,
 *     because nothing can interrogate a gateway for them;
 *  5. the API key reference has to be named, or the profile resolves no
 *     credential.
 *
 * This plugin stores that whole knowledge as configuration, so the user's only
 * input is the key.
 *
 * ## How it plugs in
 *
 * `@deepseek-ai/dsh-llm-pi-ai` is a *dormant* adapter: it holds no routes of
 * its own and registers them the moment a settings section supplies profiles.
 * Its settings namespace is its loader entry id (`llm-pi-ai` by default), and
 * its section shape is `{ providers: { <route>: PiAiProviderProfile } }`.
 *
 * Writing a `providers.oreoreo` profile into that section is therefore enough
 * to make the route live — no `registerAdapter`, no host-side adapter class.
 * The Models page then shows an `oreoreo` row it can edit like any other
 * configurable provider, and the `settings.models.provider-card` extension in
 * `client.ts` decorates it.
 *
 * We deliberately do **not** register our own `LlmAdapter`: that would mean
 * reimplementing streaming, tool calls, retries and the attribution header,
 * and would take the route out of pi-ai's catalog handling. Composing through
 * the existing adapter keeps every future upstream fix.
 *
 * @module oreoreo-llm-4-dsh
 */

import type { Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';

/** Provider route key. Lowercase, no dots: it becomes a settings dict key. */
export const ROUTE = 'oreoreo';

/** Settings namespace of the generic pi-ai adapter (its loader entry id). */
export const PI_AI_NS = 'llm-pi-ai';

/** Credential reference the profile records. Typed keys land here. */
export const API_KEY_ENV = 'OREO_OREO_API_KEY';

/** Endpoint. Includes `/v1`; the adapter appends the operation path. */
export const BASE_URL = 'https://oreoreo.voyage200.top/v1';

/**
 * Wire protocol. `openai-responses` because the station serves
 * `POST /v1/responses` and has retired `/v1/chat/completions`.
 */
export const PROTOCOL = 'openai-responses';

/**
 * One model this route advertises.
 *
 * Every field here exists because pi-ai cannot discover it: a gateway does not
 * publish context sizes, and `discoverModels` on an unknown route only returns
 * ids. Leaving them unset would fall back to the adapter defaults
 * (1,000,000 context / 128,000 output / text-only), which over-claims context
 * on the small models and under-claims vision on the large ones.
 */
export interface OreoModel {
  /** Model id exactly as the station names it. */
  id: string;
  /** Human label shown by model pickers. Defaults to {@link id}. */
  name?: string;
  /** Context window in tokens. */
  contextWindow: number;
  /** Maximum output tokens the model accepts. */
  maxTokens: number;
  /**
   * Input modalities. `['text', 'image']` requires the upstream to accept image
   * parts on this model; claiming it wrongly fails mid-turn, after the message
   * is durable, so only set it where it was measured.
   */
  input?: Array<'text' | 'image'>;
  /**
   * Selectable reasoning efforts: level -> the spelling sent upstream (`null`
   * omits the field for that level). `false` declares a non-reasoning model;
   * omitted inherits the catalog, which for a hand-declared route means "does
   * not reason".
   *
   * This is a dict rather than a list because pi-ai forwards the *value* on the
   * wire: `{low: 'low', high: 'high'}` and `{low: null}` are both meaningful,
   * and a list would silently pick a spelling the endpoint rejects.
   */
  reasoningEfforts?: false | Record<string, string | null>;
}

/**
 * Measured catalogue.
 *
 * Every number here is transcribed from the two upstreams' own model endpoints,
 * not estimated:
 *
 *  - OpenCode Go half (`deepseek-flash`, `glm-5.3-flash`, `muse-spark-1.3`,
 *    `hy4`, `longcat-2.0`, `minimax-m3.1-flash`, `gemini-4-argon`):
 *    `GET https://opencode.ai/inference/go/openai/v1/models` publishes
 *    `limit.{context,output}` and `capabilities.reasoning.effort[]` per model.
 *    Note the effort arrays differ per model — `hy4` offers only
 *    `none`/`high`, `deepseek-flash` only `low`/`high`/`max` — so they are
 *    copied per model rather than shared.
 *  - rota.fans half (the `gpt-*-contributor` aliases): upstream `gpt-6.2-astra`,
 *    `gpt-6.2-sol`, `gpt-6.1-terra` per platform.openai.com/docs/models —
 *    1.05M context, 128K max output, efforts `low|medium|high|xhigh|max`
 *    (terra adds `none`). Terra sits a release behind, hence 6.1.
 *
 * The effort dict maps the level a user picks to the string sent upstream. A
 * level absent from a model's map is a level the model rejects, so do not
 * "normalise" these lists to a common shape.
 */

/** Efforts OpenAI's GPT-6.2 generation accepts. */
const GPT62_EFFORTS = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  xhigh: 'xhigh',
  max: 'max',
} as const;

/** Terra also accepts `none` (thinking off). */
// DSH only knows `off`; the upstream spells no-thinking as `none`, so the
// level key is `off` while the wire value stays whatever upstream expects.
const GPT61_EFFORTS = { off: 'none', ...GPT62_EFFORTS } as const;

export const DEFAULT_MODELS: readonly OreoModel[] = [
  {
    // opencode: limit.context=1000000, limit.output=384000, effort low|high|max
    id: 'deepseek-flash',
    name: 'DeepSeek Flash',
    contextWindow: 1_000_000,
    maxTokens: 384_000,
    input: ['text', 'image'],
    reasoningEfforts: { low: 'low', high: 'high', max: 'max' },
  },
  {
    // rota → gpt-6.2-astra: 1.05M ctx, 128K out, efforts low..max
    id: 'gpt-astra-contributor',
    name: 'GPT Astra (contributor)',
    contextWindow: 1_050_000,
    maxTokens: 128_000,
    input: ['text', 'image'],
    reasoningEfforts: { ...GPT62_EFFORTS },
  },
  {
    // rota → gpt-6.2-sol: same envelope as astra
    id: 'gpt-sol-contributor',
    name: 'GPT Sol (contributor)',
    contextWindow: 1_050_000,
    maxTokens: 128_000,
    input: ['text', 'image'],
    reasoningEfforts: { ...GPT62_EFFORTS },
  },
  {
    // rota → gpt-6.1-terra: adds `none`
    id: 'gpt-terra-contributor',
    name: 'GPT Terra (contributor)',
    contextWindow: 1_050_000,
    maxTokens: 128_000,
    input: ['text', 'image'],
    reasoningEfforts: { ...GPT61_EFFORTS },
  },
  {
    // opencode: 1M ctx, 131072 out, effort low|high|max, text+image(+video)
    id: 'glm-5.3-flash',
    name: 'GLM 5.3 Flash',
    contextWindow: 1_000_000,
    maxTokens: 131_072,
    input: ['text', 'image'],
    reasoningEfforts: { low: 'low', high: 'high', max: 'max' },
  },
  {
    // opencode: 1048576 ctx, 131072 out, effort minimal..xhigh (no max)
    id: 'muse-spark-1.3-contributor',
    name: 'Muse Spark 1.3 (contributor)',
    contextWindow: 1_048_576,
    maxTokens: 131_072,
    input: ['text', 'image'],
    reasoningEfforts: {
      minimal: 'minimal',
      low: 'low',
      medium: 'medium',
      high: 'high',
      xhigh: 'xhigh',
    },
  },
  {
    // opencode: 1M ctx, 512000 out, effort low..max
    id: 'minimax-m3.1-flash',
    name: 'MiniMax M3.1 Flash',
    contextWindow: 1_000_000,
    maxTokens: 512_000,
    input: ['text', 'image'],
    reasoningEfforts: { ...GPT62_EFFORTS },
  },
  {
    // opencode: 1048576 ctx, 65536 out, effort low|medium|high,
    // text+image+video+audio+pdf. Cost 2/10 per 1M (cache read 0.1).
    id: 'gemini-4-argon',
    name: 'Gemini 4 Argon',
    contextWindow: 1_048_576,
    maxTokens: 65_536,
    input: ['text', 'image'],
    reasoningEfforts: { low: 'low', medium: 'medium', high: 'high' },
  },
];

/** Plugin configuration. */
export interface Config {
  /** Endpoint override; defaults to {@link BASE_URL}. */
  baseURL: string;
  /** Name shown by the Models page; defaults to `Oreo`. */
  displayName: string;
  /** Credential reference; defaults to {@link API_KEY_ENV}. */
  apiKeyEnv: string;
  /** Whether {@link apply} writes the profile automatically on first load. */
  autoConfigure: boolean;
  /** Model list; defaults to {@link DEFAULT_MODELS}. */
  models: OreoModel[];
}

/** Runtime schema; defaults are what a bare install runs with. */
export const Config = Schema.object<Config>({
  baseURL: Schema.string().default(BASE_URL).description('Provider endpoint, including /v1.'),
  displayName: Schema.string().default('Oreo').description('Provider name shown in the Models page.'),
  apiKeyEnv: Schema.string()
    .default(API_KEY_ENV)
    .description('Credential reference the profile records; the typed key is stored under it.'),
  autoConfigure: Schema.boolean()
    .default(true)
    .description('Write the provider profile automatically so the route is usable without panel edits.'),
  models: Schema.array(
    Schema.object({
      id: Schema.string().required().description('Model id exactly as the station names it.'),
      name: Schema.string().description('Display label; defaults to the id.'),
      contextWindow: Schema.number().default(128_000).description('Context window in tokens.'),
      maxTokens: Schema.number().default(32_000).description('Maximum output tokens.'),
      input: Schema.array(Schema.union([Schema.const('text'), Schema.const('image')]))
        .default(['text'])
        .description('Accepted input modalities.'),
      // A free-form dict: level name -> wire value. Left loose on purpose so a
      // new upstream spelling needs no plugin release.
      reasoningEfforts: Schema.any().description(
        'Reasoning levels offered for this model, as {level: wireValue}; false for a non-reasoning model.',
      ),
    }),
  )
    .default(DEFAULT_MODELS as OreoModel[])
    .description('Models this route advertises.'),
});

/** Context members this plugin needs before it can do anything. */
export const inject = ['settings'];

/**
 * Build the `providers.<route>` profile from this plugin's config.
 *
 * Kept separate from {@link apply} so it is testable without a Cordis context
 * and so the write path has one shape to validate.
 *
 * @param config - resolved plugin config.
 * @returns the pi-ai provider profile for this route.
 */
export function buildProfile(config: Config): Record<string, unknown> {
  return {
    displayName: config.displayName,
    api: PROTOCOL,
    baseURL: config.baseURL,
    apiKeyEnv: config.apiKeyEnv,
    // Every model declares its own sizes; these two only cover a model the
    // list forgets to size, so they are the conservative floor rather than the
    // adapter's optimistic 1M/128K.
    defaultContextWindow: 128_000,
    defaultMaxTokens: 32_000,
    models: config.models.map((model) => ({
      id: model.id,
      ...(model.name === undefined ? {} : { name: model.name }),
      contextWindow: model.contextWindow,
      maxTokens: model.maxTokens,
      input: model.input ?? ['text'],
      ...(model.reasoningEfforts === undefined
        ? {}
        : { reasoningEfforts: model.reasoningEfforts }),
    })),
  };
}

/** Minimal shape of the settings service this plugin touches. */
interface SettingsLike {
  update(ns: string, patch: object, expectedRevision?: number): Promise<void>;
  describe(options?: { redact?: boolean }): Array<{
    ns: string;
    value: unknown;
    revision: number;
  }>;
}

/**
 * Read the pi-ai section's current `providers` dict.
 *
 * The describe view is redacted (secrets are not returned), which is fine: we
 * only need to know whether our route is already present and what else lives
 * beside it, because a settings write is a merge and must not drop siblings.
 *
 * @param settings - settings service.
 * @returns the providers dict as currently stored, or an empty object.
 */
function readProviders(settings: SettingsLike): Record<string, unknown> {
  const section = settings.describe({ redact: true }).find((entry) => entry.ns === PI_AI_NS);
  const value = section?.value;
  if (value === null || typeof value !== 'object') {
    return {};
  }
  const providers = (value as { providers?: unknown }).providers;
  if (providers === null || typeof providers !== 'object') {
    return {};
  }
  return providers as Record<string, unknown>;
}

/**
 * Write the route profile if it is not already there.
 *
 * Idempotent by design: a second boot must not clobber fields the user edited
 * in the panel (a changed key reference, a hand-added model). We only create
 * the route the first time, and afterwards leave the stored profile alone —
 * the panel is the owner of record once it exists.
 *
 * @param settings - settings service.
 * @param config - resolved plugin config.
 * @returns what happened, for the boot log.
 */
export async function ensureProfile(
  settings: SettingsLike,
  config: Config,
): Promise<'created' | 'present' | 'disabled'> {
  if (!config.autoConfigure) {
    return 'disabled';
  }
  const providers = readProviders(settings);
  if (providers[ROUTE] !== undefined) {
    return 'present';
  }
  await settings.update(PI_AI_NS, { providers: { [ROUTE]: buildProfile(config) } });
  return 'created';
}

/**
 * Plugin entry point.
 *
 * @param ctx - host context.
 * @param config - resolved plugin config.
 */
export function apply(ctx: Context, config: Config): void {
  ctx.inject(['settings'], (child) => {
    const settings = child.get('settings') as unknown as SettingsLike;
    child.effect(() => {
      ensureProfile(settings, config)
        .then((outcome) => {
          if (outcome === 'created') {
            ctx.logger.info(
              `oreoreo-llm-4-dsh: wrote provider route "${ROUTE}" (${config.models.length} models) into ${PI_AI_NS}`,
            );
          } else if (outcome === 'present') {
            ctx.logger.debug(`oreoreo-llm-4-dsh: route "${ROUTE}" already configured; left untouched`);
          }
        })
        .catch((error: unknown) => {
          // A refusal here is usually a stale revision or a read-only profile;
          // the panel still works, so log and keep the composition alive.
          ctx.logger.warn(`oreoreo-llm-4-dsh: could not write route "${ROUTE}": ${String(error)}`);
        });
    }, 'oreoreo-llm-4-dsh: seed provider profile');
  });
}
