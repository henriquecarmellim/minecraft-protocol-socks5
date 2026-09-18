/**
 * Formatador e colorizador de mensagens de chat do Minecraft para o terminal.
 * Converte códigos de formatação § (Section Sign) em cores ANSI e decodifica JSON/NBT.
 */

const ANSI_RESET = '\x1b[0m';
const MINECRAFT_TO_ANSI: Record<string, string> = {
  '0': '\x1b[30m', // Preto
  '1': '\x1b[34m', // Azul Escuro
  '2': '\x1b[32m', // Verde Escuro
  '3': '\x1b[36m', // Ciano Escuro
  '4': '\x1b[31m', // Vermelho Escuro
  '5': '\x1b[35m', // Roxo
  '6': '\x1b[33m', // Ouro / Laranja
  '7': '\x1b[37m', // Cinza Claro
  '8': '\x1b[90m', // Cinza Escuro
  '9': '\x1b[94m', // Azul Claro
  'a': '\x1b[92m', // Verde Claro
  'b': '\x1b[96m', // Ciano Claro
  'c': '\x1b[91m', // Vermelho Claro
  'd': '\x1b[95m', // Rosa
  'e': '\x1b[93m', // Amarelo
  'f': '\x1b[97m', // Branco
  'l': '\x1b[1m',  // Negrito
  'o': '\x1b[3m',  // Itálico
  'r': '\x1b[0m',  // Reset
};

/**
 * Converte códigos de cores de Minecraft (§a, §c, etc.) para códigos de escape ANSI do terminal.
 */
export function minecraftColorsToAnsi(text: string): string {
  if (!text) return '';
  const converted = text.replace(/§([0-9a-fk-or])/gi, (_, code) => {
    const lower = code.toLowerCase();
    return MINECRAFT_TO_ANSI[lower] || '';
  });
  return converted + ANSI_RESET;
}

/**
 * Remove todos os códigos de formatação § caso precise de texto puro.
 */
export function stripMinecraftColors(text: string): string {
  if (!text) return '';
  return text.replace(/§[0-9a-fk-or]/gi, '');
}

/**
 * Desempacota recursivamente estruturas de Chat Component do Minecraft (JSON ou NBT).
 */
export function extractRawChatText(data: any): string {
  if (!data) return '';

  if (typeof data === 'string') {
    // Tenta verificar se é uma string JSON
    if (data.trim().startsWith('{') || data.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(data);
        return extractRawChatText(parsed);
      } catch {
        return data;
      }
    }
    return data;
  }

  let result = '';

  if (typeof data.text === 'string') {
    result += data.text;
  }

  if (Array.isArray(data.extra)) {
    for (const item of data.extra) {
      result += extractRawChatText(item);
    }
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      result += extractRawChatText(item);
    }
  }

  if (data.translate) {
    if (Array.isArray(data.with)) {
      result += data.with.map(extractRawChatText).join(' ');
    } else {
      result += data.translate;
    }
  }

  return result;
}

/**
 * Formata qualquer mensagem recebida do Minecraft pronta para exibição colorida no terminal.
 */
export function formatChatMessage(data: any): string {
  const rawText = extractRawChatText(data);
  return minecraftColorsToAnsi(rawText);
}
