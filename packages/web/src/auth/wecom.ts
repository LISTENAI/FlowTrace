const WECOM_DESKTOP_AUTHORIZE_URL =
  'https://login.work.weixin.qq.com/wwlogin/sso/login';

export function isWeComBrowser(userAgent: string) {
  return /wxwork/i.test(userAgent);
}

export function weComAuthorizationURL(url: string, userAgent: string) {
  if (isWeComBrowser(userAgent)) return url;

  const mobile = new URL(url);
  const appId =
    mobile.searchParams.get('appid') ??
    mobile.searchParams.get('client_id');
  const agentId = mobile.searchParams.get('agentid');
  const redirectURI = mobile.searchParams.get('redirect_uri');
  const state = mobile.searchParams.get('state');
  if (!appId || !agentId || !redirectURI || !state) {
    throw new Error('企业微信登录参数不完整');
  }

  const desktop = new URL(WECOM_DESKTOP_AUTHORIZE_URL);
  desktop.searchParams.set('login_type', 'CorpApp');
  desktop.searchParams.set('appid', appId);
  desktop.searchParams.set('agentid', agentId);
  desktop.searchParams.set('redirect_uri', redirectURI);
  desktop.searchParams.set('state', state);
  return desktop.toString();
}
