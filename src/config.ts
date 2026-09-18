/**
 * Configurações da aplicação, proxy SOCKS5 e servidor Minecraft.
 * Suporta leitura de variáveis de ambiente (.env) e valores padrão.
 */

export interface Socks5ProxyConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  timeoutMs: number;
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

export function loadConfig(): AppConfig {
  const proxyPort = parseInt(process.env.PROXY_PORT || '1080', 10);
  const serverPort = parseInt(process.env.MC_PORT || '25565', 10);

  const authMode = (process.env.MC_AUTH || 'offline').toLowerCase();
  const auth: 'offline' | 'microsoft' = authMode === 'microsoft' ? 'microsoft' : 'offline';

  return {
    proxy: {
      host: process.env.PROXY_HOST || '127.0.0.1',
      port: isNaN(proxyPort) ? 1080 : proxyPort,
      username: process.env.PROXY_USERNAME || undefined,
      password: process.env.PROXY_PASSWORD || undefined,
      timeoutMs: parseInt(process.env.PROXY_TIMEOUT_MS || '15000', 10),
    },
    server: {
      host: process.env.MC_HOST || 'localhost',
      port: isNaN(serverPort) ? 25565 : serverPort,
      username: process.env.MC_USERNAME || 'MinerBot',
      version: process.env.MC_VERSION ? process.env.MC_VERSION : undefined,
      auth,
      resolveSrvLocally: process.env.RESOLVE_SRV_LOCALLY === 'true',
      routeAuthThroughProxy: process.env.ROUTE_AUTH_THROUGH_PROXY !== 'false',
    },
  };
}
