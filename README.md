# 🚀 minecraft-protocol-socks5 (Bun + TypeScript)

Projeto de cliente/bot para Minecraft desenvolvido em **TypeScript** utilizando o runtime ultrarrápido **Bun (bun.sh)** e a biblioteca **`minecraft-protocol`**, configurado para tunelar toda a conexão TCP (e opcionalmente as requisições HTTP de autenticação da Microsoft) através de um servidor **Proxy SOCKS5** ou pela **Rede Tor**.

---

## 📋 Características

- ⚡ **Runtime Bun**: Execução nativa de TypeScript com máxima performance e inicialização instantânea.
- 🛡️ **Proxy SOCKS5 Completo (RFC 1928)**: Tunelamento transparente dos pacotes TCP do Minecraft Protocol através de proxies SOCKS5 (com ou sem autenticação de usuário/senha).
- 🧅 **Suporte Nativo à Rede Tor**: Conecte-se com total anonimato através da rede Tor, com auto-detecção da porta ativa (`9050` ou `9150`) e suporte a servidores com endereços ocultos `.onion`.
- 🔐 **Autenticação Dupla**: Suporte a modo pirata/offline (`offline`) e contas oficiais Microsoft (`microsoft`). No modo Microsoft, o tráfego HTTP de OAuth também é roteado pelo proxy via `socks-proxy-agent`.
- 🌐 **Prevenção de DNS Leak**: Por padrão, o nome de domínio do servidor Minecraft é resolvido diretamente pelo proxy/Tor remoto, garantindo que o seu provedor de internet não veja as consultas DNS.
- 📡 **Suporte a Ping & MOTD**: Utilitário para consultar latência, MOTD e contagem de jogadores pelo proxy sem precisar entrar no jogo.
- 🧪 **Mock SOCKS5 Server e Teste E2E**: Servidor proxy mock embutido para testar localmente sem precisar de um proxy externo contratado.

---

## 🏗️ Arquitetura do Projeto

```
minecraft-protocol-socks5/
├── .env                  # Configurações ativas de Proxy e Servidor MC
├── .env.example          # Modelo documentado de variáveis de ambiente
├── bunfig.toml           # Configurações do Bun (compatibilidade Windows/OneDrive)
├── package.json          # Dependências e scripts do projeto
├── tsconfig.json         # Configuração estrita do TypeScript
├── README.md             # Documentação do projeto
└── src/
    ├── config.ts         # Leitor e validador tipado de configurações (.env)
    ├── socks-connector.ts# Conector SOCKS5 customizado para o minecraft-protocol
    ├── client.ts         # Inicialização do Bot MC, ciclo de vida e eventos de jogo
    ├── tor.ts            # Utilitários de detecção, verificação de IP e circuito Tor
    ├── ping.ts           # Utilitário de Ping/MOTD via Proxy SOCKS5
    ├── mock-proxy.ts     # Servidor proxy SOCKS5 local para desenvolvimento e testes
    ├── test-e2e.ts       # Teste automatizado ponta a ponta (Mock SOCKS5 + Servidor MC)
    └── index.ts          # Ponto de entrada principal da aplicação
```

---

## ⚙️ Configuração (.env)

Copie o arquivo `.env.example` para `.env` ou edite diretamente as variáveis:

```env
# ==========================================================
# CONFIGURAÇÕES DO PROXY SOCKS5 / REDE TOR
# ==========================================================
# Ative USE_TOR=true para usar a Rede Tor local (auto-detecta porta 9050 ou 9150)
USE_TOR=false

# Para proxies SOCKS5 comuns (se USE_TOR=false):
PROXY_HOST=127.0.0.1
PROXY_PORT=1080
PROXY_USERNAME=
PROXY_PASSWORD=
PROXY_TIMEOUT_MS=15000

# ==========================================================
# CONFIGURAÇÕES DO SERVIDOR DE MINECRAFT
# ==========================================================
MC_HOST=mc.exemplo.com
MC_PORT=25565

# Versão do Minecraft (ex: 1.20.4, 1.8.9). Deixe vazio para autodetectar via ping
MC_VERSION=

# Nome do jogador / Bot
MC_USERNAME=MinerBot

# Modo de autenticação: 'offline' ou 'microsoft'
MC_AUTH=offline

# Se true, resolve registros SRV localmente. Se false, delega a resolução ao proxy SOCKS5
RESOLVE_SRV_LOCALLY=false

# Roteia requisições HTTP da autenticação Microsoft via SOCKS5
ROUTE_AUTH_THROUGH_PROXY=true
```

---

## 🧅 Como Usar com a Rede Tor

A rede Tor expõe nativamente uma interface proxy SOCKS5 local:
- **Porta 9150**: Se você abrir o **Tor Browser**.
- **Porta 9050**: Se você executar o **Tor Expert Bundle** ou o serviço do Tor instalado via terminal (`winget install TorProject.Tor`).

### Passo a passo para usar com o Tor:

1. **Iniciar o Tor** (O Tor já está instalado no seu sistema):
   ```bash
   bun run tor:start
   ```
   *(Inicia o serviço Tor em segundo plano na porta 9050)*

2. **Verificar se o Tor está ativo e ver o seu IP de saída**:
   ```bash
   bun run tor:check
   ```
   *Retornará a confirmação da rede Tor e o IP público do nó de saída.*

3. **Conectar o bot de Minecraft através da Rede Tor**:
   ```bash
   bun run start:tor
   ```
   *(Ou ative `USE_TOR=true` no arquivo `.env` e rode `bun run start`)*

4. **Pinguar um servidor via Tor**:
   ```bash
   bun run ping:tor
   ```

5. **Encerrar o serviço Tor**:
   ```bash
   bun run tor:stop
   ```

> [!NOTE]
> No modo Tor, a resolução de domínios (DNS) é feita remotamente dentro da rede Onion, evitando 100% o vazamento de consultas para o seu provedor de internet (DNS Leak). Além disso, você pode se conectar diretamente a servidores Minecraft hospedados em domínios `.onion`!

---

## 🚀 Como Executar (Modo SOCKS5 Padrão)

### 1. Iniciar o Bot no Servidor
Inicia o cliente conectando através do proxy configurado no `.env`:
```bash
bun run start
```
Ou com reload automático ao alterar arquivos:
```bash
bun run dev
```

### 2. Apenas Pingar o Servidor via SOCKS5
Verifica se o proxy e o servidor Minecraft estão acessíveis, exibindo MOTD, versão e latência:
```bash
bun run ping
```

### 3. Iniciar Servidor Mock SOCKS5 para Testes
Caso queira testar localmente sem possuir um proxy SOCKS5 externo ativo:
```bash
bun run proxy:mock
```
Isso inicia um proxy SOCKS5 local na porta `1080`.

### 4. Executar Teste Automatizado E2E
Executa um teste ponta a ponta completo que sobe o mock proxy SOCKS5, um servidor Minecraft mock, realiza o ping e conecta o bot verificando todo o fluxo de pacotes:
```bash
bun run test:e2e
```

### 5. Verificação de Tipos TypeScript
Garante 100% de integridade e aderência aos tipos:
```bash
bun run typecheck
```

---

## 💡 Como Funciona o Tunelamento SOCKS5

O `minecraft-protocol` permite injetar uma função `connect(client)` personalizada na inicialização do cliente. Em vez de abrir uma conexão TCP direta via `net.connect()`, o nosso conector:

1. Conecta-se ao servidor SOCKS5 / nó local do Tor (`PROXY_HOST:PROXY_PORT`).
2. Executa a negociação RFC 1928.
3. Solicita ao proxy um comando `CONNECT` para o servidor Minecraft (`MC_HOST:MC_PORT`).
4. Assim que o túnel TCP é aberto, entrega o socket ao cliente via `client.setSocket(socket)` e emite o evento `connect`.
5. O `minecraft-protocol` assume o socket tunelado e realiza os pacotes `set_protocol` e `login_start`.
