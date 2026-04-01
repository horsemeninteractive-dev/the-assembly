import { UserInternal } from '../../src/types.ts';
import { sanitizeUser } from '../routes/shared.ts';

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
  <title>Authentication Success</title>
  <style${nonceAttr}>
    body { background: #0a0a0a; margin: 0; padding: 0; }
    .container { display: flex; flex-direction: column; align-items: center; margin-top: 20vh; font-family: sans-serif; color: white; }
  </style>
</head>
<body>
<div class="container" id="container">
  <p>Authentication successful. Redirecting...</p>
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
  
  var exchangeCode = authData.exchangeCode;
  var redirectParams = exchangeCode 
    ? '?code=' + encodeURIComponent(exchangeCode)
    : '?token=' + encodeURIComponent(token) + '&user=' + encodeURIComponent(userStr);
  
  if (platform === 'android') {
    var intentLink = 'intent://auth' + redirectParams + '#Intent;scheme=theassembly;package=com.horsemeninteractive.theassembly;end';
    window.location.href = intentLink;
    setTimeout(function() {
      window.location.href = 'theassembly://auth' + redirectParams;
    }, 500);

    var p = document.createElement('p');
    p.style.marginTop = '40px';
    p.style.color = '#888';
    p.style.fontSize = '14px';
    p.textContent = 'If you are not redirected automatically:';
    container.appendChild(p);

    var a = document.createElement('a');
    a.href = intentLink;
    a.style.marginTop = '15px';
    a.style.padding = '12px 24px';
    a.style.background = '#2563eb';
    a.style.color = 'white';
    a.style.textDecoration = 'none';
    a.style.borderRadius = '6px';
    a.style.fontWeight = 'bold';
    a.textContent = 'Return to The Assembly';
    container.appendChild(a);
  } else if (window.opener) {
    window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', user: user, token: token }, origin);
    window.close();
  } else {
    // Only use code-based redirect for better security on web fallback
    window.location.href = exchangeCode ? '/?code=' + encodeURIComponent(exchangeCode) : '/';
  }
})();
</script>
</body>
</html>`;
}
