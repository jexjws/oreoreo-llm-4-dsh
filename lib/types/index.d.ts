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
/** Provider route key. Lowercase, no dots: it becomes a settings dict key. */
export declare const ROUTE = "oreoreo";
/** Settings namespace of the generic pi-ai adapter (its loader entry id). */
export declare const PI_AI_NS = "llm-pi-ai";
/** Credential reference the profile records. Typed keys land here. */
export declare const API_KEY_ENV = "OREO_OREO_API_KEY";
/** Endpoint. Includes `/v1`; the adapter appends the operation path. */
export declare const BASE_URL = "https://oreoreo.voyage200.top/v1";
/**
 * Wire protocol. `openai-responses` because the station serves
 * `POST /v1/responses` and has retired `/v1/chat/completions`.
 */
export declare const PROTOCOL = "openai-responses";
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
export declare const DEFAULT_MODELS: readonly OreoModel[];
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
export declare const Config: import("@deepseek-ai/schemastery").ObjectConfig<Config>;
/** Context members this plugin needs before it can do anything. */
export declare const inject: string[];
/**
 * Build the `providers.<route>` profile from this plugin's config.
 *
 * Kept separate from {@link apply} so it is testable without a Cordis context
 * and so the write path has one shape to validate.
 *
 * @param config - resolved plugin config.
 * @returns the pi-ai provider profile for this route.
 */
export declare function buildProfile(config: Config): Record<string, unknown>;
/** Minimal shape of the settings service this plugin touches. */
interface SettingsLike {
    update(ns: string, patch: object, expectedRevision?: number): Promise<void>;
    describe(options?: {
        redact?: boolean;
    }): Array<{
        ns: string;
        value: unknown;
        revision: number;
    }>;
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
export declare function ensureProfile(settings: SettingsLike, config: Config): Promise<'created' | 'present' | 'disabled'>;
/**
 * Plugin entry point.
 *
 * @param ctx - host context.
 * @param config - resolved plugin config.
 */
export declare function apply(ctx: Context, config: Config): void;
export {};
