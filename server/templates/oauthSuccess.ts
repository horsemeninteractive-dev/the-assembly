import { UserInternal } from '../../shared/types';
import { sanitizeUser } from '../routes/shared';

export function oauthSuccessPage(
  user: UserInternal,
  token: string,
  platform: string = 'web',
  nonce: string = '',
  exchangeCode: string = ''
): string {
  const targetOrigin = process.env.APP_URL || 'https://theassembly.web.app';
  const saneUser = sanitizeUser(user);
  const nonceAttr = nonce ? ` nonce="${nonce}"` : '';

  const authDataJson = JSON.stringify({
    user: saneUser,
    token: token,
    platform: platform,
    origin: targetOrigin,
    exchangeCode: exchangeCode,
  }).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authenticating | The Assembly</title>
  <link href="https://fonts.googleapis.com/css2?family=Quantico:wght@400;700&display=swap" rel="stylesheet">
  <style${nonceAttr}>
    :root {
      --color-primary: #ffffff;
      --color-bg: #07070a;
      --font-thematic: 'Quantico', sans-serif;
    }
    body { 
      background: var(--color-bg); 
      margin: 0; 
      padding: 0; 
      overflow: hidden;
      height: 100vh;
      width: 100vw;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }
    .background {
      position: absolute;
      inset: 0;
      z-index: 0;
      overflow: hidden;
      pointer-events: none;
    }
    .background img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0.6;
      filter: blur(40px);
      transform: scale(1.1);
    }
    .overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(to top, rgba(7,7,10,0.8), rgba(7,7,10,0.4));
    }
    .content {
      position: relative;
      z-index: 10;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .logo-box {
      width: 100px;
      height: 100px;
      background: rgba(0,0,0,0.6);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 2rem;
      box-shadow: 0 0 50px rgba(0,0,0,0.5);
      overflow: hidden;
    }
    .logo-box img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      padding: 1.2rem;
      filter: drop-shadow(0 0 15px rgba(255,255,255,0.15));
    }
    .brand-text {
      font-family: var(--font-thematic);
      font-size: 2rem;
      text-transform: uppercase;
      letter-spacing: 0.35em;
      margin: 0 0 0.75rem 0;
      color: white;
      text-shadow: 0 4px 12px rgba(0,0,0,0.8);
    }
    .divider {
      height: 1px;
      width: 8rem;
      background: linear-gradient(90deg, transparent, rgba(239,68,68,0.5), transparent);
      margin-bottom: 2.5rem;
    }
    .status {
      font-family: monospace;
      font-size: 10px;
      color: rgba(255,255,255,0.4);
      text-transform: uppercase;
      letter-spacing: 0.5em;
      animation: pulse 2s infinite ease-in-out;
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 0.8; }
    }
    .grain {
      position: absolute;
      inset: 0;
      background-image: url('https://grainy-gradients.vercel.app/noise.svg');
      opacity: 0.04;
      pointer-events: none;
      z-index: 5;
    }
  </style>
</head>
<body>
<div class="grain"></div>
<div class="background">
  <img src="/hero.png" alt="">
  <div class="overlay"></div>
</div>

<div class="content" id="container">
  <div class="logo-box">
    <img src="https://storage.googleapis.com/secretchancellor/SC.png" alt="Logo">
  </div>
  <h1 class="brand-text">The Assembly</h1>
  <div class="divider"></div>
  <p class="status">Authentication successful</p>
</div>

<script${nonceAttr}>
(function() {
  var authData = ${authDataJson};
  var user = authData.user;
  var userStr = JSON.stringify(user);
  var token = authData.token;
  var origin = authData.origin;
  var platform = authData.platform;
  var container = document.getElementById('container');
  var statusText = document.querySelector('.status');
  
  var exchangeCode = authData.exchangeCode;
  var redirectParams = exchangeCode 
    ? '?code=' + encodeURIComponent(exchangeCode)
    : '?token=' + encodeURIComponent(token) + '&user=' + encodeURIComponent(userStr);
  
  setTimeout(function() {
    statusText.textContent = 'Redirecting...';
    
    if (platform === 'android') {
      var intentLink = 'intent://auth' + redirectParams + '#Intent;scheme=theassembly;package=com.horsemeninteractive.theassembly;end';
      window.location.href = intentLink;
      setTimeout(function() {
        window.location.href = 'theassembly://auth' + redirectParams;
      }, 500);
    } else if (window.opener) {
      window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', user: user, token: token }, origin);
      window.close();
    } else {
      window.location.href = exchangeCode ? '/?code=' + encodeURIComponent(exchangeCode) : '/';
    }
  }, 1200);
})();
</script>
</body>
</html>`;
}


