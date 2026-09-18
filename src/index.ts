import readline from 'node:readline';
import { loadConfig } from './config.ts';
import { createMinecraftBot, type MinecraftBot } from './client.ts';
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
      console.log(`Dica: Inicie o serviço Tor com: bun run tor:start\n`);
      process.exit(1);
    }
  }

  // Se o modo Tor estiver ativado, detecta a porta ativa (9050 ou 9150)
  if (config.proxy.isTor) {
    const detectedPort = await detectTorPort(config.proxy.port);
    if (!detectedPort) {
      console.error(`❌ [Erro Tor] Nenhum serviço Tor detectado em 127.0.0.1 (portas 9050 ou 9150).`);
      console.log(`👉 Para iniciar a rede Tor automaticamente, execute:`);
      console.log(`   bun run tor:start\n`);
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

  // Previne o bug do minecraft-protocol de disparar duas conexões simultâneas quando a versão está vazia.
  // Se a versão não foi especificada no .env, usamos 1.20.4 como padrão seguro ou o valor configurado.
  if (!config.server.version) {
    config.server.version = '1.20.4';
  }

  let rl: readline.Interface | null = null;

  // Callback para receber mensagens de chat do jogo e imprimir sem quebrar o prompt do usuário
  const onChatMessage = (formatted: string) => {
    if (rl) {
      // Limpa a linha atual do prompt, imprime a mensagem do chat e restaura o prompt
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
      console.log(formatted);
      rl.prompt(true);
    } else {
      console.log(formatted);
    }
  };

  // Inicializa o bot conectando através do proxy
  const bot: MinecraftBot = createMinecraftBot(config, onChatMessage);

  // Inicializa o console interativo para o usuário digitar no terminal
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '\x1b[36m💬 [Você] > \x1b[0m',
  });

  console.log(`\n⌨️  [Console Interativo Ativado]`);
  console.log(`   Digite sua mensagem ou comando (ex: /login senha) e aperte Enter.`);
  console.log(`   Digite /quit para desconectar e sair.\n`);

  rl.prompt();

  rl.on('line', (line) => {
    const input = line.trim();
    if (!input) {
      rl?.prompt();
      return;
    }

    if (input === '/quit' || input === '/exit') {
      console.log('\n[Console] Encerrando conexão...');
      bot.disconnect('Comando /quit do usuário');
      rl?.close();
      process.exit(0);
    }

    if (input === '/help') {
      console.log('\n📖 Comandos do Console:');
      console.log('  /login <senha>       - Envia comando de login');
      console.log('  /register <senha>    - Envia comando de registro');
      console.log('  /quit                - Desconecta o bot e encerra');
      console.log('  <qualquer texto>     - Envia como mensagem normal no chat do jogo\n');
      rl?.prompt();
      return;
    }

    // Envia o texto ou comando digitado para o servidor
    bot.sendChat(input);
    rl?.prompt();
  });

  // Tratamento de encerramento seguro (CTRL+C)
  const handleExit = (signal: string) => {
    console.log(`\n[Processo] Sinal ${signal} recebido. Encerrando bot com segurança...`);
    rl?.close();
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
