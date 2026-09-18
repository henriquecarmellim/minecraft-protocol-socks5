import mc from 'minecraft-protocol';
import { createSocksConnect, createSocksHttpAgent } from './socks-connector.ts';
import type { AppConfig } from './config.ts';

export interface MinecraftBot {
  client: mc.Client;
  sendChat: (message: string) => void;
  disconnect: (reason?: string) => void;
  isConnected: () => boolean;
}

/**
 * Cria e inicializa o cliente de Minecraft configurado para trafegar via SOCKS5.
 */
export function createMinecraftBot(config: AppConfig): MinecraftBot {
  const { proxy, server } = config;

  console.log('='.repeat(55));
  console.log(`🤖 Iniciando Bot do Minecraft: ${server.username}`);
  console.log(`🌐 Servidor Alvo: ${server.host}:${server.port} (Modo: ${server.auth.toUpperCase()})`);
  console.log(`🛡️  Proxy SOCKS5: ${proxy.host}:${proxy.port}${proxy.username ? ' (Com autenticação)' : ''}`);
  if (server.version) {
    console.log(`📦 Versão Forçada: ${server.version}`);
  } else {
    console.log(`📦 Versão: Auto-detecção habilitada`);
  }
  console.log('='.repeat(55));

  const connectFn = createSocksConnect(proxy, server);
  const httpAgent = server.routeAuthThroughProxy ? createSocksHttpAgent(proxy) : undefined;

  const clientOptions: mc.ClientOptions = {
    host: server.host,
    port: server.port,
    username: server.username,
    version: server.version || undefined,
    auth: server.auth,
    connect: connectFn,
    agent: httpAgent,
  };

  const client = mc.createClient(clientOptions);
  let connected = false;

  // Evento de conexão do socket
  client.on('connect', () => {
    connected = true;
    console.log(`[Socket] Conectado ao servidor através do SOCKS5! Negociando protocolo...`);
  });

  // Mudança de estado do protocolo (handshaking -> login -> configuration -> play)
  client.on('state', (newState, oldState) => {
    console.log(`[Protocolo] Transição de estado: ${oldState} -> ${newState}`);
  });

  // Login confirmado pelo servidor
  client.on('login', (packet: any) => {
    console.log(`\n🎉 [Sucesso] ${server.username} logou com sucesso no servidor!`);
    console.log(`🆔 Entity ID: ${packet?.entityId ?? 'N/A'}`);
    console.log(`🎮 Modo de Jogo: ${packet?.gameMode ?? 'Padrão'}`);
    console.log(`🌍 Dimensão: ${packet?.dimension?.name ?? packet?.dimension ?? 'Principal'}\n`);
  });

  // Mensagens de chat de outros jogadores (1.19+)
  client.on('playerChat', (data: any) => {
    const sender = data.senderName || data.sender || 'Desconhecido';
    const message = data.plainMessage || data.formattedMessage || '';
    console.log(`💬 [Chat] <${sender}> ${message}`);
  });

  // Mensagens do sistema / anúncios do servidor
  client.on('systemChat', (data: any) => {
    try {
      const parsed = JSON.parse(data.formattedMessage);
      const text = parsed.text || data.formattedMessage;
      console.log(`📢 [Sistema] ${text}`);
    } catch {
      console.log(`📢 [Sistema] ${data.formattedMessage}`);
    }
  });

  // Chat legados (1.18 e anteriores)
  client.on('chat', (packet: any) => {
    try {
      const msg = JSON.parse(packet.message);
      const text = msg.text || (msg.extra ? msg.extra.map((e: any) => e.text || '').join('') : packet.message);
      console.log(`💬 [Mensagem] ${text}`);
    } catch {
      console.log(`💬 [Mensagem] ${packet.message}`);
    }
  });

  // Desconexão ou expulsão pelo servidor
  client.on('kick_disconnect', (packet: any) => {
    console.warn(`⚠️ [Kick/Disconnect] Expulso do servidor: ${packet.reason}`);
  });

  client.on('disconnect', (packet: any) => {
    console.warn(`⚠️ [Disconnect] Servidor desconectou o cliente: ${packet.reason}`);
  });

  // Erro de rede ou protocolo
  client.on('error', (err: Error) => {
    console.error(`❌ [Erro do Cliente]: ${err.message}`);
  });

  // Fim da conexão
  client.on('end', (reason: string) => {
    connected = false;
    console.log(`🔌 [Conexão Encerrada] Motivo: ${reason}`);
  });

  return {
    client,
    sendChat: (message: string) => {
      if (!connected) {
        console.warn(`[Aviso] Tentativa de enviar mensagem sem estar conectado.`);
        return;
      }
      try {
        client.chat(message);
      } catch (err: any) {
        console.error(`[Erro ao enviar chat]: ${err.message}`);
      }
    },
    disconnect: (reason = 'Cliente encerrou conexão') => {
      if (connected) {
        console.log(`[Bot] Desconectando: ${reason}`);
        client.end(reason);
      }
    },
    isConnected: () => connected,
  };
}
