/**
 * Configurações da aplicação, proxy SOCKS5 e servidor Minecraft.
 * Suporta leitura de variáveis de ambiente (.env), flags CLI (--tor) e valores padrão.
 */

export interface Socks5ProxyConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  timeoutMs: number;
  isTor?: boolean;
}

export interface MinecraftServerConfig {
  host: string;
  port: number;
  username: string;
  version?: string;
  auth: 'offline' | 'microsoft';
  resolveSrvLocally: boolean;
  routeAuthThroughProxy: boolean;
}

export interface AppConfig {
  proxy: Socks5ProxyConfig;
  server: MinecraftServerConfig;
}

export function loadConfig(args: string[] = []): AppConfig {
  const isTor =
    args.includes('--tor') ||
    process.env.USE_TOR === 'true' ||
    process.env.TOR_ENABLED === 'true';

  let defaultProxyPort = isTor ? 9050 : 1080;
  const rawProxyPort = process.env.PROXY_PORT;
  const proxyPort = rawProxyPort ? parseInt(rawProxyPort, 10) : defaultProxyPort;
  const serverPort = parseInt(process.env.MC_PORT || '25565', 10);

  const authMode = (process.env.MC_AUTH || 'offline').toLowerCase();
  const auth: 'offline' | 'microsoft' = authMode === 'microsoft' ? 'microsoft' : 'offline';

  // Na rede Tor, a resolução de DNS DEVE ser delegada ao proxy para evitar vazamentos de DNS (DNS Leak)
  const resolveSrvLocally = isTor ? false : process.env.RESOLVE_SRV_LOCALLY === 'true';

  return {
    proxy: {
      host: isTor ? (process.env.TOR_HOST || '127.0.0.1') : (process.env.PROXY_HOST || '127.0.0.1'),
      port: isNaN(proxyPort) ? defaultProxyPort : proxyPort,
      username: isTor ? undefined : (process.env.PROXY_USERNAME || undefined),
      password: isTor ? undefined : (process.env.PROXY_PASSWORD || undefined),
      timeoutMs: parseInt(process.env.PROXY_TIMEOUT_MS || (isTor ? '30000' : '15000'), 10),
      isTor,
    },
    server: {
      host: process.env.MC_HOST || 'localhost',
      port: isNaN(serverPort) ? 25565 : serverPort,
      username: process.env.MC_USERNAME || 'MinerBot',
      version: process.env.MC_VERSION ? process.env.MC_VERSION : undefined,
      auth,
      resolveSrvLocally,
      routeAuthThroughProxy: isTor ? true : process.env.ROUTE_AUTH_THROUGH_PROXY !== 'false',
    },
  };
}
