import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';

const LOCALAPPDATA = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || 'C:\\Users\\gxote', 'AppData', 'Local');
const TOR_DIR = path.join(LOCALAPPDATA, 'Programs', 'Tor');
const TOR_EXE = path.join(TOR_DIR, 'tor', 'tor.exe');
const TORRC = path.join(TOR_DIR, 'torrc');

function isPortOpen(port = 9050, host = '127.0.0.1', timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => {
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

async function startTor() {
  if (await isPortOpen(9050)) {
    console.log('✅ O serviço Tor já está em execução na porta 9050!');
    return;
  }

  if (!fs.existsSync(TOR_EXE)) {
    console.error(`❌ Binário do Tor não encontrado em: ${TOR_EXE}`);
    process.exit(1);
  }

  console.log('🚀 Iniciando processo do Tor em segundo plano...');
  const child = spawn(TOR_EXE, ['-f', TORRC], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();

  // Aguarda até o Tor subir a porta SOCKS5 (máximo 20s)
  process.stdout.write('⏳ Aguardando bootstrap do Tor');
  for (let i = 0; i < 20; i++) {
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, 1000));
    if (await isPortOpen(9050)) {
      console.log('\n✅ Tor iniciado com sucesso e pronto para conexões na porta 9050!');
      return;
    }
  }

  console.log('\n⚠️ O processo foi disparado, mas a porta 9050 ainda está abrindo.');
}

async function stopTor() {
  console.log('🛑 Encerrando processos do Tor...');
  try {
    const proc = Bun.spawn(['taskkill', '/F', '/IM', 'tor.exe'], {
      stdout: 'ignore',
      stderr: 'ignore',
    });
    await proc.exited;
    console.log('✅ Processo do Tor finalizado!');
  } catch (err: any) {
    console.error('Falha ao encerrar Tor:', err.message);
  }
}

const command = process.argv[2] || 'start';

if (command === 'start') {
  await startTor();
} else if (command === 'stop') {
  await stopTor();
} else if (command === 'status') {
  const open = await isPortOpen(9050);
  console.log(`Status do Tor: ${open ? '🟢 ATIVO (Porta 9050)' : '🔴 INATIVO'}`);
} else {
  console.log('Uso: bun run src/tor-service.ts [start|stop|status]');
}
