# 🚀 minecraft-protocol-socks5 (Bun + TypeScript)

Projeto de cliente/bot para Minecraft desenvolvido em **TypeScript** utilizando o runtime ultrarrápido **Bun (bun.sh)** e a biblioteca **`minecraft-protocol`**, configurado para tunelar toda a conexão TCP (e opcionalmente as requisições HTTP de autenticação da Microsoft) através de um servidor **Proxy SOCKS5**.

---

## 📋 Características

- ⚡ **Runtime Bun**: Execução nativa de TypeScript com máxima performance e inicialização instantânea.
- 🛡️ **Proxy SOCKS5 Completo (RFC 1928)**: Tunelamento transparente dos pacotes TCP do Minecraft Protocol através de proxies SOCKS5 (com ou sem autenticação de usuário/senha).
- 🔐 **Autenticação Dupla**: Suporte a modo pirata/offline (`offline`) e contas oficiais Microsoft (`microsoft`). No modo Microsoft, o tráfego HTTP de OAuth é roteado pelo SOCKS5 via `socks-proxy-agent`.
- 🌐 **Prevenção de DNS Leak**: Por padrão, o nome de domínio do servidor Minecraft é resolvido diretamente pelo servidor SOCKS5 remoto.
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
# CONFIGURAÇÕES DO PROXY SOCKS5
# ==========================================================
PROXY_HOST=127.0.0.1
PROXY_PORT=1080
# Preencha se o seu proxy SOCKS5 exigir autenticação
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

## 🚀 Como Executar

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

O `minecraft-protocol` permite injetar uma função `connect(client)` personalizada na inicialização do cliente. Em vez de abrir uma conexão TCP direta via `net.connect()`, o nosso `socks-connector.ts`:

1. Conecta-se ao servidor SOCKS5 (`PROXY_HOST:PROXY_PORT`).
2. Executa a negociação RFC 1928 (com ou sem credenciais).
3. Solicita ao proxy um comando `CONNECT` para o servidor Minecraft (`MC_HOST:MC_PORT`).
4. Assim que o túnel TCP é aberto, entrega o socket ao cliente via `client.setSocket(socket)` e emite o evento `connect`.
5. O `minecraft-protocol` assume o socket tunelado e realiza os pacotes `set_protocol` e `login_start`.
