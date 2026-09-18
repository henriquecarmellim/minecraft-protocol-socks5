import mc from 'minecraft-protocol';
import { createSocksConnect } from './socks-connector.ts';
import type { Socks5ProxyConfig, MinecraftServerConfig } from './config.ts';

export interface PingResult {
  version: {
    name: string;
    protocol: number;
  };
  players: {
    max: number;
    online: number;
    sample?: Array<{ name: string; id: string }>;
  };
  description: string | { text?: string };
  favicon?: string;
  latency: number;
}

/**
 * Realiza um ping no servidor de Minecraft عبر proxy SOCKS5,
 * retornando a MOTD, versão, jogadores online e a latência (ping).
 */
export async function pingServerViaProxy(
  proxyConfig: Socks5ProxyConfig,
  serverConfig: MinecraftServerConfig
): Promise<PingResult> {
  const connectFn = createSocksConnect(proxyConfig, serverConfig);

  const pingOptions: mc.PingOptions & { connect?: any; version?: string } = {
    host: serverConfig.host,
    port: serverConfig.port,
    version: serverConfig.version,
    connect: connectFn,
  };

  return (await mc.ping(pingOptions)) as PingResult;
}
