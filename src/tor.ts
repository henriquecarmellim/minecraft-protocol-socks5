import net from 'node:net';
import https from 'node:https';
import { SocksProxyAgent } from 'socks-proxy-agent';

export interface TorStatusResult {
  isTor: boolean;
  ip: string;
}

/**
 * Tenta conectar rapidamente em uma porta TCP para verificar se está aberta.
 */
function isPortOpen(port: number, host = '127.0.0.1', timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isConnected = false;

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      isConnected = true;
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

/**
 * Detecta automaticamente se o Tor está rodando na porta 9050 (Tor Service)
 * ou na porta 9150 (Tor Browser).
 */
export async function detectTorPort(preferredPort?: number): Promise<number | null> {
  if (preferredPort && (await isPortOpen(preferredPort))) {
    return preferredPort;
  }

  // 9050: Tor Standalone / Daemon / Expert Bundle
  if (await isPortOpen(9050)) {
    return 9050;
  }

  // 9150: Tor Browser padrão
  if (await isPortOpen(9150)) {
    return 9150;
  }

  return null;
}

/**
 * Consulta a API oficial do Tor Project através do proxy SOCKS5
 * para verificar se a conexão está realmente saindo pela rede Tor e qual é o IP do nó de saída.
 */
export function checkTorStatus(port = 9050, host = '127.0.0.1'): Promise<TorStatusResult> {
  return new Promise((resolve, reject) => {
    const agent = new SocksProxyAgent(`socks5://${host}:${port}`);

    const req = https.get(
      'https://check.torproject.org/api/ip',
      {
        agent,
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TorCheck/1.0',
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            resolve({
              isTor: Boolean(data.IsTor),
              ip: data.IP || 'Desconhecido',
            });
          } catch (e) {
            reject(new Error(`Falha ao decodificar resposta do Tor Check: ${body}`));
          }
        });
      }
    );

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Tempo limite esgotado ao consultar check.torproject.org'));
    });
  });
}

/**
 * Solicita uma nova identidade (novo circuito e novo IP de saída)
 * ao Tor através da porta de controle (ControlPort - padrão 9051 ou 9151).
 */
export function requestNewTorIdentity(controlPort = 9051, password = '', host = '127.0.0.1'): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(controlPort, host, () => {
      socket.write(`AUTHENTICATE "${password}"\r\n`);
    });

    let authenticated = false;

    socket.on('data', (data) => {
      const response = data.toString();

      if (!authenticated) {
        if (response.startsWith('250')) {
          authenticated = true;
          socket.write('SIGNAL NEWNYM\r\n');
        } else {
          socket.destroy();
          reject(new Error(`Falha na autenticação do Tor ControlPort: ${response.trim()}`));
        }
      } else {
        if (response.startsWith('250')) {
          socket.destroy();
          resolve();
        } else {
          socket.destroy();
          reject(new Error(`Falha ao emitir SIGNAL NEWNYM: ${response.trim()}`));
        }
      }
    });

    socket.on('error', (err) => {
      reject(new Error(`Não foi possível conectar ao Tor ControlPort ${host}:${controlPort}: ${err.message}`));
    });
  });
}

// Executável direto para teste ou renovação de IP: bun run src/tor.ts [--renew]
if (import.meta.main) {
  (async () => {
    const isRenew = process.argv.includes('--renew') || process.argv.includes('renew');
    console.log('🧅 [Tor] Detectando serviços Tor locais...');
    const detected = await detectTorPort();

    if (!detected) {
      console.error('\n❌ Nenhum serviço Tor detectado nas portas 9050 (Tor Service) ou 9150 (Tor Browser)!');
      console.log('Dica: Inicie o Tor com "bun run tor:start" e tente novamente.\n');
      process.exit(1);
    }

    if (isRenew) {
      console.log('🔄 Solicitando novo circuito e novo IP para a rede Tor (NEWNYM)...');
      try {
        await requestNewTorIdentity(9051);
        console.log('✅ Novo circuito Tor solicitado com sucesso!');
        await new Promise((r) => setTimeout(r, 2000));
      } catch (err: any) {
        console.warn(`⚠️ Aviso ao renovar circuito (ControlPort 9051): ${err.message}`);
      }
    }

    console.log(`✅ Serviço Tor ativo na porta SOCKS5: ${detected}`);
    console.log('🔍 Consultando nó de saída em https://check.torproject.org/api/ip...');

    try {
      const status = await checkTorStatus(detected);
      console.log('\n======================================================');
      console.log(`🌐 IP do Nó de Saída Tor: ${status.ip}`);
      console.log(`🧅 Confirmado na Rede Tor: ${status.isTor ? 'SIM (100% Protegido)' : 'NÃO'}`);
      console.log('======================================================\n');
    } catch (err: any) {
      console.error(`❌ Erro ao consultar status do Tor: ${err.message}`);
      process.exit(1);
    }
  })();
}
