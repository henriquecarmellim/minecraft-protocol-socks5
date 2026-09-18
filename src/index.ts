import { loadConfig } from './config.ts';
import { createMinecraftBot } from './client.ts';
import { pingServerViaProxy } from './ping.ts';
import { detectTorPort, checkTorStatus } from './tor.ts';

async function main() {
  const args = process.argv.slice(2);
  const config = loadConfig(args);

  console.log(`\n======================================================`);
  console.log(`   MINECRAFT SOCKS5 PROXY CLIENT - BUN + TYPESCRIPT   `);
  if (config.proxy.isTor) {
    console.log(`   🧅 [MODO REDE TOR ATIVADO - MÁXIMO ANONIMATO]      `);
  }
  console.log(`======================================================\n`);

  // Se o usuário solicitou apenas checar o status da rede Tor
  if (args.includes('--tor-check')) {
    console.log(`🧅 Verificando status e nó de saída da rede Tor...`);
    const port = (await detectTorPort(config.proxy.port)) || config.proxy.port;
    try {
      const status = await checkTorStatus(port, config.proxy.host);
      console.log(`\n✅ Conexão com a rede Tor verificada!`);
      console.log(`🌐 IP Público (Tor Exit Node): ${status.ip}`);
      console.log(`🧅 Tráfego Tor Autêntico: ${status.isTor ? 'SIM' : 'NÃO'}\n`);
      process.exit(0);
    } catch (err: any) {
      console.error(`\n❌ Falha ao verificar rede Tor na porta ${port}:`, err.message);
      console.log(`Dica: Certifique-se de que o Tor Browser ou o serviço Tor esteja aberto.\n`);
      process.exit(1);
    }
  }

  // Se o modo Tor estiver ativado, detecta a porta ativa (9050 ou 9150)
  if (config.proxy.isTor) {
    const detectedPort = await detectTorPort(config.proxy.port);
    if (!detectedPort) {
      console.error(`❌ [Erro Tor] Nenhum serviço Tor detectado em 127.0.0.1 (portas 9050 ou 9150).`);
      console.log(`👉 Para usar a rede Tor:`);
      console.log(`   1. Abra o Tor Browser no seu computador (porta 9150 padrão) OU`);
      console.log(`   2. Inicie o serviço Tor em background (porta 9050 padrão: winget install TorProject.Tor)`);
      console.log(`\nApós iniciar o Tor, execute este comando novamente.\n`);
      process.exit(1);
    }
    config.proxy.port = detectedPort;
    console.log(`🧅 Serviço Tor detectado e conectado na porta SOCKS5: ${detectedPort}`);
  }

  // Se o usuário passou --ping na linha de comando, apenas faz o ping via SOCKS5
  if (args.includes('--ping')) {
    console.log(`🔍 Modo de Teste: Executando ping no servidor via ${config.proxy.isTor ? 'Rede Tor' : 'SOCKS5'}...`);
    try {
      const result = await pingServerViaProxy(config.proxy, config.server);
      console.log(`\n✅ Resposta do Servidor via Proxy:`);
      console.log(`📡 Latência (Ping): ${result.latency}ms`);
      console.log(`🏷️  Versão: ${result.version.name} (Protocolo: ${result.version.protocol})`);
      console.log(`👥 Jogadores: ${result.players.online}/${result.players.max}`);
      const motd = typeof result.description === 'string' ? result.description : (result.description?.text || JSON.stringify(result.description));
      console.log(`📝 MOTD: ${motd}\n`);
      process.exit(0);
    } catch (err: any) {
      console.error(`\n❌ Falha ao realizar ping no servidor via proxy:`, err.message || err);
      process.exit(1);
    }
  }

  // Inicializa o bot conectando através do proxy
  const bot = createMinecraftBot(config);

  // Tratamento de encerramento seguro (CTRL+C)
  const handleExit = (signal: string) => {
    console.log(`\n[Processo] Sinal ${signal} recebido. Encerrando bot com segurança...`);
    bot.disconnect('Processo encerrado pelo usuário');
    setTimeout(() => {
      process.exit(0);
    }, 500);
  };

  process.on('SIGINT', () => handleExit('SIGINT'));
  process.on('SIGTERM', () => handleExit('SIGTERM'));
}

main().catch((err) => {
  console.error('[Erro Fatal]', err);
  process.exit(1);
});
