import mc from 'minecraft-protocol';
import minecraftData from 'minecraft-data';
import { startMockSocks5Server } from './mock-proxy.ts';
import { createSocksConnect } from './socks-connector.ts';
import { pingServerViaProxy } from './ping.ts';

async function runE2ETest() {
  console.log('🧪 Iniciando teste automatizado ponta a ponta (E2E)...');

  const PROXY_PORT = 10855;
  const SERVER_PORT = 25595;
  const MC_VERSION = '1.20.4';

  // 1. Inicia o Mock SOCKS5 Proxy
  console.log(`[1/5] Iniciando Mock SOCKS5 na porta ${PROXY_PORT}...`);
  const proxyServer = await startMockSocks5Server(PROXY_PORT, '127.0.0.1');

  // 2. Inicia o Servidor Minecraft Mock
  console.log(`[2/5] Iniciando Servidor Minecraft local na porta ${SERVER_PORT}...`);
  const mcServer = mc.createServer({
    'online-mode': false,
    port: SERVER_PORT,
    host: '127.0.0.1',
    version: MC_VERSION,
    motd: 'Servidor de Teste SOCKS5',
    maxPlayers: 20,
  });

  const mcData = (minecraftData as any)(MC_VERSION);
  const loginPacket = mcData.loginPacket;

  await new Promise<void>((resolve) => {
    mcServer.on('listening', () => {
      console.log(`✅ Servidor Minecraft escutando na porta ${SERVER_PORT}`);
      resolve();
    });
  });

  let serverReceivedClient = false;
  mcServer.on('playerJoin', (client) => {
    serverReceivedClient = true;
    console.log(`🎮 [Servidor MC] Jogador ingressou: ${client.username}`);
    // Envia o pacote de login para o cliente finalizar o estado de entrada
    client.write('login', {
      ...loginPacket,
      enforceSecureChat: false,
      entityId: client.id,
      isHardcore: false,
      gameMode: 0,
      previousGameMode: 1,
      hashedSeed: [0, 0],
      maxPlayers: mcServer.maxPlayers,
      viewDistance: 10,
      reducedDebugInfo: false,
      enableRespawnScreen: true,
      isDebug: false,
      isFlat: false,
    });
  });

  const proxyConfig = {
    host: '127.0.0.1',
    port: PROXY_PORT,
    timeoutMs: 10000,
  };

  const serverConfig = {
    host: '127.0.0.1',
    port: SERVER_PORT,
    username: 'TestBotProxy',
    version: MC_VERSION,
    auth: 'offline' as const,
    resolveSrvLocally: false,
    routeAuthThroughProxy: false,
  };

  // 3. Testa o PING através do SOCKS5
  console.log(`[3/5] Testando PING do servidor عبر SOCKS5...`);
  const pingRes = await pingServerViaProxy(proxyConfig, serverConfig);
  console.log(`📡 Ping via SOCKS5 bem-sucedido: MOTD="${typeof pingRes.description === 'string' ? pingRes.description : pingRes.description.text}", Versão=${pingRes.version.name}`);

  // 4. Conecta o Cliente Minecraft ATRAVÉS do Proxy SOCKS5
  console.log(`[4/5] Conectando Cliente MC e realizando handshake através do SOCKS5...`);
  const connectFn = createSocksConnect(proxyConfig, serverConfig);

  const client = mc.createClient({
    host: serverConfig.host,
    port: serverConfig.port,
    username: serverConfig.username,
    version: serverConfig.version,
    connect: connectFn,
  });

  let clientLoggedIn = false;

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout aguardando login do cliente através do SOCKS5'));
    }, 10000);

    client.on('connect', () => {
      console.log(`⚡ [Cliente MC] Socket conectado através do proxy SOCKS5!`);
    });

    client.on('login', () => {
      clientLoggedIn = true;
      console.log(`🎉 [Cliente MC] Evento 'login' recebido com sucesso via SOCKS5!`);
      clearTimeout(timeout);
      resolve();
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  // 5. Validação e Finalização
  console.log(`[5/5] Validando assertions e encerrando instâncias...`);
  if (!serverReceivedClient || !clientLoggedIn) {
    throw new Error('Falha no teste: conexão ou login não confirmados!');
  }

  client.end('Fim do teste');
  mcServer.close();
  proxyServer.close();

  console.log('\n======================================================');
  console.log('✅ TESTE E2E CONCLUÍDO COM SUCESSO!');
  console.log('• Ping via proxy SOCKS5: OK');
  console.log('• Handshake via proxy SOCKS5: OK');
  console.log('• Troca de pacotes TCP do Minecraft Protocol: OK');
  console.log('======================================================\n');
  process.exit(0);
}

runE2ETest().catch((err) => {
  console.error('❌ Falha no teste E2E:', err);
  process.exit(1);
});
