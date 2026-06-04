const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const { plantillas, MapeoDeClaves } = require('../wspTemplates');

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY ||
  null;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

const WAHA_BASE_URL = process.env.WAHA_BASE_URL || '';
const WAHA_API_KEY = process.env.WAHA_API_KEY || '';
const DEFAULT_WAHA_SESSION = process.env.WAHA_SESSION || 'default';
const WAHA_SEND_ENDPOINT = process.env.WAHA_SEND_ENDPOINT || '/api/sendText';
const WAHA_SEEN_ENDPOINT = process.env.WAHA_SEEN_ENDPOINT || '/api/sendSeen';
const WAHA_START_TYPING_ENDPOINT = process.env.WAHA_START_TYPING_ENDPOINT || '/api/startTyping';
const WAHA_STOP_TYPING_ENDPOINT = process.env.WAHA_STOP_TYPING_ENDPOINT || '/api/stopTyping';
const WAHA_WEBHOOK_SECRET = process.env.WAHA_WEBHOOK_SECRET || '';
const BRIFY_PROFILE_URL = process.env.BRIFY_PROFILE_URL || 'https://agente.brifyai.com/profile';
const BRIFY_REGISTER_URL = process.env.BRIFY_REGISTER_URL || 'https://agente.brifyai.com/register';

const SUPABASE_LAWS_URL = process.env.REACT_APP_SUPABASE_LAWS_URL || process.env.SUPABASE_LAWS_URL || '';
const SUPABASE_LAWS_ANON_KEY = process.env.REACT_APP_SUPABASE_LAWS_ANON_KEY || process.env.SUPABASE_LAWS_ANON_KEY || '';

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || process.env.REACT_APP_MINIMAX_API_KEY || '';
const MINIMAX_ENDPOINT = process.env.MINIMAX_ENDPOINT || process.env.REACT_APP_MINIMAX_ENDPOINT || 'https://api.minimax.io/anthropic/v1/messages';
const MINIMAX_MODEL = process.env.MINIMAX_MODEL || process.env.REACT_APP_MINIMAX_MODEL || 'MiniMax-M2.7';
const WAHA_MINIMAX_ENABLED = (process.env.WAHA_MINIMAX_ENABLED || 'true').toLowerCase() === 'true';
const WAHA_MINIMAX_TEMPERATURE = Number(process.env.WAHA_MINIMAX_TEMPERATURE || '0.7');
const WAHA_ROUTER_ENABLED = (process.env.WAHA_ROUTER_ENABLED || 'true').toLowerCase() === 'true';
const WAHA_ROUTER_MIN_CONFIDENCE = Number(process.env.WAHA_ROUTER_MIN_CONFIDENCE || '0.55');

function normalizeIncomingText(text) {
  if (!text) return '';
  return String(text).trim();
}

function normalizePhoneFromChatId(chatId) {
  if (!chatId) return null;
  const raw = String(chatId);
  const base = raw.includes('@') ? raw.split('@')[0] : raw;
  const digits = base.replace(/[^\d]/g, '');
  return digits || null;
}

function normalizeChatIdForSend(chatId) {
  if (!chatId) return null;
  const raw = String(chatId);
  if (raw.endsWith('@lid') || raw.endsWith('@s.whatsapp.net')) {
    const digits = normalizePhoneFromChatId(raw);
    if (!digits) return raw;
    return `${digits}@c.us`;
  }
  return raw;
}

function endpointUrl(pathname) {
  const baseUrl = WAHA_BASE_URL.replace(/\/$/, '');
  const endpoint = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${baseUrl}${endpoint}`;
}

function isMenuTrigger(textLower) {
  return ['menu', 'menú', 'inicio', 'volver'].includes(textLower);
}

function isCreateDocumentTrigger(textLower) {
  if (!textLower) return false;
  if (textLower === '6') return true;
  return textLower.includes('crear documento') || textLower.includes('crear doc') || textLower.includes('documento');
}

function parseNumberSelection(text) {
  const raw = String(text || '');
  const match = raw.match(/\d+/);
  if (!match) return null;
  const n = Number(match[0]);
  if (!Number.isFinite(n)) return null;
  return n;
}

function buildMainMenu(nombre) {
  const displayName = nombre ? `, ${nombre}` : '';
  return `¡Hola${displayName}! 👋 Bienvenido/a a Brify. ¿En qué te puedo ayudar hoy?\n\n1️⃣ ⚖️ Asesor Legal\n2️⃣ 📁 Crear Grupo\n3️⃣ 🤝 Compartir Grupo\n4️⃣ 📤 Subir Archivo / Documento / Imagen\n5️⃣ 📋 Listar Documentos e Imágenes\n6️⃣ ✍️ Crear Documento\n7️⃣ 🔍 Analizar Documento\n\nPuedes escribir el número de la opción o directamente lo que necesitas hacer.`;
}

async function minimaxRewriteForWhatsApp(text) {
  if (!WAHA_MINIMAX_ENABLED) return text;
  if (!MINIMAX_API_KEY) return text;

  const input = String(text || '');
  if (!input.trim()) return input;
  if (input.length > 3500) return input;

  const system = `Eres el asistente oficial de Brify en WhatsApp. Reescribe el mensaje para que suene más humano, cálido y lúdico, usando emojis con moderación. Mantén EXACTAMENTE el significado y no inventes información.
Reglas estrictas:
- Conserva links, números, IDs, rutas y tokens tal cual.
- Mantén intacta la estructura de menús/listas (por ejemplo: "1️⃣", "2️⃣", saltos de línea).
- No agregues pasos nuevos ni cambies opciones.
- Máximo 1–2 emojis por bloque.`;

  const response = await fetch(MINIMAX_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MINIMAX_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      system,
      temperature: Number.isFinite(WAHA_MINIMAX_TEMPERATURE) ? WAHA_MINIMAX_TEMPERATURE : 0.7,
      max_tokens: 500,
      messages: [{ role: 'user', content: input }]
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return input;
  }

  const content = data?.content;
  if (typeof content === 'string' && content.trim()) return content;
  if (Array.isArray(content)) {
    const joined = content.map((b) => (typeof b === 'string' ? b : b?.text || '')).join('');
    if (joined.trim()) return joined;
  }
  if (data?.choices?.[0]?.message?.content) return data.choices[0].message.content;
  return input;
}

async function wahaSendText(chatId, text, sessionName) {
  if (!WAHA_BASE_URL) {
    throw new Error('WAHA_BASE_URL no configurado');
  }

  const toChatId = normalizeChatIdForSend(chatId);
  if (!toChatId) {
    throw new Error('chatId inválido para enviar');
  }

  let finalText = text;
  try {
    finalText = await minimaxRewriteForWhatsApp(text);
  } catch (_) {
    finalText = text;
  }

  const response = await fetch(endpointUrl(WAHA_SEND_ENDPOINT), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(WAHA_API_KEY ? { 'X-Api-Key': WAHA_API_KEY } : {})
    },
    body: JSON.stringify({
      session: sessionName || DEFAULT_WAHA_SESSION,
      chatId: toChatId,
      text: finalText
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`WAHA sendText failed: ${response.status} ${details}`);
  }

  return response.json().catch(() => null);
}

async function wahaSendSeen(chatId, sessionName) {
  if (!WAHA_BASE_URL) return null;
  const toChatId = normalizeChatIdForSend(chatId);
  if (!toChatId) return null;

  const response = await fetch(endpointUrl(WAHA_SEEN_ENDPOINT), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(WAHA_API_KEY ? { 'X-Api-Key': WAHA_API_KEY } : {})
    },
    body: JSON.stringify({
      session: sessionName || DEFAULT_WAHA_SESSION,
      chatId: toChatId
    })
  });

  return response.ok ? response.json().catch(() => null) : null;
}

async function wahaStartTyping(chatId, sessionName) {
  if (!WAHA_BASE_URL) return null;
  const toChatId = normalizeChatIdForSend(chatId);
  if (!toChatId) return null;

  const response = await fetch(endpointUrl(WAHA_START_TYPING_ENDPOINT), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(WAHA_API_KEY ? { 'X-Api-Key': WAHA_API_KEY } : {})
    },
    body: JSON.stringify({
      session: sessionName || DEFAULT_WAHA_SESSION,
      chatId: toChatId
    })
  });

  return response.ok ? response.json().catch(() => null) : null;
}

async function wahaStopTyping(chatId, sessionName) {
  if (!WAHA_BASE_URL) return null;
  const toChatId = normalizeChatIdForSend(chatId);
  if (!toChatId) return null;

  const response = await fetch(endpointUrl(WAHA_STOP_TYPING_ENDPOINT), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(WAHA_API_KEY ? { 'X-Api-Key': WAHA_API_KEY } : {})
    },
    body: JSON.stringify({
      session: sessionName || DEFAULT_WAHA_SESSION,
      chatId: toChatId
    })
  });

  return response.ok ? response.json().catch(() => null) : null;
}

function normalizeForIntent(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function detectIntentRuleBased(text) {
  const t = normalizeForIntent(text);
  if (!t) return { intent: 'unknown', confidence: 0 };

  if (['menu', 'menú', 'inicio', 'volver'].includes(t)) return { intent: 'menu', confidence: 1 };

  if (/^\d+$/.test(t)) {
    const n = Number(t);
    if (n >= 1 && n <= 7) return { intent: `menu_${n}`, confidence: 1 };
  }

  if (t.includes('asesor') || t.includes('abogad') || t.includes('legal') || t.includes('ley') || t.includes('demanda') || t.includes('contrato')) {
    return { intent: 'legal', confidence: 0.8 };
  }
  if (t.includes('crear grupo') || (t.includes('crear') && t.includes('grupo')) || t.includes('nueva carpeta') || t.includes('nuevo grupo')) {
    return { intent: 'create_group', confidence: 0.8 };
  }
  if (t.includes('compartir grupo') || (t.includes('compartir') && t.includes('grupo')) || (t.includes('invitar') && t.includes('grupo')) || t.includes('dar acceso')) {
    return { intent: 'share_group', confidence: 0.8 };
  }
  if (t.includes('subir') || t.includes('adjuntar') || t.includes('enviar archivo') || t.includes('cargar archivo')) {
    return { intent: 'upload_file', confidence: 0.8 };
  }
  if ((t.includes('listar') || t.includes('ver') || t.includes('mostrar')) && (t.includes('document') || t.includes('archivo') || t.includes('imagen'))) {
    return { intent: 'list_files', confidence: 0.75 };
  }
  if (t.includes('crear documento') || t.includes('crear doc') || (t.includes('hacer') && t.includes('documento')) || t.includes('plantilla')) {
    return { intent: 'create_document', confidence: 0.8 };
  }
  if (t.includes('analizar') || t.includes('resumir') || t.includes('interpretar') || (t.includes('revisar') && t.includes('document'))) {
    return { intent: 'analyze_document', confidence: 0.75 };
  }

  return { intent: 'unknown', confidence: 0 };
}

async function routeStageWithAI({ branch, stage, text, options }) {
  if (!WAHA_ROUTER_ENABLED) return null;
  if (!MINIMAX_API_KEY) return null;
  const input = normalizeIncomingText(text);
  if (!input) return null;
  if (!Array.isArray(options) || !options.length) return null;

  const safeOptions = options
    .map((o) => ({
      id: String(o?.id || '').trim(),
      label: String(o?.label || '').trim(),
      keywords: Array.isArray(o?.keywords) ? o.keywords.map((k) => String(k)) : []
    }))
    .filter((o) => o.id && o.label);

  if (!safeOptions.length) return null;

  const system = `Clasifica la intención del usuario dentro de un paso conversacional de WhatsApp.
Devuelve SOLO JSON válido (sin texto extra) con el formato:
{"option_id":"...","confidence":0.0}
Reglas:
- option_id debe ser uno de los ids listados.
- confidence entre 0 y 1.
- Si no estás seguro, devuelve confidence baja (<0.5).`;

  const response = await fetch(MINIMAX_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MINIMAX_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      system,
      temperature: 0,
      max_tokens: 120,
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            branch: String(branch || ''),
            stage: String(stage || ''),
            user_text: input,
            options: safeOptions
          })
        }
      ]
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) return null;

  let raw = data?.content;
  if (Array.isArray(raw)) raw = raw.map((b) => (typeof b === 'string' ? b : b?.text || '')).join('');
  if (typeof raw !== 'string') raw = data?.choices?.[0]?.message?.content;
  if (typeof raw !== 'string') return null;

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    const optionId = String(parsed?.option_id || '').trim();
    const confidence = Number(parsed?.confidence || 0);
    if (!optionId) return null;
    if (!safeOptions.some((o) => o.id === optionId)) return null;
    if (!Number.isFinite(confidence)) return null;
    if (confidence < (Number.isFinite(WAHA_ROUTER_MIN_CONFIDENCE) ? WAHA_ROUTER_MIN_CONFIDENCE : 0.55)) return null;
    return optionId;
  } catch (_) {
    return null;
  }
}

function getLawTitle(law) {
  return law?.['Título de la Norma'] || law?.titulo || law?.title || 'Título no disponible';
}

function getLawNumber(law) {
  return law?.['Número'] || law?.['Norma Número'] || law?.numero || law?.number || null;
}

function getLawUrl(law) {
  return law?.['Url'] || law?.url || null;
}

function getLawContent(law) {
  return law?.Contenido || law?.contenido || law?.content || '';
}

function extractLawQuery(text) {
  const t = normalizeIncomingText(text);
  if (!t) return '';
  const cleaned = t
    .replace(/buscar( una)? ley(es)?/gi, '')
    .replace(/necesito/gi, '')
    .replace(/quiero/gi, '')
    .replace(/sobre/gi, '')
    .replace(/ley( numero| n°| nro| n)?/gi, 'ley ')
    .trim();
  return cleaned;
}

function isLikelyLawSearch(text) {
  const t = normalizeForIntent(text);
  if (!t) return false;
  if (t.includes('buscar') && (t.includes('ley') || t.includes('norma') || t.includes('articulo') || t.includes('artículo'))) return true;
  if (t.includes('ley ') || /ley\s*\d+/i.test(t)) return true;
  if (t.includes('articulo') || t.includes('artículo')) return true;
  if (t.includes('norma') || t.includes('decreto') || t.includes('codigo') || t.includes('código')) return true;
  return false;
}

async function searchLawsRpc(query, limit = 5) {
  if (!SUPABASE_LAWS_URL || !SUPABASE_LAWS_ANON_KEY) return [];
  const q = String(query || '').trim();
  if (!q) return [];

  const response = await fetch(`${SUPABASE_LAWS_URL.replace(/\/$/, '')}/rest/v1/rpc/buscar_leyes`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_LAWS_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_LAWS_ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      termino_busqueda: q,
      limite_resultados: limit
    })
  });

  if (!response.ok) return [];
  const data = await response.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}

function formatLawResults(results) {
  if (!results?.length) return 'No encontré resultados 😕\n\nPuedes probar con otro término o con el número de ley (ej: "Ley 19.628").';
  const lines = results.slice(0, 7).map((law, idx) => {
    const titulo = getLawTitle(law);
    const numero = getLawNumber(law);
    const numText = numero ? ` — Ley ${numero}` : '';
    return `${idx + 1}️⃣ 📜 ${titulo}${numText}`;
  });
  return `📚 Encontré estos resultados:\n\n${lines.join('\n')}\n\nResponde con el número para ver el detalle, o escribe otro término.`;
}

function formatLawDetail(law) {
  const titulo = getLawTitle(law);
  const numero = getLawNumber(law);
  const url = getLawUrl(law);
  const contenido = getLawContent(law);
  const snippet = contenido ? contenido.slice(0, 900) + (contenido.length > 900 ? '…' : '') : 'Contenido no disponible';
  return `📜 ${titulo}\n${numero ? `Ley ${numero}\n` : ''}${url ? `Fuente: ${url}\n` : ''}\n${snippet}\n\n¿Quieres buscar otra ley o ver otro resultado?`;
}

async function handleAsesorLegal({ session, chatId, text, sessionName }) {
  const ctx = session.branch_context || {};
  const textTrim = normalizeIncomingText(text);
  const textLower = normalizeForIntent(textTrim);

  if (isMenuTrigger(textLower)) {
    await updateWspSession(session.id, { current_branch: null, branch_context: {} });
    const { data: user } = await supabase.from('users').select('name, full_name').eq('id', session.user_id).single();
    await wahaSendText(chatId, buildMainMenu(user?.name || user?.full_name || ''), sessionName);
    return;
  }

  if (!ctx.stage) {
    await updateWspSession(session.id, {
      current_branch: 'asesor_legal',
      branch_context: { stage: 'choose_mode' }
    });
    await wahaSendText(
      chatId,
      `¿Cómo quieres que te ayude hoy? ⚖️\n\n1️⃣ 📝 Compartir mi caso — cuéntame tu situación y te oriento con respaldo legal\n2️⃣ 🔎 Buscar una ley — dime el nombre, término o artículo que buscas`,
      sessionName
    );
    return;
  }

  if (ctx.stage === 'choose_mode') {
    const isCase = textLower === '1' || textLower.includes('caso') || textLower.includes('situacion') || textLower.includes('situación') || textLower.includes('problema');
    const isSearch = textLower === '2' || isLikelyLawSearch(textTrim);

    if (isSearch) {
      const query = extractLawQuery(textTrim);
      if (!query || query.length < 3) {
        await updateWspSession(session.id, { current_branch: 'asesor_legal', branch_context: { stage: 'law_search' } });
        await wahaSendText(chatId, `Perfecto 🔎 ¿Qué término, número de ley o artículo quieres buscar?`, sessionName);
        return;
      }

      const results = await searchLawsRpc(query, 7);
      await updateWspSession(session.id, {
        current_branch: 'asesor_legal',
        branch_context: { stage: 'law_results', last_query: query, results }
      });
      await wahaSendText(chatId, formatLawResults(results), sessionName);
      return;
    }

    if (isCase) {
      await updateWspSession(session.id, { current_branch: 'asesor_legal', branch_context: { stage: 'case_collect' } });
      await wahaSendText(chatId, `Cuéntame tu caso con el mayor detalle posible 📝\n\nQué pasó, fechas aproximadas y qué quieres lograr.`, sessionName);
      return;
    }

    if (textTrim.length > 8 && isLikelyLawSearch(textTrim)) {
      await updateWspSession(session.id, { current_branch: 'asesor_legal', branch_context: { stage: 'law_search' } });
      const query = extractLawQuery(textTrim);
      const results = await searchLawsRpc(query || textTrim, 7);
      await updateWspSession(session.id, { current_branch: 'asesor_legal', branch_context: { stage: 'law_results', last_query: query || textTrim, results } });
      await wahaSendText(chatId, formatLawResults(results), sessionName);
      return;
    }

    const optionId = await routeStageWithAI({
      branch: 'asesor_legal',
      stage: 'choose_mode',
      text: textTrim,
      options: [
        { id: 'case', label: 'Compartir mi caso', keywords: ['caso', 'situacion', 'problema', 'orientame', 'orientación'] },
        { id: 'law', label: 'Buscar una ley', keywords: ['buscar', 'ley', 'articulo', 'norma', 'decreto', 'codigo'] }
      ]
    });
    if (optionId === 'law') {
      await updateWspSession(session.id, { current_branch: 'asesor_legal', branch_context: { stage: 'law_search' } });
      const query = extractLawQuery(textTrim);
      if (!query || query.length < 2) {
        await wahaSendText(chatId, `Perfecto 🔎 ¿Qué término, número de ley o artículo quieres buscar?`, sessionName);
        return;
      }
      const results = await searchLawsRpc(query, 7);
      await updateWspSession(session.id, { current_branch: 'asesor_legal', branch_context: { stage: 'law_results', last_query: query, results } });
      await wahaSendText(chatId, formatLawResults(results), sessionName);
      return;
    }
    if (optionId === 'case') {
      await updateWspSession(session.id, { current_branch: 'asesor_legal', branch_context: { stage: 'case_collect' } });
      await wahaSendText(chatId, `Cuéntame tu caso con el mayor detalle posible 📝\n\nQué pasó, fechas aproximadas y qué quieres lograr.`, sessionName);
      return;
    }

    await wahaSendText(chatId, `¿Prefieres?\n\n1️⃣ 📝 Compartir mi caso\n2️⃣ 🔎 Buscar una ley`, sessionName);
    return;
  }

  if (ctx.stage === 'law_search') {
    const query = extractLawQuery(textTrim) || textTrim;
    if (!query || query.length < 2) {
      await wahaSendText(chatId, `Dime el término o número de ley 😊`, sessionName);
      return;
    }
    const results = await searchLawsRpc(query, 7);
    await updateWspSession(session.id, { current_branch: 'asesor_legal', branch_context: { stage: 'law_results', last_query: query, results } });
    await wahaSendText(chatId, formatLawResults(results), sessionName);
    return;
  }

  if (ctx.stage === 'law_results') {
    const selection = parseNumberSelection(textTrim);
    const results = Array.isArray(ctx.results) ? ctx.results : [];
    if (selection && results[selection - 1]) {
      const law = results[selection - 1];
      await updateWspSession(session.id, { current_branch: 'asesor_legal', branch_context: { stage: 'law_results', last_query: ctx.last_query, results, selected: selection - 1 } });
      await wahaSendText(chatId, formatLawDetail(law), sessionName);
      return;
    }

    const query = extractLawQuery(textTrim) || textTrim;
    if (!query) {
      await wahaSendText(chatId, `Responde con un número de la lista o escribe otra búsqueda 🔎`, sessionName);
      return;
    }
    const newResults = await searchLawsRpc(query, 7);
    await updateWspSession(session.id, { current_branch: 'asesor_legal', branch_context: { stage: 'law_results', last_query: query, results: newResults } });
    await wahaSendText(chatId, formatLawResults(newResults), sessionName);
    return;
  }

  if (ctx.stage === 'case_collect') {
    const description = textTrim;
    if (!description || description.length < 20) {
      await wahaSendText(chatId, `Cuéntame un poquito más 🙌 (qué pasó, cuándo, con quién y qué necesitas)`, sessionName);
      return;
    }

    const candidateLaws = await searchLawsRpc(description, 5);
    const lawsContext = candidateLaws
      .slice(0, 3)
      .map((law, idx) => {
        const titulo = getLawTitle(law);
        const numero = getLawNumber(law) || 'No disponible';
        const url = getLawUrl(law);
        const contenido = getLawContent(law);
        const fragmento = contenido ? contenido.slice(0, 700) + (contenido.length > 700 ? '…' : '') : 'Contenido no disponible';
        return `--- Ley ${idx + 1} ---\nTítulo: ${titulo}\nNúmero: ${numero}\n${url ? `Fuente: ${url}\n` : ''}Fragmento:\n${fragmento}`;
      })
      .join('\n\n');

    let answer = '';
    if (MINIMAX_API_KEY) {
      const system = `Eres un asesor legal en WhatsApp para Brify. Responde en español, con tono humano y cercano.
Si hay contexto legal, cita la ley/artículo de forma clara. Si falta información, haz 1-2 preguntas de aclaración.
No inventes artículos ni números.`;
      const response = await fetch(MINIMAX_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${MINIMAX_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: MINIMAX_MODEL,
          system,
          temperature: 0.4,
          max_tokens: 700,
          messages: [
            { role: 'user', content: `Caso del usuario:\n${description}\n\nContexto de leyes (puede estar vacío):\n${lawsContext || '(sin contexto)'}\n\nResponde:` }
          ]
        })
      });
      const data = await response.json().catch(() => ({}));
      let raw = data?.content;
      if (Array.isArray(raw)) raw = raw.map((b) => (typeof b === 'string' ? b : b?.text || '')).join('');
      if (typeof raw !== 'string') raw = data?.choices?.[0]?.message?.content;
      answer = typeof raw === 'string' ? raw : '';
    }

    if (!answer) {
      answer = `Gracias por el detalle 🙌\n\nPara orientarte mejor, necesito 2 datos:\n1) ¿En qué ciudad/comuna ocurrió?\n2) ¿Qué quieres lograr exactamente (cobrar, terminar contrato, demanda, etc.)?\n\nSi quieres, también puedo buscar una ley específica: dime el término o número (ej: "Ley 19.628").`;
    }

    await updateWspSession(session.id, { current_branch: 'asesor_legal', branch_context: { stage: 'choose_mode' } });
    await wahaSendText(chatId, answer, sessionName);
    return;
  }

  await updateWspSession(session.id, { current_branch: 'asesor_legal', branch_context: { stage: 'choose_mode' } });
  await wahaSendText(chatId, `¿Quieres?\n\n1️⃣ 📝 Compartir mi caso\n2️⃣ 🔎 Buscar una ley`, sessionName);
}

async function detectIntentWithAI(text) {
  if (!MINIMAX_API_KEY) return { intent: 'unknown', confidence: 0 };
  const t = normalizeIncomingText(text);
  if (!t) return { intent: 'unknown', confidence: 0 };

  const system = `Clasifica la intención del usuario para un menú de WhatsApp de Brify.
Devuelve SOLO JSON válido con este formato:
{"intent":"menu|legal|create_group|share_group|upload_file|list_files|create_document|analyze_document|unknown","confidence":0.0}
Reglas:
- No agregues texto fuera del JSON.
- Si el usuario pide "asesor legal/abogado/ley" => legal
- "crear grupo/carpeta" => create_group
- "compartir grupo/dar acceso" => share_group
- "subir/adjuntar archivo" => upload_file
- "ver/listar documentos/imagenes" => list_files
- "crear documento/plantilla" => create_document
- "analizar/resumir documento" => analyze_document
- Si hay duda => unknown con baja confianza.`;

  const response = await fetch(MINIMAX_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MINIMAX_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      system,
      temperature: 0,
      max_tokens: 120,
      messages: [{ role: 'user', content: t }]
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { intent: 'unknown', confidence: 0 };
  }

  let raw = data?.content;
  if (Array.isArray(raw)) raw = raw.map((b) => (typeof b === 'string' ? b : b?.text || '')).join('');
  if (typeof raw !== 'string') raw = data?.choices?.[0]?.message?.content;
  if (typeof raw !== 'string') return { intent: 'unknown', confidence: 0 };

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { intent: 'unknown', confidence: 0 };
  try {
    const parsed = JSON.parse(match[0]);
    const intent = parsed?.intent;
    const confidence = Number(parsed?.confidence || 0);
    if (typeof intent !== 'string') return { intent: 'unknown', confidence: 0 };
    return { intent, confidence: Number.isFinite(confidence) ? confidence : 0 };
  } catch (_) {
    return { intent: 'unknown', confidence: 0 };
  }
}

function parseEmails(text) {
  const matches = String(text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return Array.from(new Set(matches.map((e) => e.toLowerCase())));
}

function normalizeYesNo(text) {
  const t = normalizeForIntent(text);
  if (!t) return null;
  if (['si', 'sí', 's', 'dale', 'ok', 'okay', 'confirmo', 'confirmar', 'confirmado', 'yes'].includes(t)) return true;
  if (['no', 'n', 'cancelar', 'cancela', 'anular', 'stop'].includes(t)) return false;
  if (t.includes('si')) return true;
  if (t.includes('no')) return false;
  return null;
}

function extractQuoted(text) {
  const s = String(text || '');
  const m1 = s.match(/"([^"]+)"/);
  if (m1?.[1]) return m1[1].trim();
  const m2 = s.match(/'([^']+)'/);
  if (m2?.[1]) return m2[1].trim();
  return null;
}

function guessGroupName(text) {
  const quoted = extractQuoted(text);
  if (quoted) return quoted;
  const t = String(text || '').trim();
  if (!t) return null;
  const cleaned = t
    .replace(/crear( un| una)?/i, '')
    .replace(/grupo/i, '')
    .replace(/llamad[oa]/i, '')
    .replace(/que se llame/i, '')
    .replace(/con/gi, '')
    .trim();
  if (cleaned.length < 2) return null;
  return cleaned;
}

async function listUserGroupsByEmail(userEmail) {
  if (!userEmail) return [];
  const { data, error } = await supabase
    .from('grupos_drive')
    .select('id, group_name, folder_id, administrador')
    .eq('administrador', userEmail)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error || !Array.isArray(data)) return [];
  return data;
}

function findGroupByName(groups, query) {
  const q = normalizeForIntent(query);
  if (!q) return null;
  const exact = groups.find((g) => normalizeForIntent(g.group_name) === q);
  if (exact) return exact;
  const contains = groups.find((g) => normalizeForIntent(g.group_name).includes(q));
  if (contains) return contains;
  return null;
}

function pickGroupFromInput(groups, input) {
  const selection = parseNumberSelection(input);
  if (selection && groups[selection - 1]) return groups[selection - 1];
  return findGroupByName(groups, input);
}

async function createDriveFolder({ userId, parentFolderId, name }) {
  const drive = await getDriveClientForUser(userId);
  const response = await drive.files.create({
    requestBody: {
      name,
      parents: [parentFolderId],
      mimeType: 'application/vnd.google-apps.folder'
    },
    fields: 'id, webViewLink, name'
  });
  return response.data;
}

async function shareDriveFolder({ userId, folderId, emails, role }) {
  const drive = await getDriveClientForUser(userId);
  const normalizedRole = role === 'reader' || role === 'writer' ? role : 'reader';
  const results = [];
  for (const email of emails) {
    const response = await drive.permissions.create({
      fileId: folderId,
      requestBody: {
        type: 'user',
        role: normalizedRole,
        emailAddress: email
      },
      fields: 'id'
    });
    results.push({ email, permissionId: response.data?.id || null });
  }
  return results;
}

function normalizeMediaUrl(url) {
  if (!url) return null;
  const s = String(url);
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  const base = WAHA_BASE_URL.replace(/\/$/, '');
  const endpoint = s.startsWith('/') ? s : `/${s}`;
  return `${base}${endpoint}`;
}

function extractMediaFromPayload(payload) {
  if (!payload) return null;
  if (payload.hasMedia && payload.media && payload.media.url) {
    return {
      url: payload.media.url,
      mimetype: payload.media.mimetype || payload.media.mimeType || null,
      filename: payload.media.filename || payload.media.fileName || null
    };
  }
  if (payload.media && payload.media.url) {
    return {
      url: payload.media.url,
      mimetype: payload.media.mimetype || payload.media.mimeType || null,
      filename: payload.media.filename || payload.media.fileName || null
    };
  }
  return null;
}

async function uploadFileFromUrlToDrive({ userId, parentFolderId, fileName, mimeType, url }) {
  const drive = await getDriveClientForUser(userId);
  const headers = {
    ...(WAHA_API_KEY ? { 'X-Api-Key': WAHA_API_KEY } : {})
  };
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`No se pudo descargar el archivo desde WAHA: ${response.status} ${details}`);
  }
  const buf = Buffer.from(await response.arrayBuffer());
  const created = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [parentFolderId],
      mimeType: mimeType || undefined
    },
    media: {
      mimeType: mimeType || 'application/octet-stream',
      body: buf
    },
    fields: 'id, webViewLink, name, mimeType'
  });
  return created.data;
}

async function listDriveFiles({ userId, folderId, kind }) {
  const drive = await getDriveClientForUser(userId);
  const qBase = `'${folderId}' in parents and trashed=false`;
  let q = qBase;
  if (kind === 'images') {
    q = `${qBase} and mimeType contains 'image/'`;
  } else if (kind === 'docs') {
    q = `${qBase} and mimeType != 'application/vnd.google-apps.folder' and not mimeType contains 'image/'`;
  }
  const response = await drive.files.list({
    q,
    pageSize: 15,
    fields: 'files(id,name,mimeType,modifiedTime,webViewLink,size)'
  });
  return Array.isArray(response.data?.files) ? response.data.files : [];
}

async function getDriveFileText({ userId, fileId, mimeType }) {
  const drive = await getDriveClientForUser(userId);

  if (mimeType === 'application/vnd.google-apps.document') {
    const res = await drive.files.export({ fileId, mimeType: 'text/plain' }, { responseType: 'arraybuffer' });
    return Buffer.from(res.data).toString('utf8');
  }

  if (mimeType && mimeType.startsWith('text/')) {
    const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
    return Buffer.from(res.data).toString('utf8');
  }

  return null;
}

async function handleCrearGrupo({ session, chatId, text, sessionName }) {
  const ctx = session.branch_context || {};
  const textTrim = normalizeIncomingText(text);
  const textLower = normalizeForIntent(textTrim);

  if (isMenuTrigger(textLower)) {
    await updateWspSession(session.id, { current_branch: null, branch_context: {} });
    const { data: user } = await supabase.from('users').select('name, full_name').eq('id', session.user_id).single();
    await wahaSendText(chatId, buildMainMenu(user?.name || user?.full_name || ''), sessionName);
    return;
  }

  if (!ctx.stage) {
    await updateWspSession(session.id, { current_branch: 'crear_grupo', branch_context: { stage: 'ask_name' } });
    await wahaSendText(chatId, `¡Vamos a crear tu nuevo grupo! 📁 ¿Cómo se llamará?`, sessionName);
    return;
  }

  if (ctx.stage === 'ask_name') {
    const name = guessGroupName(textTrim);
    if (!name) {
      await wahaSendText(chatId, `Dime el nombre del grupo 📁 (puedes escribirlo entre comillas).`, sessionName);
      return;
    }
    await updateWspSession(session.id, { current_branch: 'crear_grupo', branch_context: { stage: 'confirm_name', group_name: name } });
    await wahaSendText(chatId, `Perfecto ✅ ¿Confirmas crear el grupo "${name}"? (sí/no)`, sessionName);
    return;
  }

  if (ctx.stage === 'confirm_name') {
    const ok = normalizeYesNo(textTrim);
    if (ok === false) {
      await updateWspSession(session.id, { current_branch: 'crear_grupo', branch_context: { stage: 'ask_name' } });
      await wahaSendText(chatId, `Ok 🙌 ¿Qué nombre le ponemos entonces?`, sessionName);
      return;
    }
    if (ok !== true) {
      await wahaSendText(chatId, `¿Confirmas? Responde "sí" o "no" 🙌`, sessionName);
      return;
    }

    const { data: user, error } = await supabase.from('users').select('email').eq('id', session.user_id).single();
    const userEmail = user?.email;
    if (error || !userEmail) {
      await updateWspSession(session.id, { current_branch: null, branch_context: {} });
      await wahaSendText(chatId, `No pude obtener tu usuario 😕 Escribe "menú" para reiniciar.`, sessionName);
      return;
    }

    const rootFolderId = await resolveRootFolderIdForUser(userEmail, session.user_id);
    if (!rootFolderId) {
      await updateWspSession(session.id, { current_branch: null, branch_context: {} });
      await wahaSendText(chatId, `No encontré tu carpeta raíz de Brify 😕 Revisa tu configuración en ${BRIFY_PROFILE_URL}`, sessionName);
      return;
    }

    const groupName = String(ctx.group_name || 'Grupo').trim();
    const folder = await createDriveFolder({ userId: session.user_id, parentFolderId: rootFolderId, name: groupName });

    await supabase.from('grupos_drive').insert({
      id: crypto.randomUUID(),
      owner_id: session.user_id,
      group_name: groupName,
      nombre_grupo_low: groupName.toLowerCase(),
      folder_id: folder.id,
      administrador: userEmail,
      extension: 'abogados',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    await updateWspSession(session.id, { current_branch: 'crear_grupo', branch_context: { stage: 'ask_share', folder_id: folder.id, group_name: groupName } });
    await wahaSendText(chatId, `¡Listo! 🎉 Tu grupo "${groupName}" fue creado.\n\n¿Quieres compartirlo con alguien? Puedes indicarme uno o varios correos separados por coma, o escribe "no".`, sessionName);
    return;
  }

  if (ctx.stage === 'ask_share') {
    const ok = normalizeYesNo(textTrim);
    if (ok === false) {
      await updateWspSession(session.id, { current_branch: null, branch_context: {} });
      await wahaSendText(chatId, `Perfecto ✅ ¿Necesitas algo más? Escribe "menú" 🙌`, sessionName);
      return;
    }

    const emails = parseEmails(textTrim);
    if (!emails.length) {
      await wahaSendText(chatId, `Pásame uno o varios correos separados por coma, o escribe "no".`, sessionName);
      return;
    }

    const role = process.env.WAHA_DRIVE_SHARE_ROLE || 'reader';
    try {
      await shareDriveFolder({ userId: session.user_id, folderId: ctx.folder_id, emails, role });
      await updateWspSession(session.id, { current_branch: null, branch_context: {} });
      await wahaSendText(chatId, `¡Hecho! ✅ Compartí "${ctx.group_name}" con: ${emails.join(', ')}\n\n¿Algo más? Escribe "menú" 🙌`, sessionName);
    } catch (_) {
      await updateWspSession(session.id, { current_branch: null, branch_context: {} });
      await wahaSendText(chatId, `Tuve un problema compartiendo el grupo 😕\n\n¿Quieres intentarlo de nuevo? Escribe "compartir grupo"`, sessionName);
    }
    return;
  }
}

async function handleCompartirGrupo({ session, chatId, text, sessionName }) {
  const ctx = session.branch_context || {};
  const textTrim = normalizeIncomingText(text);
  const textLower = normalizeForIntent(textTrim);

  if (isMenuTrigger(textLower)) {
    await updateWspSession(session.id, { current_branch: null, branch_context: {} });
    const { data: user } = await supabase.from('users').select('name, full_name').eq('id', session.user_id).single();
    await wahaSendText(chatId, buildMainMenu(user?.name || user?.full_name || ''), sessionName);
    return;
  }

  const { data: user, error } = await supabase.from('users').select('email').eq('id', session.user_id).single();
  const userEmail = user?.email;
  if (error || !userEmail) {
    await updateWspSession(session.id, { current_branch: null, branch_context: {} });
    await wahaSendText(chatId, `No pude obtener tu usuario 😕 Escribe "menú" para reiniciar.`, sessionName);
    return;
  }

  if (!ctx.stage || ctx.stage === 'start') {
    const groups = await listUserGroupsByEmail(userEmail);
    if (!groups.length) {
      await updateWspSession(session.id, { current_branch: null, branch_context: {} });
      await wahaSendText(chatId, `Aún no tienes grupos creados 📭\n\n¿Te gustaría crear uno? Escribe "crear grupo"`, sessionName);
      return;
    }

    const picked = pickGroupFromInput(groups, textTrim);
    if (picked) {
      await updateWspSession(session.id, { current_branch: 'compartir_grupo', branch_context: { stage: 'ask_emails', group: picked } });
      await wahaSendText(chatId, `¡Perfecto! 🤝 ¿Con qué correo(s) quieres compartir "${picked.group_name}"?\n\nPuedes escribir uno o varios separados por coma.`, sessionName);
      return;
    }

    const lines = groups.slice(0, 15).map((g, idx) => `${idx + 1}️⃣ 📁 ${g.group_name}`);
    await updateWspSession(session.id, { current_branch: 'compartir_grupo', branch_context: { stage: 'choose_group', groups } });
    await wahaSendText(chatId, `Estos son tus grupos disponibles 📂\n\n${lines.join('\n')}\n\n¿Con cuál quieres trabajar? (número o nombre)`, sessionName);
    return;
  }

  if (ctx.stage === 'choose_group') {
    const groups = Array.isArray(ctx.groups) ? ctx.groups : [];
    const picked = pickGroupFromInput(groups, textTrim);
    if (!picked) {
      await wahaSendText(chatId, `Elige un grupo por número o escribe su nombre 📁`, sessionName);
      return;
    }
    await updateWspSession(session.id, { current_branch: 'compartir_grupo', branch_context: { stage: 'ask_emails', group: picked } });
    await wahaSendText(chatId, `¡Perfecto! 🤝 ¿Con qué correo(s) quieres compartir "${picked.group_name}"?`, sessionName);
    return;
  }

  if (ctx.stage === 'ask_emails') {
    const emails = parseEmails(textTrim);
    if (!emails.length) {
      await wahaSendText(chatId, `Pásame uno o varios correos separados por coma 🙌`, sessionName);
      return;
    }
    const role = process.env.WAHA_DRIVE_SHARE_ROLE || 'reader';
    try {
      await shareDriveFolder({ userId: session.user_id, folderId: ctx.group?.folder_id, emails, role });
      await updateWspSession(session.id, { current_branch: null, branch_context: {} });
      await wahaSendText(chatId, `¡Hecho! ✅ Compartiste "${ctx.group?.group_name}" con ${emails.join(', ')}\n\n¿Necesitas algo más? Escribe "menú" 🙌`, sessionName);
    } catch (_) {
      await updateWspSession(session.id, { current_branch: null, branch_context: {} });
      await wahaSendText(chatId, `Tuve un problema compartiendo el grupo 😕\n\nVuelve a intentar escribiendo "compartir grupo".`, sessionName);
    }
    return;
  }
}

async function handleSubirArchivo({ session, chatId, text, sessionName, payload }) {
  const ctx = session.branch_context || {};
  const textTrim = normalizeIncomingText(text);
  const textLower = normalizeForIntent(textTrim);
  const media = extractMediaFromPayload(payload);

  if (isMenuTrigger(textLower)) {
    await updateWspSession(session.id, { current_branch: null, branch_context: {} });
    const { data: user } = await supabase.from('users').select('name, full_name').eq('id', session.user_id).single();
    await wahaSendText(chatId, buildMainMenu(user?.name || user?.full_name || ''), sessionName);
    return;
  }

  if (!ctx.stage) {
    await updateWspSession(session.id, { current_branch: 'subir_archivo', branch_context: { stage: 'wait_file' } });
    await wahaSendText(chatId, `Adjunta el archivo aquí 📎 y te pregunto dónde guardarlo 😊`, sessionName);
    return;
  }

  if (ctx.stage === 'wait_file') {
    if (!media?.url) {
      await wahaSendText(chatId, `Ahora envíame el archivo adjunto 📎`, sessionName);
      return;
    }
    const pending = {
      url: normalizeMediaUrl(media.url),
      mimetype: media.mimetype,
      filename: media.filename
    };
    await updateWspSession(session.id, { current_branch: 'subir_archivo', branch_context: { stage: 'choose_location', pending } });
    await wahaSendText(chatId, `Recibí tu archivo 📎 ¿Dónde quieres guardarlo?\n\n1️⃣ 📂 En mi carpeta raíz de Brify\n2️⃣ 📁 Moverlo a un grupo específico`, sessionName);
    return;
  }

  if (ctx.stage === 'choose_location') {
    let selection =
      textLower === '1' || textLower.includes('raiz') || textLower.includes('raíz') || textLower.includes('root')
        ? '1'
        : textLower === '2' || textLower.includes('grupo')
          ? '2'
          : textLower;
    if (selection !== '1' && selection !== '2') {
      const optionId = await routeStageWithAI({
        branch: 'subir_archivo',
        stage: 'choose_location',
        text: textTrim,
        options: [
          { id: 'root', label: 'Carpeta raíz', keywords: ['raiz', 'raíz', 'root', 'principal'] },
          { id: 'group', label: 'Grupo', keywords: ['grupo', 'carpeta del grupo'] }
        ]
      });
      selection = optionId === 'group' ? '2' : optionId === 'root' ? '1' : selection;
    }
    if (selection !== '1' && selection !== '2') {
      await wahaSendText(chatId, `Elige 1 o 2 🙌\n\n1️⃣ 📂 Carpeta raíz\n2️⃣ 📁 Grupo`, sessionName);
      return;
    }

    if (selection === '1') {
      const updated = await updateWspSession(session.id, { current_branch: 'subir_archivo', branch_context: { ...ctx, stage: 'save_now', saveTarget: 'root' } });
      await handleSubirArchivo({ session: updated, chatId, text, sessionName, payload });
      return;
    } else {
      const { data: user } = await supabase.from('users').select('email').eq('id', session.user_id).single();
      const groups = await listUserGroupsByEmail(user?.email);
      if (!groups.length) {
        await wahaSendText(chatId, `No encontré grupos creados 📭\n\nLo guardo en la carpeta raíz ✅`, sessionName);
        const updated = await updateWspSession(session.id, { current_branch: 'subir_archivo', branch_context: { ...ctx, stage: 'save_now', saveTarget: 'root' } });
        await handleSubirArchivo({ session: updated, chatId, text, sessionName, payload });
        return;
      } else {
        const lines = groups.slice(0, 15).map((g, idx) => `${idx + 1}️⃣ 📁 ${g.group_name}`);
        await updateWspSession(session.id, { current_branch: 'subir_archivo', branch_context: { ...ctx, stage: 'choose_group', groups } });
        await wahaSendText(chatId, `¿En cuál grupo lo guardamos? 📁\n\n${lines.join('\n')}\n\nEscribe el número o el nombre.`, sessionName);
        return;
      }
    }
  }

  if (ctx.stage === 'choose_group') {
    const groups = Array.isArray(ctx.groups) ? ctx.groups : [];
    const picked = pickGroupFromInput(groups, textTrim);
    if (!picked) {
      await wahaSendText(chatId, `Elige un grupo válido 🙌 (número o nombre)`, sessionName);
      return;
    }
    const updated = await updateWspSession(session.id, { current_branch: 'subir_archivo', branch_context: { ...ctx, stage: 'save_now', saveTarget: 'group', selectedGroup: picked } });
    await handleSubirArchivo({ session: updated, chatId, text, sessionName, payload });
    return;
  }

  if (ctx.stage === 'save_now') {
    const { data: user, error } = await supabase.from('users').select('email').eq('id', session.user_id).single();
    if (error || !user?.email) {
      await updateWspSession(session.id, { current_branch: null, branch_context: {} });
      await wahaSendText(chatId, `No pude obtener tu usuario 😕 Escribe "menú" para reiniciar.`, sessionName);
      return;
    }
    const pending = ctx.pending;
    if (!pending?.url) {
      await updateWspSession(session.id, { current_branch: 'subir_archivo', branch_context: { stage: 'wait_file' } });
      await wahaSendText(chatId, `No encontré el archivo adjunto 😕 Reenvíalo por favor 📎`, sessionName);
      return;
    }

    let parentFolderId = null;
    if (ctx.saveTarget === 'group' && ctx.selectedGroup?.folder_id) {
      parentFolderId = ctx.selectedGroup.folder_id;
    } else {
      parentFolderId = await resolveRootFolderIdForUser(user.email, session.user_id);
    }
    if (!parentFolderId) {
      await updateWspSession(session.id, { current_branch: null, branch_context: {} });
      await wahaSendText(chatId, `No encontré tu carpeta raíz de Brify 😕 Revisa tu configuración en ${BRIFY_PROFILE_URL}`, sessionName);
      return;
    }

    const fileName = pending.filename || `Archivo - ${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;
    try {
      const file = await uploadFileFromUrlToDrive({
        userId: session.user_id,
        parentFolderId,
        fileName,
        mimeType: pending.mimetype,
        url: pending.url
      });
      await updateWspSession(session.id, { current_branch: null, branch_context: {} });
      await wahaSendText(chatId, `✅ Listo. Guardé "${file.name}".\n${file.webViewLink}\n\n¿Algo más? Escribe "menú" 🙌`, sessionName);
    } catch (_) {
      await updateWspSession(session.id, { current_branch: null, branch_context: {} });
      await wahaSendText(chatId, `Tuve un problema subiendo el archivo 😕\n\nIntenta de nuevo enviándolo otra vez 📎`, sessionName);
    }
    return;
  }
}

async function handleListarArchivos({ session, chatId, text, sessionName }) {
  const ctx = session.branch_context || {};
  const textTrim = normalizeIncomingText(text);
  const textLower = normalizeForIntent(textTrim);

  if (isMenuTrigger(textLower)) {
    await updateWspSession(session.id, { current_branch: null, branch_context: {} });
    const { data: user } = await supabase.from('users').select('name, full_name').eq('id', session.user_id).single();
    await wahaSendText(chatId, buildMainMenu(user?.name || user?.full_name || ''), sessionName);
    return;
  }

  if (!ctx.stage) {
    await updateWspSession(session.id, { current_branch: 'listar_archivos', branch_context: { stage: 'choose_location' } });
    await wahaSendText(chatId, `¿Dónde quieres listar tus archivos? 📋\n\n1️⃣ 📂 Carpeta raíz\n2️⃣ 📁 Un grupo`, sessionName);
    return;
  }

  if (ctx.stage === 'choose_location') {
    let selection =
      textLower === '1' || textLower.includes('raiz') || textLower.includes('raíz') || textLower.includes('root')
        ? '1'
        : textLower === '2' || textLower.includes('grupo')
          ? '2'
          : textLower;
    if (selection !== '1' && selection !== '2') {
      const optionId = await routeStageWithAI({
        branch: 'listar_archivos',
        stage: 'choose_location',
        text: textTrim,
        options: [
          { id: 'root', label: 'Carpeta raíz', keywords: ['raiz', 'raíz', 'root', 'principal'] },
          { id: 'group', label: 'Grupo', keywords: ['grupo'] }
        ]
      });
      selection = optionId === 'group' ? '2' : optionId === 'root' ? '1' : selection;
    }
    if (selection !== '1' && selection !== '2') {
      await wahaSendText(chatId, `Elige 1 o 2 🙌\n\n1️⃣ 📂 Carpeta raíz\n2️⃣ 📁 Grupo`, sessionName);
      return;
    }

    if (selection === '1') {
      await updateWspSession(session.id, { current_branch: 'listar_archivos', branch_context: { stage: 'choose_kind', saveTarget: 'root' } });
      await wahaSendText(chatId, `¿Qué quieres ver? 📋\n\n1️⃣ 📄 Documentos\n2️⃣ 🖼️ Imágenes\n3️⃣ 📦 Todo`, sessionName);
      return;
    }

    const { data: user } = await supabase.from('users').select('email').eq('id', session.user_id).single();
    const groups = await listUserGroupsByEmail(user?.email);
    if (!groups.length) {
      await updateWspSession(session.id, { current_branch: null, branch_context: {} });
      await wahaSendText(chatId, `No encontré grupos creados 📭\n\n¿Quieres crear uno? Escribe "crear grupo"`, sessionName);
      return;
    }
    const lines = groups.slice(0, 15).map((g, idx) => `${idx + 1}️⃣ 📁 ${g.group_name}`);
    await updateWspSession(session.id, { current_branch: 'listar_archivos', branch_context: { stage: 'choose_group', groups } });
    await wahaSendText(chatId, `¿De cuál grupo quieres listar? 📁\n\n${lines.join('\n')}\n\nEscribe el número o el nombre.`, sessionName);
    return;
  }

  if (ctx.stage === 'choose_group') {
    const groups = Array.isArray(ctx.groups) ? ctx.groups : [];
    const selection = parseNumberSelection(textTrim);
    const picked = selection ? groups[selection - 1] : findGroupByName(groups, textTrim);
    if (!picked) {
      await wahaSendText(chatId, `Elige un grupo válido 🙌 (número o nombre)`, sessionName);
      return;
    }
    await updateWspSession(session.id, { current_branch: 'listar_archivos', branch_context: { stage: 'choose_kind', saveTarget: 'group', selectedGroup: picked } });
    await wahaSendText(chatId, `¿Qué quieres ver? 📋\n\n1️⃣ 📄 Documentos\n2️⃣ 🖼️ Imágenes\n3️⃣ 📦 Todo`, sessionName);
    return;
  }

  if (ctx.stage === 'choose_kind') {
    let kind = null;
    if (textLower === '1' || textLower.includes('doc')) kind = 'docs';
    else if (textLower === '2' || textLower.includes('imagen') || textLower.includes('foto')) kind = 'images';
    else if (textLower === '3' || textLower.includes('todo')) kind = 'all';
    if (!kind) {
      const optionId = await routeStageWithAI({
        branch: 'listar_archivos',
        stage: 'choose_kind',
        text: textTrim,
        options: [
          { id: 'docs', label: 'Documentos', keywords: ['documento', 'doc', 'pdf', 'word', 'archivo'] },
          { id: 'images', label: 'Imágenes', keywords: ['imagen', 'foto', 'captura', 'png', 'jpg'] },
          { id: 'all', label: 'Todo', keywords: ['todo', 'todos', 'todo junto'] }
        ]
      });
      kind = optionId === 'docs' ? 'docs' : optionId === 'images' ? 'images' : optionId === 'all' ? 'all' : null;
    }
    if (!kind) {
      await wahaSendText(chatId, `Elige 1, 2 o 3 🙌`, sessionName);
      return;
    }

    const { data: user, error } = await supabase.from('users').select('email').eq('id', session.user_id).single();
    if (error || !user?.email) {
      await updateWspSession(session.id, { current_branch: null, branch_context: {} });
      await wahaSendText(chatId, `No pude obtener tu usuario 😕 Escribe "menú" para reiniciar.`, sessionName);
      return;
    }

    let folderId = null;
    if (ctx.saveTarget === 'group' && ctx.selectedGroup?.folder_id) {
      folderId = ctx.selectedGroup.folder_id;
    } else {
      folderId = await resolveRootFolderIdForUser(user.email, session.user_id);
    }
    if (!folderId) {
      await updateWspSession(session.id, { current_branch: null, branch_context: {} });
      await wahaSendText(chatId, `No encontré tu carpeta raíz de Brify 😕 Revisa tu configuración en ${BRIFY_PROFILE_URL}`, sessionName);
      return;
    }

    const files = await listDriveFiles({ userId: session.user_id, folderId, kind: kind === 'all' ? null : kind });
    if (!files.length) {
      await updateWspSession(session.id, { current_branch: null, branch_context: {} });
      await wahaSendText(chatId, `No encontré archivos en esa carpeta 📭\n\n¿Algo más? Escribe "menú" 🙌`, sessionName);
      return;
    }
    const lines = files.map((f, idx) => `${idx + 1}️⃣ ${f.mimeType?.startsWith('image/') ? '🖼️' : '📄'} ${f.name}`);
    await updateWspSession(session.id, { current_branch: 'listar_archivos', branch_context: { stage: 'pick_file', files } });
    await wahaSendText(chatId, `Aquí están tus archivos 📋\n\n${lines.join('\n')}\n\nEscribe el número para ver el link.`, sessionName);
    return;
  }

  if (ctx.stage === 'pick_file') {
    const files = Array.isArray(ctx.files) ? ctx.files : [];
    const selection = parseNumberSelection(textTrim);
    const picked = selection ? files[selection - 1] : null;
    if (!picked) {
      await wahaSendText(chatId, `Elige un número válido 🙌`, sessionName);
      return;
    }
    await updateWspSession(session.id, { current_branch: null, branch_context: {} });
    await wahaSendText(chatId, `🔗 ${picked.name}\n${picked.webViewLink || 'Link no disponible'}\n\n¿Quieres ver otro? Escribe "listar documentos" o "menú" 🙌`, sessionName);
    return;
  }
}

async function handleAnalizarDocumento({ session, chatId, text, sessionName, payload }) {
  const ctx = session.branch_context || {};
  const textTrim = normalizeIncomingText(text);
  const textLower = normalizeForIntent(textTrim);
  const media = extractMediaFromPayload(payload);

  if (isMenuTrigger(textLower)) {
    await updateWspSession(session.id, { current_branch: null, branch_context: {} });
    const { data: user } = await supabase.from('users').select('name, full_name').eq('id', session.user_id).single();
    await wahaSendText(chatId, buildMainMenu(user?.name || user?.full_name || ''), sessionName);
    return;
  }

  if (!ctx.stage) {
    await updateWspSession(session.id, { current_branch: 'analizar_documento', branch_context: { stage: 'choose_mode' } });
    await wahaSendText(chatId, `¿Qué prefieres? 🔍\n\n1️⃣ 📂 Analizar un documento existente\n2️⃣ 📤 Subir un documento ahora`, sessionName);
    return;
  }

  if (ctx.stage === 'choose_mode') {
    if (textLower === '1' || textLower.includes('exist') || textLower.includes('ya subi') || textLower.includes('ya sub')) {
      await updateWspSession(session.id, { current_branch: 'analizar_documento', branch_context: { stage: 'choose_location' } });
      await wahaSendText(chatId, `¿Dónde está el documento? 📂\n\n1️⃣ 📂 Carpeta raíz\n2️⃣ 📁 En un grupo`, sessionName);
      return;
    }
    if (textLower === '2' || textLower.includes('subir') || textLower.includes('adjunt')) {
      await updateWspSession(session.id, { current_branch: 'analizar_documento', branch_context: { stage: 'wait_file' } });
      await wahaSendText(chatId, `Perfecto 📎 Adjunta el documento aquí y lo analizo.`, sessionName);
      return;
    }
    const optionId = await routeStageWithAI({
      branch: 'analizar_documento',
      stage: 'choose_mode',
      text: textTrim,
      options: [
        { id: 'existing', label: 'Documento existente', keywords: ['existente', 'ya subido', 'en drive', 'en brify'] },
        { id: 'upload', label: 'Subir documento', keywords: ['subir', 'adjuntar', 'enviar'] }
      ]
    });
    if (optionId === 'existing') {
      await updateWspSession(session.id, { current_branch: 'analizar_documento', branch_context: { stage: 'choose_location' } });
      await wahaSendText(chatId, `¿Dónde está el documento? 📂\n\n1️⃣ 📂 Carpeta raíz\n2️⃣ 📁 En un grupo`, sessionName);
      return;
    }
    if (optionId === 'upload') {
      await updateWspSession(session.id, { current_branch: 'analizar_documento', branch_context: { stage: 'wait_file' } });
      await wahaSendText(chatId, `Perfecto 📎 Adjunta el documento aquí y lo analizo.`, sessionName);
      return;
    }
    await wahaSendText(chatId, `Elige 1 o 2 🙌`, sessionName);
    return;
  }

  if (ctx.stage === 'wait_file') {
    if (!media?.url) {
      await wahaSendText(chatId, `Aún no veo el documento adjunto 📎 Envíalo por aquí.`, sessionName);
      return;
    }

    const url = normalizeMediaUrl(media.url);
    const mimeType = media.mimetype || '';
    const headers = {
      ...(WAHA_API_KEY ? { 'X-Api-Key': WAHA_API_KEY } : {})
    };

    if (url && mimeType.startsWith('text/')) {
      const downloaded = await fetch(url, { headers });
      if (downloaded.ok) {
        const content = Buffer.from(await downloaded.arrayBuffer()).toString('utf8');
        if (MINIMAX_API_KEY) {
          const system = `Eres un analista de documentos en WhatsApp para Brify. Responde en español, claro y útil.
Entrega: 1) resumen, 2) puntos clave, 3) riesgos/observaciones, 4) preguntas de aclaración si aplica.`;
          const response = await fetch(MINIMAX_ENDPOINT, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${MINIMAX_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: MINIMAX_MODEL,
              system,
              temperature: 0.4,
              max_tokens: 900,
              messages: [{ role: 'user', content: `Documento:\n${content.slice(0, 12000)}\n\nAnaliza:` }]
            })
          });
          const data = await response.json().catch(() => ({}));
          let raw = data?.content;
          if (Array.isArray(raw)) raw = raw.map((b) => (typeof b === 'string' ? b : b?.text || '')).join('');
          if (typeof raw !== 'string') raw = data?.choices?.[0]?.message?.content;
          const analysis = typeof raw === 'string' ? raw : '';

          await updateWspSession(session.id, { current_branch: null, branch_context: {} });
          await wahaSendText(
            chatId,
            analysis || `Pude leer el documento, pero no pude generar el análisis automático.\n\n¿Quieres intentar con otro archivo o buscar una ley? Escribe "menú" 🙌`,
            sessionName
          );
          return;
        }

        await updateWspSession(session.id, { current_branch: null, branch_context: {} });
        await wahaSendText(chatId, `✅ Recibí el texto.\n\n${content.slice(0, 1200)}${content.length > 1200 ? '…' : ''}\n\n¿Quieres que lo resuma?`, sessionName);
        return;
      }
    }

    await updateWspSession(session.id, { current_branch: null, branch_context: {} });
    await wahaSendText(
      chatId,
      `Recibí tu documento 📎\n\nPara un análisis completo de este tipo de archivo, súbelo desde la web: ${BRIFY_PROFILE_URL}\n\nSi quieres, dime qué necesitas (resumen, puntos clave, riesgos) y te guío 🙌`,
      sessionName
    );
    return;
  }

  if (ctx.stage === 'choose_location') {
    let selection =
      textLower === '1' || textLower.includes('raiz') || textLower.includes('raíz') || textLower.includes('root')
        ? '1'
        : textLower === '2' || textLower.includes('grupo')
          ? '2'
          : textLower;
    if (selection !== '1' && selection !== '2') {
      const optionId = await routeStageWithAI({
        branch: 'analizar_documento',
        stage: 'choose_location',
        text: textTrim,
        options: [
          { id: 'root', label: 'Carpeta raíz', keywords: ['raiz', 'raíz', 'root', 'principal'] },
          { id: 'group', label: 'Grupo', keywords: ['grupo'] }
        ]
      });
      selection = optionId === 'group' ? '2' : optionId === 'root' ? '1' : selection;
    }
    if (selection !== '1' && selection !== '2') {
      await wahaSendText(chatId, `Elige 1 o 2 🙌`, sessionName);
      return;
    }
    if (selection === '1') {
      const updated = await updateWspSession(session.id, { current_branch: 'analizar_documento', branch_context: { stage: 'pick_file', saveTarget: 'root' } });
      await handleAnalizarDocumento({ session: updated, chatId, text, sessionName, payload });
      return;
    } else {
      const { data: user } = await supabase.from('users').select('email').eq('id', session.user_id).single();
      const groups = await listUserGroupsByEmail(user?.email);
      if (!groups.length) {
        await wahaSendText(chatId, `No encontré grupos creados 📭\n\nIntentemos con la carpeta raíz ✅`, sessionName);
        const updated = await updateWspSession(session.id, { current_branch: 'analizar_documento', branch_context: { stage: 'pick_file', saveTarget: 'root' } });
        await handleAnalizarDocumento({ session: updated, chatId, text, sessionName, payload });
        return;
      } else {
        const lines = groups.slice(0, 15).map((g, idx) => `${idx + 1}️⃣ 📁 ${g.group_name}`);
        await updateWspSession(session.id, { current_branch: 'analizar_documento', branch_context: { stage: 'choose_group', groups } });
        await wahaSendText(chatId, `¿De cuál grupo? 📁\n\n${lines.join('\n')}\n\nEscribe el número o el nombre.`, sessionName);
        return;
      }
    }
  }

  if (ctx.stage === 'choose_group') {
    const groups = Array.isArray(ctx.groups) ? ctx.groups : [];
    const picked = pickGroupFromInput(groups, textTrim);
    if (!picked) {
      await wahaSendText(chatId, `Elige un grupo válido 🙌`, sessionName);
      return;
    }
    const updated = await updateWspSession(session.id, { current_branch: 'analizar_documento', branch_context: { stage: 'pick_file', saveTarget: 'group', selectedGroup: picked } });
    await handleAnalizarDocumento({ session: updated, chatId, text, sessionName, payload });
    return;
  }

  if (ctx.stage === 'pick_file') {
    const { data: user, error } = await supabase.from('users').select('email').eq('id', session.user_id).single();
    if (error || !user?.email) {
      await updateWspSession(session.id, { current_branch: null, branch_context: {} });
      await wahaSendText(chatId, `No pude obtener tu usuario 😕 Escribe "menú" para reiniciar.`, sessionName);
      return;
    }

    let folderId = null;
    if (ctx.saveTarget === 'group' && ctx.selectedGroup?.folder_id) folderId = ctx.selectedGroup.folder_id;
    else folderId = await resolveRootFolderIdForUser(user.email, session.user_id);

    if (!folderId) {
      await updateWspSession(session.id, { current_branch: null, branch_context: {} });
      await wahaSendText(chatId, `No encontré tu carpeta raíz de Brify 😕 Revisa tu configuración en ${BRIFY_PROFILE_URL}`, sessionName);
      return;
    }

    const files = await listDriveFiles({ userId: session.user_id, folderId, kind: 'docs' });
    if (!files.length) {
      await updateWspSession(session.id, { current_branch: null, branch_context: {} });
      await wahaSendText(chatId, `No encontré documentos en esa carpeta 📭\n\n¿Algo más? Escribe "menú" 🙌`, sessionName);
      return;
    }

    const selection = parseNumberSelection(textTrim);
    if (!selection) {
      const lines = files.map((f, idx) => `${idx + 1}️⃣ 📄 ${f.name}`);
      await updateWspSession(session.id, { current_branch: 'analizar_documento', branch_context: { stage: 'pick_file_select', files } });
      await wahaSendText(chatId, `Elige el documento a analizar 🔍\n\n${lines.join('\n')}\n\nEscribe el número.`, sessionName);
      return;
    }
  }

  if (ctx.stage === 'pick_file_select') {
    const files = Array.isArray(ctx.files) ? ctx.files : [];
    const selection = parseNumberSelection(textTrim);
    const picked = selection ? files[selection - 1] : null;
    if (!picked) {
      await wahaSendText(chatId, `Elige un número válido 🙌`, sessionName);
      return;
    }

    const textContent = await getDriveFileText({ userId: session.user_id, fileId: picked.id, mimeType: picked.mimeType });
    if (!textContent) {
      await updateWspSession(session.id, { current_branch: null, branch_context: {} });
      await wahaSendText(chatId, `Aún no puedo analizar ese tipo de archivo por WhatsApp 😕\n\nAbre el documento aquí y analízalo desde la web:\n${picked.webViewLink}\n\n¿Algo más? Escribe "menú" 🙌`, sessionName);
      return;
    }

    let analysis = '';
    if (MINIMAX_API_KEY) {
      const system = `Eres un analista de documentos en WhatsApp para Brify. Responde en español, claro y útil.
Entrega: 1) resumen, 2) puntos clave, 3) riesgos/observaciones, 4) preguntas de aclaración si aplica.`;
      const response = await fetch(MINIMAX_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${MINIMAX_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: MINIMAX_MODEL,
          system,
          temperature: 0.4,
          max_tokens: 900,
          messages: [{ role: 'user', content: `Documento:\n${textContent.slice(0, 12000)}\n\nAnaliza:` }]
        })
      });
      const data = await response.json().catch(() => ({}));
      let raw = data?.content;
      if (Array.isArray(raw)) raw = raw.map((b) => (typeof b === 'string' ? b : b?.text || '')).join('');
      if (typeof raw !== 'string') raw = data?.choices?.[0]?.message?.content;
      analysis = typeof raw === 'string' ? raw : '';
    }

    if (!analysis) {
      analysis = `✅ Puedo abrir el documento, pero ahora mismo no pude generar el análisis automático.\n\nLink: ${picked.webViewLink}\n\n¿Quieres intentar de nuevo o analizar otro? Escribe "analizar" 🙌`;
    }

    await updateWspSession(session.id, { current_branch: null, branch_context: {} });
    await wahaSendText(chatId, analysis, sessionName);
    return;
  }
}

async function detectIntent(text) {
  const rule = detectIntentRuleBased(text);
  if (rule.intent !== 'unknown') return rule;
  const ai = await detectIntentWithAI(text);
  if (ai.intent !== 'unknown' && ai.confidence >= 0.5) return ai;
  return rule;
}

async function enterBranch(session, chatId, sessionName, branch) {
  if (branch === 'legal') {
    await updateWspSession(session.id, {
      current_branch: 'asesor_legal',
      branch_context: { stage: 'choose_mode' }
    });
    await wahaSendText(
      chatId,
      `¿Cómo quieres que te ayude hoy? ⚖️\n\n1️⃣ 📝 Compartir mi caso — cuéntame tu situación y te oriento con respaldo legal\n2️⃣ 🔎 Buscar una ley — dime el nombre, término o artículo que buscas`,
      sessionName
    );
    return true;
  }

  if (branch === 'create_group') {
    await updateWspSession(session.id, {
      current_branch: 'crear_grupo',
      branch_context: { stage: 'ask_name' }
    });
    await wahaSendText(chatId, `¡Vamos a crear tu nuevo grupo! 📁 ¿Cómo se llamará?`, sessionName);
    return true;
  }

  if (branch === 'share_group') {
    await updateWspSession(session.id, {
      current_branch: 'compartir_grupo',
      branch_context: { stage: 'start' }
    });
    await wahaSendText(chatId, `¡Perfecto! 🤝 Dime el nombre del grupo (o escribe "listar" para ver tus grupos 📂)`, sessionName);
    return true;
  }

  if (branch === 'upload_file') {
    await updateWspSession(session.id, {
      current_branch: 'subir_archivo',
      branch_context: { stage: 'wait_file' }
    });
    await wahaSendText(
      chatId,
      `¡Claro! 📤 Adjunta el archivo directamente en este chat y te pregunto dónde guardarlo 😊`,
      sessionName
    );
    return true;
  }

  if (branch === 'list_files') {
    await updateWspSession(session.id, {
      current_branch: 'listar_archivos',
      branch_context: { stage: 'choose_location' }
    });
    await wahaSendText(chatId, `¿Dónde quieres listar tus archivos? �\n\n1️⃣ 📂 Carpeta raíz\n2️⃣ 📁 Un grupo`, sessionName);
    return true;
  }

  if (branch === 'create_document') {
    await updateWspSession(session.id, {
      current_branch: 'crear_documento',
      branch_context: {}
    });
    await handleCrearDocumento({ session, chatId, text: '6', sessionName });
    return true;
  }

  if (branch === 'analyze_document') {
    await updateWspSession(session.id, {
      current_branch: 'analizar_documento',
      branch_context: { stage: 'choose_mode' }
    });
    await wahaSendText(
      chatId,
      `¿Qué prefieres? 🔍\n\n1️⃣ 📂 Analizar un documento existente\n2️⃣ 📤 Subir un documento ahora`,
      sessionName
    );
    return true;
  }

  return false;
}

async function getOrCreateWspSession(phoneNumber) {
  const { data: existing, error } = await supabase
    .from('wsp_sessions')
    .select('*')
    .eq('phone_number', phoneNumber)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!error && existing) return existing;

  const { data: created, error: createError } = await supabase
    .from('wsp_sessions')
    .insert({
      id: crypto.randomUUID(),
      phone_number: phoneNumber,
      current_branch: null,
      branch_context: {},
      last_interaction: new Date().toISOString()
    })
    .select('*')
    .single();

  if (createError) throw createError;
  return created;
}

async function updateWspSession(sessionId, patch) {
  const { data, error } = await supabase
    .from('wsp_sessions')
    .update({
      ...patch,
      last_interaction: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', sessionId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function getUserByPhone(phoneNumber) {
  const { data, error } = await supabase.from('users').select('*').eq('phone_number', phoneNumber).single();
  if (error) return null;
  return data;
}

async function getUserByEmail(email) {
  const { data, error } = await supabase.from('users').select('*').eq('email', email).single();
  if (error) return null;
  return data;
}

async function isDriveLinked(userId) {
  const { data, error } = await supabase
    .from('user_credentials')
    .select('google_refresh_token')
    .eq('user_id', userId)
    .single();
  if (error) return false;
  return Boolean(data?.google_refresh_token);
}

function buildClauseBaseLegal(values) {
  const norma = (values.n_norma || '').trim();
  const termino = (values.termino_ley || '').trim();
  if (!norma && !termino) return '';
  if (norma && termino) return `BASE LEGAL: Se hace referencia a la norma ${norma} y al término "${termino}".`;
  if (norma) return `BASE LEGAL: Se hace referencia a la norma ${norma}.`;
  return `BASE LEGAL: Se hace referencia al término "${termino}".`;
}

function renderPlantillaToHtml(plantilla, values) {
  const replacements = {
    ...values,
    clausula_base_legal: buildClauseBaseLegal(values)
  };

  let content = plantilla.contenido || '';
  content = content.replace(/__TITULO_PRINCIPAL__/g, '').replace(/__TITULO__/g, '');
  content = content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  content = content.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const v = replacements[key];
    if (v === null || v === undefined) return '';
    return String(v);
  });

  return `<!doctype html><html><head><meta charset="utf-8"></head><body><div style="font-family: Arial, sans-serif; white-space: pre-wrap;">${content}</div></body></html>`;
}

async function getDriveClientForUser(userId) {
  const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.REACT_APP_GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.REACT_APP_GOOGLE_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI || 'http://localhost';

  const { data: creds, error } = await supabase
    .from('user_credentials')
    .select('google_refresh_token')
    .eq('user_id', userId)
    .single();

  if (error || !creds?.google_refresh_token) {
    throw new Error('Usuario sin Google Drive vinculado');
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oauth2Client.setCredentials({ refresh_token: creds.google_refresh_token });
  await oauth2Client.getAccessToken();
  return google.drive({ version: 'v3', auth: oauth2Client });
}

async function resolveRootFolderIdForUser(userEmail, userId) {
  const { data: adminFolder, error } = await supabase
    .from('carpeta_administrador')
    .select('id_drive_carpeta')
    .or(`user_id.eq.${userId},correo.eq.${userEmail}`)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !adminFolder?.id_drive_carpeta) return null;
  return adminFolder.id_drive_carpeta;
}

async function createHtmlFileInDrive({ userId, parentFolderId, fileName, html }) {
  const drive = await getDriveClientForUser(userId);
  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [parentFolderId],
      mimeType: 'text/html'
    },
    media: {
      mimeType: 'text/html',
      body: html
    },
    fields: 'id, webViewLink, name'
  });
  return response.data;
}

async function logDocumentoAdministrador({ file, userEmail, servicio, templateKey }) {
  const { error } = await supabase.from('documentos_administrador').insert({
    file_id: file.id,
    name: file.name,
    file_type: 'text/html',
    file_size: null,
    administrador: userEmail,
    cliente: userEmail,
    servicio,
    carpeta_actual: null,
    nombre_carpeta_actual: null,
    telegram_id: null,
    content: null,
    metadata: {
      source: 'waha',
      action: 'crear_documento',
      template_key: templateKey
    },
    embedding: null,
    pendiente: false,
    nombre_limpio: (file.name || '').toLowerCase().replace(/[^a-z0-9]/g, '_'),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  if (error) throw error;
}

async function handleCrearDocumento({ session, chatId, text, sessionName }) {
  const ctx = session.branch_context || {};
  const textTrim = normalizeIncomingText(text);
  const textLower = textTrim.toLowerCase();

  if (!ctx.stage) {
    await updateWspSession(session.id, {
      current_branch: 'crear_documento',
      branch_context: { stage: 'choose_mode' }
    });
    await wahaSendText(
      chatId,
      `¡Vamos a crear tu documento! ✍️ ¿Qué tipo de documento necesitas?\n\n1️⃣ 📋 Desde plantilla predefinida\n2️⃣ 📝 Documento en blanco personalizado`,
      sessionName
    );
    return;
  }

  if (ctx.stage === 'choose_mode') {
    if (textLower === '1' || textLower.includes('plantilla')) {
      const keys = Object.keys(plantillas);
      const lines = keys.map((k, idx) => `${idx + 1}️⃣ 📄 ${plantillas[k].nombre}`);
      await updateWspSession(session.id, {
        current_branch: 'crear_documento',
        branch_context: { stage: 'choose_template', keys }
      });
      await wahaSendText(chatId, `Perfecto ✅ Elige una plantilla:\n\n${lines.join('\n')}\n\nEscribe el número.`, sessionName);
      return;
    }

    if (textLower === '2' || textLower.includes('blanco')) {
      await updateWspSession(session.id, {
        current_branch: 'crear_documento',
        branch_context: { stage: 'blank_title' }
      });
      await wahaSendText(chatId, `Genial 📝 ¿Cuál es el título del documento?`, sessionName);
      return;
    }

    const optionId = await routeStageWithAI({
      branch: 'crear_documento',
      stage: 'choose_mode',
      text: textTrim,
      options: [
        { id: 'template', label: 'Plantilla predefinida', keywords: ['plantilla', 'formato', 'modelo', 'contrato', 'finiquito', 'poder'] },
        { id: 'blank', label: 'Documento en blanco', keywords: ['blanco', 'personalizado', 'desde cero', 'redactar'] }
      ]
    });
    if (optionId === 'template') {
      const keys = Object.keys(plantillas);
      const lines = keys.map((k, idx) => `${idx + 1}️⃣ 📄 ${plantillas[k].nombre}`);
      await updateWspSession(session.id, {
        current_branch: 'crear_documento',
        branch_context: { stage: 'choose_template', keys }
      });
      await wahaSendText(chatId, `Perfecto ✅ Elige una plantilla:\n\n${lines.join('\n')}\n\nEscribe el número.`, sessionName);
      return;
    }
    if (optionId === 'blank') {
      await updateWspSession(session.id, {
        current_branch: 'crear_documento',
        branch_context: { stage: 'blank_title' }
      });
      await wahaSendText(chatId, `Genial 📝 ¿Cuál es el título del documento?`, sessionName);
      return;
    }

    await wahaSendText(chatId, `No entendí esa opción 😅\n\n1️⃣ 📋 Plantilla\n2️⃣ 📝 Documento en blanco`, sessionName);
    return;
  }

  if (ctx.stage === 'choose_template') {
    const selection = parseNumberSelection(textTrim);
    const keys = Array.isArray(ctx.keys) ? ctx.keys : Object.keys(plantillas);
    const selectedKey = selection ? keys[selection - 1] : null;
    if (!selectedKey || !plantillas[selectedKey]) {
      await wahaSendText(chatId, `Porfa elige un número válido 🙌`, sessionName);
      return;
    }

    const plantilla = plantillas[selectedKey];
    const labels = plantilla.variables_requeridas || [];
    const firstLabel = labels[0];
    await updateWspSession(session.id, {
      current_branch: 'crear_documento',
      branch_context: {
        stage: 'collect_vars',
        templateKey: selectedKey,
        labels,
        varIndex: 0,
        answers: {}
      }
    });
    await wahaSendText(
      chatId,
      `Perfecto ✅ Vamos con la plantilla "${plantilla.nombre}".\n\n1/${labels.length} ✍️ Ingresa: ${firstLabel}\n\nSi es opcional, puedes escribir "omitir".`,
      sessionName
    );
    return;
  }

  if (ctx.stage === 'collect_vars') {
    const labels = Array.isArray(ctx.labels) ? ctx.labels : [];
    const varIndex = Number.isFinite(ctx.varIndex) ? ctx.varIndex : 0;
    const label = labels[varIndex];
    if (!label) {
      await updateWspSession(session.id, { current_branch: null, branch_context: {} });
      await wahaSendText(chatId, `Tuve un problema con la plantilla 😕 Escribe "menú" para volver a empezar.`, sessionName);
      return;
    }

    const isOptional = label.toLowerCase().includes('(opcional)');
    const internalKey = MapeoDeClaves[label];
    const answers = typeof ctx.answers === 'object' && ctx.answers ? { ...ctx.answers } : {};
    const userValue = textTrim;
    if (internalKey) {
      if (isOptional && (!userValue || userValue.toLowerCase() === 'omitir' || userValue === '-')) {
        answers[internalKey] = '';
      } else {
        answers[internalKey] = userValue;
      }
    }

    const nextIndex = varIndex + 1;
    if (nextIndex >= labels.length) {
      await updateWspSession(session.id, {
        current_branch: 'crear_documento',
        branch_context: {
          stage: 'choose_save_location',
          templateKey: ctx.templateKey,
          answers
        }
      });
      await wahaSendText(chatId, `¡Listo! ✅ ¿Dónde quieres guardarlo?\n\n1️⃣ 📂 Carpeta raíz de Brify\n2️⃣ 📁 En un grupo específico`, sessionName);
      return;
    }

    await updateWspSession(session.id, {
      current_branch: 'crear_documento',
      branch_context: {
        ...ctx,
        varIndex: nextIndex,
        answers
      }
    });

    await wahaSendText(chatId, `${nextIndex + 1}/${labels.length} ✍️ Ingresa: ${labels[nextIndex]}\n\nSi es opcional, puedes escribir "omitir".`, sessionName);
    return;
  }

  if (ctx.stage === 'blank_title') {
    const title = textTrim;
    if (!title) {
      await wahaSendText(chatId, `¿Cuál sería el título? ✍️`, sessionName);
      return;
    }
    await updateWspSession(session.id, {
      current_branch: 'crear_documento',
      branch_context: { stage: 'blank_description', title }
    });
    await wahaSendText(chatId, `Perfecto ✅ Ahora dime una descripción breve o el contexto para redactarlo 📝`, sessionName);
    return;
  }

  if (ctx.stage === 'blank_description') {
    const description = textTrim;
    if (!description) {
      await wahaSendText(chatId, `Dame una descripción breve para poder redactarlo 📝`, sessionName);
      return;
    }
    await updateWspSession(session.id, {
      current_branch: 'crear_documento',
      branch_context: {
        stage: 'choose_save_location_blank',
        title: ctx.title,
        description
      }
    });
    await wahaSendText(chatId, `Listo ✅ ¿Dónde quieres guardarlo?\n\n1️⃣ 📂 Carpeta raíz de Brify\n2️⃣ 📁 En un grupo específico`, sessionName);
    return;
  }

  if (ctx.stage === 'choose_save_location' || ctx.stage === 'choose_save_location_blank') {
    let selection =
      textLower === '1' || textLower.includes('raiz') || textLower.includes('raíz') || textLower.includes('root')
        ? '1'
        : textLower === '2' || textLower.includes('grupo')
          ? '2'
          : textLower;
    if (selection !== '1' && selection !== '2') {
      const optionId = await routeStageWithAI({
        branch: 'crear_documento',
        stage: 'choose_save_location',
        text: textTrim,
        options: [
          { id: 'root', label: 'Carpeta raíz', keywords: ['raiz', 'raíz', 'root', 'principal'] },
          { id: 'group', label: 'Grupo específico', keywords: ['grupo', 'carpeta del grupo'] }
        ]
      });
      selection = optionId === 'group' ? '2' : optionId === 'root' ? '1' : selection;
    }
    if (selection !== '1' && selection !== '2') {
      await wahaSendText(chatId, `Elige una opción 🙌\n\n1️⃣ 📂 Carpeta raíz\n2️⃣ 📁 Grupo específico`, sessionName);
      return;
    }

    let groups = [];
    if (selection === '2') {
      const { data, error } = await supabase
        .from('users')
        .select('email')
        .eq('id', session.user_id)
        .single();
      const userEmail = data?.email;
      if (userEmail) {
        const groupsResult = await supabase
          .from('grupos_drive')
          .select('id, group_name, folder_id')
          .eq('administrador', userEmail)
          .order('created_at', { ascending: false })
          .limit(20);
        if (!groupsResult.error && Array.isArray(groupsResult.data)) groups = groupsResult.data;
      }

      if (!groups.length) {
        await wahaSendText(chatId, `No encontré grupos creados 📭\n\nTe lo guardo en la carpeta raíz ✅`, sessionName);
      }
    }

    if (selection === '2' && groups.length) {
      const lines = groups.map((g, idx) => `${idx + 1}️⃣ 📁 ${g.group_name}`);
      await updateWspSession(session.id, {
        current_branch: 'crear_documento',
        branch_context: {
          ...ctx,
          stage: 'choose_group',
          groups
        }
      });
      await wahaSendText(chatId, `¿En cuál grupo lo guardamos? 📁\n\n${lines.join('\n')}\n\nEscribe el número.`, sessionName);
      return;
    }

    const updated = await updateWspSession(session.id, {
      current_branch: 'crear_documento',
      branch_context: {
        ...ctx,
        stage: 'save_now',
        saveTarget: 'root'
      }
    });
    await handleCrearDocumento({ session: updated, chatId, text, sessionName });
    return;
  }

  if (ctx.stage === 'choose_group') {
    const selection = parseNumberSelection(textTrim);
    const groups = Array.isArray(ctx.groups) ? ctx.groups : [];
    const selected = pickGroupFromInput(groups, textTrim);
    if (!selected) {
      await wahaSendText(chatId, `Elige un grupo válido 🙌 (número o nombre)`, sessionName);
      return;
    }
    const updated = await updateWspSession(session.id, {
      current_branch: 'crear_documento',
      branch_context: {
        ...ctx,
        stage: 'save_now',
        saveTarget: 'group',
        selectedGroup: selected
      }
    });
    await handleCrearDocumento({ session: updated, chatId, text, sessionName });
    return;
  }

  if (ctx.stage === 'save_now') {
    const { data: user, error } = await supabase.from('users').select('*').eq('id', session.user_id).single();
    if (error || !user) {
      await updateWspSession(session.id, { current_branch: null, branch_context: {} });
      await wahaSendText(chatId, `No pude encontrar tu cuenta 😕 Escribe "menú" para reiniciar.`, sessionName);
      return;
    }

    let parentFolderId = null;
    if (ctx.saveTarget === 'group' && ctx.selectedGroup?.folder_id) {
      parentFolderId = ctx.selectedGroup.folder_id;
    } else {
      parentFolderId = await resolveRootFolderIdForUser(user.email, user.id);
    }

    if (!parentFolderId) {
      await updateWspSession(session.id, { current_branch: null, branch_context: {} });
      await wahaSendText(chatId, `No encontré tu carpeta raíz de Brify 😕 Revisa tu configuración en ${BRIFY_PROFILE_URL}`, sessionName);
      return;
    }

    let fileName = `Documento Brify - ${new Date().toISOString().slice(0, 10)}.html`;
    let html = '';
    let templateKey = null;

    if (ctx.templateKey) {
      templateKey = ctx.templateKey;
      const plantilla = plantillas[templateKey];
      fileName = `${plantilla.nombre} - ${new Date().toISOString().slice(0, 10)}.html`;
      html = renderPlantillaToHtml(plantilla, ctx.answers || {});
    } else {
      const title = ctx.title || 'Documento';
      fileName = `${title} - ${new Date().toISOString().slice(0, 10)}.html`;
      const body = String(ctx.description || '');
      html = `<!doctype html><html><head><meta charset="utf-8"></head><body><h1>${title}</h1><div style="white-space: pre-wrap; font-family: Arial, sans-serif;">${body}</div></body></html>`;
    }

    try {
      const file = await createHtmlFileInDrive({
        userId: user.id,
        parentFolderId,
        fileName,
        html
      });

      await logDocumentoAdministrador({
        file,
        userEmail: user.email,
        servicio: 'abogados',
        templateKey
      });

      await updateWspSession(session.id, { current_branch: null, branch_context: {} });
      await wahaSendText(chatId, `✅ Listo. Guardé tu documento: ${file.webViewLink}\n\n¿Quieres hacer algo más? Escribe "menú" 🙌`, sessionName);
      return;
    } catch (_) {
      await updateWspSession(session.id, { current_branch: null, branch_context: {} });
      await wahaSendText(chatId, `Tuve un error guardando el documento 😕\n\nRevisa que tu Drive esté vinculado en ${BRIFY_PROFILE_URL} y vuelve a intentar. Escribe "menú" para empezar de nuevo.`, sessionName);
      return;
    }
  }
}

async function handleWahaMessage({ chatId, body, payload, sessionName }) {
  const phoneNumber = normalizePhoneFromChatId(chatId);
  if (!phoneNumber) return;

  let session = await getOrCreateWspSession(phoneNumber);
  const text = normalizeIncomingText(body);
  const textLower = text.toLowerCase();

  if (isMenuTrigger(textLower)) {
    if (!session.user_id) {
      const userByPhone = await getUserByPhone(phoneNumber);
      if (userByPhone) {
        session = await updateWspSession(session.id, { user_id: userByPhone.id, branch_context: {}, current_branch: null });
      }
    }

    if (!session.user_id) {
      await updateWspSession(session.id, { current_branch: 'verify_phone', branch_context: { awaiting_email: true } });
      await wahaSendText(chatId, `¡Hola! No encontré una cuenta asociada a este número 😊 ¿Me puedes indicar el correo con el que te registraste en Brify?`, sessionName);
      return;
    }

    const { data: user } = await supabase.from('users').select('name, full_name').eq('id', session.user_id).single();
    await wahaSendText(chatId, buildMainMenu(user?.name || user?.full_name || ''), sessionName);
    return;
  }

  if (!session.user_id) {
    const user = await getUserByPhone(phoneNumber);
    if (user) {
      session = await updateWspSession(session.id, { user_id: user.id, branch_context: {}, current_branch: null });
    } else {
      const awaitingEmail = Boolean(session.branch_context?.awaiting_email);
      if (!awaitingEmail) {
        session = await updateWspSession(session.id, { current_branch: 'verify_phone', branch_context: { awaiting_email: true } });
        await wahaSendText(chatId, `¡Hola! No encontré una cuenta asociada a este número 😊 ¿Me puedes indicar el correo con el que te registraste en Brify?`, sessionName);
        return;
      }

      const email = text.trim().toLowerCase();
      const byEmail = await getUserByEmail(email);
      if (!byEmail) {
        await updateWspSession(session.id, { current_branch: null, branch_context: { awaiting_email: true } });
        await wahaSendText(chatId, `Parece que aún no tienes cuenta en Brify 🙌 Puedes registrarte fácilmente aquí: ${BRIFY_REGISTER_URL}\n\nSi ya tienes cuenta, revisa el correo e inténtalo de nuevo.`, sessionName);
        return;
      }

      await supabase.from('users').update({ phone_number: phoneNumber, phone_verified: true, updated_at: new Date().toISOString() }).eq('id', byEmail.id);
      session = await updateWspSession(session.id, { user_id: byEmail.id, current_branch: null, branch_context: {} });
    }
  }

  const hasDrive = await isDriveLinked(session.user_id);
  if (!hasDrive) {
    await updateWspSession(session.id, { current_branch: 'await_drive', branch_context: {} });
    await wahaSendText(chatId, `Para usar todas las herramientas de Brify en WhatsApp necesitas vincular tu Google Drive primero 📂\n\nPuedes hacerlo desde tu perfil en ${BRIFY_PROFILE_URL}. ¡Avísame cuando lo hagas!`, sessionName);
    return;
  }

  if (session.current_branch === 'asesor_legal') {
    await handleAsesorLegal({ session, chatId, text, sessionName });
    return;
  }

  if (session.current_branch === 'crear_grupo') {
    await handleCrearGrupo({ session, chatId, text, sessionName });
    return;
  }

  if (session.current_branch === 'compartir_grupo') {
    await handleCompartirGrupo({ session, chatId, text, sessionName });
    return;
  }

  if (session.current_branch === 'subir_archivo') {
    await handleSubirArchivo({ session, chatId, text, sessionName, payload });
    return;
  }

  if (session.current_branch === 'listar_archivos') {
    await handleListarArchivos({ session, chatId, text, sessionName });
    return;
  }

  if (session.current_branch === 'analizar_documento') {
    await handleAnalizarDocumento({ session, chatId, text, sessionName, payload });
    return;
  }

  if (session.current_branch === 'crear_documento') {
    await handleCrearDocumento({ session, chatId, text, sessionName });
    return;
  }

  const media = extractMediaFromPayload(payload);
  if (media?.url) {
    await enterBranch(session, chatId, sessionName, 'upload_file');
    session = await getOrCreateWspSession(phoneNumber);
    await handleSubirArchivo({ session, chatId, text, sessionName, payload });
    return;
  }

  const intent = await detectIntent(text);
  if (intent.intent === 'menu_1') {
    await enterBranch(session, chatId, sessionName, 'legal');
    return;
  } else if (intent.intent === 'menu_2') {
    await enterBranch(session, chatId, sessionName, 'create_group');
    return;
  } else if (intent.intent === 'menu_3') {
    await enterBranch(session, chatId, sessionName, 'share_group');
    return;
  } else if (intent.intent === 'menu_4') {
    await enterBranch(session, chatId, sessionName, 'upload_file');
    return;
  } else if (intent.intent === 'menu_5') {
    await enterBranch(session, chatId, sessionName, 'list_files');
    return;
  } else if (intent.intent === 'menu_6') {
    await enterBranch(session, chatId, sessionName, 'create_document');
    return;
  } else if (intent.intent === 'menu_7') {
    await enterBranch(session, chatId, sessionName, 'analyze_document');
    return;
  }
    session = await updateWspSession(session.id, { current_branch: 'asesor_legal', branch_context: { stage: 'choose_mode' } });
    await handleAsesorLegal({ session, chatId, text, sessionName });
    await enterBranch(session, chatId, sessionName, 'legal');
    return;
    session = await updateWspSession(session.id, { current_branch: 'crear_grupo', branch_context: { stage: 'ask_name' } });
    await handleCrearGrupo({ session, chatId, text, sessionName });
    await enterBranch(session, chatId, sessionName, 'create_group');
    return;
    session = await updateWspSession(session.id, { current_branch: 'compartir_grupo', branch_context: { stage: 'start' } });
    await handleCompartirGrupo({ session, chatId, text, sessionName });
    await enterBranch(session, chatId, sessionName, 'share_group');
    return;
    session = await updateWspSession(session.id, { current_branch: 'subir_archivo', branch_context: { stage: 'wait_file' } });
    await handleSubirArchivo({ session, chatId, text, sessionName, payload });
    await enterBranch(session, chatId, sessionName, 'upload_file');
    return;
    session = await updateWspSession(session.id, { current_branch: 'listar_archivos', branch_context: { stage: 'choose_location' } });
    await handleListarArchivos({ session, chatId, text, sessionName });
    await enterBranch(session, chatId, sessionName, 'list_files');
    return;
    session = await updateWspSession(session.id, { current_branch: 'crear_documento', branch_context: { stage: 'choose_mode' } });
    await handleCrearDocumento({ session, chatId, text, sessionName });
    await enterBranch(session, chatId, sessionName, 'create_document');
    return;
    session = await updateWspSession(session.id, { current_branch: 'analizar_documento', branch_context: { stage: 'choose_mode' } });
    await handleAnalizarDocumento({ session, chatId, text, sessionName, payload });
    await enterBranch(session, chatId, sessionName, 'analyze_document');
    return;

  const { data: user } = await supabase.from('users').select('name, full_name').eq('id', session.user_id).single();
  await wahaSendText(chatId, buildMainMenu(user?.name || user?.full_name || ''), sessionName);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-brify-webhook-secret'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    if (WAHA_WEBHOOK_SECRET) {
      const provided = req.headers['x-brify-webhook-secret'];
      if (provided !== WAHA_WEBHOOK_SECRET) {
        return res.status(401).json({ success: false });
      }
    }

    const event = req.body?.event;
    const payload = req.body?.payload || {};
    const sessionName = req.body?.session || DEFAULT_WAHA_SESSION;

    if (event !== 'message') {
      return res.json({ success: true });
    }

    if (payload.fromMe) {
      return res.json({ success: true });
    }

    const chatId = payload?._data?.key?.remoteJidAlt || payload.from || payload.chatId;
    const body = payload.body;
    if (!chatId) {
      return res.status(400).json({ success: false });
    }

    await wahaSendSeen(chatId, sessionName);
    await wahaStartTyping(chatId, sessionName);
    await handleWahaMessage({ chatId, body, payload, sessionName });
    await wahaStopTyping(chatId, sessionName);
    return res.json({ success: true });
  } catch (error) {
    console.error('Error procesando webhook WAHA (Serverless):', error);
    try {
      const payload = req.body?.payload || {};
      const sessionName = req.body?.session || DEFAULT_WAHA_SESSION;
      const chatId = payload?._data?.key?.remoteJidAlt || payload.from || payload.chatId;
      if (chatId) {
        await wahaStopTyping(chatId, sessionName);
      }
    } catch (_) {}
    return res.status(500).json({ success: false, error: error.message });
  }
};

