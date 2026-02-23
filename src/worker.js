/**
 * Hanzo.id Cloudflare Worker
 * Routes authentication paths to Login app, API paths to IAM, everything else to marketing site
 * Features: Two-pane login, social/web3 auth, dynamic app portal, signup
 */

// IAM backend
const IAM_ORIGIN = 'https://iam.hanzo.ai';
const MARKETING_ORIGIN = 'https://hanzo-id.pages.dev';

// Client ID → application/organization map.
// Casdoor's /api/get-app-login is broken for our version, so we maintain this
// as a fallback for social login callback processing.
const CLIENT_APP_MAP = {
  'hanzo-platform-client-id': { application: 'app-platform', organization: 'hanzo' },
  'hanzo-app-client-id': { application: 'app-hanzo', organization: 'hanzo' },
  'hanzo-console-client-id': { application: 'app-console', organization: 'hanzo' },
  'hanzo-cloud-client-id': { application: 'app-cloud', organization: 'hanzo' },
  'hanzo-kms-client-id': { application: 'app-kms', organization: 'hanzo' },
  'hanzo-commerce-client-id': { application: 'app-commerce', organization: 'hanzo' },
  'hanzo-flow-client-id': { application: 'app-flow', organization: 'hanzo' },
  'hanzo-team-client-id': { application: 'app-team', organization: 'hanzo' },
  'hanzo-auto-client-id': { application: 'app-auto', organization: 'hanzo' },
  'hanzobot-client-id': { application: 'app-hanzobot', organization: 'hanzo' },
  'adnexus-app-client-id': { application: 'app-adnexus', organization: 'adnexus' },
  'lux-app-client-id': { application: 'app-lux', organization: 'lux' },
  'zoo-app-client-id': { application: 'app-zoo', organization: 'zoo' },
  'pars-app-client-id': { application: 'app-pars', organization: 'pars' },
};

// ── Per-org branding ──────────────────────────────────────────────────
const ORG_BRANDS = {
  hanzo: {
    displayName: 'Hanzo',
    orgId: 'hanzo',
    accentColor: '#ffffff',
    accentColorRgb: '255, 255, 255',
    gradientEnd: '#0a0a0a',
    logoSvg: `<svg viewBox="0 0 67 67" xmlns="http://www.w3.org/2000/svg" aria-label="Hanzo" role="img">
      <path d="M22.21 67V44.6369H0V67H22.21Z" fill="#ffffff"/>
      <path d="M0 44.6369L22.21 46.8285V44.6369H0Z" fill="#DDDDDD"/>
      <path d="M66.7038 22.3184H22.2534L0.0878906 44.6367H44.4634L66.7038 22.3184Z" fill="#ffffff"/>
      <path d="M22.21 0H0V22.3184H22.21V0Z" fill="#ffffff"/>
      <path d="M66.7198 0H44.5098V22.3184H66.7198V0Z" fill="#ffffff"/>
      <path d="M66.6753 22.3185L44.5098 20.0822V22.3185H66.6753Z" fill="#DDDDDD"/>
      <path d="M66.7198 67V44.6369H44.5098V67H66.7198Z" fill="#ffffff"/>
    </svg>`,
    faviconUrl: 'https://cdn.hanzo.ai/img/favicon.png',
    websiteUrl: 'https://hanzo.ai',
    tagline: 'Build the future<br>with <span>AI</span>',
    subtitle: 'The unified platform for AI infrastructure, identity, and compute. Powering the next generation of intelligent applications.',
    features: [
      'LLM Gateway &mdash; 100+ providers, one API',
      'Model Context Protocol &mdash; 260+ tools',
      'Agent Framework &mdash; multi-agent orchestration',
      '<a href="https://hanzo.network" style="color:inherit;text-decoration:none;">Hanzo Network</a> &mdash; decentralized AI compute',
    ],
  },
  lux: {
    displayName: 'Lux',
    orgId: 'lux',
    accentColor: '#ffffff',
    accentColorRgb: '255, 255, 255',
    gradientEnd: '#0a0a0a',
    logoSvg: `<svg viewBox="0 0 120 40" xmlns="http://www.w3.org/2000/svg" aria-label="Lux" role="img">
      <text x="0" y="32" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="36" font-weight="700" fill="#ffffff" letter-spacing="-1">Lux</text>
    </svg>`,
    faviconUrl: 'https://cdn.lux.network/img/favicon.ico',
    websiteUrl: 'https://lux.network',
    tagline: 'The future of<br><span>blockchain</span>',
    subtitle: 'Multi-consensus blockchain with post-quantum cryptography and high-performance validators. Secure, scalable, interoperable.',
    features: [
      'Multi-consensus &mdash; Snow, Tendermint, Nakamoto',
      'Post-quantum cryptography &mdash; future-proof security',
      'Sub-second finality &mdash; 4500+ TPS',
      '<a href="https://cloud.lux.network" style="color:inherit;text-decoration:none;">Lux Cloud</a> &mdash; validator management',
    ],
  },
  zoo: {
    displayName: 'Zoo',
    orgId: 'zoo',
    accentColor: '#ffffff',
    accentColorRgb: '255, 255, 255',
    gradientEnd: '#0a0a0a',
    logoSvg: `<svg viewBox="0 0 120 40" xmlns="http://www.w3.org/2000/svg" aria-label="Zoo" role="img">
      <text x="0" y="32" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="36" font-weight="700" fill="#ffffff" letter-spacing="-1">Zoo</text>
    </svg>`,
    faviconUrl: 'https://cdn.zoo.ngo/img/logo-white.svg',
    websiteUrl: 'https://zoo.ngo',
    tagline: 'Open <span>AI</span><br>research network',
    subtitle: 'Decentralized AI research and science. Community-driven experiments, governance, and breakthrough discoveries.',
    features: [
      'Decentralized AI &mdash; open training & inference',
      'DeSci &mdash; decentralized science infrastructure',
      'ZIPs &mdash; community governance proposals',
      '<a href="https://zips.zoo.ngo" style="color:inherit;text-decoration:none;">Zoo Foundation</a> &mdash; 501(c)(3) research',
    ],
  },
  pars: {
    displayName: 'Pars',
    orgId: 'pars',
    accentColor: '#ffffff',
    accentColorRgb: '255, 255, 255',
    gradientEnd: '#0a0a0a',
    logoSvg: `<svg viewBox="0 0 120 40" xmlns="http://www.w3.org/2000/svg" aria-label="Pars" role="img">
      <text x="0" y="32" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="36" font-weight="700" fill="#ffffff" letter-spacing="-1">Pars</text>
    </svg>`,
    faviconUrl: 'https://cdn.pars.network/img/logo-white.svg',
    websiteUrl: 'https://pars.network',
    tagline: 'Intelligent<br><span>identity</span>',
    subtitle: 'AI-powered identity verification and access management. Secure, private, and seamless authentication for the modern web.',
    features: [
      'AI verification &mdash; intelligent identity checks',
      'Privacy-first &mdash; zero-knowledge proofs',
      'Multi-factor &mdash; biometric, hardware, social',
      '<a href="https://pars.network" style="color:inherit;text-decoration:none;">Pars AI</a> &mdash; next-gen identity platform',
    ],
  },
};

// Domain → org key mapping
const DOMAIN_ORG_MAP = {
  'hanzo.id': 'hanzo',
  'lux.id': 'lux',
  'id.lux.network': 'lux',
  'iam.lux.network': 'lux',
  'zoo.id': 'zoo',
  'id.zoo.network': 'zoo',
  'id.zoo.ngo': 'zoo',
  'pars.id': 'pars',
  'id.pars.network': 'pars',
};

function getOrgBrand(hostname) {
  const orgKey = DOMAIN_ORG_MAP[hostname];
  return ORG_BRANDS[orgKey] || ORG_BRANDS.hanzo;
}

// Paths that go to the custom login/signup/forgot pages
const LOGIN_PATHS = [
  '/login',
  '/signup',
  '/forget',
];

// Paths that should be proxied to IAM backend
const IAM_PATHS = [
  '/api/',
  '/oauth/',
  '/login/oauth/',
  '/result',
  '/cas/',
  '/scim/',
  '/.well-known/',
  '/static/',
  '/img/',
];

function shouldServeLogin(pathname) {
  return LOGIN_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
}

function shouldProxyToIAM(pathname) {
  return IAM_PATHS.some(p => pathname.startsWith(p));
}

const CONSOLE_URL = 'https://console.hanzo.ai';

// Hanzo apps available for SSO
const HANZO_APPS = [
  {
    id: 'console',
    name: 'Console',
    description: 'AI observability, tracing, evals & prompt management',
    url: 'https://console.hanzo.ai',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
    color: '#a78bfa',
  },
  {
    id: 'chat',
    name: 'Chat',
    description: 'AI chat with MCP tools & multi-model support',
    url: 'https://chat.hanzo.ai',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    color: '#34d399',
  },
  {
    id: 'platform',
    name: 'Platform',
    description: 'Deploy & manage applications at scale',
    url: 'https://platform.hanzo.ai',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
    color: '#f472b6',
  },
  {
    id: 'studio',
    name: 'Studio',
    description: 'Visual AI workflow builder & node editor',
    url: 'https://studio.hanzo.ai',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
    color: '#fbbf24',
  },
  {
    id: 'search',
    name: 'Search',
    description: 'AI-powered search with generative UI',
    url: 'https://search.hanzo.ai',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    color: '#60a5fa',
  },
  {
    id: 'kms',
    name: 'Secrets',
    description: 'Manage secrets, encryption keys & credentials',
    url: 'https://kms.hanzo.ai',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
    color: '#f59e0b',
  },
  {
    id: 'docs',
    name: 'Docs',
    description: 'API documentation, guides & references',
    url: 'https://docs.hanzo.ai',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
    color: '#94a3b8',
  },
];

const HANZO_LOGO_SVG = `<svg viewBox="0 0 67 67" xmlns="http://www.w3.org/2000/svg" aria-label="Hanzo logo" role="img">
  <path d="M22.21 67V44.6369H0V67H22.21Z" fill="#ffffff"/>
  <path d="M0 44.6369L22.21 46.8285V44.6369H0Z" fill="#DDDDDD"/>
  <path d="M66.7038 22.3184H22.2534L0.0878906 44.6367H44.4634L66.7038 22.3184Z" fill="#ffffff"/>
  <path d="M22.21 0H0V22.3184H22.21V0Z" fill="#ffffff"/>
  <path d="M66.7198 0H44.5098V22.3184H66.7198V0Z" fill="#ffffff"/>
  <path d="M66.6753 22.3185L44.5098 20.0822V22.3185H66.6753Z" fill="#DDDDDD"/>
  <path d="M66.7198 67V44.6369H44.5098V67H66.7198Z" fill="#ffffff"/>
</svg>`;

// Google icon SVG
const GOOGLE_ICON = `<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>`;

const GITHUB_ICON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/></svg>`;

const WALLET_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`;

// Shared CSS — parameterized by accent color
function getSharedCSS(brand) {
  const ac = brand.accentColor;
  const acRgb = brand.accentColorRgb;
  const gradEnd = brand.gradientEnd;
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      background: #050508;
      color: #fff;
      min-height: 100vh;
    }
    a { cursor: pointer; }
    .container {
      display: flex;
      min-height: 100vh;
    }
    .brand-pane {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 4rem;
      background: linear-gradient(135deg, #0a0a12 0%, #050508 50%, ${gradEnd} 100%);
      border-right: 1px solid rgba(255,255,255,0.06);
      position: relative;
      overflow: hidden;
    }
    .brand-pane::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle at 30% 70%, rgba(${acRgb}, 0.08) 0%, transparent 60%);
      pointer-events: none;
    }
    .brand-logo img { height: 48px; width: auto; margin-bottom: 2rem; }
    .brand-logo svg { height: 48px; width: 48px; margin-bottom: 2rem; }
    .brand-title {
      font-size: 2.5rem;
      font-weight: 700;
      line-height: 1.2;
      margin-bottom: 1rem;
      letter-spacing: -0.02em;
    }
    .brand-title span { color: ${ac}; }
    .brand-subtitle {
      font-size: 1.1rem;
      color: #888;
      line-height: 1.6;
      max-width: 400px;
    }
    .brand-features {
      margin-top: 3rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .brand-feature {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      color: #999;
      font-size: 0.9rem;
    }
    .brand-feature .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: ${ac};
      flex-shrink: 0;
    }
    .auth-pane {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .auth-card {
      width: 100%;
      max-width: 400px;
    }
    .auth-header {
      margin-bottom: 2rem;
    }
    .auth-header h2 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    .auth-header p {
      color: #666;
      font-size: 0.9rem;
    }
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      width: 100%;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      border: 1px solid #222;
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
      text-decoration: none;
      color: #fff;
      background: #0c0c10;
    }
    .btn:hover {
      background: #151518;
      border-color: #333;
    }
    .btn-primary {
      background: ${ac};
      color: #000;
      border-color: ${ac};
      font-weight: 600;
    }
    .btn-primary:hover {
      opacity: 0.9;
    }
    .btn svg, .btn img {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }
    .btn-web3 {
      background: linear-gradient(135deg, #1a1a2e, #16213e);
      border-color: #2a2a4a;
    }
    .btn-web3:hover { border-color: ${ac}; }
    .social-buttons {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }
    .divider {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin: 1.5rem 0;
      color: #444;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .divider::before, .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #222;
    }
    .form-group {
      margin-bottom: 1rem;
    }
    .form-group label {
      display: block;
      font-size: 0.8rem;
      color: #888;
      margin-bottom: 0.4rem;
      font-weight: 500;
    }
    .form-group input {
      width: 100%;
      padding: 0.7rem 0.9rem;
      border-radius: 8px;
      border: 1px solid #222;
      background: #0c0c10;
      color: #fff;
      font-size: 0.9rem;
      outline: none;
      transition: border-color 0.15s;
    }
    .form-group input:focus { border-color: ${ac}; }
    .form-group input::placeholder { color: #444; }
    .error-msg {
      color: #ef4444;
      font-size: 0.85rem;
      margin-bottom: 1rem;
      display: none;
    }
    .success-msg {
      color: #34d399;
      font-size: 0.85rem;
      margin-bottom: 1rem;
      display: none;
    }
    .footer-links {
      margin-top: 2rem;
      text-align: center;
      font-size: 0.85rem;
      color: #666;
    }
    .footer-links a {
      color: ${ac};
      text-decoration: none;
      cursor: pointer;
    }
    .footer-links a:hover { text-decoration: underline; }
    .forgot-link {
      display: block;
      text-align: right;
      font-size: 0.8rem;
      color: #888;
      text-decoration: none;
      margin-top: 0.25rem;
      cursor: pointer;
    }
    .forgot-link:hover { color: ${ac}; }
    .app-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.25rem 0.6rem;
      border-radius: 6px;
      background: rgba(${acRgb}, 0.1);
      border: 1px solid rgba(${acRgb}, 0.2);
      font-size: 0.75rem;
      color: ${ac};
      margin-bottom: 1rem;
    }
    .app-badge svg { width: 12px; height: 12px; }
    .loading { opacity: 0.6; pointer-events: none; }
    @media (max-width: 768px) {
      .container { flex-direction: column; }
      .brand-pane {
        padding: 2rem;
        border-right: none;
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .brand-title { font-size: 1.75rem; }
      .brand-features { display: none; }
      .auth-pane { padding: 2rem; }
    }
`;
}

// Brand pane HTML — parameterized by org brand
function getBrandPaneHTML(brand) {
  const features = brand.features.map(f => `        <div class="brand-feature"><span class="dot"></span> ${f}</div>`).join('\n');
  return `
    <div class="brand-pane">
      <div class="brand-logo">${brand.logoSvg}</div>
      <h1 class="brand-title">${brand.tagline}</h1>
      <p class="brand-subtitle">${brand.subtitle}</p>
      <div class="brand-features">
${features}
      </div>
    </div>`;
}

// ── Portal page ──────────────────────────────────────────────────────
function getPortalPage(brand) {
  const appCards = HANZO_APPS.map(app => `
        <a class="app-card" href="${app.url}">
          <div class="app-icon" style="color: ${app.color}; border-color: ${app.color}33;">
            ${app.icon}
          </div>
          <div class="app-info">
            <div class="app-name">${app.name}</div>
            <div class="app-desc">${app.description}</div>
          </div>
          <svg class="app-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </a>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${brand.displayName} ID - Your Apps</title>
  <link rel="icon" type="image/png" href="${brand.faviconUrl}" />
  <style>
    ${getSharedCSS(brand)}
    .portal-card { width: 100%; max-width: 480px; }
    .portal-header { margin-bottom: 1.5rem; }
    .portal-header h2 { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.5rem; }
    .portal-header p { color: #666; font-size: 0.9rem; }
    .app-grid { display: flex; flex-direction: column; gap: 0.5rem; }
    .app-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      border-radius: 10px;
      border: 1px solid #1a1a1f;
      background: #0a0a0f;
      text-decoration: none;
      color: #fff;
      cursor: pointer;
      transition: all 0.15s;
    }
    .app-card:hover {
      background: #111116;
      border-color: #2a2a35;
      transform: translateX(2px);
    }
    .app-icon {
      width: 40px; height: 40px;
      border-radius: 10px;
      border: 1px solid;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      background: rgba(0,0,0,0.3);
    }
    .app-icon svg { width: 20px; height: 20px; }
    .app-info { flex: 1; min-width: 0; }
    .app-name { font-weight: 600; font-size: 0.95rem; margin-bottom: 0.15rem; }
    .app-desc { color: #666; font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .app-arrow { width: 16px; height: 16px; color: #444; flex-shrink: 0; transition: color 0.15s; }
    .app-card:hover .app-arrow { color: #888; }
    .portal-footer {
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid #1a1a1f;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .portal-footer a { font-size: 0.85rem; color: #666; text-decoration: none; cursor: pointer; transition: color 0.15s; }
    .portal-footer a:hover { color: ${brand.accentColor}; }
    @media (max-width: 768px) {
      .auth-pane { padding: 1.5rem; }
      .portal-card { max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="container">
    ${getBrandPaneHTML(brand)}
    <div class="auth-pane">
      <div class="portal-card">
        <div class="portal-header">
          <h2>Your Apps</h2>
          <p>Sign in to any ${brand.displayName} service with your account</p>
        </div>
        <div class="app-grid">
${appCards}
        </div>
        <div class="portal-footer">
          <a href="/login?prompt=login">Sign in with a different account</a>
          <a href="${brand.websiteUrl}">${brand.websiteUrl.replace('https://', '')}</a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ── Sign In page ─────────────────────────────────────────────────────
function getLoginPage(url, brand) {
  const params = new URL(url);
  const clientId = params.searchParams.get('client_id') || '';
  const redirectUri = params.searchParams.get('redirect_uri') || '';
  const state = params.searchParams.get('state') || '';
  const scope = params.searchParams.get('scope') || 'openid profile email';

  let appName = brand.displayName;
  if (redirectUri) {
    try {
      const rdHost = new URL(redirectUri).hostname;
      const match = HANZO_APPS.find(a => new URL(a.url).hostname === rdHost);
      if (match) appName = brand.displayName + ' ' + match.name;
    } catch {}
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign In - ${appName}</title>
  <link rel="icon" type="image/png" href="${brand.faviconUrl}" />
  <style>${getSharedCSS(brand)}</style>
</head>
<body>
  <div class="container">
    ${getBrandPaneHTML(brand)}
    <div class="auth-pane">
      <div class="auth-card">
        <div class="auth-header">
          ${redirectUri ? `<div class="app-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Signing in to ${appName}</div>` : ''}
          <h2>Sign in to ${brand.displayName}</h2>
          <p>Choose your preferred sign-in method</p>
        </div>
        <div class="social-buttons">
          <a class="btn" id="btn-google" href="#">${GOOGLE_ICON} Continue with Google</a>
          <a class="btn" id="btn-github" href="#">${GITHUB_ICON} Continue with GitHub</a>
        </div>
        <div class="social-buttons">
          <a class="btn btn-web3" id="btn-wallet" href="#">${WALLET_ICON} Connect Wallet</a>
        </div>
        <div class="divider">or continue with email</div>
        <div id="error-msg" class="error-msg"></div>
        <form id="loginForm">
          <div class="form-group">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.35rem;">
              <label id="login-contact-label" for="email" style="margin:0;">Email address</label>
              <button type="button" id="login-contact-toggle" style="background:none;border:1px solid #333;color:#888;font-size:0.78em;padding:0.2rem 0.55rem;border-radius:4px;cursor:pointer;">Use phone</button>
            </div>
            <input type="email" id="email" name="email" placeholder="you@company.com" required autocomplete="email" />
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" placeholder="Enter your password" required autocomplete="current-password" />
            <a class="forgot-link" href="/forget">Forgot password?</a>
          </div>
          <button type="submit" class="btn btn-primary" id="submitBtn" style="margin-top: 1rem; border: none;">Sign in</button>
        </form>
        <div class="footer-links">
          <p>Don&rsquo;t have an account? <a href="/signup">Sign up</a></p>
        </div>
      </div>
    </div>
  </div>
  <script>
    (function() {
      var origin = window.location.origin;
      var oauthParams = new URLSearchParams(window.location.search);
      function pickAuthParam(snakeCase, camelCase, fallback) {
        return oauthParams.get(snakeCase) || oauthParams.get(camelCase) || fallback || '';
      }

      var clientId = pickAuthParam('client_id', 'clientId', '${clientId}') || 'hanzo-app-client-id';
      var redirectUri = pickAuthParam('redirect_uri', 'redirectUri', '${redirectUri}');
      var state = pickAuthParam('state', 'state', '${state}');
      var scope = pickAuthParam('scope', 'scope', '${scope}') || 'openid profile email';
      var responseType = pickAuthParam('response_type', 'responseType', 'code') || 'code';
      var nonce = pickAuthParam('nonce', 'nonce', '');
      var responseMode = pickAuthParam('response_mode', 'responseMode', '');
      var codeChallengeMethod = pickAuthParam('code_challenge_method', 'codeChallengeMethod', '');
      var codeChallenge = pickAuthParam('code_challenge', 'codeChallenge', '');

      // Fallback map used only if IAM app lookup is unavailable.
      var fallbackAppMap = {
        'hanzo-app-client-id': { app: 'app-hanzo', org: 'hanzo' },
        'hanzo-console-client-id': { app: 'app-console', org: 'hanzo' },
        'hanzo-cloud-client-id': { app: 'app-cloud', org: 'hanzo' },
        'hanzo-commerce-client-id': { app: 'app-commerce', org: 'hanzo' },
        'hanzo-platform-client-id': { app: 'app-platform', org: 'hanzo' },
        'hanzo-auto-client-id': { app: 'app-auto', org: 'hanzo' },
        'hanzo-flow-client-id': { app: 'app-flow', org: 'hanzo' },
        'hanzobot-client-id': { app: 'app-hanzobot', org: 'hanzo' },
        'hanzo-team-client-id': { app: 'app-team', org: 'hanzo' },
        'hanzo-kms-client-id': { app: 'app-kms', org: 'hanzo' },
        'hanzo-kms': { app: 'app-kms', org: 'hanzo' },
        'bootnode-web': { app: 'app-bootnode', org: 'hanzo' },
        'hanzo-web3': { app: 'app-hanzo-web3', org: 'hanzo' },
        'adnexus-app-client-id': { app: 'app-adnexus', org: 'adnexus' },
        'zoo-app-client-id': { app: 'app-zoo', org: 'zoo' },
        'lux-app-client-id': { app: 'app-lux', org: 'lux' },
        'pars-app-client-id': { app: 'app-pars', org: 'pars' },
        'lux-web3': { app: 'app-lux-web3', org: 'lux' },
        'zoo-web3': { app: 'app-zoo-web3', org: 'zoo' },
        'hanzo-cloud': { app: 'hanzo-cloud', org: 'hanzo' },
        'zoo-cloud': { app: 'zoo-cloud', org: 'zoo' },
        'lux-cloud': { app: 'lux-cloud', org: 'lux' },
        'pars-cloud': { app: 'pars-cloud', org: 'pars' },
        'b108dacba027db36ec26': { app: 'app-hanzo-vm', org: 'hanzo' },
      };
      var fallback = fallbackAppMap[clientId] || {};
      var loginApp = fallback.app || '';
      var loginOrganization = fallback.org || '';

      function buildApiLoginParams() {
        var params = new URLSearchParams({
          clientId: clientId || 'hanzo-app-client-id',
          responseType: responseType || 'code',
          redirectUri: redirectUri || origin + '/callback',
          scope: scope,
          state: state,
          type: responseType || 'code',
        });

        if (nonce) params.set('nonce', nonce);
        if (responseMode) params.set('responseMode', responseMode);
        if (codeChallengeMethod) params.set('code_challenge_method', codeChallengeMethod);
        if (codeChallenge) params.set('code_challenge', codeChallenge);

        return params;
      }

      function resolveLoginConfigFromIAM() {
        return fetch(origin + '/api/get-app-login?' + buildApiLoginParams().toString(), {
          method: 'GET',
          credentials: 'include',
        })
        .then(function(res) {
          if (!res.ok) return null;
          return res.json();
        })
        .then(function(data) {
          if (data && data.status === 'ok' && data.data) {
            if (data.data.name) loginApp = data.data.name;
            if (data.data.organization) loginOrganization = data.data.organization;
          }
        })
        .catch(function() {
          // IAM app lookup unavailable -- keep whatever fallbackAppNameMap resolved.
        });
      }

      var loginConfigPromise = resolveLoginConfigFromIAM();

      // Social OAuth providers — redirect to IAM's provider login
      function socialLogin(provider) {
        var params = new URLSearchParams({
          client_id: clientId || 'hanzo-app-client-id',
          redirect_uri: redirectUri || origin + '/callback',
          response_type: responseType || 'code',
          scope: scope,
          state: state,
          provider: provider,
        });

        if (nonce) params.set('nonce', nonce);
        if (responseMode) params.set('response_mode', responseMode);
        if (codeChallengeMethod) params.set('code_challenge_method', codeChallengeMethod);
        if (codeChallenge) params.set('code_challenge', codeChallenge);

        window.location.href = origin + '/login/oauth/authorize?' + params.toString();
      }

      function showComingSoon(e, name) {
        e.preventDefault();
        var errEl = document.getElementById('error-msg');
        errEl.textContent = name + ' sign-in is being configured. Please use email and password for now.';
        errEl.style.display = 'block';
        setTimeout(function() { errEl.style.display = 'none'; }, 4000);
      }

      document.getElementById('btn-google').addEventListener('click', function(e) {
        e.preventDefault();
        socialLogin('provider-google');
      });
      document.getElementById('btn-github').addEventListener('click', function(e) {
        e.preventDefault();
        socialLogin('provider-github');
      });
      // Web3 wallet login — client-side EIP-712 typed data flow (matches Casdoor MetaMask IDP)
      async function walletLogin() {
        var errEl = document.getElementById('error-msg');
        if (typeof window.ethereum === 'undefined') {
          errEl.textContent = 'Please install MetaMask or another Web3 wallet.';
          errEl.style.display = 'block';
          setTimeout(function() { errEl.style.display = 'none'; }, 5000);
          return;
        }
        try {
          var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          var address = accounts[0];

          var nonce = crypto.randomUUID();
          var now = new Date();
          var typedData = JSON.stringify({
            domain: { chainId: window.ethereum.chainId, name: 'Hanzo IAM', version: '1' },
            message: {
              prompt: 'In order to authenticate to this website, sign this request and your public address will be sent to the server in a verifiable way.',
              nonce: nonce,
              createAt: now.toLocaleString()
            },
            primaryType: 'AuthRequest',
            types: {
              EIP712Domain: [{ name: 'name', type: 'string' }, { name: 'version', type: 'string' }, { name: 'chainId', type: 'uint256' }],
              AuthRequest: [{ name: 'prompt', type: 'string' }, { name: 'nonce', type: 'string' }, { name: 'createAt', type: 'string' }]
            }
          });

          var signature = await window.ethereum.request({ method: 'eth_signTypedData_v4', params: [address, typedData] });
          var web3Code = JSON.stringify({ address: address, typedData: typedData, signature: signature });

          await loginConfigPromise;

          var params = buildApiLoginParams();
          var web3State = state || loginOrganization || 'web3-login';
          params.set('state', web3State);
          var res = await fetch(origin + '/api/login?' + params.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              method: 'signup',
              type: responseType || 'code',
              application: loginApp,
              organization: loginOrganization,
              provider: 'provider-web3',
              code: web3Code,
              state: web3State,
              redirectUri: redirectUri || origin + '/callback',
            }),
            credentials: 'include',
          });

          var text = await res.text();
          var data;
          try { data = JSON.parse(text); } catch (e) {
            throw new Error('Server returned invalid response (HTTP ' + res.status + ')');
          }
          if (data.status === 'ok' && data.data) {
            if (redirectUri) {
              window.location.href = redirectUri + '?code=' + encodeURIComponent(data.data) + '&state=' + encodeURIComponent(state);
            } else {
              window.location.href = '/login';
            }
          } else {
            errEl.textContent = data.msg || 'Web3 login failed';
            errEl.style.display = 'block';
          }
        } catch (err) {
          if (err.code === 4001) return;
          errEl.textContent = err.message || 'Failed to connect wallet';
          errEl.style.display = 'block';
          setTimeout(function() { errEl.style.display = 'none'; }, 5000);
        }
      }

      document.getElementById('btn-wallet').addEventListener('click', function(e) {
        e.preventDefault();
        walletLogin();
      });

      // Login contact toggle (email ↔ phone)
      var loginContactMode = 'email';
      var loginContactInput = document.getElementById('email');
      var loginContactLabel = document.getElementById('login-contact-label');
      var loginContactToggle = document.getElementById('login-contact-toggle');
      loginContactToggle.addEventListener('click', function() {
        if (loginContactMode === 'email') {
          loginContactMode = 'phone';
          loginContactInput.type = 'tel';
          loginContactInput.placeholder = '+1 (555) 000-0000';
          loginContactInput.autocomplete = 'tel';
          loginContactInput.value = '';
          loginContactLabel.textContent = 'Phone number';
          loginContactToggle.textContent = 'Use email';
        } else {
          loginContactMode = 'email';
          loginContactInput.type = 'email';
          loginContactInput.placeholder = 'you@company.com';
          loginContactInput.autocomplete = 'email';
          loginContactInput.value = '';
          loginContactLabel.textContent = 'Email address';
          loginContactToggle.textContent = 'Use phone';
        }
      });

      // Email/phone + password login
      document.getElementById('loginForm').addEventListener('submit', function(e) {
        e.preventDefault();
        var email = document.getElementById('email').value;
        var password = document.getElementById('password').value;
        var btn = document.getElementById('submitBtn');
        var errEl = document.getElementById('error-msg');
        errEl.style.display = 'none';
        btn.classList.add('loading');
        btn.textContent = 'Signing in...';

        loginConfigPromise.then(function() {
          return fetch(origin + '/api/login?' + buildApiLoginParams().toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'token',
            username: email,
            password: password,
            organization: loginOrganization,
            application: loginApp,
            signinMethod: 'Password',
            language: navigator.language || 'en',
          }),
          credentials: 'include',
          });
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
          btn.classList.remove('loading');
          btn.textContent = 'Sign in';
          if (data.status === 'ok' && data.data) {
            if (redirectUri) {
              var sep = redirectUri.indexOf('?') >= 0 ? '&' : '?';
              window.location.href = redirectUri + sep
                + 'access_token=' + encodeURIComponent(data.data)
                + '&refresh_token=' + encodeURIComponent(data.data2 || '')
                + '&state=' + encodeURIComponent(state)
                + '&provider=hanzo&status=200';
            } else {
              window.location.href = '/login';
            }
          } else {
            errEl.textContent = data.msg || 'Invalid email or password';
            errEl.style.display = 'block';
          }
        })
        .catch(function() {
          btn.classList.remove('loading');
          btn.textContent = 'Sign in';
          errEl.textContent = 'Unable to sign in. Please try again.';
          errEl.style.display = 'block';
        });
      });
    })();
  </script>
</body>
</html>`;
}

// ── Sign Up page ─────────────────────────────────────────────────────
function getSignupPage(url, brand) {
  const params = new URL(url);
  const redirectUri = params.searchParams.get('redirect_uri') || '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Create Account - ${brand.displayName}</title>
  <link rel="icon" type="image/png" href="${brand.faviconUrl}" />
  <style>${getSharedCSS(brand)}</style>
</head>
<body>
  <div class="container">
    ${getBrandPaneHTML(brand)}
    <div class="auth-pane">
      <div class="auth-card">
        <div class="auth-header">
          <h2>Create your account</h2>
          <p>Get started with ${brand.displayName} in seconds</p>
        </div>
        <div class="social-buttons">
          <a class="btn" id="btn-google" href="#">${GOOGLE_ICON} Sign up with Google</a>
          <a class="btn" id="btn-github" href="#">${GITHUB_ICON} Sign up with GitHub</a>
        </div>
        <div class="social-buttons">
          <a class="btn btn-web3" id="btn-wallet" href="#">${WALLET_ICON} Connect Wallet</a>
        </div>
        <div class="divider">or sign up with email</div>
        <div id="error-msg" class="error-msg"></div>
        <div id="success-msg" class="success-msg"></div>
        <form id="signupForm">
          <div class="form-group">
            <label for="name">Full name</label>
            <input type="text" id="name" name="name" placeholder="Jane Smith" required autocomplete="name" />
          </div>
          <div class="form-group">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.35rem;">
              <label id="contact-label" for="contact" style="margin:0;">Email address</label>
              <button type="button" id="contact-toggle" style="background:none;border:1px solid #333;color:#888;font-size:0.78em;padding:0.2rem 0.55rem;border-radius:4px;cursor:pointer;">Use phone instead</button>
            </div>
            <input type="email" id="contact" name="contact" placeholder="you@company.com" required autocomplete="email" />
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" placeholder="Min. 8 characters" required minlength="8" autocomplete="new-password" />
          </div>
          <button type="submit" class="btn btn-primary" id="submitBtn" style="margin-top: 1rem; border: none;">Create account</button>
        </form>
        <div class="footer-links">
          <p>Already have an account? <a href="/login?prompt=login">Sign in</a></p>
        </div>
      </div>
    </div>
  </div>
  <script>
    (function() {
      var origin = window.location.origin;
      var oauthParams = new URLSearchParams(window.location.search);
      function pickParam(snakeCase, camelCase, fallback) {
        return oauthParams.get(snakeCase) || oauthParams.get(camelCase) || fallback || '';
      }

      var clientId = pickParam('client_id', 'clientId', '') || 'hanzo-app-client-id';
      var redirectUri = pickParam('redirect_uri', 'redirectUri', '${redirectUri}');
      var state = pickParam('state', 'state', '');
      var scope = pickParam('scope', 'scope', '') || 'openid profile email';
      var responseType = pickParam('response_type', 'responseType', 'code') || 'code';

      var fallbackAppNameMap = {
        'hanzo-app-client-id': 'app-hanzo',
        'hanzo-console-client-id': 'app-console',
        'hanzo-cloud-client-id': 'app-cloud',
        'hanzo-platform-client-id': 'app-platform',
        'hanzo-kms-client-id': 'app-kms',
        'hanzo-web3': 'app-hanzo-web3',
        'lux-web3': 'app-lux-web3',
        'lux-cloud': 'lux-cloud',
      };
      var signupApp = fallbackAppNameMap[clientId] || '';
      var signupOrg = '';

      function buildApiParams() {
        return new URLSearchParams({
          clientId: clientId,
          responseType: responseType,
          redirectUri: redirectUri || origin + '/callback',
          scope: scope,
          state: state,
          type: responseType,
        });
      }

      // Resolve app/org from IAM dynamically
      var configPromise = fetch(origin + '/api/get-app-login?' + buildApiParams().toString(), {
        method: 'GET',
        credentials: 'include',
      })
      .then(function(res) { return res.ok ? res.json() : null; })
      .then(function(data) {
        if (data && data.status === 'ok' && data.data) {
          if (data.data.name) signupApp = data.data.name;
          if (data.data.organization) signupOrg = data.data.organization;
        }
      })
      .catch(function() {});

      function socialLogin(provider) {
        var params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri || origin + '/callback',
          response_type: responseType,
          scope: scope,
          state: state,
          provider: provider,
        });
        window.location.href = origin + '/login/oauth/authorize?' + params.toString();
      }

      document.getElementById('btn-google').addEventListener('click', function(e) {
        e.preventDefault();
        socialLogin('provider-google');
      });
      document.getElementById('btn-github').addEventListener('click', function(e) {
        e.preventDefault();
        socialLogin('provider-github');
      });
      // Web3 wallet signup — client-side EIP-712 typed data flow
      async function walletLogin() {
        var errEl = document.getElementById('error-msg');
        if (typeof window.ethereum === 'undefined') {
          errEl.textContent = 'Please install MetaMask or another Web3 wallet.';
          errEl.style.display = 'block';
          setTimeout(function() { errEl.style.display = 'none'; }, 5000);
          return;
        }
        try {
          var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          var address = accounts[0];

          var nonce = crypto.randomUUID();
          var now = new Date();
          var typedData = JSON.stringify({
            domain: { chainId: window.ethereum.chainId, name: 'Hanzo IAM', version: '1' },
            message: {
              prompt: 'In order to authenticate to this website, sign this request and your public address will be sent to the server in a verifiable way.',
              nonce: nonce,
              createAt: now.toLocaleString()
            },
            primaryType: 'AuthRequest',
            types: {
              EIP712Domain: [{ name: 'name', type: 'string' }, { name: 'version', type: 'string' }, { name: 'chainId', type: 'uint256' }],
              AuthRequest: [{ name: 'prompt', type: 'string' }, { name: 'nonce', type: 'string' }, { name: 'createAt', type: 'string' }]
            }
          });

          var signature = await window.ethereum.request({ method: 'eth_signTypedData_v4', params: [address, typedData] });
          var web3Code = JSON.stringify({ address: address, typedData: typedData, signature: signature });

          await configPromise;
          var params = buildApiParams();
          var web3State = state || signupOrg || 'web3-signup';
          params.set('state', web3State);

          var res = await fetch(origin + '/api/login?' + params.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              method: 'signup',
              type: responseType,
              application: signupApp,
              organization: signupOrg,
              provider: 'provider-web3',
              code: web3Code,
              state: web3State,
              redirectUri: redirectUri || origin + '/callback',
            }),
            credentials: 'include',
          });

          var text = await res.text();
          var data;
          try { data = JSON.parse(text); } catch (e) {
            throw new Error('Server returned invalid response (HTTP ' + res.status + ')');
          }
          if (data.status === 'ok' && data.data) {
            if (redirectUri) {
              window.location.href = redirectUri + '?code=' + encodeURIComponent(data.data) + '&state=' + encodeURIComponent(state);
            } else {
              window.location.href = '/login';
            }
          } else {
            errEl.textContent = data.msg || 'Web3 signup failed';
            errEl.style.display = 'block';
          }
        } catch (err) {
          if (err.code === 4001) return;
          errEl.textContent = err.message || 'Failed to connect wallet';
          errEl.style.display = 'block';
          setTimeout(function() { errEl.style.display = 'none'; }, 5000);
        }
      }

      document.getElementById('btn-wallet').addEventListener('click', function(e) {
        e.preventDefault();
        walletLogin();
      });

      // Contact field toggle (email ↔ phone)
      var contactMode = 'email';
      var contactInput = document.getElementById('contact');
      var contactLabel = document.getElementById('contact-label');
      var contactToggle = document.getElementById('contact-toggle');
      contactToggle.addEventListener('click', function() {
        if (contactMode === 'email') {
          contactMode = 'phone';
          contactInput.type = 'tel';
          contactInput.placeholder = '+1 (555) 000-0000';
          contactInput.autocomplete = 'tel';
          contactInput.value = '';
          contactLabel.textContent = 'Phone number';
          contactToggle.textContent = 'Use email instead';
        } else {
          contactMode = 'email';
          contactInput.type = 'email';
          contactInput.placeholder = 'you@company.com';
          contactInput.autocomplete = 'email';
          contactInput.value = '';
          contactLabel.textContent = 'Email address';
          contactToggle.textContent = 'Use phone instead';
        }
      });

      document.getElementById('signupForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        var name = document.getElementById('name').value;
        var contactVal = contactInput.value.trim();
        var email = contactMode === 'email' ? contactVal : '';
        var phone = contactMode === 'phone' ? contactVal : '';
        var password = document.getElementById('password').value;
        var btn = document.getElementById('submitBtn');
        var errEl = document.getElementById('error-msg');
        var successEl = document.getElementById('success-msg');
        errEl.style.display = 'none';
        successEl.style.display = 'none';

        if (!contactVal) {
          errEl.textContent = contactMode === 'email' ? 'Email is required.' : 'Phone number is required.';
          errEl.style.display = 'block';
          return;
        }

        btn.classList.add('loading');
        btn.textContent = 'Creating account...';

        await configPromise;
        var username = contactMode === 'email' ? email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_') : phone.replace(/[^0-9]/g, '').slice(-8);

        fetch(origin + '/api/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            application: signupApp,
            organization: signupOrg,
            username: username,
            name: name,
            email: email,
            password: password,
            phone: phone,
          }),
          credentials: 'include',
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
          btn.classList.remove('loading');
          btn.textContent = 'Create account';
          if (data.status === 'ok') {
            successEl.textContent = 'Account created! Redirecting to sign in...';
            successEl.style.display = 'block';
            setTimeout(function() {
              window.location.href = '/login?prompt=login' + (redirectUri ? '&redirect_uri=' + encodeURIComponent(redirectUri) : '');
            }, 1500);
          } else {
            errEl.textContent = data.msg || 'Unable to create account. Please try again.';
            errEl.style.display = 'block';
          }
        })
        .catch(function() {
          btn.classList.remove('loading');
          btn.textContent = 'Create account';
          errEl.textContent = 'Unable to create account. Please try again.';
          errEl.style.display = 'block';
        });
      });
    })();
  </script>
</body>
</html>`;
}

// ── Forgot Password page ─────────────────────────────────────────────
function getForgotPage(url, brand) {
  const params = new URL(url);
  const clientId = params.searchParams.get('client_id') || '';
  const redirectUri = params.searchParams.get('redirect_uri') || '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password - ${brand.displayName}</title>
  <link rel="icon" type="image/png" href="${brand.faviconUrl}" />
  <style>${getSharedCSS(brand)}</style>
</head>
<body>
  <div class="container">
    ${getBrandPaneHTML(brand)}
    <div class="auth-pane">
      <div class="auth-card">
        <div class="auth-header">
          <h2>Reset your password</h2>
          <p>Enter your email and we&rsquo;ll send you a reset link</p>
        </div>
        <div id="error-msg" class="error-msg"></div>
        <div id="success-msg" class="success-msg"></div>
        <form id="forgotForm">
          <div class="form-group">
            <label for="email">Email address</label>
            <input type="email" id="email" name="email" placeholder="you@company.com" required autocomplete="email" />
          </div>
          <button type="submit" class="btn btn-primary" id="submitBtn" style="margin-top: 1rem; border: none;">Send reset link</button>
        </form>
        <div class="footer-links">
          <p>Remember your password? <a href="/login?prompt=login">Sign in</a></p>
          <p style="margin-top: 0.5rem;">Don&rsquo;t have an account? <a href="/signup">Sign up</a></p>
        </div>
      </div>
    </div>
  </div>
  <script>
    (function() {
      var origin = window.location.origin;
      var qp = new URLSearchParams(window.location.search);
      var clientId = qp.get('client_id') || qp.get('clientId') || '${clientId}';
      var redirectUri = qp.get('redirect_uri') || qp.get('redirectUri') || '${redirectUri}';

      // Resolve application name + org from IAM dynamically
      var forgotAppId = '';
      var configPromise = (function() {
        if (!clientId) return Promise.resolve();
        var p = new URLSearchParams({
          clientId: clientId,
          responseType: 'code',
          redirectUri: redirectUri || origin + '/callback',
          scope: 'openid profile email',
          state: '',
        });
        return fetch(origin + '/api/get-app-login?' + p.toString(), {
          method: 'GET',
          credentials: 'include',
        })
        .then(function(res) { return res.ok ? res.json() : null; })
        .then(function(data) {
          if (data && data.status === 'ok' && data.data) {
            // Build the owner/name applicationId that IAM expects
            var owner = data.data.owner || 'admin';
            var name = data.data.name || '';
            if (name) forgotAppId = owner + '/' + name;
          }
        })
        .catch(function() {});
      })();

      document.getElementById('forgotForm').addEventListener('submit', function(e) {
        e.preventDefault();
        var email = document.getElementById('email').value;
        var btn = document.getElementById('submitBtn');
        var errEl = document.getElementById('error-msg');
        var successEl = document.getElementById('success-msg');
        errEl.style.display = 'none';
        successEl.style.display = 'none';
        btn.classList.add('loading');
        btn.textContent = 'Sending...';

        configPromise.then(function() {
          var payload = {
            dest: email,
            type: 'email',
            method: 'forget',
          };
          if (forgotAppId) payload.applicationId = forgotAppId;

          return fetch(origin + '/api/send-verification-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            credentials: 'include',
          });
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
          btn.classList.remove('loading');
          btn.textContent = 'Send reset link';
          // Show generic message for security (don't reveal if email exists)
          successEl.textContent = 'If an account exists with that email, you will receive a reset link shortly.';
          successEl.style.display = 'block';
        })
        .catch(function() {
          btn.classList.remove('loading');
          btn.textContent = 'Send reset link';
          errEl.textContent = 'Unable to send reset link. Please try again.';
          errEl.style.display = 'block';
        });
      });
    })();
  </script>
</body>
</html>`;
}

// GitHub OAuth App credentials (shared across all Hanzo services)
const GITHUB_CLIENT_ID = '59a7e63937e7b6033e74';

// App-specific callback paths (GitHub allows subdirectories of the callback URL)
const PLATFORM_GITHUB_CALLBACK = 'https://hanzo.id/callback/platform/github';
const PLATFORM_IAM_CALLBACK = 'https://hanzo.id/callback/platform/hanzo';
const DEFAULT_PLATFORM_IAM_CLIENT_ID = 'hanzo-platform-client-id';

// Map of app-specific callback paths to their target redirect origins
const APP_CALLBACKS = {
  '/callback/platform/github': {
    defaultRedirect: 'https://platform.hanzo.ai/login',
    provider: 'github',
  },
  '/callback/platform/gitlab': {
    defaultRedirect: 'https://platform.hanzo.ai/login',
    provider: 'gitlab',
  },
  '/callback/platform/bitbucket': {
    defaultRedirect: 'https://platform.hanzo.ai/login',
    provider: 'bitbucket',
  },
  '/callback/platform/hanzo': {
    defaultRedirect: 'https://platform.hanzo.ai/login',
    provider: 'hanzo',
  },
};

// Allowed redirect origins for OAuth callbacks. Tokens are never sent to
// origins outside this set. Add additional Hanzo service origins here.
const ALLOWED_REDIRECT_ORIGINS = new Set([
  'https://platform.hanzo.ai',
  'https://console.hanzo.ai',
  'https://chat.hanzo.ai',
  'https://studio.hanzo.ai',
  'https://search.hanzo.ai',
  'https://kms.hanzo.ai',
  'https://cloud.hanzo.ai',
  'https://docs.hanzo.ai',
  'https://hanzo.ai',
  'https://hanzo.id',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8000',
]);

/**
 * Validate that a redirect URL's origin is in the allow-list.
 * Returns the validated URL or the fallback default.
 */
function validateRedirectOrigin(redirectUrl, fallback) {
  try {
    const parsed = new URL(redirectUrl);
    if (ALLOWED_REDIRECT_ORIGINS.has(parsed.origin)) {
      return redirectUrl;
    }
  } catch {}
  return fallback;
}

// ── Worker fetch handler ─────────────────────────────────────────────
// Alias domains that should 301 redirect to their canonical .id domain
const DOMAIN_REDIRECTS = {
  'iam.lux.network': 'lux.id',
  'id.lux.network': 'lux.id',
  'id.zoo.network': 'zoo.id',
  'id.zoo.ngo': 'zoo.id',
  'id.pars.network': 'pars.id',
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Redirect alias domains to canonical .id domain (all paths)
    const canonicalHost = DOMAIN_REDIRECTS[url.hostname];
    if (canonicalHost) {
      const target = new URL(url);
      target.hostname = canonicalHost;
      return Response.redirect(target.toString(), 301);
    }

    // Resolve org brand from request hostname
    const brand = getOrgBrand(url.hostname);

    // ── Platform Git provider OAuth ──────────────────────────────────
    // Platform needs Git provider tokens (repo access) — handled separately
    // from IAM social login. Uses the same GitHub OAuth App but with
    // app-specific callback paths (GitHub allows subdirectories).

    // Initiate platform IAM OAuth (email/password, Google, GitHub social via IAM)
    if (pathname === '/oauth/hanzo/platform') {
      const redirect = validateRedirectOrigin(
        url.searchParams.get('redirect') || 'https://platform.hanzo.ai/login',
        'https://platform.hanzo.ai/login',
      );
      const clientId =
        url.searchParams.get('client_id') ||
        env.PLATFORM_IAM_CLIENT_ID ||
        env.IAM_CLIENT_ID ||
        DEFAULT_PLATFORM_IAM_CLIENT_ID;
      const scope = url.searchParams.get('scope') || 'openid profile email';
      const nonce = crypto.randomUUID();
      const statePayload = JSON.stringify({ redirect, clientId, nonce });
      const state = btoa(statePayload);

      const authUrl = new URL(`${url.origin}/login/oauth/authorize`);
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', PLATFORM_IAM_CALLBACK);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', scope);
      authUrl.searchParams.set('state', state);

      return Response.redirect(authUrl.toString(), 302);
    }

    // Initiate platform GitHub OAuth
    if (pathname === '/oauth/github/platform') {
      const redirect = validateRedirectOrigin(
        url.searchParams.get('redirect') || 'https://platform.hanzo.ai/login',
        'https://platform.hanzo.ai/login',
      );
      const nonce = crypto.randomUUID();
      const statePayload = JSON.stringify({ redirect, nonce });
      const state = btoa(statePayload);

      const githubUrl = new URL('https://github.com/login/oauth/authorize');
      githubUrl.searchParams.set('client_id', GITHUB_CLIENT_ID);
      githubUrl.searchParams.set('redirect_uri', PLATFORM_GITHUB_CALLBACK);
      githubUrl.searchParams.set('scope', 'user:email,read:user,repo,admin:repo_hook');
      githubUrl.searchParams.set('state', state);

      return Response.redirect(githubUrl.toString(), 302);
    }

    // Platform GitHub OAuth callback — exchange code for tokens, redirect to platform
    if (pathname === '/callback/platform/github') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');

      if (!code) {
        return Response.redirect('https://platform.hanzo.ai/login?error=no_code', 302);
      }

      // Decode state to get the original redirect URL (validated against allow-list)
      const defaultPlatformRedirect = 'https://platform.hanzo.ai/login';
      let redirect = defaultPlatformRedirect;
      try {
        const decoded = JSON.parse(atob(state));
        if (decoded.redirect) {
          redirect = validateRedirectOrigin(decoded.redirect, defaultPlatformRedirect);
        }
      } catch {}

      // Exchange GitHub code for tokens
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code: code,
          redirect_uri: PLATFORM_GITHUB_CALLBACK,
        }),
      });

      const tokens = await tokenRes.json();

      const redirectUrl = new URL(redirect);
      if (tokens.access_token) {
        redirectUrl.searchParams.set('access_token', tokens.access_token);
        redirectUrl.searchParams.set('refresh_token', tokens.refresh_token || '');
        redirectUrl.searchParams.set('expires_at', tokens.expires_in
          ? String(Math.floor(Date.now() / 1000) + Number(tokens.expires_in))
          : '0');
        redirectUrl.searchParams.set('provider', 'github');
        redirectUrl.searchParams.set('status', '200');
      } else {
        redirectUrl.searchParams.set('error', tokens.error || 'token_exchange_failed');
        redirectUrl.searchParams.set('error_description', tokens.error_description || 'Failed to exchange code');
      }

      return Response.redirect(redirectUrl.toString(), 302);
    }

    // Platform IAM callback — exchange code for IAM tokens, redirect to platform
    if (pathname === '/callback/platform/hanzo') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const directAccessToken = url.searchParams.get('access_token');
      const directRefreshToken = url.searchParams.get('refresh_token');

      const defaultIAMRedirect = 'https://platform.hanzo.ai/login';
      let redirect = defaultIAMRedirect;
      try {
        const decoded = JSON.parse(atob(state || ''));
        if (decoded.redirect) {
          redirect = validateRedirectOrigin(decoded.redirect, defaultIAMRedirect);
        }
      } catch {}

      const redirectUrl = new URL(redirect);

      // Direct token passthrough (from implicit flow / password login)
      if (directAccessToken) {
        redirectUrl.searchParams.set('access_token', directAccessToken);
        redirectUrl.searchParams.set('refresh_token', directRefreshToken || '');
        redirectUrl.searchParams.set('provider', 'hanzo');
        redirectUrl.searchParams.set('status', '200');
        return Response.redirect(redirectUrl.toString(), 302);
      }

      // Authorization code exchange flow
      if (!code) {
        return Response.redirect('https://platform.hanzo.ai/login?error=no_code', 302);
      }

      let clientId =
        env.PLATFORM_IAM_CLIENT_ID || env.IAM_CLIENT_ID || DEFAULT_PLATFORM_IAM_CLIENT_ID;
      try {
        const decoded = JSON.parse(atob(state || ''));
        if (decoded.clientId) clientId = decoded.clientId;
      } catch {}

      const tokenPayload = {
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        redirect_uri: PLATFORM_IAM_CALLBACK,
      };
      const clientSecret = env.PLATFORM_IAM_CLIENT_SECRET || env.IAM_CLIENT_SECRET;
      if (clientSecret) {
        tokenPayload.client_secret = clientSecret;
      }

      const tokenRes = await fetch(`${IAM_ORIGIN}/api/login/oauth/access_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(tokenPayload),
      });

      const tokens = await tokenRes.json().catch(() => ({}));

      if (tokens.access_token) {
        redirectUrl.searchParams.set('access_token', tokens.access_token);
        redirectUrl.searchParams.set('refresh_token', tokens.refresh_token || '');
        redirectUrl.searchParams.set(
          'expires_at',
          tokens.expires_in
            ? String(Math.floor(Date.now() / 1000) + Number(tokens.expires_in))
            : '0',
        );
        redirectUrl.searchParams.set('provider', 'hanzo');
        redirectUrl.searchParams.set('status', '200');
      } else {
        redirectUrl.searchParams.set('error', tokens.error || 'token_exchange_failed');
        redirectUrl.searchParams.set(
          'error_description',
          tokens.error_description || tokens.message || 'Failed to exchange code',
        );
      }

      return Response.redirect(redirectUrl.toString(), 302);
    }

    // ── Standard OAuth endpoint aliases ──────────────────────────────
    // CLI clients (Rust, Python) call /oauth/authorize and /oauth/token
    // which are standard OAuth2 paths. IAM uses different paths, so
    // we rewrite and proxy transparently.

    // GET /oauth/authorize → serve login page (same as /login/oauth/authorize)
    if (pathname === '/oauth/authorize') {
      return new Response(getLoginPage(request.url, brand), {
        headers: {
          'content-type': 'text/html;charset=UTF-8',
          'cache-control': 'no-cache',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
        },
      });
    }

    // POST /oauth/token → proxy to IAM's /api/login/oauth/access_token
    if (pathname === '/oauth/token' && request.method === 'POST') {
      const iamUrl = new URL('/api/login/oauth/access_token' + url.search, IAM_ORIGIN);
      const headers = new Headers(request.headers);
      headers.set('Host', 'iam.hanzo.ai');

      const iamRequest = new Request(iamUrl.toString(), {
        method: 'POST',
        headers: headers,
        body: request.body,
        redirect: 'manual',
      });

      const response = await fetch(iamRequest);
      const newResponse = new Response(response.body, response);
      const location = newResponse.headers.get('location');
      if (location && location.includes('iam.hanzo.ai')) {
        newResponse.headers.set('location', location.replace('iam.hanzo.ai', 'hanzo.id'));
      }
      return newResponse;
    }

    // OAuth callback from social providers (GitHub, Google, etc.)
    // Handle server-side: read context cookie, call IAM /api/login, redirect to app.
    // Casdoor's SPA callback relies on sessionStorage which breaks through the proxy,
    // so we handle the full exchange here instead.
    if (pathname === '/callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');

      if (code && state) {
        // Casdoor's state for social logins is a base64-encoded query string:
        //   btoa("?client_id=...&redirect_uri=...&provider=...&method=...&application=...")
        // Decode it to extract the application, provider, and redirect_uri.
        let stateParams = new URLSearchParams();
        let stateObj = {};
        try {
          const decoded = atob(state);
          if (decoded.startsWith('?') || decoded.includes('=')) {
            stateParams = new URLSearchParams(decoded);
          } else {
            // Might be JSON
            stateObj = JSON.parse(decoded);
          }
        } catch (e) { /* state might not be decodable */ }

        // Also try reading the _oauth_ctx cookie as secondary fallback
        const cookieHeader = request.headers.get('Cookie') || '';
        let oauthCtx = {};
        const ctxMatch = cookieHeader.match(/_oauth_ctx=([^;]+)/);
        if (ctxMatch) {
          try {
            oauthCtx = JSON.parse(atob(decodeURIComponent(ctxMatch[1])));
          } catch (e) { /* ignore decode errors */ }
        }

        // Resolve from state params (primary), cookie (secondary), JSON state (tertiary)
        const application = stateParams.get('application') || oauthCtx.application || stateObj.application || '';
        const provider = stateParams.get('provider') || oauthCtx.provider || stateObj.provider || '';
        const method = stateParams.get('method') || stateObj.method || 'link';
        const stateClientId = stateParams.get('client_id') || oauthCtx.clientId || '';
        const originalRedirectUri = stateParams.get('redirect_uri') || oauthCtx.redirectUri || stateObj.redirectUri || '';

        // Resolve organization from app map using client_id
        let organization = oauthCtx.organization || stateObj.organization || '';
        if (!organization && stateClientId && CLIENT_APP_MAP[stateClientId]) {
          organization = CLIENT_APP_MAP[stateClientId].organization;
        }

        // Call IAM's /api/login to process the social provider callback server-side.
        // This replicates what Casdoor's SPA callback component does.
        // IAM expects state to be the authState config value ("hanzo"), NOT the
        // Casdoor-encoded state from GitHub. The encoded state was only for context extraction.
        // We use type:'token' (implicit) because our Casdoor version has a bug where
        // type:'code' maps to an empty grant_type and fails the grant_type check.
        const loginRes = await fetch(`${IAM_ORIGIN}/api/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Cookie': cookieHeader,
            'Host': 'iam.hanzo.ai',
          },
          body: JSON.stringify({
            type: 'token',
            code: code,
            state: 'hanzo',  // Must match IAM's authState config
            redirectUri: `${url.origin}/callback`,
            application: application,
            organization: organization,
            provider: provider,
            method: method,
          }),
        });

        const loginData = await loginRes.json().catch(() => ({}));

        // Clear the oauth context cookie
        const clearCookie = '_oauth_ctx=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';

        if (loginData.status === 'ok' && loginData.data) {
          // With type:'token', data=access_token JWT, data2=refresh_token JWT
          // Redirect to the original redirect_uri with the tokens
          const targetRedirectUri = originalRedirectUri
            ? originalRedirectUri.replaceAll('iam.hanzo.ai', 'hanzo.id')
            : `${url.origin}/login`;
          const targetUrl = new URL(targetRedirectUri);
          targetUrl.searchParams.set('access_token', loginData.data);
          targetUrl.searchParams.set('refresh_token', loginData.data2 || '');
          targetUrl.searchParams.set('provider', 'hanzo');
          targetUrl.searchParams.set('status', '200');
          return new Response(null, {
            status: 302,
            headers: {
              'Location': targetUrl.toString(),
              'Set-Cookie': clearCookie,
            },
          });
        }

        // If API login failed, include debug info to diagnose the issue
        const debugInfo = JSON.stringify({
          msg: loginData.msg || 'unknown',
          hasCookie: !!ctxMatch,
          fromState: !!stateParams.get('application'),
          app: application,
          org: organization,
          prov: provider,
          stateClientId: stateClientId,
        });

        if (originalRedirectUri) {
          const errorUrl = new URL(originalRedirectUri.replaceAll('iam.hanzo.ai', 'hanzo.id'));
          errorUrl.searchParams.set('error', loginData.msg || 'social_login_failed');
          errorUrl.searchParams.set('debug', debugInfo);
          return new Response(null, {
            status: 302,
            headers: {
              'Location': errorUrl.toString(),
              'Set-Cookie': clearCookie,
            },
          });
        }

        // Last resort: redirect to login page with error
        return new Response(null, {
          status: 302,
          headers: {
            'Location': `${url.origin}/login?error=${encodeURIComponent(loginData.msg || 'social_login_failed')}&debug=${encodeURIComponent(debugInfo)}`,
            'Set-Cookie': clearCookie,
          },
        });
      }

      // No code/state — proxy to IAM as-is (non-social callback)
      const iamUrl = new URL(pathname + url.search, IAM_ORIGIN);
      const headers = new Headers(request.headers);
      headers.set('Host', 'iam.hanzo.ai');

      const iamRequest = new Request(iamUrl.toString(), {
        method: request.method,
        headers: headers,
        redirect: 'manual',
      });

      const response = await fetch(iamRequest);
      const location = response.headers.get('location');
      if (location) {
        const newHeaders = new Headers(response.headers);
        newHeaders.set('location', location.replaceAll('iam.hanzo.ai', 'hanzo.id'));
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      }
      return new Response(response.body, response);
    }

    // /login/oauth/authorize — if it has a provider param, construct the
    // social provider OAuth URL and redirect directly. Otherwise serve
    // our custom login page.
    if (pathname === '/login/oauth/authorize') {
      if (url.searchParams.has('provider')) {
        const provider = url.searchParams.get('provider');
        const clientId = url.searchParams.get('client_id');

        // Resolve the application and its owning org.
        // Try API first, fall back to CLIENT_APP_MAP.
        let appName = '';
        let appOwner = '';
        if (clientId) {
          try {
            const loginParams = new URLSearchParams({
              clientId: clientId,
              responseType: url.searchParams.get('response_type') || 'code',
              redirectUri: url.searchParams.get('redirect_uri') || `${url.origin}/callback`,
              scope: url.searchParams.get('scope') || 'openid profile email',
              state: url.searchParams.get('state') || '',
            });
            const appLoginRes = await fetch(`${IAM_ORIGIN}/api/get-app-login?${loginParams.toString()}`);
            const appLoginData = await appLoginRes.json();
            if (appLoginData && appLoginData.status === 'ok' && appLoginData.data) {
              appName = appLoginData.data.name || '';
              appOwner = appLoginData.data.owner || appLoginData.data.organization || '';
            }
          } catch (e) {
            // Fall through to CLIENT_APP_MAP
          }
          // Fallback: use hardcoded client_id → app map
          if (!appName && CLIENT_APP_MAP[clientId]) {
            appName = CLIENT_APP_MAP[clientId].application;
            appOwner = CLIENT_APP_MAP[clientId].organization;
          }
        }

        // Get provider details from IAM. Use the resolved owner if available.
        const providerOwner = appOwner || 'admin';
        let providerClientId = '';
        let providerType = '';
        try {
          const provRes = await fetch(`${IAM_ORIGIN}/api/get-provider?id=${encodeURIComponent(providerOwner)}/${encodeURIComponent(provider)}`);
          const provData = await provRes.json();
          if (provData.data) {
            providerClientId = provData.data.clientId || '';
            providerType = provData.data.type || '';
          }
        } catch (e) {
          // Fall through to IAM proxy
        }

        // Store OAuth context in a cookie so the /callback handler can use it.
        // The Casdoor SPA normally stores this in sessionStorage, but since we handle
        // the callback server-side, we need it in a cookie the worker can read.
        const oauthContext = JSON.stringify({
          application: appName,
          organization: appOwner,
          provider: provider,
          redirectUri: url.searchParams.get('redirect_uri') || `${url.origin}/callback`,
          clientId: clientId || '',
        });
        const oauthContextCookie = `_oauth_ctx=${encodeURIComponent(btoa(oauthContext))}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;

        // Proxy all social provider logins (GitHub, Google, etc.) to IAM.
        // IAM (Casdoor) manages the full OAuth flow with its own state tracking,
        // so it can correctly process the callback when the provider redirects back.
        const iamUrl = new URL(pathname + url.search, IAM_ORIGIN);
        const headers = new Headers(request.headers);
        headers.set('Host', 'iam.hanzo.ai');
        const iamRequest = new Request(iamUrl.toString(), {
          method: request.method,
          headers: headers,
          body: request.body,
          redirect: 'manual',
        });
        const response = await fetch(iamRequest);
        if (response.status >= 300 && response.status < 400) {
          const newHeaders = new Headers(response.headers);
          const location = newHeaders.get('location');
          if (location && location.includes('iam.hanzo.ai')) {
            newHeaders.set('location', location.replace('iam.hanzo.ai', 'hanzo.id'));
          }
          newHeaders.append('Set-Cookie', oauthContextCookie);
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders,
          });
        }
        // For 200 responses (SPA HTML), also set the cookie
        const newHeaders = new Headers(response.headers);
        newHeaders.append('Set-Cookie', oauthContextCookie);
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      }

      return new Response(getLoginPage(request.url, brand), {
        headers: {
          'content-type': 'text/html;charset=UTF-8',
          'cache-control': 'no-cache',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
        },
      });
    }

    // Proxy IAM API paths (token exchange, userinfo, signup, login, etc.)
    if (shouldProxyToIAM(pathname)) {
      const iamUrl = new URL(pathname + url.search, IAM_ORIGIN);

      const headers = new Headers(request.headers);
      headers.set('Host', 'iam.hanzo.ai');

      const iamRequest = new Request(iamUrl.toString(), {
        method: request.method,
        headers: headers,
        body: request.body,
        redirect: 'manual',
      });

      const response = await fetch(iamRequest);

      // Rewrite OIDC discovery URLs
      if (pathname.startsWith('/.well-known/')) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('json') || contentType.includes('text')) {
          const body = await response.text();
          const rewritten = body.replaceAll('iam.hanzo.ai', 'hanzo.id');
          const newHeaders = new Headers(response.headers);
          const location = newHeaders.get('location');
          if (location && location.includes('iam.hanzo.ai')) {
            newHeaders.set('location', location.replace('iam.hanzo.ai', 'hanzo.id'));
          }
          return new Response(rewritten, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders,
          });
        }
      }

      const newResponse = new Response(response.body, response);

      // Rewrite redirect locations from IAM back to hanzo.id
      const location = newResponse.headers.get('location');
      if (location && location.includes('iam.hanzo.ai')) {
        newResponse.headers.set('location', location.replace('iam.hanzo.ai', 'hanzo.id'));
      }

      return newResponse;
    }

    // Logout — clear session and redirect to login
    if (pathname === '/logout') {
      const logoutUrl = new URL('/api/logout', IAM_ORIGIN);
      logoutUrl.searchParams.set('id_token_hint', url.searchParams.get('id_token_hint') || '');
      logoutUrl.searchParams.set('post_logout_redirect_uri', `https://hanzo.id/login?prompt=login`);
      logoutUrl.searchParams.set('state', url.searchParams.get('state') || '');
      // Proxy logout to IAM then redirect to login
      try {
        await fetch(logoutUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
      } catch {}
      return new Response(null, {
        status: 302,
        headers: {
          Location: '/login?prompt=login',
          'Set-Cookie': 'casdoor_session_id=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax',
        },
      });
    }

    // Serve auth pages
    if (shouldServeLogin(pathname)) {
      let html;

      if (pathname === '/signup' || pathname.startsWith('/signup/')) {
        html = getSignupPage(request.url, brand);
      } else if (pathname === '/forget' || pathname.startsWith('/forget/')) {
        html = getForgotPage(request.url, brand);
      } else {
        // /login
        const hasOAuthParams = url.searchParams.has('client_id') || url.searchParams.has('redirect_uri');
        const forceLogin = url.searchParams.get('prompt') === 'login';

        if (hasOAuthParams || forceLogin) {
          html = getLoginPage(request.url, brand);
        } else {
          html = getPortalPage(brand);
        }
      }

      return new Response(html, {
        headers: {
          'content-type': 'text/html;charset=UTF-8',
          'cache-control': 'no-cache',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
        },
      });
    }

    // Proxy everything else to the marketing site
    const marketingOrigin = env.MARKETING_ORIGIN || MARKETING_ORIGIN;
    const marketingUrl = new URL(pathname + url.search, marketingOrigin);

    const marketingRequest = new Request(marketingUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    const response = await fetch(marketingRequest);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  },
};
