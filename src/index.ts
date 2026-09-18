import { loadConfig } from './config.ts';
import { createMinecraftBot } from './client.ts';
import { pingServerViaProxy } from './ping.ts';

async function main() {
  const config = loadConfig();
  const args = process.argv.slice(2);

  console.log(`\n======================================================`);
  console.log(`   MINECRAFT SOCKS5 PROXY CLIENT - BUN + TYPESCRIPT   `);
  console.log(`======================================================\n`);

  // Se o usuário passou --ping na linha de comando, apenas faz o ping via SOCKS5
  if (args.includes('--ping')) {
    console.log(`🔍 Modo de Teste: Executando ping no servidor via SOCKS5...`);
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
