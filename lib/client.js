window.__ModuleLoader__.load({
	id: "@voyage200/oreoreo-llm-4-dsh",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		var __dep_0 = require("react/jsx-runtime");
		var _jsxs = __dep_0.jsxs; var _jsx = __dep_0.jsx;
		/** Provider route key; must match the host half. */
		const ROUTE = 'oreoreo';
		/** Inline styles, so the plugin ships no CSS asset to register. */
		const styles = {
		    /** Wrapper: a quiet full-width strip under the card's own controls. */
		    wrap: {
		        display: 'flex',
		        flexDirection: 'column',
		        gap: '6px',
		        marginTop: '10px',
		        paddingTop: '10px',
		        borderTop: '0.5px solid var(--dsw-alias-border-l2)',
		    },
		    line: {
		        display: 'flex',
		        alignItems: 'baseline',
		        flexWrap: 'wrap',
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
		};
		/**
		 * The provider-card extension: what saving does, then the resolved protocol and
		 * endpoint once the route is live.
		 *
		 * @param props - owner share from the Models section.
		 * @returns the extension strip, or nothing for providers that are not ours.
		 */
		function OreoProviderCard(props) {
		    // The seat is keyed by settings namespace, which every pi-ai route shares.
		    if (props.provider.provider !== ROUTE) {
		        return null;
		    }
		    if (props.provider.error !== undefined) {
		        return (_jsx("div", { style: styles.wrap, children: _jsxs("div", { style: { ...styles.line, ...styles.warn }, children: ["\u8DEF\u7531\u914D\u7F6E\u6709\u95EE\u9898\uFF1A", props.provider.error] }) }));
		    }
		    if (!props.configured) {
		        return (_jsx("div", { style: styles.wrap, children: _jsx("div", { style: styles.line, children: "\u4FDD\u5B58\u540E\u4F1A\u81EA\u52A8\u5199\u5165\u7AEF\u70B9\u4E0E\u6A21\u578B\u76EE\u5F55\uFF0C\u53EA\u9700\u586B\u5199 API \u5BC6\u94A5\u3002" }) }));
		    }
		    // The card already warns when the key is missing, with the env var named in
		    // its own placeholder. Nothing to add here.
		    if (!props.keyConfigured) {
		        return null;
		    }
		    return (_jsxs("div", { style: styles.wrap, children: [_jsx("div", { style: { ...styles.line, ...styles.ok }, children: "\u2713 \u5BC6\u94A5\u5DF2\u914D\u7F6E\uFF0C\u53EF\u76F4\u63A5\u5728\u5BF9\u8BDD\u4E2D\u9009\u7528\u672C\u8DEF\u7531\u7684\u6A21\u578B\u3002" }), _jsxs("div", { style: styles.line, children: ["\u534F\u8BAE ", _jsx("code", { style: styles.code, children: "openai-responses" }), "\uFF0C\u7AEF\u70B9 ", _jsx("code", { style: styles.code, children: props.provider.defaultBaseURL ?? 'https://oreoreo.voyage200.top/v1' })] })] }));
		}
		/** Locale namespaces this half registers copy into. */
		const NS = 'oreoOnboarding';
		/**
		 * Browser-half entry point.
		 *
		 * The registration goes through `ctx.slots.inject`, which waits for the target
		 * slot to be *declared* before registering — the declaring package may load
		 * after us, so a bare `register` at module scope would throw.
		 *
		 * @param ctx - client context.
		 */
		function apply(ctx) {
		    // Keyed seat: our `key` is the settings namespace, matching how the section
		    // dispatches (`entryKey = settingsNs`). The component still filters by route.
		    ctx.slots.inject('settings.models.provider-card', () => ctx.slots.register({ name: 'settings.models.provider-card', key: 'llm-pi-ai' }, OreoProviderCard));
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
		const inject = ['slots', 'locale'];

		exports["OreoProviderCard"] = OreoProviderCard;
		exports["NS"] = NS;
		exports["apply"] = apply;
		exports["inject"] = inject;

		return module.exports;
	}
});
