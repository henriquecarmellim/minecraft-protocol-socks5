import { SocksClient, type SocksClientOptions } from 'socks';
import { SocksProxyAgent } from 'socks-proxy-agent';
import dns from 'node:dns/promises';
import { isIP } from 'node:net';
import type { Client } from 'minecraft-protocol';
import type { Socks5ProxyConfig, MinecraftServerConfig } from './config.ts';

/**
 * Cria a função de conexão customizada para o `minecraft-protocol`
 * que roteia o tráfego TCP através de um proxy SOCKS5.
 */
export function createSocksConnect(
  proxyConfig: Socks5ProxyConfig,
  serverConfig: MinecraftServerConfig
): (client: Client) => void {
  return (client: Client) => {
    (async () => {
      let targetHost = serverConfig.host;
      let targetPort = serverConfig.port;

      // Resolução local opcional de registros SRV do Minecraft (_minecraft._tcp.dominio.com)
      if (serverConfig.resolveSrvLocally && targetPort === 25565 && !isIP(targetHost) && targetHost !== 'localhost') {
        try {
          const records = await dns.resolveSrv(`_minecraft._tcp.${targetHost}`);
          if (records && records.length > 0 && records[0]) {
            targetHost = records[0].name;
            targetPort = records[0].port;
            console.log(`[DNS SRV] Servidor resolvido para ${targetHost}:${targetPort}`);
          }
        } catch {
          // Não possui SRV ou falhou; utiliza o host e porta originais
        }
      }

      console.log(`[SOCKS5] Estabelecendo conexão via proxy ${proxyConfig.host}:${proxyConfig.port} -> ${targetHost}:${targetPort}...`);

      const socksOptions: SocksClientOptions = {
        proxy: {
          host: proxyConfig.host,
          port: proxyConfig.port,
          type: 5,
          userId: proxyConfig.username,
          password: proxyConfig.password,
        },
        command: 'connect',
        destination: {
          host: targetHost,
          port: targetPort,
        },
        timeout: proxyConfig.timeoutMs,
      };

      try {
        const info = await SocksClient.createConnection(socksOptions);
        console.log(`[SOCKS5] Conexão via proxy estabelecida com sucesso!`);

        // Conecta o socket ao cliente do minecraft-protocol
        client.setSocket(info.socket);

        // Como o socket já está conectado via SOCKS5, disparamos o evento 'connect'
        // para que o minecraft-protocol inicie o handshake do protocolo
        client.emit('connect');
      } catch (err: any) {
        const errorMessage = `[SOCKS5 Falha] Não foi possível conectar ao destino ${targetHost}:${targetPort} através do proxy ${proxyConfig.host}:${proxyConfig.port}: ${err?.message || err}`;
        console.error(errorMessage);
        client.emit('error', new Error(errorMessage));
      }
    })();
  };
}

/**
 * Cria um Agent HTTP/HTTPS SOCKS5 para permitir que chamadas de autenticação
 * (por exemplo, OAuth da Microsoft/Mojang) também passem pelo proxy.
 */
export function createSocksHttpAgent(proxyConfig: Socks5ProxyConfig): SocksProxyAgent {
  let proxyUrl = 'socks5://';
  if (proxyConfig.username && proxyConfig.password) {
    proxyUrl += `${encodeURIComponent(proxyConfig.username)}:${encodeURIComponent(proxyConfig.password)}@`;
  } else if (proxyConfig.username) {
    proxyUrl += `${encodeURIComponent(proxyConfig.username)}@`;
  }
  proxyUrl += `${proxyConfig.host}:${proxyConfig.port}`;

  return new SocksProxyAgent(proxyUrl);
}
