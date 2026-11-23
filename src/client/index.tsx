/**
 * Browser half: the Models-page provider-card extension.
 *
 * `@deepseek-ai/dsh-client-ui-settings-models` declares the
 * `settings.models.provider-card` seat and renders it on every provider card.
 * Registering into it needs nothing from that package at runtime except the
 * slot key itself — a registrant is a plain React component receiving the
 * owner's props share.
 *
 * ## Why the card extension, and what it is allowed to say
 *
 * The seat is **keyed by `settingsNs`**, not by provider route: every
 * pi-ai-configured route shares one namespace, so a registration under
 * `llm-pi-ai` receives *all* of them. We therefore re-check the route id inside
 * the component and render nothing for any other provider — otherwise our hint
 * would appear on every third-party model card the user owns.
 *
 * ## Say only what the card cannot say itself
 *
 * The card already renders its own API-key warning, and its own key input
 * placeholder already names the env var. Repeating either here is noise on top
 * of a message the user is already reading, so this component stays silent in
 * those states. What it adds instead are the two facts the card has no way to
 * know: that saving writes the endpoint and catalog automatically, and — once
 * configured — which protocol and endpoint the route ended up with.
 *
 * There is deliberately no "verify connection" action: the section exposes no
 * arbitrary-endpoint fetch to a plugin, and a plugin-invented probe would use a
 * different code path from the real request, so a green tick could still be
 * followed by a failed turn.
 *
 * @module oreoreo-llm-4-dsh/client
 */

import type { ReactNode } from 'react';

/** Provider route key; must match the host half. */
const ROUTE = 'oreoreo';

/**
 * Owner share of one `settings.models.provider-card` occurrence, as the Models
 * section supplies it. Mirrored here rather than imported so this file has no
 * runtime dependency on the declaring package.
 */
interface ProviderCardOwnerProps {
  /** The card's directory row. */
  provider: {
    /** Provider route id — `oreoreo` for ours. */
    readonly provider: string;
    /** Display name the card shows. */
    readonly displayName: string;
    /** Settings namespace the row is configured through. */
    readonly settingsNs: string;
    /** Endpoint the adapter falls back to when the profile sets none. */
    readonly defaultBaseURL?: string;
    /** Whether this route exists only because configuration declared it. */
    readonly declared?: boolean;
    /** Configuration diagnostic for repair. */
    readonly error?: string;
  };
  /** Whether any layer configures this provider. */
  readonly configured: boolean;
  /** Whether the referenced api-key credential is confirmed configured. */
  readonly keyConfigured: boolean;
}

/** Inline styles, so the plugin ships no CSS asset to register. */
const styles = {
  /** Wrapper: a quiet full-width strip under the card's own controls. */
  wrap: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    marginTop: '10px',
    paddingTop: '10px',
    borderTop: '0.5px solid var(--dsw-alias-border-l2)',
  },
  line: {
    display: 'flex',
    alignItems: 'baseline',
    flexWrap: 'wrap' as const,
    gap: '8px',
    fontSize: '12px',
    lineHeight: '18px',
    color: 'var(--dsw-alias-label-tertiary)',
  },
  ok: {
    color: 'var(--dsw-alias-state-success-primary)',
  },
  warn: {
    color: 'var(--dsw-alias-state-warn-label)',
  },
  code: {
    fontFamily: 'var(--ds-font-family-code)',
    fontSize: '11px',
    padding: '1px 5px',
    borderRadius: 'var(--dsw-radius-xs)',
    border: '0.5px solid var(--dsw-alias-border-l3)',
    color: 'var(--dsw-alias-label-secondary)',
  },
} as const;

/**
 * The provider-card extension: what saving does, then the resolved protocol and
 * endpoint once the route is live.
 *
 * @param props - owner share from the Models section.
 * @returns the extension strip, or nothing for providers that are not ours.
 */
export function OreoProviderCard(props: ProviderCardOwnerProps): ReactNode {
  // The seat is keyed by settings namespace, which every pi-ai route shares.
  if (props.provider.provider !== ROUTE) {
    return null;
  }

  if (props.provider.error !== undefined) {
    return (
      <div style={styles.wrap}>
        <div style={{ ...styles.line, ...styles.warn }}>
          路由配置有问题：{props.provider.error}
        </div>
      </div>
    );
  }

  if (!props.configured) {
    return (
      <div style={styles.wrap}>
        <div style={styles.line}>
          保存后会自动写入端点与模型目录，只需填写 API 密钥。
        </div>
      </div>
    );
  }

  // The card already warns when the key is missing, with the env var named in
  // its own placeholder. Nothing to add here.
  if (!props.keyConfigured) {
    return null;
  }

  return (
    <div style={styles.wrap}>
      <div style={{ ...styles.line, ...styles.ok }}>
        ✓ 密钥已配置，可直接在对话中选用本路由的模型。
      </div>
      <div style={styles.line}>
        协议 <code style={styles.code}>openai-responses</code>
        ，端点 <code style={styles.code}>{props.provider.defaultBaseURL ?? 'https://oreoreo.voyage200.top/v1'}</code>
      </div>
    </div>
  );
}

/** Locale namespaces this half registers copy into. */
export const NS = 'oreoOnboarding';

/**
 * Browser-half entry point.
 *
 * The registration goes through `ctx.slots.inject`, which waits for the target
 * slot to be *declared* before registering — the declaring package may load
 * after us, so a bare `register` at module scope would throw.
 *
 * @param ctx - client context.
 */
export function apply(ctx: {
  slots: {
    inject(name: string, register: () => unknown): void;
    register(
      options: {
        name: string;
        key?: string;
        id?: string;
        order?: number;
        label?: string | (() => string);
      },
      component: unknown,
    ): () => void;
  };
  effect(fn: () => (() => void) | void, label?: string): void;
}): void {
  // Keyed seat: our `key` is the settings namespace, matching how the section
  // dispatches (`entryKey = settingsNs`). The component still filters by route.
  ctx.slots.inject('settings.models.provider-card', () =>
    ctx.slots.register({ name: 'settings.models.provider-card', key: 'llm-pi-ai' }, OreoProviderCard),
  );
}

/**
 * Service dependencies this half needs on its `ctx` before `apply()` runs.
 *
 * `slots` is the important one and the one that is easy to miss: the
 * `package.json` `dsh.client.inject` list only orders *plugin activation*; this
 * list is what actually puts services on the context. Without `slots` here,
 * `ctx.slots` is undefined, `ctx.slots.inject(...)` throws inside `apply()`, the
 * error is swallowed by the activation boundary, and the plugin looks loaded
 * while registering nothing — the exact silent failure this file hit.
 */
export const inject = ['slots', 'locale'];
