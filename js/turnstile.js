/**
 * Cloudflare Turnstile helper. Active only when TURNSTILE_SITE_KEY is set in
 * js/supabase-config.js. The token is verified by Supabase Auth itself
 * (Authentication > Attack Protection > Enable CAPTCHA), so the secret key
 * lives only in the Supabase dashboard.
 */
const ZBMTurnstile = {
  widgetId: null,

  siteKey() {
    return typeof TURNSTILE_SITE_KEY !== 'undefined' ? String(TURNSTILE_SITE_KEY || '').trim() : '';
  },

  enabled() {
    return !!this.siteKey();
  },

  mount(el) {
    if (!this.enabled() || !el) return;
    const render = () => {
      this.widgetId = window.turnstile.render(el, { sitekey: this.siteKey(), theme: 'auto' });
    };
    if (window.turnstile) return render();
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
  },

  token() {
    if (this.widgetId === null || !window.turnstile) return undefined;
    return window.turnstile.getResponse(this.widgetId) || undefined;
  },

  reset() {
    if (this.widgetId !== null && window.turnstile) window.turnstile.reset(this.widgetId);
  }
};

window.ZBMTurnstile = ZBMTurnstile;
