import mc from 'minecraft-protocol';
import { createSocksConnect, createSocksHttpAgent } from './socks-connector.ts';
import { formatChatMessage, stripMinecraftColors } from './chat-formatter.ts';
import type { AppConfig } from './config.ts';

export interface MinecraftBot {
  client: mc.Client;
  sendChat: (message: string) => void;
  disconnect: (reason?: string) => void;
  isConnected: () => boolean;
}

export type ChatMessageHandler = (formatted: string, raw: string) => void;

/**
 * Cria e inicializa o cliente de Minecraft configurado para trafegar via SOCKS5,
 * com exibição completa e colorida do chat do jogo e console interativo.
 */
export function createMinecraftBot(config: AppConfig, onChatMessage?: ChatMessageHandler): MinecraftBot {
  const { proxy, server } = config;

  console.log('='.repeat(55));
  console.log(`🤖 Iniciando Bot do Minecraft: ${server.username}`);
  console.log(`🌐 Servidor Alvo: ${server.host}:${server.port} (Modo: ${server.auth.toUpperCase()})`);
  console.log(`🛡️  Proxy SOCKS5: ${proxy.host}:${proxy.port}${proxy.username ? ' (Com autenticação)' : ''}`);
  console.log(`📦 Versão: ${server.version || 'Auto-detecção (1.8.9 ~ 1.20.4)'}`);
  console.log('='.repeat(55));

  const connectFn = createSocksConnect(proxy, server);
  const httpAgent = server.routeAuthThroughProxy ? createSocksHttpAgent(proxy) : undefined;

  // Se o servidor for uma rede 1.8 como StarDix ou similar e nenhuma versão for forçada,
  // passar undefined pode acionar autoVersion do minecraft-protocol que dispara duas conexões.
  // Permitimos passar version diretamente ou fallback seguro.
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

  // Função auxiliar para despachar mensagens de chat
  const handleIncomingMessage = (prefix: string, content: any) => {
    const formatted = formatChatMessage(content);
    const raw = stripMinecraftColors(formatted);

    // Se o texto não for vazio
    if (raw.trim()) {
      const fullFormatted = `${prefix} ${formatted}`;
      if (onChatMessage) {
        onChatMessage(fullFormatted, raw);
      } else {
        console.log(fullFormatted);
      }
    }
  };

  // Evento de conexão do socket
  client.on('connect', () => {
    connected = true;
    console.log(`⚡ [Socket] Conexão SOCKS5 estabelecida com sucesso! Iniciando handshake do Minecraft...`);
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
    console.log(`🌍 Dimensão: ${packet?.dimension?.name ?? packet?.dimension ?? 'Principal'}`);
    console.log(`💡 Você já pode digitar comandos como /login ou conversar no chat abaixo!\n`);
  });

  // Mensagens de chat de outros jogadores (1.19+)
  client.on('playerChat', (data: any) => {
    const sender = data.senderName || data.sender || 'Jogador';
    const message = data.plainMessage || data.formattedMessage || data;
    handleIncomingMessage(`💬 <${sender}>`, message);
  });

  // Mensagens do sistema / anúncios do servidor (1.19+)
  client.on('systemChat', (data: any) => {
    const content = data.formattedMessage || data;
    handleIncomingMessage(`📢 [Sistema]`, content);
  });

  // Chat legado e pacotes de mensagens de servidores Bungee/Paper (1.8 a 1.18)
  client.on('chat', (packet: any) => {
    const content = packet.message || packet;
    handleIncomingMessage(`💬`, content);
  });

  // Desconexão ou expulsão pelo servidor
  client.on('kick_disconnect', (packet: any) => {
    const reason = formatChatMessage(packet.reason);
    console.warn(`\n⚠️ [Kick] Expulso do servidor: ${reason}\n`);
  });

  client.on('disconnect', (packet: any) => {
    const reason = formatChatMessage(packet.reason);
    console.warn(`\n⚠️ [Disconnect] Servidor encerrou a conexão: ${reason}\n`);
  });

  // Erro de rede ou protocolo
  client.on('error', (err: Error) => {
    console.error(`❌ [Erro do Cliente]: ${err.message}`);
    if (err.message.includes('timed out') && config.proxy.isTor) {
      console.error('\n💡 DICA IMPORTANTE SOBRE A REDE TOR:');
      console.error('Servidores com proteção Anti-DDoS rígida (como StarDix, RedeSky) costumam bloquear ou descartar');
      console.error('conexões originadas de nós de saída da Rede Tor.');
      console.error('👉 Para conectar em servidores que bloqueiam Tor, utilize um proxy SOCKS5 comum (residencial/VPS)');
      console.error('   definindo USE_TOR=false no seu .env e configurando o PROXY_HOST e PROXY_PORT.');
      console.error('👉 Servidores como Hypixel (play.hypixel.net) e servidores privados aceitam o Tor normalmente!\n');
    }
  });

  // Fim da conexão
  client.on('end', (reason: string) => {
    connected = false;
    console.log(`🔌 [Conexão Encerrada] Motivo: ${reason}`);
  });

  return {
    client,
    sendChat: (message: string) => {
      const trimmed = message.trim();
      if (!trimmed) return;

      try {
        // Se for um comando (começa com /)
        if (trimmed.startsWith('/')) {
          const command = trimmed.slice(1);
          // Tenta enviar via pacote chat_command (1.19+)
          try {
            (client as any).write('chat_command', {
              command,
              timestamp: BigInt(Date.now()),
              salt: 0n,
              argumentSignatures: [],
              signedPreview: false,
              messageCount: 0,
              acknowledged: Buffer.alloc(3),
              previousMessages: [],
            });
            console.log(`📤 [Comando Enviado] ${trimmed}`);
            return;
          } catch {
            // Em versões 1.8 a 1.18, comandos são enviados direto no pacote chat
          }
        }

        // Envio padrão de chat
        if (typeof client.chat === 'function') {
          client.chat(trimmed);
        } else {
          client.write('chat', { message: trimmed });
        }
        console.log(`📤 [Enviado] ${trimmed}`);
      } catch (err: any) {
        console.error(`❌ [Erro ao enviar mensagem]: ${err.message}`);
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
