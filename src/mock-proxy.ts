import net from 'node:net';

/**
 * Servidor SOCKS5 (RFC 1928) leve integrado para testes locais e desenvolvimento.
 * Permite testar o fluxo de conexão sem a necessidade de um servidor proxy externo.
 */
export function startMockSocks5Server(port = 1080, host = '127.0.0.1'): Promise<net.Server> {
  return new Promise((resolve, reject) => {
    const server = net.createServer((socket) => {
      let state: 'HANDSHAKE' | 'REQUEST' | 'CONNECTED' = 'HANDSHAKE';

      socket.on('data', (rawChunk: Buffer | string) => {
        const data = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);

        if (state === 'HANDSHAKE') {
          // RFC 1928: [VER, NMETHODS, METHODS...]
          if (data[0] !== 0x05) {
            socket.destroy();
            return;
          }
          // Responde 0x05 (SOCKS5), 0x00 (NO_AUTH)
          socket.write(Buffer.from([0x05, 0x00]));
          state = 'REQUEST';
          return;
        }

        if (state === 'REQUEST') {
          // RFC 1928: [VER, CMD, RSV, ATYP, DST.ADDR, DST.PORT]
          if (data[0] !== 0x05 || data[1] !== 0x01) {
            // Apenas CMD 0x01 (CONNECT) suportado no mock
            socket.write(Buffer.from([0x05, 0x07, 0x00, 0x01, 0, 0, 0, 0, 0, 0])); // Command not supported
            socket.destroy();
            return;
          }

          const atyp = data[3];
          let dstAddr = '';
          let dstPort = 0;
          let offset = 4;

          if (atyp === 0x01) {
            // IPv4
            dstAddr = `${data[offset]}.${data[offset + 1]}.${data[offset + 2]}.${data[offset + 3]}`;
            offset += 4;
          } else if (atyp === 0x03) {
            // Domain name
            const domainLength = Number(data[offset] ?? 0);
            offset += 1;
            dstAddr = data.subarray(offset, offset + domainLength).toString('utf8');
            offset += domainLength;
          } else if (atyp === 0x04) {
            // IPv6
            const parts: string[] = [];
            for (let i = 0; i < 16; i += 2) {
              parts.push(data.readUInt16BE(offset + i).toString(16));
            }
            dstAddr = parts.join(':');
            offset += 16;
          } else {
            socket.destroy();
            return;
          }

          dstPort = data.readUInt16BE(offset);

          console.log(`[Mock SOCKS5] Requisição CONNECT para ${dstAddr}:${dstPort}`);

          const remote = net.connect(dstPort, dstAddr, () => {
            // Resposta de sucesso: 0x05, 0x00 (Sucesso), 0x00, 0x01 (IPv4 0.0.0.0:0)
            socket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
            state = 'CONNECTED';

            // Bidirecional: Socket <-> Remote
            socket.pipe(remote);
            remote.pipe(socket);
          });

          remote.on('error', (err) => {
            console.error(`[Mock SOCKS5] Erro ao conectar ao destino ${dstAddr}:${dstPort}: ${err.message}`);
            // Connection refused (0x05)
            socket.write(Buffer.from([0x05, 0x05, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
            socket.destroy();
          });

          socket.on('error', () => {
            remote.destroy();
          });

          socket.on('close', () => {
            remote.destroy();
          });
        }
      });

      socket.on('error', () => {
        socket.destroy();
      });
    });

    server.listen(port, host, () => {
      console.log(`🛡️  [Mock SOCKS5] Proxy local escutando em ${host}:${port}`);
      resolve(server);
    });

    server.on('error', (err) => {
      reject(err);
    });
  });
}

// Se executado diretamente via terminal
if (import.meta.main) {
  const port = parseInt(process.env.PROXY_PORT || '1080', 10);
  startMockSocks5Server(port).then(() => {
    console.log(`Pronto para receber conexões de teste! Pressione CTRL+C para encerrar.`);
  }).catch((err) => {
    console.error(`Falha ao iniciar mock SOCKS5: ${err.message}`);
  });
}
