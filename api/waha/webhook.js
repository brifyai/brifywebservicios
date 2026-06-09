const crypto = require('crypto');
const { Readable } = require('stream');
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

if (!supabaseUrl) {
  console.error('[WAHA webhook] Falta REACT_APP_SUPABASE_URL');
}
if (!supabaseServiceKey) {
  console.warn(
    '[WAHA webhook] SUPABASE_SERVICE_ROLE_KEY no configurado: se usará ANON key y la búsqueda en users puede fallar por RLS (terminará pidiendo correo).'
  );
}

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
const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.REACT_APP_GEMINI_API_KEY ||
  process.env.REACT_APP_GOOGLE_GEMINI_API_KEY ||
  process.env.GOOGLE_GEMINI_API_KEY ||
  '';
const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY ||
  process.env.REACT_APP_OPENAI_API_KEY ||
  '';
const OPENAI_BASE_URL =
  process.env.OPENAI_BASE_URL ||
  process.env.REACT_APP_OPENAI_BASE_URL ||
  'https://api.openai.com/v1';
const OPENAI_EMBEDDINGS_MODEL =
  process.env.EMBEDDINGS_MODEL ||
  process.env.REACT_APP_EMBEDDINGS_MODEL ||
  process.env.OPENAI_EMBEDDINGS_MODEL ||
  process.env.REACT_APP_OPENAI_EMBEDDINGS_MODEL ||
  'nvidia/llama-nemotron-embed-1b-v2';
const OPENAI_CHAT_MODEL =
  process.env.OPENAI_CHAT_MODEL ||
  process.env.REACT_APP_OPENAI_CHAT_MODEL ||
  'gpt-4.1-mini';
const EMBEDDINGS_API_KEY =
  process.env.EMBEDDINGS_API_KEY ||
  process.env.REACT_APP_EMBEDDINGS_API_KEY ||
  process.env.OPENROUTER_API_KEY ||
  process.env.REACT_APP_OPENROUTER_API_KEY ||
  OPENAI_API_KEY;
const EMBEDDINGS_BASE_URL =
  process.env.EMBEDDINGS_BASE_URL ||
  process.env.REACT_APP_EMBEDDINGS_BASE_URL ||
  process.env.OPENROUTER_BASE_URL ||
  process.env.REACT_APP_OPENROUTER_BASE_URL ||
  process.env.OPENAI_BASE_URL ||
  process.env.REACT_APP_OPENAI_BASE_URL ||
  'https://openrouter.ai/api/v1';
const OPENAI_EMBEDDINGS_DIMENSIONS = Number(
  process.env.OPENAI_EMBEDDINGS_DIMENSIONS ||
    process.env.REACT_APP_OPENAI_EMBEDDINGS_DIMENSIONS ||
    process.env.EMBEDDINGS_DIMENSIONS ||
    process.env.REACT_APP_EMBEDDINGS_DIMENSIONS ||
    '768'
);
const EMBEDDINGS_INPUT_TYPE_MODE =
  process.env.EMBEDDINGS_INPUT_TYPE_MODE ||
  process.env.REACT_APP_EMBEDDINGS_INPUT_TYPE_MODE ||
  'auto';
const EMBEDDINGS_HTTP_REFERER =
  process.env.EMBEDDINGS_HTTP_REFERER ||
  process.env.REACT_APP_EMBEDDINGS_HTTP_REFERER ||
  process.env.OPENROUTER_HTTP_REFERER ||
  process.env.REACT_APP_OPENROUTER_HTTP_REFERER ||
  '';
const EMBEDDINGS_APP_TITLE =
  process.env.EMBEDDINGS_APP_TITLE ||
  process.env.REACT_APP_EMBEDDINGS_APP_TITLE ||
  process.env.OPENROUTER_APP_TITLE ||
  process.env.REACT_APP_OPENROUTER_APP_TITLE ||
  'Brify';
const GEMINI_EMBEDDINGS_MODEL =
  process.env.GEMINI_EMBEDDINGS_MODEL ||
  process.env.REACT_APP_GEMINI_EMBEDDINGS_MODEL ||
  'text-embedding-004';
const GEMINI_VISION_MODEL =
  process.env.GEMINI_VISION_MODEL ||
  process.env.REACT_APP_GEMINI_VISION_MODEL ||
  'gemini-1.5-flash';
const WAHA_MINIMAX_ENABLED = (process.env.WAHA_MINIMAX_ENABLED || 'true').toLowerCase() === 'true';
const WAHA_MINIMAX_TEMPERATURE = Number(process.env.WAHA_MINIMAX_TEMPERATURE || '0.7');
const WAHA_ROUTER_ENABLED = (process.env.WAHA_ROUTER_ENABLED || 'true').toLowerCase() === 'true';
const WAHA_ROUTER_MIN_CONFIDENCE = Number(process.env.WAHA_ROUTER_MIN_CONFIDENCE || '0.55');
const WAHA_CASUAL_ENABLED = (process.env.WAHA_CASUAL_ENABLED || 'true').toLowerCase() === 'true';
const WAHA_CASUAL_MAX_TURNS = Number(process.env.WAHA_CASUAL_MAX_TURNS || '12');
const WAHA_HTTP_TIMEOUT_MS = Number(process.env.WAHA_HTTP_TIMEOUT_MS || '7000');
const WAHA_MINIMAX_TIMEOUT_MS = Number(process.env.WAHA_MINIMAX_TIMEOUT_MS || '8000');
const WAHA_MEDIA_TIMEOUT_MS = Number(process.env.WAHA_MEDIA_TIMEOUT_MS || '12000');
const WAHA_EMBEDDINGS_ENABLED = (process.env.WAHA_EMBEDDINGS_ENABLED || 'true').toLowerCase() === 'true';
const WAHA_EMBEDDINGS_TIMEOUT_MS = Number(process.env.WAHA_EMBEDDINGS_TIMEOUT_MS || '15000');
const WAHA_EMBEDDINGS_MAX_CHUNKS = Number(process.env.WAHA_EMBEDDINGS_MAX_CHUNKS || '24');
const WAHA_VISION_ENABLED = (process.env.WAHA_VISION_ENABLED || 'true').toLowerCase() === 'true';
const WAHA_VISION_TIMEOUT_MS = Number(process.env.WAHA_VISION_TIMEOUT_MS || '20000');

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...(options || {}), signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeEmbeddingTo768(vec) {
  const arr = Array.isArray(vec) ? vec.map((n) => (typeof n === 'number' ? n : Number(n))) : [];
  const clean = arr.map((n) => (Number.isFinite(n) ? n : 0));
  if (clean.length === 768) return clean;
  if (clean.length > 768) return clean.slice(0, 768);
  if (clean.length < 768) return [...clean, ...new Array(768 - clean.length).fill(0)];
  return new Array(768).fill(0);
}

function serializeVectorForDb(vec) {
  const normalized = normalizeEmbeddingTo768(vec);
  return `[${normalized.map((n) => Number(Number(n).toFixed(8))).join(',')}]`;
}

function extractEmbeddingFromResponse(data) {
  if (!data) return null;
  if (Array.isArray(data?.data) && data.data[0]?.embedding) return data.data[0].embedding;
  if (Array.isArray(data?.embedding)) return data.embedding;
  if (data?.data?.embedding) return data.data.embedding;
  return null;
}

function summarizeEmbeddingError(error, extra = {}) {
  const base = {
    message: error?.message || null,
    name: error?.name || null,
    status: error?.status || error?.code || null
  };
  const details = error?.details || error?.errorDetails || error?.response?.data || null;
  if (details) base.details = details;
  return {
    ...extra,
    ...base
  };
}

function summarizeSupabaseError(error, extra = {}) {
  return {
    ...extra,
    message: error?.message || null,
    code: error?.code || null,
    details: error?.details || null,
    hint: error?.hint || null
  };
}

function summarizeOpenAIError(error, extra = {}) {
  return {
    ...extra,
    message: error?.message || null,
    name: error?.name || null,
    status: error?.status || null,
    type: error?.type || null,
    code: error?.code || null,
    param: error?.param || null
  };
}

function shouldSendEmbeddingDimensions(modelName, baseUrl) {
  const model = String(modelName || '').trim().toLowerCase();
  const url = String(baseUrl || '').trim().toLowerCase();
  return Boolean(
    model &&
    Number.isFinite(OPENAI_EMBEDDINGS_DIMENSIONS) &&
    OPENAI_EMBEDDINGS_DIMENSIONS > 0 &&
    (
      /^text-embedding-3-/i.test(model) ||
      model.includes('nvidia/llama-nemotron-embed-1b-v2') ||
      url.includes('openrouter.ai')
    )
  );
}

function resolveEmbeddingInputType(taskType, baseUrl) {
  const mode = String(EMBEDDINGS_INPUT_TYPE_MODE || 'auto').trim().toLowerCase();
  if (!mode || mode === 'off' || mode === 'none' || mode === 'disabled') return null;

  const normalizedTask = String(taskType || '').trim().toUpperCase();
  const defaultType = normalizedTask === 'RETRIEVAL_QUERY' ? 'search_query' : 'search_document';

  if (mode === 'query_passage') {
    return normalizedTask === 'RETRIEVAL_QUERY' ? 'query' : 'passage';
  }
  if (mode === 'search') return defaultType;
  if (mode !== 'auto') return mode;

  const url = String(baseUrl || '').trim().toLowerCase();
  if (url.includes('openrouter.ai')) return defaultType;
  return null;
}

function extractEmbeddingValues(result) {
  const candidates = [
    result,
    result?.response,
    result?.data,
    result?.response?.data,
    result?.embeddings?.[0],
    result?.data?.[0],
    result?.embedding
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (Array.isArray(candidate?.embedding?.values)) return candidate.embedding.values;
    if (Array.isArray(candidate?.values)) return candidate.values;
    if (Array.isArray(candidate?.embedding)) return candidate.embedding;
    if (Array.isArray(candidate)) return candidate;
    const extracted = extractEmbeddingFromResponse(candidate);
    if (Array.isArray(extracted?.values)) return extracted.values;
    if (Array.isArray(extracted)) return extracted;
  }

  return null;
}

async function geminiEmbedTextsDetailed(texts, taskType = 'RETRIEVAL_DOCUMENT') {
  if (!WAHA_EMBEDDINGS_ENABLED) {
    return { embeddings: null, error: { reason: 'embeddings_disabled' } };
  }
  if (!GEMINI_API_KEY) {
    return { embeddings: null, error: { reason: 'missing_gemini_api_key' } };
  }
  const inputs = Array.isArray(texts) ? texts.map((t) => String(t || '').trim()).filter(Boolean) : [];
  if (!inputs.length) {
    return { embeddings: null, error: { reason: 'missing_input_texts' } };
  }

  let GoogleGenerativeAI = null;
  try {
    ({ GoogleGenerativeAI } = require('@google/generative-ai'));
  } catch (error) {
    return {
      embeddings: null,
      error: summarizeEmbeddingError(error, {
        reason: 'gemini_sdk_load_failed',
        model: GEMINI_EMBEDDINGS_MODEL,
        task_type: taskType
      })
    };
  }

  let model = null;
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: GEMINI_EMBEDDINGS_MODEL });
  } catch (error) {
    return {
      embeddings: null,
      error: summarizeEmbeddingError(error, {
        reason: 'gemini_model_init_failed',
        model: GEMINI_EMBEDDINGS_MODEL,
        task_type: taskType
      })
    };
  }

  const out = [];
  const timeoutMs = Number.isFinite(WAHA_EMBEDDINGS_TIMEOUT_MS) && WAHA_EMBEDDINGS_TIMEOUT_MS > 0 ? WAHA_EMBEDDINGS_TIMEOUT_MS : 15000;

  for (let inputIndex = 0; inputIndex < inputs.length; inputIndex++) {
    const input = inputs[inputIndex];
    const requestForms = [
      {
        label: 'content_parts_with_task_type',
        build: () => ({
          content: { parts: [{ text: input }] },
          taskType
        })
      },
      {
        label: 'raw_string',
        build: () => input
      },
      {
        label: 'content_string_object',
        build: () => ({ content: input })
      }
    ];

    const attempts = [];
    let embedded = null;

    for (const form of requestForms) {
      try {
        const result = await Promise.race([
          model.embedContent(form.build()),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini embeddings timeout')), timeoutMs))
        ]);
        const values = extractEmbeddingValues(result);
        if (Array.isArray(values)) {
          embedded = normalizeEmbeddingTo768(values);
          attempts.push({ form: form.label, ok: true, values: values.length });
          break;
        }
        attempts.push({
          form: form.label,
          ok: false,
          reason: 'missing_embedding_values',
          response_keys: Object.keys(result || {}).slice(0, 8)
        });
      } catch (error) {
        attempts.push({
          form: form.label,
          ok: false,
          ...summarizeEmbeddingError(error)
        });
      }
    }

    if (!embedded) {
      return {
        embeddings: null,
        error: {
          reason: 'all_embedding_forms_failed',
          model: GEMINI_EMBEDDINGS_MODEL,
          task_type: taskType,
          input_index: inputIndex,
          input_chars: input.length,
          attempts: attempts.slice(0, 6)
        }
      };
    }

    out.push(embedded);
  }

  return { embeddings: out.length ? out : null, error: null };
}

async function openaiEmbedTextsDetailed(texts, taskType = 'RETRIEVAL_DOCUMENT') {
  if (!WAHA_EMBEDDINGS_ENABLED) {
    return { embeddings: null, error: { reason: 'embeddings_disabled' } };
  }
  if (!EMBEDDINGS_API_KEY) {
    return { embeddings: null, error: { reason: 'missing_embeddings_api_key' } };
  }
  const inputs = Array.isArray(texts) ? texts.map((t) => String(t || '').trim()).filter(Boolean) : [];
  if (!inputs.length) {
    return { embeddings: null, error: { reason: 'missing_input_texts' } };
  }

  const timeoutMs = Number.isFinite(WAHA_EMBEDDINGS_TIMEOUT_MS) && WAHA_EMBEDDINGS_TIMEOUT_MS > 0 ? WAHA_EMBEDDINGS_TIMEOUT_MS : 15000;
  const out = [];

  for (let inputIndex = 0; inputIndex < inputs.length; inputIndex++) {
    const input = inputs[inputIndex];
    const body = {
      model: OPENAI_EMBEDDINGS_MODEL,
      input,
      encoding_format: 'float'
    };
    if (shouldSendEmbeddingDimensions(OPENAI_EMBEDDINGS_MODEL, EMBEDDINGS_BASE_URL)) {
      body.dimensions = OPENAI_EMBEDDINGS_DIMENSIONS;
    }
    const inputType = resolveEmbeddingInputType(taskType, EMBEDDINGS_BASE_URL);
    if (inputType) body.input_type = inputType;

    let response = null;
    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${EMBEDDINGS_API_KEY}`
      };
      if (String(EMBEDDINGS_BASE_URL || '').toLowerCase().includes('openrouter.ai')) {
        if (EMBEDDINGS_HTTP_REFERER) headers['HTTP-Referer'] = EMBEDDINGS_HTTP_REFERER;
        if (EMBEDDINGS_APP_TITLE) headers['X-Title'] = EMBEDDINGS_APP_TITLE;
      }
      response = await fetchWithTimeout(
        `${String(EMBEDDINGS_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '')}/embeddings`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        },
        timeoutMs
      );
    } catch (error) {
      return {
        embeddings: null,
        error: {
          reason: 'openai_request_failed',
          model: OPENAI_EMBEDDINGS_MODEL,
          task_type: taskType,
          input_index: inputIndex,
          input_chars: input.length,
          attempts: [
            summarizeOpenAIError(error, { form: 'openai_embeddings_create', ok: false })
          ]
        }
      };
    }

    let data = null;
    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }

    if (!response.ok) {
      const apiError = data?.error || {};
      return {
        embeddings: null,
        error: {
          reason: 'openai_embeddings_failed',
          model: OPENAI_EMBEDDINGS_MODEL,
          task_type: taskType,
          input_index: inputIndex,
          input_chars: input.length,
          attempts: [
            summarizeOpenAIError(
              {
                message: apiError?.message || `OpenAI embeddings HTTP ${response.status}`,
                status: response.status,
                type: apiError?.type || null,
                code: apiError?.code || null,
                param: apiError?.param || null
              },
              { form: 'openai_embeddings_create', ok: false }
            )
          ]
        }
      };
    }

    const values = Array.isArray(data?.data) && Array.isArray(data.data[0]?.embedding) ? data.data[0].embedding : null;
    if (!Array.isArray(values)) {
      return {
        embeddings: null,
        error: {
          reason: 'openai_missing_embedding_values',
          model: OPENAI_EMBEDDINGS_MODEL,
          task_type: taskType,
          input_index: inputIndex,
          input_chars: input.length,
          attempts: [
            {
              form: 'openai_embeddings_create',
              ok: false,
              response_keys: Object.keys(data || {}).slice(0, 8)
            }
          ]
        }
      };
    }

    out.push(normalizeEmbeddingTo768(values));
  }

  return { embeddings: out.length ? out : null, error: null };
}

async function geminiEmbedTexts(texts, taskType = 'RETRIEVAL_DOCUMENT') {
  const detailed = await openaiEmbedTextsDetailed(texts, taskType);
  return detailed?.embeddings || null;
}

async function buildEmbeddingsWithFallback(texts, taskType = 'RETRIEVAL_DOCUMENT') {
  const inputs = Array.isArray(texts) ? texts.map((t) => String(t || '').trim()).filter(Boolean) : [];
  if (!inputs.length) return { embeddings: null, provider: null };

  const openaiDetailed = await openaiEmbedTextsDetailed(inputs, taskType);
  const openaiEmbeddings = openaiDetailed?.embeddings;
  if (Array.isArray(openaiEmbeddings) && openaiEmbeddings.length === inputs.length) {
    return {
      embeddings: openaiEmbeddings,
      provider: String(EMBEDDINGS_BASE_URL || '').toLowerCase().includes('openrouter.ai') ? 'openrouter' : 'openai_compatible',
      model: OPENAI_EMBEDDINGS_MODEL,
      error: null
    };
  }

  const deterministicEmbeddings = inputs.map((input) => generateDeterministicEmbedding(input));
  return {
    embeddings: deterministicEmbeddings,
    provider: 'deterministic_fallback',
    model: openaiDetailed?.error ? OPENAI_EMBEDDINGS_MODEL : null,
    error: openaiDetailed?.error || { reason: 'unknown_openai_embedding_failure' }
  };
}

async function geminiGenerateText({ modelName, prompt, timeoutMs }) {
  if (!GEMINI_API_KEY) return '';
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: modelName });

  const t = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 20000;
  const result = await Promise.race([
    model.generateContent(prompt),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini timeout')), t))
  ]).catch(() => null);

  const text = result?.response?.text ? result.response.text() : '';
  return typeof text === 'string' ? sanitizeWhatsAppText(text) : '';
}

async function geminiAnalyzeImage({ imageBuffer, mimeType, userMessage }) {
  if (!WAHA_VISION_ENABLED) return '';
  if (!GEMINI_API_KEY) return '';
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) return '';
  const mt = String(mimeType || '').trim() || 'image/jpeg';
  const base64 = imageBuffer.toString('base64');

  const promptText = `Analiza la imagen que adjunta el usuario.
Entrega:
1) Qué se ve (descripción breve)
2) Texto detectado si aplica (OCR)
3) Si parece un documento/boleta/contrato, sugiere qué información clave extraer
Reglas: no uses Markdown.`;

  const prompt = [
    { text: promptText },
    { inlineData: { data: base64, mimeType: mt } },
    ...(userMessage ? [{ text: `\nContexto del usuario: ${String(userMessage).trim()}` }] : [])
  ];

  const answer = await geminiGenerateText({
    modelName: GEMINI_VISION_MODEL,
    prompt,
    timeoutMs: Number.isFinite(WAHA_VISION_TIMEOUT_MS) && WAHA_VISION_TIMEOUT_MS > 0 ? WAHA_VISION_TIMEOUT_MS : 20000
  });
  return answer;
}

function sanitizeWhatsAppText(text) {
  let s = String(text || '');
  if (!s.trim()) return '';

  s = s.replace(/^\s*[-*_]{3,}\s*$/gm, '');
  s = s.replace(/\*\*(.+?)\*\*/g, '$1');
  s = s.replace(/(^|\s)\*(\S[^*]{0,200}?)\*(?=\s|$)/g, '$1$2');
  s = s.replace(/(^|\s)_(\S[^_]{0,200}?)_(?=\s|$)/g, '$1$2');
  s = s.replace(/^\s*[-•*]\s+/gm, '🔹 ');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

function normalizeIncomingText(text) {
  if (!text) return '';
  return String(text).trim();
}

function isValidEmail(text) {
  const s = String(text || '').trim();
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function normalizeForEmbedding(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hashStringToUint32(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function generateDeterministicEmbedding(text, dimensions = 768) {
  const normalized = normalizeForEmbedding(text);
  const tokens = normalized.split(' ').filter((t) => t.length > 0);
  const vector = new Array(dimensions).fill(0);

  for (const token of tokens) {
    const hash = hashStringToUint32(token);
    const index = hash % dimensions;
    const sign = (hash & 1) === 0 ? 1 : -1;
    const magnitude = 1 + ((hash >>> 1) % 3);
    vector[index] += sign * magnitude;
  }

  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => v / norm);
}

function isLikelyDocumentSearch(text) {
  const t = normalizeForIntent(text);
  if (!t) return false;
  if (isLikelyLegalTopic(t) || isLikelyLawSearch(t)) return false;
  if (isLikelyDocumentKnowledgeQuestion(text) || wantsDocumentLink(text)) return true;
  const hasVerb = t.includes('busca') || t.includes('buscar') || t.includes('encuentra') || t.includes('encontrar') || t.includes('muestrame') || t.includes('muéstrame');
  const hasDocHint =
    t.includes('document') ||
    t.includes('archivo') ||
    t.includes('pdf') ||
    t.includes('contrato') ||
    t.includes('propuesta') ||
    t.includes('procedimiento') ||
    t.includes('manual') ||
    t.includes('reunion') ||
    t.includes('reunión');
  if (hasVerb && hasDocHint) return true;
  if (t.startsWith('que decia') || t.startsWith('qué decia') || t.startsWith('que decía') || t.startsWith('qué decía')) return true;
  if (t.startsWith('donde') || t.startsWith('dónde')) return hasDocHint;
  return false;
}

function driveOpenLink(fileId) {
  const id = String(fileId || '').trim();
  if (!id) return '';
  return `https://drive.google.com/open?id=${id}`;
}

function normalizePhoneFromChatId(chatId) {
  if (!chatId) return null;
  const raw = String(chatId);
  const base = raw.includes('@') ? raw.split('@')[0] : raw;
  const digits = base.replace(/[^\d]/g, '');
  if (!digits) return null;
  if (digits.length > 11) {
    if (digits.startsWith('569')) return digits.slice(0, 11);
    if (digits.startsWith('56') && digits.length >= 11 && digits[2] === '9') return digits.slice(0, 11);
  }
  if (digits.length === 8) return `569${digits}`;
  if (digits.length === 9 && digits.startsWith('9')) return `56${digits}`;
  if (digits.length === 11 && digits.startsWith('569')) return digits;
  if (digits.length === 12 && digits.startsWith('00569')) return digits.slice(2);
  return digits;
}

function documentWsspPatch(phoneNumber) {
  const normalized = normalizePhoneFromChatId(phoneNumber);
  return normalized ? { wssp: normalized } : {};
}

function isImmediateVectorizableMime(mimeType) {
  const mt = String(mimeType || '').trim().toLowerCase();
  if (!mt) return false;
  return (
    mt === 'application/vnd.google-apps.document' ||
    mt.startsWith('text/') ||
    mt === 'application/pdf' ||
    mt === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mt === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mt === 'application/vnd.ms-excel'
  );
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

function isExplicitCreateGroupRequest(text) {
  const t = normalizeForIntent(text);
  if (!t) return false;
  const hasCreateVerb =
    t.includes('crear') ||
    t.includes('crea') ||
    t.includes('armar') ||
    t.includes('arma') ||
    t.includes('generar') ||
    t.includes('genera') ||
    t.includes('hacer') ||
    t.includes('haz');
  const hasGroupTarget = t.includes('grupo') || t.includes('carpeta');
  return hasCreateVerb && hasGroupTarget;
}

function isCreateDocumentTrigger(textLower) {
  if (!textLower) return false;
  if (textLower === '6') return false;
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

function buildMainMenu(nombre, meta = {}) {
  const displayName = nombre ? ` ${nombre}` : '';
  const minutesSinceLast = Number.isFinite(meta?.minutesSinceLast) ? meta.minutesSinceLast : null;
  const firstInteraction = Boolean(meta?.firstInteraction);

  let header = '';
  if (firstInteraction) {
    header = `Hola${displayName} 👋 Soy Brify. ¿Qué necesitas hoy?`;
  } else if (minutesSinceLast !== null && minutesSinceLast < 5) {
    header = `Perfecto 👌 Te leo.`;
  } else if (minutesSinceLast !== null && minutesSinceLast < 60 * 24) {
    header = `Hola de nuevo${displayName} 👋 ¿En qué seguimos?`;
  } else if (minutesSinceLast !== null) {
    header = `Hola${displayName} 👋 Qué bueno verte de vuelta. ¿Qué hacemos hoy?`;
  } else {
    header = `Hola${displayName} 👋 ¿En qué te puedo ayudar?`;
  }

  return `${header}\n\nPuedes decirme directamente lo que necesitas.\n\nPor ejemplo: "crear grupo Marketing", "compartir grupo Ventas con correo@empresa.com" o simplemente hacer una pregunta.\n\nSi prefieres, también puedes usar estas opciones:\n\n1️⃣ ⚖️ Asesor legal\n2️⃣ 📁 Crear grupo\n3️⃣ 🤝 Compartir grupo\n4️⃣ 📤 Subir archivo\n5️⃣ 📋 Listar archivos\n6️⃣ 🔍 Analizar documento`;
}

async function showMainMenu({ session, chatId, sessionName }) {
  const last = session?.last_interaction ? new Date(session.last_interaction).getTime() : null;
  const minutesSinceLast = Number.isFinite(last) ? (Date.now() - last) / 60000 : null;
  const firstInteraction = !last || !Number.isFinite(minutesSinceLast);

  const updated = await updateWspSession(session.id, { current_branch: 'casual', branch_context: {} });
  let name = '';
  if (updated.user_id) {
    const { data: user } = await supabase.from('users').select('name, full_name').eq('id', updated.user_id).single();
    name = user?.name || user?.full_name || '';
  }
  await wahaSendText(chatId, buildMainMenu(name, { minutesSinceLast, firstInteraction }), sessionName);
  return updated;
}

function extractGroupNameForShare(text) {
  const quoted = extractQuoted(text);
  if (quoted) return quoted;
  const raw = String(text || '');
  if (!raw.trim()) return null;

  const withoutEmails = raw.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, ' ').replace(/\s+/g, ' ').trim();
  const m = withoutEmails.match(/\bgrupo\b\s+(.+)/i) || withoutEmails.match(/\bcarpeta\b\s+(.+)/i);
  if (!m?.[1]) return null;

  let name = m[1].trim();
  name = name.replace(/\b(con|a|para|por)\b\s+.+$/i, '').trim();
  name = name.replace(/^[“”"'`]+|[“”"'`]+$/g, '').trim();
  if (name.length < 2) return null;
  return name;
}

function extractGroupMention(text) {
  const quoted = extractQuoted(text);
  if (quoted) return quoted;
  const t = String(text || '').trim();
  if (!t) return null;
  const m = t.match(/\b(en|al|a|del|de)\s+el\s+grupo\s+(.+)/i) || t.match(/\bgrupo\s+(.+)/i);
  if (!m?.[2] && !m?.[1]) return null;
  const raw = (m[2] || m[1] || '').trim();
  if (!raw) return null;
  let name = raw.replace(/\b(con|a|para|por)\b\s+.+$/i, '').trim();
  name = name.replace(/^(de|del|la|el|los|las)\s+/i, '').trim();
  name = name.replace(/[.,;:!?()]+$/g, '').trim();
  if (name.length < 2) return null;
  return name;
}

function extractNameContainsQuery(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  let q = raw
    .replace(/\b(listame|listáme|mu[eé]strame|muestra|ens[eé]ñame|ensename|ver|listar|lista|busca|buscar|encuentra|mostrar|dame)\b/gi, ' ')
    .replace(/\b(archivos?|documentos?|im[aá]genes?|fotos?)\b/gi, ' ')
    .replace(/\b(relacionados?\s+con|sobre|acerca\s+de|de|del|la|el|los|las|mi|mis|mio|míos|mias|mías)\b/gi, ' ')
    .replace(/\b(grupo)\b\s+.+$/i, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (q.length < 2) return null;
  if (['mi', 'mis', 'mio', 'mios', 'mia', 'mias'].includes(normalizeForIntent(q))) return null;
  if (q.length > 80) q = q.slice(0, 80).trim();
  return q || null;
}

function isLikelyDocumentKnowledgeQuestion(text) {
  const t = normalizeForIntent(text);
  if (!t) return false;
  if (isLikelyLegalTopic(t) || isLikelyLawSearch(t)) return false;

  if (extractDocumentReferenceName(text)) return true;

  const patterns = [
    'segun mi documento',
    'según mi documento',
    'segun el documento',
    'según el documento',
    'segun mis documentos',
    'según mis documentos',
    'segun la informacion subida',
    'según la información subida',
    'segun la informacion que te subi',
    'según la información que te subí',
    'basado en mis documentos',
    'basado en mi documento',
    'que dice mi documento',
    'qué dice mi documento',
    'que dice el documento',
    'qué dice el documento',
    'resume mi documento',
    'resumeme mi documento',
    'resúmeme mi documento',
    'explica mi documento',
    'analiza mi documento',
    'segun mis archivos',
    'según mis archivos'
  ];
  if (patterns.some((p) => t.includes(p))) return true;

  const hasQuestionVerb =
    t.includes('que dice') ||
    t.includes('qué dice') ||
    t.includes('resume') ||
    t.includes('resumeme') ||
    t.includes('resúmeme') ||
    t.includes('explica') ||
    t.includes('analiza') ||
    t.includes('segun') ||
    t.includes('según');
  const hasDocHint =
    t.includes('document') ||
    t.includes('archivo') ||
    t.includes('pdf') ||
    t.includes('informacion subida') ||
    t.includes('información subida');

  return hasQuestionVerb && hasDocHint;
}

function wantsDocumentLink(text) {
  const t = normalizeForIntent(text);
  if (!t) return false;
  return (
    t.includes('link') ||
    t.includes('enlace') ||
    t.includes('abrir') ||
    t.includes('acceder') ||
    t.includes('pasame el documento') ||
    t.includes('pásame el documento')
  );
}

function hasListIntentVerb(text) {
  const t = normalizeForIntent(text);
  if (!t) return false;
  return (
    t.includes('listar') ||
    t.includes('listame') ||
    t.includes('ver') ||
    t.includes('mostrar') ||
    t.includes('muestrame') ||
    t.includes('ensename') ||
    t.includes('dame')
  );
}

function cleanDocumentNameCandidate(value) {
  let name = String(value || '').trim();
  if (!name) return null;
  name = name
    .replace(/^[“”"'`]+|[“”"'`]+$/g, '')
    .replace(/\ben\s+el\s+grupo\b[\s\S]*$/i, '')
    .replace(/\ben\s+la\s+carpeta\b[\s\S]*$/i, '')
    .replace(/^(de|del|la|el|los|las)\s+/i, '')
    .replace(/\b(sobre|acerca|respecto|que|qué|donde|dónde|para|con|del|de la|de los|de las)\b[\s\S]*$/i, '')
    .replace(/[.,;:!?()]+$/g, '')
    .trim();
  return name.length >= 2 ? name : null;
}

function stripTrailingPoliteness(value) {
  let text = String(value || '').trim();
  if (!text) return '';
  text = text
    .replace(/\b(?:por\s+favor|porfavor|porfa|porfis|porfi|gracias|graciass|graciass|pls|please)\b[\s.!?,;:]*$/i, '')
    .replace(/\b(?:muchas\s+gracias|mil\s+gracias)\b[\s.!?,;:]*$/i, '')
    .replace(/[.,;:!?()]+$/g, '')
    .trim();
  return text;
}

function extractDocumentReferenceName(text) {
  const quoted = extractQuoted(text);
  if (quoted) return cleanDocumentNameCandidate(quoted);

  const raw = String(text || '').trim();
  if (!raw) return null;
  const patterns = [
    /(?:segun|según)\s+(?:mi|el|mis)?\s*(?:documento|archivo|pdf)\s+([^,?\n]+)$/i,
    /(?:resume|resumeme|resúmeme|analiza|explica|revisa)\s+(?:mi|el)?\s*(?:documento|archivo|pdf)\s+([^,?\n]+)$/i,
    /(?:link|enlace|abrir|acceder)\s+(?:del|de|a)?\s*(?:documento|archivo|pdf)\s+([^,?\n]+)$/i,
    /(?:documento|archivo|pdf)\s+([^,?\n]+?)\s+(?:que|qué|sobre|acerca|respecto|donde|dónde|para|con)\b/i
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    const candidate = cleanDocumentNameCandidate(match?.[1]);
    if (candidate) return candidate;
  }
  return null;
}

function extractDocumentContainerName(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const patterns = [
    /\b(?:en|de|del)\s+la\s+carpeta\s+([^,.\n]+?)(?:\s+(?:por|para|y|que|del|de la|de el|con|gracias)\b|$)/i,
    /\b(?:en|de|del)\s+el\s+grupo\s+([^,.\n]+?)(?:\s+(?:por|para|y|que|del|de la|de el|con|gracias)\b|$)/i,
    /\bcarpeta\s+([^,.\n]+?)(?:\s+(?:por|para|y|que|del|de la|de el|con|gracias)\b|$)/i
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    const candidate = cleanDocumentNameCandidate(stripTrailingPoliteness(match?.[1]));
    if (candidate) return candidate;
  }
  return null;
}

function extractAnalysisDocumentHint(text) {
  const direct = extractDocumentReferenceName(text);
  if (direct) return direct;

  const raw = String(text || '').trim();
  if (!raw) return null;
  const patterns = [
    /(?:analiza|analizar|revisa|revisar|interpretar|resumir|resume|opinion|opinión|opina|dame tu opinion|dame tu opinión)\s+(?:el|la|mi)?\s*(contrato|acuerdo|anexo|demanda|escrito|pdf|documento|archivo)\b/i,
    /\b(?:sobre|del|de la|de el)\s+(contrato|acuerdo|anexo|demanda|escrito)\b/i
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    const candidate = cleanDocumentNameCandidate(match?.[1]);
    if (candidate) return candidate;
  }
  return null;
}

function isLikelyDocumentAnalysisRequest(text) {
  const t = normalizeForIntent(text);
  if (!t) return false;
  const hasAnalysisVerb =
    t.includes('analiza') ||
    t.includes('analizar') ||
    t.includes('revisa') ||
    t.includes('revisar') ||
    t.includes('interpret') ||
    t.includes('resumir') ||
    t.includes('resume') ||
    t.includes('opinion') ||
    t.includes('opinión') ||
    t.includes('opina');
  if (!hasAnalysisVerb) return false;

  const hasDocHint =
    t.includes('document') ||
    t.includes('archivo') ||
    t.includes('pdf') ||
    t.includes('drive') ||
    t.includes('carpeta') ||
    t.includes('contrato') ||
    Boolean(extractAnalysisDocumentHint(text));
  return hasDocHint;
}

function sanitizeSearchFragment(text) {
  return String(text || '')
    .replace(/[%_]/g, ' ')
    .replace(/[,()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractRelevantDocExcerpt(content, query, maxChars = 900) {
  const raw = String(content || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  if (!query) return raw.slice(0, maxChars);

  const normalizedQuery = normalizeForIntent(query);
  const terms = normalizedQuery.split(' ').filter((t) => t.length > 3).slice(0, 8);
  const lowerRaw = raw.toLowerCase();
  let at = -1;
  for (const term of terms) {
    at = lowerRaw.indexOf(term);
    if (at >= 0) break;
  }
  if (at < 0) return raw.slice(0, maxChars);

  const start = Math.max(0, at - Math.floor(maxChars * 0.25));
  const end = Math.min(raw.length, start + maxChars);
  return raw.slice(start, end).trim();
}

function trimToNaturalBoundary(text, maxChars = 1100) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  if (raw.length <= maxChars) return raw;

  const boundaryChars = ['. ', '! ', '? ', '; ', ': ', '\n', ', '];
  let cut = -1;
  for (const boundary of boundaryChars) {
    const idx = raw.lastIndexOf(boundary, maxChars);
    if (idx > cut) cut = idx + boundary.trimEnd().length;
  }
  if (cut < Math.floor(maxChars * 0.6)) {
    cut = raw.lastIndexOf(' ', maxChars);
  }
  if (cut < 1) cut = maxChars;
  return raw.slice(0, cut).trim().replace(/[,:;\-–]+$/, '').trim();
}

function buildDocumentFallbackSummary(content, query, maxChars = 1100) {
  const raw = String(content || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';

  const excerpt = extractRelevantDocExcerpt(raw, query, Math.max(900, maxChars)) || raw;
  const normalizedQuery = normalizeForIntent(query);
  const terms = normalizedQuery.split(' ').filter((t) => t.length > 3).slice(0, 8);
  const segments = excerpt
    .split(/(?<=[.!?;:])\s+|\s{2,}/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (!segments.length) return trimToNaturalBoundary(excerpt, maxChars);

  const ranked = segments
    .map((segment, index) => {
      const normalizedSegment = normalizeForIntent(segment);
      const score = terms.reduce((acc, term) => acc + (normalizedSegment.includes(term) ? 2 : 0), 0) + Math.min(segment.length / 120, 2);
      return { segment, index, score };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 5)
    .sort((a, b) => a.index - b.index);

  let summary = '';
  for (const item of ranked) {
    const next = summary ? `${summary} ${item.segment}` : item.segment;
    if (next.length > maxChars) break;
    summary = next;
  }

  summary = trimToNaturalBoundary(summary || excerpt, maxChars);
  if (!/[.!?]$/.test(summary)) summary = `${summary}.`;
  return summary;
}

function buildDocumentAnalysisClosing({ mismatch, useLegalLens, fileName }) {
  if (mismatch?.mismatch) {
    return `Si quieres, ahora puedo ayudarte a buscar el documento correcto en tu Drive o revisar otro archivo para comparar.`;
  }
  if (useLegalLens) {
    return `Si quieres, puedo profundizar en una cláusula, resumirte los riesgos o comparar este archivo con otro documento.`;
  }
  return `Si quieres, puedo profundizar en una parte específica del archivo, resumirlo más simple o revisar otro documento relacionado.`;
}

async function minimaxRewriteForWhatsApp(text) {
  if (!WAHA_MINIMAX_ENABLED) return text;
  if (!MINIMAX_API_KEY) return text;

  const input = String(text || '');
  if (!input.trim()) return input;
  if (input.length > 3500) return input;

  const system = `Eres el asistente oficial de Brify en WhatsApp. Escribe en español chileno neutral (sin voseo). Reescribe el mensaje para que suene humano, cálido y lúdico, usando emojis con moderación. Mantén EXACTAMENTE el significado y no inventes información.
Reglas estrictas:
- Conserva links, números, IDs, rutas y tokens tal cual.
- Mantén intacta la estructura de menús/listas (por ejemplo: "1️⃣", "2️⃣", saltos de línea).
- No agregues pasos nuevos ni cambies opciones.
- No uses Markdown (sin asteriscos, sin guiones como viñetas, sin líneas separadoras).
- Evita argentinismos como "escribí", "vos", "che".
- Máximo 1–2 emojis por bloque.`;

  const response = await fetchWithTimeout(
    MINIMAX_ENDPOINT,
    {
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
    },
    Number.isFinite(WAHA_MINIMAX_TIMEOUT_MS) && WAHA_MINIMAX_TIMEOUT_MS > 0 ? WAHA_MINIMAX_TIMEOUT_MS : 8000
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return input;
  }

  const content = data?.content;
  if (typeof content === 'string' && content.trim()) return sanitizeWhatsAppText(content);
  if (Array.isArray(content)) {
    const joined = content.map((b) => (typeof b === 'string' ? b : b?.text || '')).join('');
    if (joined.trim()) return sanitizeWhatsAppText(joined);
  }
  if (data?.choices?.[0]?.message?.content) return sanitizeWhatsAppText(data.choices[0].message.content);
  return input;
}

async function wahaSendText(chatId, text, sessionName, options = {}) {
  if (!WAHA_BASE_URL) {
    throw new Error('WAHA_BASE_URL no configurado');
  }

  const toChatId = normalizeChatIdForSend(chatId);
  if (!toChatId) {
    throw new Error('chatId inválido para enviar');
  }

  let finalText = text;
  if (options?.skipRewrite) {
    finalText = String(text || '');
  } else {
    try {
      finalText = await minimaxRewriteForWhatsApp(text);
    } catch (_) {
      finalText = text;
    }
  }

  const response = await fetchWithTimeout(
    endpointUrl(WAHA_SEND_ENDPOINT),
    {
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
    },
    Number.isFinite(WAHA_HTTP_TIMEOUT_MS) && WAHA_HTTP_TIMEOUT_MS > 0 ? WAHA_HTTP_TIMEOUT_MS : 7000
  );

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`WAHA sendText failed: ${response.status} ${details}`);
  }

  return response.json().catch(() => null);
}

async function wahaSendTextLogged({ threadId, chatId, text, sessionName, options }) {
  if (threadId) {
    await appendLegalMessage(threadId, 'assistant', text);
  }
  return wahaSendText(chatId, text, sessionName, options);
}

async function wahaSendSeen(chatId, sessionName) {
  if (!WAHA_BASE_URL) return null;
  const toChatId = normalizeChatIdForSend(chatId);
  if (!toChatId) return null;

  try {
    const response = await fetchWithTimeout(
      endpointUrl(WAHA_SEEN_ENDPOINT),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(WAHA_API_KEY ? { 'X-Api-Key': WAHA_API_KEY } : {})
        },
        body: JSON.stringify({
          session: sessionName || DEFAULT_WAHA_SESSION,
          chatId: toChatId
        })
      },
      Number.isFinite(WAHA_HTTP_TIMEOUT_MS) && WAHA_HTTP_TIMEOUT_MS > 0 ? WAHA_HTTP_TIMEOUT_MS : 7000
    );
    return response.ok ? response.json().catch(() => null) : null;
  } catch (_) {
    return null;
  }
}

async function wahaStartTyping(chatId, sessionName) {
  if (!WAHA_BASE_URL) return null;
  const toChatId = normalizeChatIdForSend(chatId);
  if (!toChatId) return null;

  try {
    const response = await fetchWithTimeout(
      endpointUrl(WAHA_START_TYPING_ENDPOINT),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(WAHA_API_KEY ? { 'X-Api-Key': WAHA_API_KEY } : {})
        },
        body: JSON.stringify({
          session: sessionName || DEFAULT_WAHA_SESSION,
          chatId: toChatId
        })
      },
      Number.isFinite(WAHA_HTTP_TIMEOUT_MS) && WAHA_HTTP_TIMEOUT_MS > 0 ? WAHA_HTTP_TIMEOUT_MS : 7000
    );
    return response.ok ? response.json().catch(() => null) : null;
  } catch (_) {
    return null;
  }
}

async function wahaStopTyping(chatId, sessionName) {
  if (!WAHA_BASE_URL) return null;
  const toChatId = normalizeChatIdForSend(chatId);
  if (!toChatId) return null;

  try {
    const response = await fetchWithTimeout(
      endpointUrl(WAHA_STOP_TYPING_ENDPOINT),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(WAHA_API_KEY ? { 'X-Api-Key': WAHA_API_KEY } : {})
        },
        body: JSON.stringify({
          session: sessionName || DEFAULT_WAHA_SESSION,
          chatId: toChatId
        })
      },
      Number.isFinite(WAHA_HTTP_TIMEOUT_MS) && WAHA_HTTP_TIMEOUT_MS > 0 ? WAHA_HTTP_TIMEOUT_MS : 7000
    );
    return response.ok ? response.json().catch(() => null) : null;
  } catch (_) {
    return null;
  }
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
    if (n >= 1 && n <= 6) return { intent: `menu_${n}`, confidence: 1 };
  }

  if (isLikelyDocumentAnalysisRequest(text)) {
    return { intent: 'analyze_document', confidence: 0.82 };
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
  if (hasListIntentVerb(t) && (t.includes('grupo') || t.includes('carpeta'))) {
    return { intent: 'list_groups', confidence: 0.78 };
  }
  if (hasListIntentVerb(t) && (t.includes('document') || t.includes('archivo') || t.includes('imagen'))) {
    return { intent: 'list_files', confidence: 0.75 };
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

  const response = await fetchWithTimeout(
    MINIMAX_ENDPOINT,
    {
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
    },
    Number.isFinite(WAHA_MINIMAX_TIMEOUT_MS) && WAHA_MINIMAX_TIMEOUT_MS > 0 ? WAHA_MINIMAX_TIMEOUT_MS : 8000
  );

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
    .replace(/[.,;:!?()]/g, ' ')
    .replace(/buscar( una)? ley(es)?/gi, ' ')
    .replace(/\b(necesito|quiero|deseo|me gustaria|me gustaría|saber|averiguar|consultar|ver)\b/gi, ' ')
    .replace(/\b(sobre|acerca de|respecto de)\b/gi, ' ')
    .replace(/\bley( numero| n°| nro| n)?\b/gi, 'ley ')
    .replace(/\s+/g, ' ')
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

function isQuestionLike(text) {
  const raw = String(text || '').trim();
  if (!raw) return false;
  if (raw.includes('?') || raw.includes('¿')) return true;
  const t = normalizeForIntent(raw);
  return (
    t.startsWith('que ') ||
    t.startsWith('qué ') ||
    t.startsWith('como ') ||
    t.startsWith('cómo ') ||
    t.startsWith('cuando ') ||
    t.startsWith('cuándo ') ||
    t.startsWith('donde ') ||
    t.startsWith('dónde ') ||
    t.startsWith('puedo ') ||
    t.startsWith('debo ') ||
    t.startsWith('necesito ') ||
    t.startsWith('me puedes ') ||
    t.startsWith('me podrias ') ||
    t.startsWith('me podrías ')
  );
}

function shouldTreatAsCase(text) {
  const t = normalizeForIntent(text);
  if (!t) return false;
  if (t.includes('mi caso') || t.includes('me paso') || t.includes('me pasó') || t.includes('me ocurrió') || t.includes('me ocurrio')) return true;
  if (t.includes('arrend') || t.includes('arriendo') || t.includes('arriend')) {
    return isQuestionLike(text) && !t.includes('buscar');
  }
  return isQuestionLike(text) && !isLikelyLawSearch(text);
}

function isLegalBranchReentryPhrase(text) {
  const t = normalizeForIntent(text);
  if (!t) return false;
  return (
    t === 'asesor legal' ||
    t === 'abogado' ||
    t === 'ayuda legal' ||
    t === 'legal' ||
    t === 'quiero asesoria legal' ||
    t === 'quiero asesoria legal' ||
    t === 'necesito asesoria legal' ||
    t === 'necesito asesoria legal'
  );
}

function isLikelyLegalTopic(text) {
  const t = normalizeForIntent(text);
  if (!t) return false;
  const keywords = [
    'arriendo',
    'arrend',
    'contrato',
    'clausula',
    'cláusula',
    'despido',
    'finiquito',
    'pension',
    'alimentos',
    'custodia',
    'demanda',
    'denuncia',
    'multa',
    'garantia',
    'garantía',
    'arrendatario',
    'arrendador',
    'vecino',
    'vecina',
    'ruido',
    'ruidos',
    'molesto',
    'molestos',
    'fiesta',
    'fiestas',
    'municipalidad',
    'ordenanza',
    'copropiedad',
    'carabineros',
    'ley',
    'articulo',
    'artículo',
    'codigo',
    'código',
    'decreto',
    'norma'
  ];
  return keywords.some((k) => t.includes(k));
}

function getGlobalState(ctx) {
  const base = ctx && typeof ctx === 'object' ? ctx : {};
  const global = base._global && typeof base._global === 'object' ? base._global : {};
  const history = Array.isArray(global.history) ? global.history : [];
  return { history };
}

function getPendingFollowup(ctx) {
  const pending = ctx && typeof ctx === 'object' ? ctx.pending_followup : null;
  return pending && typeof pending === 'object' ? pending : null;
}

function withPendingFollowup(ctx, pending) {
  const base = ctx && typeof ctx === 'object' ? { ...ctx } : {};
  if (pending && typeof pending === 'object' && Object.keys(pending).length) {
    base.pending_followup = pending;
  } else {
    delete base.pending_followup;
  }
  return base;
}

function isShortReplyForPending(text) {
  const raw = normalizeIncomingText(text);
  if (!raw) return false;
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length <= 5 && raw.length <= 48) return true;
  const t = normalizeForIntent(raw);
  return (
    t === 'si' ||
    t === 'sí' ||
    t === 'no' ||
    t === 'dale' ||
    t === 'ok' ||
    t === 'bueno' ||
    t === 'esa' ||
    t === 'esa opcion' ||
    t === 'esa opción' ||
    t === 'la primera' ||
    t === 'la segunda'
  );
}

function isLikelyFreshUserTurn(text) {
  const raw = normalizeIncomingText(text);
  if (!raw) return false;
  if (isQuestionLike(raw) || shouldTreatAsCase(raw) || isLikelyLawSearch(raw) || isLikelyLegalTopic(raw)) return true;
  const t = normalizeForIntent(raw);
  return raw.length >= 60 || t.includes('necesito ') || t.includes('quiero ') || t.includes('tengo un problema');
}

function buildOptionKeywords(baseKeywords, index) {
  const extras = [];
  if (index === 0) extras.push('1', 'uno', 'primera', 'la primera', 'opcion 1', 'opción 1');
  if (index === 1) extras.push('2', 'dos', 'segunda', 'la segunda', 'opcion 2', 'opción 2');
  if (index === 2) extras.push('3', 'tres', 'tercera', 'la tercera', 'opcion 3', 'opción 3');
  if (index === 3) extras.push('4', 'cuatro', 'cuarta', 'la cuarta', 'opcion 4', 'opción 4');
  return Array.from(new Set([...(Array.isArray(baseKeywords) ? baseKeywords : []), ...extras]));
}

function buildPendingFollowupFromAssistant({ userText, assistantText }) {
  const sourceUserText = normalizeIncomingText(userText);
  const reply = normalizeIncomingText(assistantText);
  const replyIntent = normalizeForIntent(reply);
  if (!sourceUserText || !reply || !replyIntent) return null;

  const offersLegalOrDraft =
    (replyIntent.includes('redactar una carta') || replyIntent.includes('redactar un mensaje')) &&
    (
      (replyIntent.includes('orient') && replyIntent.includes('legal')) ||
      replyIntent.includes('legalmente') ||
      replyIntent.includes('pasos legales')
    );

  if (offersLegalOrDraft) {
    return {
      type: 'choice',
      subtype: 'legal_or_draft',
      source_user_text: sourceUserText,
      source_assistant_text: reply,
      prompt: `¿Qué prefieres en este caso?\n\n1️⃣ 📝 Redactar un mensaje o carta\n2️⃣ ⚖️ Ver la orientación legal y los pasos a seguir`,
      options: [
        { id: 'draft_message', label: 'Redactar mensaje o carta', keywords: buildOptionKeywords(['carta', 'mensaje', 'redactar', 'redacta', 'formal', 'escrito'], 0) },
        { id: 'legal_guidance', label: 'Orientación legal', keywords: buildOptionKeywords(['legalmente', 'legal', 'pasos legales', 'orientacion', 'orientación', 'denunciar', 'via legal', 'vía legal'], 1) }
      ],
      created_at: new Date().toISOString()
    };
  }

  return null;
}

function isPendingFollowupExpired(pending) {
  const createdAt = pending?.created_at ? Date.parse(pending.created_at) : NaN;
  if (!Number.isFinite(createdAt)) return false;
  return Date.now() - createdAt > 1000 * 60 * 30;
}

function isSmallTypoMatch(input, keyword) {
  const a = normalizeForIntent(input).replace(/\s+/g, ' ').trim();
  const b = normalizeForIntent(keyword).replace(/\s+/g, ' ').trim();
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;

  const compactA = a.replace(/\s+/g, '');
  const compactB = b.replace(/\s+/g, '');
  if (!compactA || !compactB) return false;

  if (Math.abs(compactA.length - compactB.length) > 1) return false;
  if (compactA.length < 4 || compactB.length < 4) return false;

  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < compactA.length && j < compactB.length) {
    if (compactA[i] === compactB[j]) {
      i++;
      j++;
      continue;
    }
    edits++;
    if (edits > 1) return false;
    if (compactA.length > compactB.length) {
      i++;
    } else if (compactB.length > compactA.length) {
      j++;
    } else {
      i++;
      j++;
    }
  }
  if (i < compactA.length || j < compactB.length) edits++;
  return edits <= 1;
}

function resolvePendingFollowupByKeywords(pending, text) {
  const input = normalizeForIntent(text);
  if (!input) return null;
  const options = Array.isArray(pending?.options) ? pending.options : [];
  for (const option of options) {
    const keywords = Array.isArray(option?.keywords) ? option.keywords : [];
    if (keywords.some((keyword) => {
      const k = normalizeForIntent(keyword);
      return k && (input === k || input.includes(k) || isSmallTypoMatch(input, k));
    })) {
      return String(option.id || '').trim() || null;
    }
  }
  return null;
}

async function resolvePendingFollowupOption(pending, text) {
  const direct = resolvePendingFollowupByKeywords(pending, text);
  if (direct) return direct;
  if (!isShortReplyForPending(text)) return null;

  const options = Array.isArray(pending?.options) ? pending.options : [];
  if (!options.length) return null;

  const optionId = await routeStageWithAI({
    branch: 'pending_followup',
    stage: String(pending?.subtype || pending?.type || 'choice'),
    text,
    options
  });
  return optionId || null;
}

function buildPendingFollowupAction(pending, optionId) {
  const sourceUserText = normalizeIncomingText(pending?.source_user_text || '');
  if (!sourceUserText) return null;

  if (pending?.subtype === 'legal_or_draft') {
    if (optionId === 'legal_guidance') {
      return {
        route: 'legal_case',
        text: `${sourceUserText}\n\nEl usuario quiere orientación legal y pasos concretos sobre este caso.`
      };
    }
    if (optionId === 'draft_message') {
      return {
        route: 'casual',
        text: `Ayúdame a redactar un mensaje o carta breve, clara y firme para este caso: ${sourceUserText}`
      };
    }
  }

  if (pending?.subtype === 'upload_missing_document_for_analysis') {
    if (optionId === 'upload_now') {
      return {
        route: 'upload_for_analysis',
        text: sourceUserText,
        analysis_question: sourceUserText,
        save_target: pending?.save_target === 'group' ? 'group' : 'root',
        selected_group: pending?.selected_group || null
      };
    }
    if (optionId === 'later') {
      return {
        route: 'reply_text',
        text: `Perfecto 🙌 Cuando quieras, súbeme el documento y lo analizo al tiro.`
      };
    }
  }

  if (pending?.subtype === 'create_group_upload_and_analyze_document') {
    if (optionId === 'create_group_upload') {
      return {
        route: 'create_group_and_upload_for_analysis',
        text: sourceUserText,
        analysis_question: sourceUserText,
        group_name: String(pending?.group_name || '').trim() || null
      };
    }
    if (optionId === 'upload_root') {
      return {
        route: 'upload_for_analysis',
        text: sourceUserText,
        analysis_question: sourceUserText,
        save_target: 'root',
        selected_group: null
      };
    }
    if (optionId === 'later') {
      return {
        route: 'reply_text',
        text: `Dale 🙌 Cuando tengas el documento, me lo envías y lo analizo contigo.`
      };
    }
  }

  return null;
}

async function persistPendingFollowup(sessionId, ctx, pending) {
  const branchContext = withPendingFollowup(ctx, pending);
  return updateWspSession(sessionId, { branch_context: branchContext });
}

async function ensureUserGroupExists({ session, groupName }) {
  const cleanGroupName = String(groupName || '').trim();
  if (!session?.user_id || !cleanGroupName) return null;

  const { data: user } = await supabase.from('users').select('email').eq('id', session.user_id).single();
  const userEmail = user?.email;
  if (!userEmail) return null;

  const existingGroups = await listUserGroupsByEmail(userEmail);
  const existing = findGroupByName(existingGroups, cleanGroupName);
  if (existing) return existing;

  const rootFolderId = await resolveRootFolderIdForUser(userEmail, session.user_id, session.phone_number, { sessionId: session.id });
  if (!rootFolderId) return null;

  const folder = await createDriveFolder({ userId: session.user_id, parentFolderId: rootFolderId, name: cleanGroupName });
  const record = await upsertGrupoDriveRecord({
    ownerUserId: session.user_id,
    userEmail,
    folderId: folder.id,
    groupName: cleanGroupName,
    extension: 'brify'
  });
  await setWspSessionGlobal(session.id, {
    last_group_record_result: {
      ok: true,
      folder_id: folder.id,
      group_name: cleanGroupName,
      source: 'analysis_missing_group_auto_create',
      record_id: record?.id || null,
      ts: new Date().toISOString()
    }
  });

  return {
    id: record?.id || null,
    group_name: cleanGroupName,
    folder_id: folder.id,
    administrador: userEmail
  };
}

async function startUploadForAnalysis({ session, chatId, sessionName, question, saveTarget = 'root', selectedGroup = null }) {
  const branchContext = {
    stage: 'wait_file',
    saveTarget: saveTarget === 'group' && selectedGroup?.folder_id ? 'group' : 'root',
    ...(saveTarget === 'group' && selectedGroup?.folder_id ? { selectedGroup } : {}),
    after_upload_action: {
      type: 'analyze_document',
      question: normalizeIncomingText(question)
    }
  };
  const updated = await updateWspSession(session.id, {
    current_branch: 'subir_archivo',
    branch_context: branchContext
  });
  const groupName = String(selectedGroup?.group_name || '').trim();
  const message = groupName
    ? `Ahora sube tu documento por aquí 📎 Lo guardaré en "${groupName}" y apenas llegue lo analizo.`
    : `Ahora sube tu documento por aquí 📎 Apenas llegue lo analizo.`;
  await wahaSendText(chatId, message, sessionName, { skipRewrite: true });
  return updated;
}

async function tryResolvePendingFollowup({ session, chatId, text, sessionName, payload }) {
  const ctx = session?.branch_context || {};
  const pending = getPendingFollowup(ctx);
  if (!pending) return { handled: false, session };

  try {
    if (isPendingFollowupExpired(pending)) {
      const cleared = await updateWspSession(session.id, { branch_context: withPendingFollowup(ctx, null) });
      return { handled: false, session: cleared || session };
    }

    const userText = normalizeIncomingText(text);
    if (!userText) return { handled: false, session };

    const optionId = await resolvePendingFollowupOption(pending, userText);
    if (!optionId) {
      if (isLikelyFreshUserTurn(userText)) {
        const cleared = await updateWspSession(session.id, { branch_context: withPendingFollowup(ctx, null) });
        return { handled: false, session: cleared || session };
      }
      if (isShortReplyForPending(userText)) {
        await wahaSendText(chatId, pending.prompt || `¿Cuál opción prefieres?`, sessionName, { skipRewrite: true });
        return { handled: true, session };
      }
      const cleared = await updateWspSession(session.id, { branch_context: withPendingFollowup(ctx, null) });
      return { handled: false, session: cleared || session };
    }

    const action = buildPendingFollowupAction(pending, optionId);
    const cleanedCtx = withPendingFollowup(ctx, null);
    if (!action) {
      const cleared = await updateWspSession(session.id, { branch_context: cleanedCtx });
      return { handled: false, session: cleared || session };
    }

    if (action.route === 'legal_case') {
      const nextSession = await updateWspSession(session.id, {
        current_branch: 'asesor_legal',
        branch_context: { ...cleanedCtx, stage: 'choose_mode' }
      });
      await handleAsesorLegal({ session: nextSession, chatId, text: action.text, sessionName, payload });
      return { handled: true, session: nextSession };
    }

    if (action.route === 'casual') {
      const nextSession = await returnSessionToCasual(session.id, cleanedCtx);
      await handleCasualConversation({ session: nextSession, chatId, text: action.text, sessionName });
      return { handled: true, session: nextSession };
    }

    if (action.route === 'upload_for_analysis') {
      const nextSession = await returnSessionToCasual(session.id, cleanedCtx);
      await startUploadForAnalysis({
        session: nextSession || session,
        chatId,
        sessionName,
        question: action.analysis_question || action.text,
        saveTarget: action.save_target || 'root',
        selectedGroup: action.selected_group || null
      });
      return { handled: true, session: nextSession || session };
    }

    if (action.route === 'create_group_and_upload_for_analysis') {
      const baseSession = await returnSessionToCasual(session.id, cleanedCtx);
      const createdGroup = await ensureUserGroupExists({
        session: baseSession || session,
        groupName: action.group_name
      });
      if (!createdGroup?.folder_id) {
        await wahaSendText(
          chatId,
          `No pude dejar listo ese grupo ahora mismo 😕\n\nSi quieres, súbeme el documento igual y lo analizo desde la carpeta raíz.`,
          sessionName,
          { skipRewrite: true }
        );
        return { handled: true, session: baseSession || session };
      }
      await wahaSendText(chatId, `Perfecto 🙌 Dejé listo el grupo "${createdGroup.group_name}".`, sessionName, { skipRewrite: true });
      await startUploadForAnalysis({
        session: baseSession || session,
        chatId,
        sessionName,
        question: action.analysis_question || action.text,
        saveTarget: 'group',
        selectedGroup: createdGroup
      });
      return { handled: true, session: baseSession || session };
    }

    if (action.route === 'reply_text') {
      const nextSession = await returnSessionToCasual(session.id, cleanedCtx);
      await wahaSendText(chatId, action.text, sessionName, { skipRewrite: true });
      return { handled: true, session: nextSession || session };
    }

    const cleared = await updateWspSession(session.id, { branch_context: cleanedCtx });
    return { handled: false, session: cleared || session };
  } catch (error) {
    console.error('[WAHA webhook] tryResolvePendingFollowup error:', {
      sessionId: session?.id || null,
      pendingSubtype: pending?.subtype || pending?.type || null,
      message: error?.message || 'unknown'
    });

    if (pending?.subtype === 'create_group_upload_and_analyze_document') {
      try {
        const cleanedCtx = withPendingFollowup(ctx, null);
        const baseSession = await returnSessionToCasual(session.id, cleanedCtx);
        const createdGroup = await ensureUserGroupExists({
          session: baseSession || session,
          groupName: String(pending?.group_name || '').trim()
        });
        if (createdGroup?.folder_id) {
          await wahaSendText(chatId, `Perfecto 🙌 Dejé listo el grupo "${createdGroup.group_name}".`, sessionName, { skipRewrite: true });
          await startUploadForAnalysis({
            session: baseSession || session,
            chatId,
            sessionName,
            question: normalizeIncomingText(pending?.source_user_text || ''),
            saveTarget: 'group',
            selectedGroup: createdGroup
          });
          return { handled: true, session: baseSession || session };
        }
      } catch (fallbackError) {
        console.error('[WAHA webhook] pending create_group fallback error:', {
          sessionId: session?.id || null,
          groupName: pending?.group_name || null,
          message: fallbackError?.message || 'unknown'
        });
      }
      await wahaSendText(
        chatId,
        `Tuve un problema preparando ese grupo 😕\n\nSi quieres, súbeme el documento igual y lo reviso desde la carpeta raíz.`,
        sessionName,
        { skipRewrite: true }
      );
      return { handled: true, session };
    }

    await wahaSendText(
      chatId,
      `Tuve un problema continuando esa acción 😕\n\nSi quieres, dime nuevamente qué prefieres y seguimos desde ahí.`,
      sessionName,
      { skipRewrite: true }
    );
    return { handled: true, session };
  }
}

function isShortLegalPreferenceReply(text) {
  const t = normalizeForIntent(text);
  if (!t) return false;
  return (
    t === 'legalmente' ||
    t === 'legal' ||
    t === 'juridicamente' ||
    t === 'jurídicamente' ||
    t === 'por la via legal' ||
    t === 'por la vía legal' ||
    t === 'los pasos legales' ||
    t === 'pasos legales' ||
    t === 'ayudame con los pasos legales' ||
    t === 'ayúdame con los pasos legales' ||
    t === 'quiero los pasos legales' ||
    t === 'orientame legalmente' ||
    t === 'oriéntame legalmente'
  );
}

function lastGlobalTurnPair(history) {
  const items = Array.isArray(history) ? history.filter(Boolean).slice(-8) : [];
  for (let i = items.length - 1; i >= 1; i--) {
    const assistant = items[i];
    const user = items[i - 1];
    if (assistant?.role === 'assistant' && user?.role === 'user') {
      return { user, assistant };
    }
  }
  return { user: null, assistant: null };
}

function assistantOfferedLegalPath(text) {
  const t = normalizeForIntent(text);
  if (!t) return false;
  return (
    t.includes('orient') && t.includes('legal') ||
    t.includes('legalmente') ||
    t.includes('pasos legales') ||
    t.includes('que hacer legalmente') ||
    t.includes('qué hacer legalmente') ||
    t.includes('redactar una carta') ||
    t.includes('prefieres que te oriente')
  );
}

function buildLegalHandoffQuestion(history, currentText) {
  const reply = normalizeIncomingText(currentText);
  if (!isShortLegalPreferenceReply(reply)) return '';

  const { user, assistant } = lastGlobalTurnPair(history);
  const lastUserText = String(user?.content || '').trim();
  const lastAssistantText = String(assistant?.content || '').trim();
  if (!lastUserText || !lastAssistantText) return '';
  if (!assistantOfferedLegalPath(lastAssistantText)) return '';
  if (!shouldTreatAsCase(lastUserText) && !isLikelyLegalTopic(lastUserText)) return '';

  return `${lastUserText}\n\nEl usuario quiere orientación legal y pasos concretos sobre este caso.`;
}

function detectCommonLegalScenario(question) {
  const t = normalizeForIntent(question);
  if (!t) return null;

  const hasNeighborNoise =
    (t.includes('vecino') || t.includes('vecina')) &&
    (t.includes('ruido') || t.includes('ruidos') || t.includes('fiesta') || t.includes('fiestas') || t.includes('molesto') || t.includes('molestos'));
  if (hasNeighborNoise) return 'neighbor_noise';

  return null;
}

function buildCommonLegalScenarioFallback(question) {
  const scenario = detectCommonLegalScenario(question);
  if (scenario === 'neighbor_noise') {
    return `Por lo que describes, esto sí puede abordarse por la vía legal como un problema de ruidos molestos y convivencia vecinal.\n\nLo más útil en estos casos suele ser:\n1. Reunir respaldo básico: fechas, horarios, audios, videos o testigos si los tienes.\n2. Revisar si tu comuna tiene ordenanza sobre ruidos molestos, porque muchas municipalidades regulan horarios y sanciones.\n3. Si vives en condominio o edificio, revisar también el reglamento de copropiedad y dejar constancia con administración o comité.\n4. Si el ruido ocurre de noche o en forma reiterada, puedes denunciar para que fiscalicen o dejen constancia según corresponda.\n\nSi quieres, te ayudo en dos caminos: te digo los pasos formales para denunciar o te ayudo a redactar un mensaje/carta para tu vecino.`;
  }

  return '';
}

async function appendGlobalHistory(sessionId, currentCtx, role, content) {
  const { history } = getGlobalState(currentCtx);
  const trimmed = String(content || '').trim();
  if (!trimmed) return null;
  const next = [...history.slice(-(Number.isFinite(WAHA_CASUAL_MAX_TURNS) ? WAHA_CASUAL_MAX_TURNS : 12) * 2 + 1), { role, content: trimmed, ts: new Date().toISOString() }];
  try {
    return await updateWspSession(sessionId, { branch_context: { ...(currentCtx || {}), _global: { history: next } } });
  } catch (_) {
    return null;
  }
}

function formatGlobalHistoryForModel(history, maxItems = 10, maxChars = 1800) {
  const items = Array.isArray(history) ? history.slice(-maxItems) : [];
  const lines = items.map((m) => {
    const r = m?.role === 'assistant' ? 'Brify' : 'Usuario';
    const c = String(m?.content || '').replace(/\s+/g, ' ').trim();
    return `${r}: ${c}`;
  });
  const joined = lines.join('\n');
  if (joined.length <= maxChars) return joined;
  return joined.slice(-maxChars);
}

async function minimaxCasualReply({ history, userMessage }) {
  if (!MINIMAX_API_KEY) return '';
  const system = `Eres Brify en WhatsApp. Responde en español chileno neutral (sin voseo), humano, cercano y útil.
Objetivo: conversar de forma natural y detectar cuándo hay que activar una capacidad de Brify.
Reglas:
- Si el usuario hace una pregunta general o conversa de cualquier tema, respóndela con normalidad. No digas que solo ayudas con grupos, archivos o temas legales.
- Si el usuario solo saluda o conversa, responde amable y sigue la conversación.
- Si detectas una intención de Brify pero falta un dato para ejecutar, pide solo la mínima aclaración necesaria.
- Si la intención ya está clara, responde de forma breve y alineada con esa intención, sin obligar al usuario a usar menús ni números.
- No uses Markdown (sin asteriscos, sin guiones como viñetas, sin líneas separadoras). Si haces lista, usa emojis.
- No inventes datos.`;

  try {
    const response = await fetchWithTimeout(
      MINIMAX_ENDPOINT,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${MINIMAX_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: MINIMAX_MODEL,
          system,
          temperature: 0.6,
          max_tokens: 450,
          messages: [
            {
              role: 'user',
              content: `Historial reciente:\n${history || '(sin historial)'}\n\nMensaje actual:\n${String(userMessage || '').trim()}\n\nResponde:`
            }
          ]
        })
      },
      Number.isFinite(WAHA_MINIMAX_TIMEOUT_MS) && WAHA_MINIMAX_TIMEOUT_MS > 0 ? WAHA_MINIMAX_TIMEOUT_MS : 8000
    );

    if (!response.ok) return '';
    const data = await response.json().catch(() => ({}));
    let raw = data?.content;
    if (Array.isArray(raw)) raw = raw.map((b) => (typeof b === 'string' ? b : b?.text || '')).join('');
    if (typeof raw !== 'string') raw = data?.choices?.[0]?.message?.content;
    return typeof raw === 'string' ? sanitizeWhatsAppText(raw) : '';
  } catch (_) {
    return '';
  }
}

async function openaiCasualReply({ history, userMessage }) {
  if (!OPENAI_API_KEY) return '';
  const system = `Eres Brify en WhatsApp. Responde en español chileno neutral, humano, cercano y útil.
Objetivo: conversar de forma natural y detectar cuándo hay que activar una capacidad de Brify.
Reglas:
- Si el usuario hace una pregunta general o conversa de cualquier tema, respóndela con normalidad. No digas que solo ayudas con grupos, archivos o temas legales.
- Si el usuario solo saluda o conversa, responde amable y sigue la conversación.
- Si detectas una intención de Brify pero falta un dato para ejecutar, pide solo la mínima aclaración necesaria.
- Si la intención ya está clara, responde de forma breve y alineada con esa intención, sin obligar al usuario a usar menús ni números.
- No uses Markdown (sin asteriscos, sin guiones como viñetas, sin líneas separadoras). Si haces lista, usa emojis.
- No inventes datos.`;

  try {
    const response = await fetchWithTimeout(
      `${String(OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '')}/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: OPENAI_CHAT_MODEL,
          temperature: 0.6,
          max_tokens: 450,
          messages: [
            { role: 'system', content: system },
            {
              role: 'user',
              content: `Historial reciente:\n${history || '(sin historial)'}\n\nMensaje actual:\n${String(userMessage || '').trim()}\n\nResponde:`
            }
          ]
        })
      },
      Number.isFinite(WAHA_MINIMAX_TIMEOUT_MS) && WAHA_MINIMAX_TIMEOUT_MS > 0 ? WAHA_MINIMAX_TIMEOUT_MS : 8000
    );

    if (!response.ok) return '';
    const data = await response.json().catch(() => ({}));
    const raw = data?.choices?.[0]?.message?.content;
    return typeof raw === 'string' ? sanitizeWhatsAppText(raw) : '';
  } catch (_) {
    return '';
  }
}

function isWhoAreYouQuestion(text) {
  const t = normalizeForIntent(text);
  if (!t) return false;
  return (
    t.includes('quien eres') ||
    t.includes('quién eres') ||
    t.includes('quien es brify') ||
    t.includes('quién es brify') ||
    t.includes('que eres') ||
    t.includes('qué eres') ||
    t.includes('eres una ia') ||
    t.includes('eres un bot') ||
    t.includes('que hace brify') ||
    t.includes('qué hace brify') ||
    t.includes('para que sirves') ||
    t.includes('para qué sirves')
  );
}

function buildWhoAreYouReply() {
  return `Soy Brify, tu asistente. Estoy para ayudarte a resolver dudas y gestionar tus archivos de forma simple 🙌

Puedo ayudarte con cosas como:
📁 Crear grupos
🤝 Compartir grupos
📋 Listar archivos y grupos
📤 Subir documentos e imágenes
⚖️ Acompañarte con Asesoría Legal

Si quieres, dime directamente qué necesitas y lo hacemos.`;
}

async function handleCasualConversation({ session, chatId, text, sessionName }) {
  const ctx = session.branch_context || {};
  const userText = normalizeIncomingText(text);

  let freshCtx = ctx;
  try {
    const updatedAfterUser = await appendGlobalHistory(session.id, ctx, 'user', userText);
    freshCtx = updatedAfterUser?.branch_context || ctx;
  } catch (_) {
    freshCtx = ctx;
  }

  const { history } = getGlobalState(freshCtx);
  const historyText = formatGlobalHistoryForModel(history, 10, 1800);

  let answer = '';
  if (isWhoAreYouQuestion(userText)) {
    answer = buildWhoAreYouReply();
  }

  if (WAHA_MINIMAX_ENABLED && MINIMAX_API_KEY) {
    try {
      if (!answer) answer = await minimaxCasualReply({ history: historyText, userMessage: userText });
    } catch (_) {
      answer = '';
    }
  }

  if (!answer && OPENAI_API_KEY) {
    try {
      answer = await openaiCasualReply({ history: historyText, userMessage: userText });
    } catch (_) {
      answer = '';
    }
  }

  if (!answer) {
    if (!WAHA_MINIMAX_ENABLED && !OPENAI_API_KEY && !MINIMAX_API_KEY) {
      answer = `Te leo 🙌\n\nAhora mismo no tengo el chat inteligente habilitado, pero igual puedo ayudarte con acciones.\n\nDime qué necesitas hacer:\n📤 Subir archivos\n📋 Listar archivos\n📁 Crear grupos\n🤝 Compartir grupos\n\nSi quieres reiniciar, escribe "menú".`;
    } else {
      answer = `Tuve un problema respondiendo 😕\n\nPrueba de nuevo en unos segundos.\n\nSi quieres hacer una acción, dime algo como:\n📁 "crear grupo Marketing"\n🤝 "compartir grupo Ventas con correo@empresa.com"\n📤 "subir archivo"\n📋 "listar archivos"\n\nO escribe "menú".`;
    }
  } else {
    answer = sanitizeWhatsAppText(answer);
  }

  const pendingFollowup = buildPendingFollowupFromAssistant({ userText, assistantText: answer });

  let updatedAfterAssistant = null;
  try {
    updatedAfterAssistant = await appendGlobalHistory(session.id, freshCtx, 'assistant', answer);
  } catch (_) {
    updatedAfterAssistant = null;
  }

  try {
    await wahaSendText(chatId, answer, sessionName, { skipRewrite: true });
  } catch (_) {}

  const latestSession = updatedAfterAssistant || session;
  const latestCtx = latestSession?.branch_context || freshCtx;
  try {
    const nextSession = await persistPendingFollowup(session.id, latestCtx, pendingFollowup);
    return nextSession || latestSession;
  } catch (_) {
    return latestSession;
  }
}

async function getActiveLegalThread(sessionId) {
  try {
    const { data, error } = await supabase
      .from('wsp_legal_threads')
      .select('*')
      .eq('session_id', sessionId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return data || null;
  } catch (_) {
    return null;
  }
}

async function getLatestLegalThread(sessionId) {
  try {
    const { data, error } = await supabase
      .from('wsp_legal_threads')
      .select('*')
      .eq('session_id', sessionId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return data || null;
  } catch (_) {
    return null;
  }
}

async function createLegalThread({ sessionId, userId, threadType }) {
  try {
    const { data, error } = await supabase
      .from('wsp_legal_threads')
      .insert({
        id: crypto.randomUUID(),
        session_id: sessionId,
        user_id: userId,
        thread_type: threadType,
        messages: [],
        laws_referenced: [],
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('*')
      .single();
    if (error) return null;
    return data || null;
  } catch (_) {
    return null;
  }
}

async function appendLegalMessage(threadId, role, content) {
  try {
    const { data: thread, error } = await supabase.from('wsp_legal_threads').select('messages').eq('id', threadId).single();
    if (error) return null;
    const prev = Array.isArray(thread?.messages) ? thread.messages : [];
    const next = [
      ...prev.slice(-30),
      { role, content: String(content || ''), ts: new Date().toISOString() }
    ];
    const { error: updateError } = await supabase
      .from('wsp_legal_threads')
      .update({ messages: next, updated_at: new Date().toISOString() })
      .eq('id', threadId);
    if (updateError) return null;
    return next;
  } catch (_) {
    return null;
  }
}

async function setLegalThreadType(threadId, threadType) {
  try {
    await supabase.from('wsp_legal_threads').update({ thread_type: threadType, updated_at: new Date().toISOString() }).eq('id', threadId);
  } catch (_) {}
}

async function setLegalThreadActive(threadId, isActive) {
  try {
    await supabase
      .from('wsp_legal_threads')
      .update({ is_active: Boolean(isActive), updated_at: new Date().toISOString() })
      .eq('id', threadId);
  } catch (_) {}
}

async function getLegalThreadHistory(threadId, maxItems = 10, maxChars = 2500) {
  try {
    const { data, error } = await supabase.from('wsp_legal_threads').select('messages').eq('id', threadId).single();
    if (error) return '';
    const messages = Array.isArray(data?.messages) ? data.messages : [];
    const last = messages.slice(-maxItems);
    const lines = last.map((m) => {
      const role = m?.role === 'assistant' ? 'Brify' : 'Usuario';
      const content = String(m?.content || '').replace(/\s+/g, ' ').trim();
      return `${role}: ${content}`;
    });
    const joined = lines.join('\n');
    if (joined.length <= maxChars) return joined;
    return joined.slice(-maxChars);
  } catch (_) {
    return '';
  }
}

async function appendLegalThreadReferences(threadId, { laws = [], documents = [] } = {}) {
  if (!threadId) return null;
  try {
    const { data: thread, error } = await supabase
      .from('wsp_legal_threads')
      .select('laws_referenced, documents_referenced')
      .eq('id', threadId)
      .single();
    if (error) return null;

    const currentLaws = Array.isArray(thread?.laws_referenced) ? thread.laws_referenced : [];
    const currentDocs = Array.isArray(thread?.documents_referenced) ? thread.documents_referenced : [];

    const nextLaws = Array.from(
      new Map(
        [...currentLaws, ...(Array.isArray(laws) ? laws : [])]
          .filter((item) => item && (item.number || item.title))
          .map((item) => [`${item.number || ''}|${item.title || ''}`, item])
      ).values()
    ).slice(-20);

    const nextDocs = Array.from(
      new Map(
        [...currentDocs, ...(Array.isArray(documents) ? documents : [])]
          .filter((item) => item && (item.file_id || item.name))
          .map((item) => [`${item.file_id || ''}|${item.name || ''}`, item])
      ).values()
    ).slice(-20);

    await supabase
      .from('wsp_legal_threads')
      .update({
        laws_referenced: nextLaws,
        documents_referenced: nextDocs,
        updated_at: new Date().toISOString()
      })
      .eq('id', threadId);
    return { laws: nextLaws, documents: nextDocs };
  } catch (_) {
    return null;
  }
}

function splitLongWhatsAppResponse(text, maxChars = 1400) {
  const input = String(text || '').trim();
  if (!input) return [];
  if (input.length <= maxChars) return [input];

  const parts = [];
  let remaining = input;
  while (remaining.length > maxChars) {
    let cut = remaining.lastIndexOf('\n', maxChars);
    if (cut < Math.floor(maxChars * 0.45)) cut = remaining.lastIndexOf('. ', maxChars);
    if (cut < Math.floor(maxChars * 0.45)) cut = remaining.lastIndexOf('! ', maxChars);
    if (cut < Math.floor(maxChars * 0.45)) cut = remaining.lastIndexOf('? ', maxChars);
    if (cut < Math.floor(maxChars * 0.45)) cut = remaining.lastIndexOf(' ', maxChars);
    if (cut < 1) cut = maxChars;
    const chunk = remaining.slice(0, cut).trim();
    if (chunk) parts.push(chunk);
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) parts.push(remaining);

  return parts.map((part, index) => {
    if (index === 0) return part;
    return `Continuo con el análisis 👇\n\n${part}`;
  });
}

async function wahaSendLongTextLogged({ threadId, chatId, text, sessionName, options }) {
  const chunks = splitLongWhatsAppResponse(text, 1400);
  for (const chunk of chunks) {
    await wahaSendTextLogged({ threadId, chatId, text: chunk, sessionName, options });
  }
}

async function wahaSendLongText({ chatId, text, sessionName, options }) {
  const chunks = splitLongWhatsAppResponse(text, 1400);
  for (const chunk of chunks) {
    await wahaSendText(chatId, chunk, sessionName, options);
  }
}

function normalizeLawNumber(value) {
  return String(value || '').replace(/[^\d]/g, '');
}

function expandLawQuery(query) {
  const t = normalizeForIntent(query);
  if (!t) return query;
  const expansions = [];
  if (t.includes('arriendo') || t.includes('arriendos')) {
    expansions.push('arrendamiento', 'arrendatario', 'arrendador', 'contrato', 'renta', 'garantia', 'canon');
  }
  if (t.includes('finiquito')) {
    expansions.push('codigo del trabajo', 'termino de contrato', 'indemnizacion', 'despido');
  }
  if (t.includes('divorcio')) {
    expansions.push('matrimonio', 'alimentos', 'cuidado personal', 'relacion directa y regular');
  }
  if (t.includes('ruido') || t.includes('ruidos') || t.includes('fiesta') || t.includes('fiestas') || t.includes('vecino') || t.includes('vecina')) {
    expansions.push('ruidos molestos', 'ordenanza municipal', 'municipalidad', 'convivencia vecinal', 'copropiedad', 'carabineros');
  }
  if (!expansions.length) return query;
  const merged = `${query} ${expansions.join(' ')}`.trim();
  return merged.length > 240 ? query : merged;
}

async function searchLawsRpc(query, limit = 5) {
  if (!SUPABASE_LAWS_URL || !SUPABASE_LAWS_ANON_KEY) return [];
  const q = expandLawQuery(String(query || '').trim());
  if (!q) return [];

  let response = null;
  try {
    response = await fetchWithTimeout(
      `${SUPABASE_LAWS_URL.replace(/\/$/, '')}/rest/v1/rpc/buscar_leyes`,
      {
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
      },
      Number.isFinite(WAHA_HTTP_TIMEOUT_MS) && WAHA_HTTP_TIMEOUT_MS > 0 ? WAHA_HTTP_TIMEOUT_MS : 7000
    );
  } catch (_) {
    response = null;
  }

  if (!response?.ok) return [];
  const data = await response.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}

async function searchCodigosRpc(query, limit = 4) {
  if (!SUPABASE_LAWS_URL || !SUPABASE_LAWS_ANON_KEY) return [];
  const q = expandLawQuery(String(query || '').trim());
  if (!q) return [];

  let response = null;
  try {
    response = await fetchWithTimeout(
      `${SUPABASE_LAWS_URL.replace(/\/$/, '')}/rest/v1/rpc/buscar_codigos`,
      {
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
      },
      Number.isFinite(WAHA_HTTP_TIMEOUT_MS) && WAHA_HTTP_TIMEOUT_MS > 0 ? WAHA_HTTP_TIMEOUT_MS : 7000
    );
  } catch (_) {
    response = null;
  }

  if (!response?.ok) return [];
  const data = await response.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}

async function searchCodigosVectorRpc(query, limit = 4, minSimilarity = 0.7) {
  if (!SUPABASE_LAWS_URL || !SUPABASE_LAWS_ANON_KEY) return [];
  const q = expandLawQuery(String(query || '').trim());
  if (!q) return [];

  const runSearch = async (embedding) => {
    if (!Array.isArray(embedding) || !embedding.length) return [];
    let response = null;
    try {
      response = await fetchWithTimeout(
        `${SUPABASE_LAWS_URL.replace(/\/$/, '')}/rest/v1/rpc/match_codigos`,
        {
          method: 'POST',
          headers: {
            apikey: SUPABASE_LAWS_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_LAWS_ANON_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query_embedding: serializeVectorForDb(embedding),
            match_count: limit,
            min_similarity: minSimilarity
          })
        },
        Number.isFinite(WAHA_HTTP_TIMEOUT_MS) && WAHA_HTTP_TIMEOUT_MS > 0 ? WAHA_HTTP_TIMEOUT_MS : 7000
      );
    } catch (_) {
      response = null;
    }

    if (!response?.ok) return [];
    const data = await response.json().catch(() => []);
    return Array.isArray(data) ? data : [];
  };

  let embeddingsResult = null;
  try {
    embeddingsResult = await buildEmbeddingsWithFallback([q], 'RETRIEVAL_QUERY');
  } catch (_) {
    embeddingsResult = null;
  }

  const primaryEmbedding = Array.isArray(embeddingsResult?.embeddings) ? embeddingsResult.embeddings[0] : null;
  const primaryResults = await runSearch(primaryEmbedding);
  if (primaryResults.length) return primaryResults;

  if (embeddingsResult?.provider === 'openai') {
    const deterministicResults = await runSearch(generateDeterministicEmbedding(q));
    if (deterministicResults.length) return deterministicResults;
  }

  return [];
}

function buildLawSnippet(law, query) {
  const content = String(getLawContent(law) || '').replace(/\s+/g, ' ').trim();
  if (!content) return '';

  const q = normalizeForIntent(query);
  const tokens = q
    .split(/\s+/)
    .filter((t) => t.length >= 4)
    .slice(0, 8);

  if (!tokens.length) return content.slice(0, 260) + (content.length > 260 ? '…' : '');

  const lower = normalizeForIntent(content);
  let bestIdx = -1;
  let bestToken = '';
  for (const token of tokens) {
    const idx = lower.indexOf(token);
    if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) {
      bestIdx = idx;
      bestToken = token;
    }
  }

  if (bestIdx === -1) return content.slice(0, 260) + (content.length > 260 ? '…' : '');

  const start = Math.max(0, bestIdx - 140);
  const end = Math.min(lower.length, bestIdx + bestToken.length + 160);
  const snippet = content.slice(start, end).trim();
  const prefix = start > 0 ? '…' : '';
  const suffix = end < content.length ? '…' : '';
  return `${prefix}${snippet}${suffix}`;
}

function suggestLawRefinement(query) {
  const t = normalizeForIntent(query);
  if (!t) return '';
  if (t.includes('arriendo') || t.includes('arriendos')) {
    return `\n\nSi no era eso, prueba con: "arrendamiento", "contrato de arriendo", "arrendatario".`;
  }
  return '';
}

function formatLawResults(results, query) {
  if (!results?.length) {
    return 'No encontré resultados 😕\n\nDime otro término, o el número de ley (por ejemplo: "Ley 19.628").';
  }

  if (results.length <= 2) {
    const blocks = results.map((law, idx) => {
      const titulo = getLawTitle(law);
      const numero = getLawNumber(law);
      const numText = numero ? ` (Ley ${numero})` : '';
      const snippet = buildLawSnippet(law, query);
      return `${idx + 1}️⃣ 📜 ${titulo}${numText}\n🧾 ${snippet || 'Extracto no disponible'}`;
    });
    const header = results.length === 1 ? `Esto es lo más cercano que encontré 👇` : `Encontré esto 👇`;
    return `${header}\n\n${blocks.join('\n\n')}\n\n¿Te muestro el detalle de alguna? Puedes decir "la 1", "la 2" o mencionar una palabra del título.${suggestLawRefinement(query)}`;
  }

  const lines = results.slice(0, 7).map((law, idx) => {
    const titulo = getLawTitle(law);
    const numero = getLawNumber(law);
    const numText = numero ? ` — Ley ${numero}` : '';
    return `${idx + 1}️⃣ 📜 ${titulo}${numText}`;
  });

  return `Mira lo que encontré 👇\n\n${lines.join('\n')}\n\nDime el número o una palabra del título para abrir una.`;
}

function formatLawDetail(law) {
  const titulo = getLawTitle(law);
  const numero = getLawNumber(law);
  const url = getLawUrl(law);
  const contenido = getLawContent(law);
  const snippet = contenido ? contenido.slice(0, 900) + (contenido.length > 900 ? '…' : '') : 'Contenido no disponible';
  return `📜 ${titulo}\n${numero ? `Ley ${numero}\n` : ''}${url ? `Fuente: ${url}\n` : ''}\n${snippet}\n\n¿Quieres buscar otra ley o ver otro resultado?`;
}

function pickLawFromResults(results, input) {
  if (!Array.isArray(results) || !results.length) return null;
  const raw = String(input || '').trim();
  const t = normalizeForIntent(raw);
  if (!t) return null;

  const ordinalMap = new Map([
    ['primera', 1],
    ['primero', 1],
    ['segunda', 2],
    ['segundo', 2],
    ['tercera', 3],
    ['tercero', 3]
  ]);
  for (const [k, v] of ordinalMap.entries()) {
    if (t.includes(k) && v <= results.length) return { law: results[v - 1], index: v - 1 };
  }

  const selection = parseNumberSelection(raw);
  if (selection && selection >= 1 && selection <= results.length) {
    return { law: results[selection - 1], index: selection - 1 };
  }

  const digits = normalizeLawNumber(raw);
  if (digits && t.includes('ley')) {
    const idx = results.findIndex((r) => normalizeLawNumber(getLawNumber(r)) === digits);
    if (idx !== -1) return { law: results[idx], index: idx };
  }

  const tokens = t
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !['para', 'como', 'esta', 'esto', 'sobre', 'leyes', 'ley'].includes(w))
    .slice(0, 8);
  if (!tokens.length) return null;

  let best = { idx: -1, score: 0 };
  results.forEach((law, idx) => {
    const title = normalizeForIntent(getLawTitle(law));
    let score = 0;
    for (const tok of tokens) {
      if (title.includes(tok)) score += 1;
    }
    if (score > best.score) best = { idx, score };
  });

  if (best.idx !== -1 && best.score > 0) return { law: results[best.idx], index: best.idx };
  return null;
}

function extractLawNumbersFromText(text) {
  const raw = String(text || '');
  if (!raw.trim()) return [];
  const matches = Array.from(raw.matchAll(/\bley\s*([0-9]{2,6}(?:\.[0-9]{1,3})?)\b/gi));
  return Array.from(
    new Set(
      matches
        .map((m) => normalizeLawNumber(m?.[1]))
        .filter(Boolean)
    )
  );
}

function dedupeLaws(laws) {
  return Array.from(
    new Map(
      (Array.isArray(laws) ? laws : [])
        .filter(Boolean)
        .map((law) => {
          const key = `${normalizeLawNumber(getLawNumber(law))}|${normalizeForIntent(getLawTitle(law))}`;
          return [key, law];
        })
    ).values()
  );
}

function buildLegalLawContext(laws, question) {
  return (Array.isArray(laws) ? laws : [])
    .slice(0, 4)
    .map((law, idx) => {
      const titulo = getLawTitle(law);
      const numero = getLawNumber(law) || 'No disponible';
      const url = getLawUrl(law);
      const snippet = buildLawSnippet(law, question || titulo) || String(getLawContent(law) || '').slice(0, 700);
      return `Ley ${idx + 1}\nTítulo: ${titulo}\nNúmero: ${numero}\n${url ? `Fuente: ${url}\n` : ''}Fragmento:\n${snippet || 'Sin extracto disponible'}`;
    })
    .join('\n\n');
}

function getCodigoTitle(item) {
  return item?.titulo || item?.title || 'Material jurídico';
}

function getCodigoContent(item) {
  return item?.contenido || item?.content || '';
}

function buildCodigoSnippet(item, query) {
  const content = String(getCodigoContent(item) || '').replace(/\s+/g, ' ').trim();
  if (!content) return '';
  return extractRelevantDocExcerpt(content, query, 700) || content.slice(0, 700);
}

function buildLegalCodigosContext(codigos, question) {
  return (Array.isArray(codigos) ? codigos : [])
    .slice(0, 3)
    .map((item, idx) => {
      const title = getCodigoTitle(item);
      const filePath = item?.file_path || null;
      const snippet = buildCodigoSnippet(item, question);
      return `Material complementario ${idx + 1}\nTítulo: ${title}\n${filePath ? `Referencia: ${filePath}\n` : ''}Extracto:\n${snippet || 'Sin extracto disponible'}`;
    })
    .join('\n\n');
}

function summarizeCodigoRefs(codigos) {
  return Array.from(
    new Map(
      (Array.isArray(codigos) ? codigos : [])
        .filter((item) => item?.titulo)
        .map((item) => [
          `${normalizeForIntent(item.titulo)}|${item.file_path || ''}`,
          { title: item.titulo, file_path: item.file_path || null }
        ])
    ).values()
  ).slice(0, 6);
}

function mergeCodigoSearchResults(textResults, vectorResults, limit = 4) {
  const merged = new Map();

  const upsert = (item, source) => {
    if (!item || (!item.titulo && !item.contenido && !item.id)) return;
    const key = item?.id
      ? String(item.id)
      : `${normalizeForIntent(item.titulo || item.title || '')}|${item.file_path || ''}`;
    const current = merged.get(key) || {
      id: item?.id || null,
      titulo: item?.titulo || item?.title || null,
      contenido: item?.contenido || item?.content || '',
      file_path: item?.file_path || null,
      created_at: item?.created_at || null,
      textScore: 0,
      vectorScore: 0,
      matchedBy: new Set()
    };

    current.id = current.id || item?.id || null;
    current.titulo = current.titulo || item?.titulo || item?.title || null;
    current.contenido = current.contenido || item?.contenido || item?.content || '';
    current.file_path = current.file_path || item?.file_path || null;
    current.created_at = current.created_at || item?.created_at || null;

    const numericScore = Number(item?.similarity ?? item?.relevancia ?? 0);
    if (source === 'vector') current.vectorScore = Math.max(current.vectorScore, numericScore);
    if (source === 'text') current.textScore = Math.max(current.textScore, numericScore);
    current.matchedBy.add(source);
    merged.set(key, current);
  };

  (Array.isArray(vectorResults) ? vectorResults : []).forEach((item) => upsert(item, 'vector'));
  (Array.isArray(textResults) ? textResults : []).forEach((item) => upsert(item, 'text'));

  return Array.from(merged.values())
    .map((item) => ({
      ...item,
      hybrid_score: item.vectorScore + item.textScore + (item.matchedBy.size > 1 ? 0.15 : 0)
    }))
    .sort((a, b) =>
      (b.hybrid_score - a.hybrid_score) ||
      (b.vectorScore - a.vectorScore) ||
      (b.textScore - a.textScore) ||
      String(b.created_at || '').localeCompare(String(a.created_at || ''))
    )
    .slice(0, limit)
    .map(({ textScore, vectorScore, matchedBy, hybrid_score, ...item }) => item);
}

function buildLegalDocumentContext(documents, question) {
  return (Array.isArray(documents) ? documents : [])
    .slice(0, 3)
    .map((doc, idx) => {
      const excerpt = extractRelevantDocExcerpt(doc.content, question, 1200);
      const folderName = doc?.metadata?.nombre_carpeta_actual || doc?.metadata?.folder_name || doc?.folder_name || null;
      return `Documento ${idx + 1}\nNombre: ${doc.name}\n${folderName ? `Carpeta: ${folderName}\n` : ''}Contenido relevante:\n${excerpt || '(sin texto útil)'}`;
    })
    .join('\n\n');
}

async function searchLawsForLegalQuestion({ question, documents = [], limit = 5 }) {
  const directLawNumbers = extractLawNumbersFromText(question);
  let results = [];

  for (const lawNumber of directLawNumbers) {
    const exactMatches = await searchLawsRpc(`Ley ${lawNumber}`, Math.max(limit, 5));
    results.push(
      ...exactMatches.filter((law) => normalizeLawNumber(getLawNumber(law)) === lawNumber)
    );
  }

  if (results.length < limit) {
    const docHints = (Array.isArray(documents) ? documents : [])
      .slice(0, 2)
      .map((doc) => extractRelevantDocExcerpt(doc.content, question, 360))
      .filter(Boolean)
      .join('\n');
    const searchQuery = [question, docHints].filter(Boolean).join('\n');
    const contextual = await searchLawsRpc(searchQuery, limit);
    results.push(...contextual);
  }

  return dedupeLaws(results).slice(0, limit);
}

async function searchCodigosForLegalQuestion({ question, documents = [], limit = 4 }) {
  const docHints = (Array.isArray(documents) ? documents : [])
    .slice(0, 2)
    .map((doc) => extractRelevantDocExcerpt(doc.content, question, 280))
    .filter(Boolean)
    .join('\n');

  const searchQuery = [question, docHints].filter(Boolean).join('\n');
  const effectiveLimit = Math.max(limit, 4);
  const [vectorResults, textResults] = await Promise.all([
    searchCodigosVectorRpc(searchQuery, effectiveLimit, 0.68),
    searchCodigosRpc(searchQuery, effectiveLimit)
  ]);
  return mergeCodigoSearchResults(textResults, vectorResults, limit);
}

function summarizeLawRefsForThread(laws) {
  return (Array.isArray(laws) ? laws : []).slice(0, 8).map((law) => ({
    title: getLawTitle(law),
    number: getLawNumber(law),
    url: getLawUrl(law)
  }));
}

function summarizeDocumentRefsForThread(documents) {
  return Array.from(
    new Map(
      (Array.isArray(documents) ? documents : [])
        .filter((doc) => doc?.name || doc?.fileId || doc?.file_id)
        .map((doc) => {
          const fileId = doc?.fileId || doc?.file_id || null;
          const name = doc?.name || null;
          const key = `${fileId || ''}|${normalizeForIntent(name || '')}`;
          return [
            key,
            {
              name,
              file_id: fileId,
              url: driveOpenLink(fileId)
            }
          ];
        })
    ).values()
  ).slice(0, 8);
}

async function getLegalThreadReferencedDocuments(threadId, userId) {
  if (!threadId || !userId) return [];
  try {
    const { data: thread, error } = await supabase
      .from('wsp_legal_threads')
      .select('documents_referenced')
      .eq('id', threadId)
      .single();
    if (error) return [];
    const docs = Array.isArray(thread?.documents_referenced) ? thread.documents_referenced : [];
    const ids = docs.map((doc) => doc?.file_id).filter(Boolean);
    if (!ids.length) return [];
    return await loadUserDocsByFileIds({ userId, fileIds: ids });
  } catch (_) {
    return [];
  }
}

async function minimaxLegalReply({ history, question, lawsContext, docsContext, codigosContext }) {
  if (!MINIMAX_API_KEY) return '';
  const system = `Eres el Asesor Legal de Brify, un legislador chileno experto.
Respondes con autoridad jurídica, criterio legal y lenguaje profesional, pero cercano y natural.
Prioridad:
1. Usa primero la legislación chilena verificada que tengas disponible para esta consulta.
2. Si también hay documentos del usuario, intégralos con el análisis legal.
3. Si existe material jurídico complementario, úsalo solo para enriquecer o explicar mejor, nunca como reemplazo de la ley.
4. Si el contexto legal es insuficiente, dilo explícitamente y formula solo las aclaraciones mínimas necesarias.
Reglas:
- No inventes leyes, artículos ni hechos.
- Si citas una ley, menciona su nombre o número de forma clara.
- Si hay documento del usuario, explica cómo se relaciona con la legislación aplicable.
- Si usas material complementario, preséntalo como apoyo interpretativo o práctico, no como si fuera una norma.
- No hables de sistemas internos, bases de datos, tablas, prompts, contexto oculto ni verificaciones técnicas.
- Si no puedes confirmar una norma exacta, responde de forma prudente y práctica, sin mencionar limitaciones internas.
- No uses Markdown.
- Si la respuesta es larga, redacta con continuidad para poder dividirse en varios mensajes.
- Responde en español chileno neutral.`;

  try {
    const response = await fetchWithTimeout(
      MINIMAX_ENDPOINT,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${MINIMAX_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: MINIMAX_MODEL,
          system,
          temperature: 0.25,
          max_tokens: 950,
          messages: [
            {
              role: 'user',
              content: `Historial legal reciente:\n${history || '(sin historial)'}\n\nConsulta del usuario:\n${question}\n\nContexto documental:\n${docsContext || '(sin documentos relevantes)'}\n\nContexto legal disponible:\n${lawsContext || '(sin normativa específica confirmada para esta consulta)'}\n\nMaterial jurídico complementario:\n${codigosContext || '(sin apoyo complementario relevante)'}\n\nResponde:`
            }
          ]
        })
      },
      Number.isFinite(WAHA_MINIMAX_TIMEOUT_MS) && WAHA_MINIMAX_TIMEOUT_MS > 0 ? WAHA_MINIMAX_TIMEOUT_MS : 9000
    );
    if (!response.ok) return '';
    const data = await response.json().catch(() => ({}));
    let raw = data?.content;
    if (Array.isArray(raw)) raw = raw.map((b) => (typeof b === 'string' ? b : b?.text || '')).join('');
    if (typeof raw !== 'string') raw = data?.choices?.[0]?.message?.content;
    return typeof raw === 'string' ? sanitizeWhatsAppText(raw) : '';
  } catch (_) {
    return '';
  }
}

async function openaiLegalReply({ history, question, lawsContext, docsContext, codigosContext }) {
  if (!OPENAI_API_KEY) return '';
  try {
    const response = await fetchWithTimeout(
      `${String(OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '')}/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: OPENAI_CHAT_MODEL,
          temperature: 0.25,
          max_tokens: 950,
          messages: [
            {
              role: 'system',
              content: `Eres el Asesor Legal de Brify, un legislador chileno experto.
Responde con criterio jurídico chileno, tono profesional pero cercano.
Usa primero la legislación chilena verificada disponible para la consulta.
Si además hay documentos del usuario, intégralos con la ley aplicable.
Si existe material jurídico complementario, úsalo solo como apoyo interpretativo o práctico, nunca como reemplazo de una norma.
No inventes artículos ni afirmes hechos no presentes.
No menciones bases de datos, tablas, sistemas internos, verificaciones técnicas ni limitaciones internas.
Si no puedes confirmar una norma exacta, responde de forma prudente y útil, sin hablar de infraestructura.
No uses Markdown.`
            },
            {
              role: 'user',
              content: `Historial legal reciente:\n${history || '(sin historial)'}\n\nConsulta:\n${question}\n\nDocumentos:\n${docsContext || '(sin documentos)'}\n\nNormativa disponible:\n${lawsContext || '(sin normativa específica confirmada para esta consulta)'}\n\nMaterial jurídico complementario:\n${codigosContext || '(sin apoyo complementario relevante)'}\n\nResponde:`
            }
          ]
        })
      },
      Number.isFinite(WAHA_MINIMAX_TIMEOUT_MS) && WAHA_MINIMAX_TIMEOUT_MS > 0 ? WAHA_MINIMAX_TIMEOUT_MS : 9000
    );
    if (!response.ok) return '';
    const data = await response.json().catch(() => ({}));
    const raw = data?.choices?.[0]?.message?.content;
    return typeof raw === 'string' ? sanitizeWhatsAppText(raw) : '';
  } catch (_) {
    return '';
  }
}

function buildLegalFallbackReply({ question, laws, documents }) {
  const scenarioReply = buildCommonLegalScenarioFallback(question);
  if (scenarioReply) return scenarioReply;

  const law = Array.isArray(laws) && laws.length ? laws[0] : null;
  const doc = Array.isArray(documents) && documents.length ? documents[0] : null;
  const lawText = law
    ? `Encontré como referencia ${getLawTitle(law)}${getLawNumber(law) ? ` (Ley ${getLawNumber(law)})` : ''}.`
    : `No tengo una norma específica confirmada para cerrar este punto con total precisión.`;
  const docText = doc
    ? ` Además revisé el documento "${doc.name}".`
    : '';
  return `${lawText}${docText}\n\nPara orientarte bien, necesito afinar uno o dos puntos de tu caso: qué pasó exactamente, en qué contexto ocurrió y qué quieres lograr. Si quieres, también puedes citar una ley concreta o mencionar el documento exacto.`;
}

function isLikelyLegalDocumentQuestion(text) {
  const t = normalizeForIntent(text);
  if (!t) return false;
  return (
    isLikelyDocumentKnowledgeQuestion(text) ||
    ((t.includes('document') || t.includes('archivo') || t.includes('pdf')) &&
      (t.includes('segun') || t.includes('según') || t.includes('demanda') || t.includes('contrato') || t.includes('ley') || t.includes('testigo')))
  );
}

async function uploadLegalMediaDocument({ session, threadId, media, userEmail }) {
  const normalizedUrl = normalizeMediaUrl(media?.url);
  if (!normalizedUrl || !userEmail) return null;

  const parentFolderId = await resolveRootFolderIdForUser(userEmail, session.user_id, session.phone_number, { sessionId: session.id });
  if (!parentFolderId) throw new Error('No encontré la carpeta raíz del usuario para Asesor Legal');

  const baseName = String(media?.filename || `documento-legal-${Date.now()}`).trim();
  const finalName = /^\[AL\]/i.test(baseName) ? baseName : `[AL] ${baseName}`;
  const file = await uploadFileFromUrlToDrive({
    userId: session.user_id,
    parentFolderId,
    fileName: finalName,
    mimeType: media?.mimetype,
    url: normalizedUrl
  });

  await upsertDocumentoAdministradorByFile({
    userEmail,
    fileId: file.id,
    patch: {
      ...documentWsspPatch(session.phone_number),
      name: file.name,
      file_type: file.mimeType || media?.mimetype || null,
      file_size: Number.isFinite(Number(file.size)) ? Number(file.size) : null,
      servicio: 'abogados',
      pendiente: true,
      carpeta_actual: parentFolderId,
      nombre_carpeta_actual: 'Carpeta raíz',
      metadata: { source: 'waha', action: 'legal_upload_file', vector_status: 'uploaded', legal_thread_id: threadId || null },
      nombre_limpio: String(file.name || '').toLowerCase().replace(/[^a-z0-9]/g, '_')
    }
  });

  const vectorized = await vectorizeDriveFileToSupabase({
    userId: session.user_id,
    userEmail,
    fileId: file.id,
    fileName: file.name,
    mimeType: file.mimeType || media?.mimetype || null,
    fileSize: file.size || null,
    phoneNumber: session.phone_number,
    service: 'abogados',
    sourceAction: 'legal_upload_file'
  });

  const { data: doc } = await supabase
    .from('documentos_administrador')
    .select('name,file_id,content,metadata,created_at')
    .eq('administrador', userEmail)
    .eq('file_id', file.id)
    .maybeSingle();

  const documentRef = {
    name: doc?.name || file.name,
    fileId: doc?.file_id || file.id,
    content: String(doc?.content || ''),
    metadata: doc?.metadata || {},
    created_at: doc?.created_at || null
  };

  await appendLegalThreadReferences(threadId, {
    documents: summarizeDocumentRefsForThread([documentRef])
  });

  return {
    ...documentRef,
    webViewLink: file.webViewLink || driveOpenLink(file.id),
    mimeType: file.mimeType || media?.mimetype || null,
    vectorized
  };
}

async function answerLegalConsultation({
  session,
  threadId,
  chatId,
  sessionName,
  question,
  uploadedDocuments = [],
  forceKnowledgeFallback = false
}) {
  const cleanQuestion = normalizeIncomingText(question);
  if (!cleanQuestion) return false;

  const preferredDocumentName = extractDocumentReferenceName(cleanQuestion);
  const explicitDocQuestion = isLikelyLegalDocumentQuestion(cleanQuestion);
  const documents = [];

  if (Array.isArray(uploadedDocuments) && uploadedDocuments.length) {
    documents.push(...uploadedDocuments.filter(Boolean));
  }

  if (preferredDocumentName) {
    const namedDocuments = await findUserDocumentsByNameHint({
      userId: session.user_id,
      nameHint: preferredDocumentName,
      limit: 3
    });
    documents.push(...namedDocuments);
  }

  if (explicitDocQuestion && !documents.length) {
    const referencedDocuments = await getLegalThreadReferencedDocuments(threadId, session.user_id);
    documents.push(...referencedDocuments);
  }

  if (explicitDocQuestion && (!documents.length || !preferredDocumentName)) {
    const semanticMatches = await semanticSearchUserDocs({
      userId: session.user_id,
      query: cleanQuestion,
      limit: 4
    });
    if (semanticMatches.length) {
      const semanticDocuments = await loadUserDocsByFileIds({
        userId: session.user_id,
        fileIds: semanticMatches.map((item) => item.fileId)
      });
      documents.push(...semanticDocuments);
    }
  }

  const uniqueDocuments = Array.from(
    new Map(
      documents
        .filter((doc) => doc?.fileId || doc?.file_id || doc?.name)
        .map((doc) => [String(doc.fileId || doc.file_id || doc.name), doc])
    ).values()
  ).slice(0, 4);

  const laws = forceKnowledgeFallback ? [] : await searchLawsForLegalQuestion({ question: cleanQuestion, documents: uniqueDocuments, limit: 5 });
  const codigos = forceKnowledgeFallback ? [] : await searchCodigosForLegalQuestion({ question: cleanQuestion, documents: uniqueDocuments, limit: 3 });
  const history = threadId ? await getLegalThreadHistory(threadId, 14, 3200) : '';
  const lawsContext = buildLegalLawContext(laws, cleanQuestion);
  const docsContext = buildLegalDocumentContext(uniqueDocuments, cleanQuestion);
  const codigosContext = buildLegalCodigosContext(codigos, cleanQuestion);

  if (!laws.length) {
    await wahaSendTextLogged({
      threadId,
      chatId,
      text: `Buscando información, ya te contesto... esperame 🔍`,
      sessionName,
      options: { skipRewrite: true }
    });
  }

  let answer = await minimaxLegalReply({
    history,
    question: cleanQuestion,
    lawsContext,
    docsContext,
    codigosContext
  });

  if (!answer) {
    answer = await openaiLegalReply({
      history,
      question: cleanQuestion,
      lawsContext,
      docsContext,
      codigosContext
    });
  }

  if (!answer) {
    answer = buildLegalFallbackReply({
      question: cleanQuestion,
      laws,
      documents: uniqueDocuments
    });
  }

  const withSources = (() => {
    const lawNames = summarizeLawRefsForThread(laws).slice(0, 3).map((item) => item.number ? `${item.title} (Ley ${item.number})` : item.title);
    const docNames = explicitDocQuestion
      ? summarizeDocumentRefsForThread(uniqueDocuments).slice(0, 2).map((item) => item.name).filter(Boolean)
      : [];
    const codigoNames = summarizeCodigoRefs(codigos).slice(0, 2).map((item) => item.title).filter(Boolean);
    const sources = Array.from(new Set([...lawNames, ...codigoNames, ...docNames].filter(Boolean)));
    if (!sources.length) return answer;
    if (normalizeForIntent(answer).includes('fuente:')) return answer;
    return `${answer}\n\nFuente: ${sources.join(', ')}`;
  })();

  await appendLegalThreadReferences(threadId, {
    laws: summarizeLawRefsForThread(laws),
    documents: explicitDocQuestion || uploadedDocuments.length ? summarizeDocumentRefsForThread(uniqueDocuments) : []
  });

  await wahaSendLongTextLogged({
    threadId,
    chatId,
    text: withSources,
    sessionName,
    options: { skipRewrite: true }
  });

  await updateWspSession(session.id, {
    current_branch: 'asesor_legal',
    branch_context: {
      ...(session.branch_context || {}),
      thread_id: threadId,
      stage: 'case_active',
      last_legal_laws: summarizeLawRefsForThread(laws),
      last_legal_docs: explicitDocQuestion || uploadedDocuments.length ? summarizeDocumentRefsForThread(uniqueDocuments) : []
    }
  });
  return true;
}

async function handleAsesorLegal({ session, chatId, text, sessionName, payload }) {
  let ctx = session.branch_context || {};
  const textTrim = normalizeIncomingText(text);
  const textLower = normalizeForIntent(textTrim);
  const media = extractMediaFromPayload(payload);
  const { history: globalHistory } = getGlobalState(ctx);

  if (isMenuTrigger(textLower)) {
    if (ctx.thread_id) {
      await setLegalThreadActive(ctx.thread_id, false);
    }
    await showMainMenu({ session, chatId, sessionName });
    return;
  }

  let threadId = ctx.thread_id || null;
  if (!threadId) {
    const active = await getActiveLegalThread(session.id);
    const reusable = active || (await getLatestLegalThread(session.id));
    if (reusable?.id) {
      threadId = reusable.id;
      await setLegalThreadActive(threadId, true);
    } else {
      const created = await createLegalThread({ sessionId: session.id, userId: session.user_id, threadType: 'case' });
      threadId = created?.id || null;
    }
    if (threadId) {
      const updatedSession = await updateWspSession(session.id, {
        current_branch: 'asesor_legal',
        branch_context: { ...ctx, thread_id: threadId, stage: ctx.stage || 'choose_mode' }
      });
      ctx = updatedSession?.branch_context || { ...ctx, thread_id: threadId, stage: ctx.stage || 'choose_mode' };
    }
  }

  if (threadId && textTrim) {
    await appendLegalMessage(threadId, 'user', textTrim);
  }

  if (!ctx.stage) {
    const updatedSession = await updateWspSession(session.id, {
      current_branch: 'asesor_legal',
      branch_context: { ...ctx, thread_id: threadId, stage: 'choose_mode' }
    });
    ctx = updatedSession?.branch_context || { ...ctx, thread_id: threadId, stage: 'choose_mode' };
    await wahaSendTextLogged({
      threadId,
      chatId,
      text: `Soy tu Asesor Legal de Brify ⚖️\n\nPuedo orientarte sobre tu caso, buscar leyes chilenas y revisar documentos dentro del contexto legal.\n\nSi quieres, parte contándome tu caso, mencionando una ley o diciéndome algo como: "según mi documento..."`,
      sessionName
    });
    return;
  }

  const { data: legalUser } = await supabase.from('users').select('email').eq('id', session.user_id).single();
  const legalUserEmail = legalUser?.email || null;
  let uploadedDocuments = [];

  if (media?.url && legalUserEmail) {
    try {
      const uploadedDoc = await uploadLegalMediaDocument({
        session,
        threadId,
        media,
        userEmail: legalUserEmail
      });
      if (uploadedDoc) uploadedDocuments.push(uploadedDoc);
      if (!textTrim || textTrim.length < 6) {
        await updateWspSession(session.id, {
          current_branch: 'asesor_legal',
          branch_context: { ...ctx, thread_id: threadId, stage: 'case_active', last_legal_docs: summarizeDocumentRefsForThread(uploadedDocuments) }
        });
        await wahaSendTextLogged({
          threadId,
          chatId,
          text: `Listo 🙌 Guardé "${uploadedDoc.name}" dentro del contexto legal.\n\nAhora puedes preguntarme algo como: "según mi documento, ¿qué implicancia legal tiene esto?"`,
          sessionName,
          options: { skipRewrite: true }
        });
        return;
      }
    } catch (uploadError) {
      await wahaSendTextLogged({
        threadId,
        chatId,
        text: `Tuve un problema guardando el documento en Asesor Legal 😕\n\nSi quieres, reenvíalo o cuéntame tu consulta y la trabajamos igual.`,
        sessionName
      });
      return;
    }
  }

  const wantsDocumentLegalAnswer = isLikelyLegalDocumentQuestion(textTrim);
  const isBranchReentry = isLegalBranchReentryPhrase(textTrim);
  const legalHandoffQuestion = buildLegalHandoffQuestion(globalHistory, textTrim);
  const effectiveQuestion = legalHandoffQuestion || textTrim;
  const wantsFreeLegalAnswer =
    ctx.stage === 'case_collect' ||
    ctx.stage === 'case_active' ||
    (effectiveQuestion.length >= 18 && shouldTreatAsCase(effectiveQuestion));

  if (isBranchReentry && !uploadedDocuments.length) {
    await updateWspSession(session.id, {
      current_branch: 'asesor_legal',
      branch_context: { ...ctx, thread_id: threadId, stage: 'case_collect' }
    });
    if (threadId) await setLegalThreadType(threadId, 'case');
    await wahaSendTextLogged({
      threadId,
      chatId,
      text: `Te leo ⚖️ Cuéntame tu caso con la mayor cantidad de detalles que puedas.\n\nQué pasó, cuándo fue más o menos, quiénes estuvieron involucrados y qué necesitas resolver.`,
      sessionName,
      options: { skipRewrite: true }
    });
    return;
  }

  if ((uploadedDocuments.length && textTrim) || wantsDocumentLegalAnswer || (wantsFreeLegalAnswer && !isBranchReentry)) {
    if (threadId) await setLegalThreadType(threadId, 'case');
    const answered = await answerLegalConsultation({
      session,
      threadId,
      chatId,
      sessionName,
      question: effectiveQuestion,
      uploadedDocuments
    });
    if (answered) return;
  }

  if (ctx.stage === 'choose_mode') {
    if ((textLower.includes('asesor') || textLower.includes('abogado') || textLower.includes('orienta')) && !isLikelyLawSearch(textTrim)) {
      await updateWspSession(session.id, { current_branch: 'asesor_legal', branch_context: { ...ctx, thread_id: threadId, stage: 'case_collect' } });
      if (threadId) await setLegalThreadType(threadId, 'case');
      await wahaSendTextLogged({
        threadId,
        chatId,
        text: `Cuéntame tu caso con el mayor detalle posible 📝\n\nQué pasó, fechas aproximadas y qué quieres lograr.`,
        sessionName
      });
      return;
    }

    const isCase = textLower === '1' || shouldTreatAsCase(textTrim) || textLower.includes('caso') || textLower.includes('situacion') || textLower.includes('situación') || textLower.includes('problema');
    const isSearch = textLower === '2' || isLikelyLawSearch(textTrim);

    if (isSearch) {
      if (!SUPABASE_LAWS_URL || !SUPABASE_LAWS_ANON_KEY) {
        await updateWspSession(session.id, { current_branch: 'asesor_legal', branch_context: { ...ctx, thread_id: threadId, stage: 'case_collect' } });
        if (threadId) await setLegalThreadType(threadId, 'case');
        await wahaSendTextLogged({
          threadId,
          chatId,
          text: `Ahora mismo no tengo acceso a la base de leyes 😕\n\nIgual puedo orientarte: cuéntame tu caso o tu duda y te ayudo con lo más importante 🙌`,
          sessionName
        });
        return;
      }
      const query = extractLawQuery(textTrim);
      if (!query || query.length < 3) {
        await updateWspSession(session.id, { current_branch: 'asesor_legal', branch_context: { ...ctx, thread_id: threadId, stage: 'law_search', no_results_count: 0 } });
        if (threadId) await setLegalThreadType(threadId, 'law_search');
        await wahaSendTextLogged({ threadId, chatId, text: `Perfecto 🔎 ¿Qué término, número de ley o artículo quieres buscar?`, sessionName });
        return;
      }

      const results = await searchLawsRpc(query, 7);
      await updateWspSession(session.id, {
        current_branch: 'asesor_legal',
        branch_context: { ...ctx, thread_id: threadId, stage: 'law_results', last_query: query, results, no_results_count: results.length ? 0 : (Number(ctx.no_results_count || 0) + 1) }
      });
      await wahaSendTextLogged({ threadId, chatId, text: formatLawResults(results, query), sessionName });
      return;
    }

    if (isCase) {
      await updateWspSession(session.id, { current_branch: 'asesor_legal', branch_context: { ...ctx, thread_id: threadId, stage: 'case_collect' } });
      if (threadId) await setLegalThreadType(threadId, 'case');
      await wahaSendTextLogged({
        threadId,
        chatId,
        text: `Cuéntame tu caso con el mayor detalle posible 📝\n\nQué pasó, fechas aproximadas y qué quieres lograr.`,
        sessionName
      });
      return;
    }

    if (textTrim.length > 8 && isLikelyLawSearch(textTrim)) {
      await updateWspSession(session.id, { current_branch: 'asesor_legal', branch_context: { ...ctx, thread_id: threadId, stage: 'law_search', no_results_count: 0 } });
      if (threadId) await setLegalThreadType(threadId, 'law_search');
      const query = extractLawQuery(textTrim);
      const results = await searchLawsRpc(query || textTrim, 7);
      await updateWspSession(session.id, { current_branch: 'asesor_legal', branch_context: { ...ctx, thread_id: threadId, stage: 'law_results', last_query: query || textTrim, results, no_results_count: results.length ? 0 : (Number(ctx.no_results_count || 0) + 1) } });
      await wahaSendTextLogged({ threadId, chatId, text: formatLawResults(results, query || textTrim), sessionName });
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
      await updateWspSession(session.id, { current_branch: 'asesor_legal', branch_context: { ...ctx, thread_id: threadId, stage: 'law_search', no_results_count: 0 } });
      if (threadId) await setLegalThreadType(threadId, 'law_search');
      const query = extractLawQuery(textTrim);
      if (!query || query.length < 2) {
        await wahaSendTextLogged({ threadId, chatId, text: `Perfecto 🔎 ¿Qué término, número de ley o artículo quieres buscar?`, sessionName });
        return;
      }
      const results = await searchLawsRpc(query, 7);
      await updateWspSession(session.id, { current_branch: 'asesor_legal', branch_context: { ...ctx, thread_id: threadId, stage: 'law_results', last_query: query, results, no_results_count: results.length ? 0 : (Number(ctx.no_results_count || 0) + 1) } });
      await wahaSendTextLogged({ threadId, chatId, text: formatLawResults(results, query), sessionName });
      return;
    }
    if (optionId === 'case') {
      await updateWspSession(session.id, { current_branch: 'asesor_legal', branch_context: { ...ctx, thread_id: threadId, stage: 'case_collect' } });
      if (threadId) await setLegalThreadType(threadId, 'case');
      await wahaSendTextLogged({
        threadId,
        chatId,
        text: `Cuéntame tu caso con el mayor detalle posible 📝\n\nQué pasó, fechas aproximadas y qué quieres lograr.`,
        sessionName
      });
      return;
    }

    await wahaSendTextLogged({ threadId, chatId, text: `Cuéntame directamente tu duda legal, menciona una ley o referencia un documento. También puedes decir:\n\n1️⃣ 📝 Compartir mi caso\n2️⃣ 🔎 Buscar una ley`, sessionName });
    return;
  }

  if (ctx.stage === 'law_search') {
    const query = extractLawQuery(textTrim) || textTrim;
    if (shouldTreatAsCase(textTrim)) {
      await updateWspSession(session.id, { current_branch: 'asesor_legal', branch_context: { ...ctx, thread_id: threadId, stage: 'case_collect' } });
      if (threadId) await setLegalThreadType(threadId, 'case');
      await wahaSendTextLogged({ threadId, chatId, text: `Perfecto 🙌 Te leo. Cuéntame el caso o la duda y te oriento paso a paso.`, sessionName });
      return;
    }
    if (!query || query.length < 2) {
      await wahaSendTextLogged({ threadId, chatId, text: `Dime el término o número de ley 😊`, sessionName });
      return;
    }
    const results = await searchLawsRpc(query, 7);
    const nextNoResults = results.length ? 0 : (Number(ctx.no_results_count || 0) + 1);
    await updateWspSession(session.id, { current_branch: 'asesor_legal', branch_context: { ...ctx, thread_id: threadId, stage: 'law_results', last_query: query, results, no_results_count: nextNoResults } });
    await appendLegalThreadReferences(threadId, { laws: summarizeLawRefsForThread(results) });
    await wahaSendTextLogged({ threadId, chatId, text: formatLawResults(results, query), sessionName });
    return;
  }

  if (ctx.stage === 'law_results') {
    const results = Array.isArray(ctx.results) ? ctx.results : [];
    const picked = pickLawFromResults(results, textTrim);
    if (picked) {
      await updateWspSession(session.id, { current_branch: 'asesor_legal', branch_context: { ...ctx, thread_id: threadId, stage: 'law_results', last_query: ctx.last_query, results, selected: picked.index } });
      await appendLegalThreadReferences(threadId, { laws: summarizeLawRefsForThread([picked.law]) });
      await wahaSendTextLogged({ threadId, chatId, text: formatLawDetail(picked.law), sessionName });
      return;
    }

    if (shouldTreatAsCase(textTrim)) {
      await updateWspSession(session.id, { current_branch: 'asesor_legal', branch_context: { ...ctx, thread_id: threadId, stage: 'case_active' } });
      if (threadId) await setLegalThreadType(threadId, 'case');
      await wahaSendTextLogged({ threadId, chatId, text: `Perfecto 🙌 Cuéntame el caso o tu duda y te oriento.`, sessionName });
      return;
    }

    const query = extractLawQuery(textTrim) || textTrim;
    if (!query) {
      await wahaSendTextLogged({ threadId, chatId, text: `Dime el número, una palabra del título, o un término nuevo para buscar 🔎`, sessionName });
      return;
    }
    const newResults = await searchLawsRpc(query, 7);
    const nextNoResults = newResults.length ? 0 : (Number(ctx.no_results_count || 0) + 1);
    await updateWspSession(session.id, { current_branch: 'asesor_legal', branch_context: { ...ctx, thread_id: threadId, stage: 'law_results', last_query: query, results: newResults, no_results_count: nextNoResults } });
    await appendLegalThreadReferences(threadId, { laws: summarizeLawRefsForThread(newResults) });
    await wahaSendTextLogged({ threadId, chatId, text: formatLawResults(newResults, query), sessionName });
    return;
  }

  if (ctx.stage === 'case_collect' || ctx.stage === 'case_active') {
    const description = textTrim;
    if (!description || description.length < 20) {
      await wahaSendTextLogged({ threadId, chatId, text: `Cuéntame un poquito más 🙌 (qué pasó, cuándo, con quién y qué necesitas)`, sessionName });
      return;
    }
    await answerLegalConsultation({
      session,
      threadId,
      chatId,
      sessionName,
      question: description,
      uploadedDocuments
    });
    return;
  }

  await updateWspSession(session.id, { current_branch: 'asesor_legal', branch_context: { ...ctx, thread_id: threadId, stage: 'choose_mode' } });
  await wahaSendTextLogged({ threadId, chatId, text: `Sigo aquí como tu Asesor Legal ⚖️\n\nPuedes contarme tu caso, buscar una ley o referenciar un documento.`, sessionName });
}

async function detectIntentWithAI(text) {
  if (!MINIMAX_API_KEY) return { intent: 'unknown', confidence: 0 };
  const t = normalizeIncomingText(text);
  if (!t) return { intent: 'unknown', confidence: 0 };

  const system = `Clasifica la intención del usuario para un menú de WhatsApp de Brify.
Devuelve SOLO JSON válido con este formato:
{"intent":"menu|legal|create_group|share_group|upload_file|list_groups|list_files|analyze_document|unknown","confidence":0.0}
Reglas:
- No agregues texto fuera del JSON.
- Si el usuario pide "asesor legal/abogado/ley" => legal
- "crear grupo/carpeta" => create_group
- "compartir grupo/dar acceso" => share_group
- "subir/adjuntar archivo" => upload_file
- "ver/listar grupos/carpetas" => list_groups
- "ver/listar documentos/imagenes" => list_files
- "analizar/resumir documento" => analyze_document
- Si hay duda => unknown con baja confianza.`;

  const response = await fetchWithTimeout(
    MINIMAX_ENDPOINT,
    {
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
    },
    Number.isFinite(WAHA_MINIMAX_TIMEOUT_MS) && WAHA_MINIMAX_TIMEOUT_MS > 0 ? WAHA_MINIMAX_TIMEOUT_MS : 8000
  );

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

async function minimaxExtractCreateGroupDetails(text) {
  if (!WAHA_MINIMAX_ENABLED) return null;
  if (!MINIMAX_API_KEY) return null;
  const t = String(text || '').trim();
  if (!t) return null;

  const system = `Extrae datos para crear un grupo y, si aplica, compartirlo.
Devuelve SOLO JSON válido (sin texto extra).
Formato:
{"group_name":string|null,"emails":string[]}
Reglas:
- group_name: SOLO el nombre del grupo, sin verbos (ej: no "Necesito X", solo "X").
- emails: correos en minúscula, únicos.
- Si no hay un dato, usa null o [].
- No inventes correos ni nombres.`;

  try {
    const response = await fetchWithTimeout(
      MINIMAX_ENDPOINT,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${MINIMAX_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: MINIMAX_MODEL,
          system,
          temperature: 0,
          max_tokens: 160,
          messages: [{ role: 'user', content: t }]
        })
      },
      Number.isFinite(WAHA_MINIMAX_TIMEOUT_MS) && WAHA_MINIMAX_TIMEOUT_MS > 0 ? WAHA_MINIMAX_TIMEOUT_MS : 8000
    );

    if (!response.ok) return null;
    const data = await response.json().catch(() => ({}));
    let raw = data?.content;
    if (Array.isArray(raw)) raw = raw.map((b) => (typeof b === 'string' ? b : b?.text || '')).join('');
    if (typeof raw !== 'string') raw = data?.choices?.[0]?.message?.content;
    if (typeof raw !== 'string') return null;

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    const groupName = typeof parsed?.group_name === 'string' ? parsed.group_name.trim() : null;
    const emails = Array.isArray(parsed?.emails) ? parsed.emails.map((e) => String(e || '').toLowerCase().trim()).filter(Boolean) : [];
    const uniq = Array.from(new Set(emails));
    return {
      group_name: groupName && groupName.length >= 2 ? groupName : null,
      emails: uniq
    };
  } catch (_) {
    return null;
  }
}

async function minimaxParseCreateGroupUserAction(text) {
  if (!WAHA_MINIMAX_ENABLED) return null;
  if (!MINIMAX_API_KEY) return null;
  const raw = String(text || '').trim();
  if (!raw) return null;

  const system = `Clasifica la respuesta del usuario dentro del paso de confirmación para crear y compartir un grupo.
Devuelve SOLO JSON válido.
Formato:
{"action":"confirm|cancel|no_share|add_emails|edit_name|unknown","name":string|null,"emails":string[]}
Reglas:
- confirm: cuando el usuario aprueba continuar.
- cancel: cuando el usuario quiere detener o anular.
- no_share: cuando quiere crear el grupo pero no compartirlo por ahora.
- add_emails: cuando agrega uno o más correos para compartir.
- edit_name: cuando quiere cambiar el nombre del grupo.
- unknown: si no está claro.
- name: solo el nuevo nombre si aplica.
- emails: correos únicos en minúscula.
- No inventes datos.`;

  try {
    const response = await fetchWithTimeout(
      MINIMAX_ENDPOINT,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${MINIMAX_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: MINIMAX_MODEL,
          system,
          temperature: 0,
          max_tokens: 180,
          messages: [{ role: 'user', content: raw }]
        })
      },
      Number.isFinite(WAHA_MINIMAX_TIMEOUT_MS) && WAHA_MINIMAX_TIMEOUT_MS > 0 ? WAHA_MINIMAX_TIMEOUT_MS : 8000
    );

    if (!response.ok) return null;
    const data = await response.json().catch(() => ({}));
    let content = data?.content;
    if (Array.isArray(content)) content = content.map((b) => (typeof b === 'string' ? b : b?.text || '')).join('');
    if (typeof content !== 'string') content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') return null;

    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    const allowed = new Set(['confirm', 'cancel', 'no_share', 'add_emails', 'edit_name', 'unknown']);
    const action = allowed.has(String(parsed?.action || '').trim()) ? String(parsed.action).trim() : 'unknown';
    const name = typeof parsed?.name === 'string' ? parsed.name.trim() : null;
    const emails = Array.isArray(parsed?.emails)
      ? Array.from(new Set(parsed.emails.map((e) => String(e || '').toLowerCase().trim()).filter(Boolean)))
      : [];
    return { action, name: name || null, emails };
  } catch (_) {
    return null;
  }
}

function parseCreateGroupUserAction(text) {
  const t = normalizeForIntent(text);
  const raw = String(text || '').trim();
  const emails = parseEmails(raw);

  if (!t) return { action: 'unknown', emails };

  if (
    t.includes('cancel') ||
    t.includes('cancela') ||
    t.includes('olvida') ||
    t.includes('da lo mismo') ||
    t.includes('ya no') ||
    t === 'no'
  ) {
    return { action: 'cancel', emails };
  }

  if (
    t.includes('no compartir') ||
    t.includes('sin compartir') ||
    t.includes('no lo compart') ||
    t.includes('no lo envies') ||
    t.includes('no lo envíes') ||
    t.includes('no lo mandes')
  ) {
    return { action: 'no_share', emails };
  }

  if (emails.length) return { action: 'add_emails', emails };

  const yn = normalizeYesNo(raw);
  if (yn === true) return { action: 'confirm', emails };
  if (yn === false) return { action: 'cancel', emails };

  const name = guessGroupName(raw);
  if (
    t.includes('cambia') ||
    t.includes('editar') ||
    t.includes('modifica') ||
    t.includes('ponle') ||
    t.includes('pon') ||
    t.includes('nombre')
  ) {
    return { action: name ? 'edit_name' : 'unknown', name, emails };
  }

  if (name && (t.startsWith('se llama') || t.startsWith('llamalo') || t.startsWith('llámalo'))) {
    return { action: 'edit_name', name, emails };
  }

  return { action: 'unknown', emails };
}

function formatCreateGroupSummary({ groupName, emails }) {
  const n = String(groupName || '').trim();
  const e = Array.isArray(emails) ? emails : [];
  const emailLine = e.length ? `🤝 Compartir con: ${e.join(', ')}` : `🤝 Compartir: (por ahora nadie)`;
  return `Captado esto 👇\n📁 Grupo: ${n || '(sin nombre)'}\n${emailLine}`;
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
  const raw = String(text || '').trim();
  if (!raw) return null;

  const withoutEmails = raw.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, ' ');
  const base = withoutEmails.replace(/\s+/g, ' ').trim();
  if (!base) return null;

  const patterns = [
    /\b(llamado|llamada|que\s+se\s+llame|que\s+se\s+llamara|nombre)\b\s+(?<name>[^,;\n]+?)(?=\s+(y|con|para|a|que)\b|$)/i,
    /\bgrupo\b\s+(?<name>[^,;\n]+?)(?=\s+(y|con|para|a|que)\b|$)/i,
    /\bcarpeta\b\s+(?<name>[^,;\n]+?)(?=\s+(y|con|para|a|que)\b|$)/i
  ];

  for (const re of patterns) {
    const m = base.match(re);
    const name = m?.groups?.name ? String(m.groups.name).trim() : '';
    if (name.length >= 2) {
      const cleaned = name.replace(/^[“”"'`]+|[“”"'`]+$/g, '').replace(/[.,;:!?()]+$/g, '').trim();
      if (cleaned.length >= 2) return cleaned;
    }
  }

  let cleaned = base;
  cleaned = cleaned
    .replace(/\b(necesito|quiero|por\s+favor|ayudame|ayúdame|podrias|podrías|me\s+gustaria|me\s+gustaría)\b/gi, ' ')
    .replace(/\b(crear|arma|armar|hacer|generar)\b/gi, ' ')
    .replace(/\b(un|una|el|la|los|las)\b/gi, ' ')
    .replace(/\b(grupo|carpeta)\b/gi, ' ')
    .replace(/\b(llamado|llamada|nombre|que\s+se\s+llame)\b/gi, ' ')
    .replace(/\b(y\s+que\s+se\s+compart[ae]|y\s+compart[ei]r|compart[ei]r|dar\s+acceso|invitar|invita|agrega|agregar|añade|anade)\b[\s\S]*$/i, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  cleaned = cleaned.replace(/^[“”"'`]+|[“”"'`]+$/g, '').replace(/[.,;:!?()]+$/g, '').trim();
  if (cleaned.length < 2) return null;
  if (cleaned.length > 80) cleaned = cleaned.slice(0, 80).trim();
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

function findGroupMentionInText(groups, text) {
  const haystack = normalizeForIntent(text);
  if (!haystack || !Array.isArray(groups) || !groups.length) return null;
  const ordered = [...groups].sort(
    (a, b) => normalizeForIntent(b?.group_name || '').length - normalizeForIntent(a?.group_name || '').length
  );
  return (
    ordered.find((group) => {
      const normalizedName = normalizeForIntent(group?.group_name || '');
      return normalizedName && haystack.includes(normalizedName);
    }) || null
  );
}

function cleanContinuationText(text) {
  let value = String(text || '').trim();
  if (!value) return '';
  value = value.replace(/^[\s,.;:!?¡¿)\]-]+/, '').trim();
  value = value.replace(/^(y|e|pero|igual|entonces|ahora|ahora bien|despues|después|de paso)\b[\s,.;:!?-]*/i, '').trim();
  value = value.replace(/^[\s,.;:!?¡¿)\]-]+/, '').trim();
  return value;
}

function extractContinuationAfterKeepInPlace(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  const patterns = [
    /^(?:gracias[\s,.;:!?-]*)?(?:no\s+te\s+preocupes|deja(?:lo)?\s+ahi|déja(?:lo)?\s+ahi|deja(?:lo)?\s+ahí|déja(?:lo)?\s+ahí|asi\s+esta\s+bien|así\s+está\s+bien|asi\s+esta|así\s+está|esta\s+bien|está\s+bien|no\s+gracias)([\s\S]*)$/i,
    /^(?:gracias[\s,.;:!?-]*)?(?:no)([\s\S]*)$/i
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match?.[1]) {
      const continuation = cleanContinuationText(match[1]);
      if (continuation) return continuation;
    }
  }
  return '';
}

function extractContinuationAfterGroupReference(text, groupName) {
  const raw = String(text || '').trim();
  const target = String(groupName || '').trim();
  if (!raw || !target) return '';
  const lowerRaw = raw.toLowerCase();
  const lowerTarget = target.toLowerCase();
  const at = lowerRaw.indexOf(lowerTarget);
  if (at < 0) return '';
  return cleanContinuationText(raw.slice(at + target.length));
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

async function upsertGrupoDriveRecord({ ownerUserId, userEmail, folderId, groupName, extension = 'brify' }) {
  const normalizedGroupName = String(groupName || '').trim();
  if (!ownerUserId || !userEmail || !folderId || !normalizedGroupName) {
    throw new Error('Faltan datos para registrar el grupo en grupos_drive');
  }

  const { data: existing, error: existingError } = await supabase
    .from('grupos_drive')
    .select('id')
    .eq('folder_id', folderId)
    .maybeSingle();
  if (existingError) throw existingError;

  const patch = {
    owner_id: ownerUserId,
    group_name: normalizedGroupName,
    nombre_grupo_low: normalizedGroupName.toLowerCase(),
    folder_id: folderId,
    administrador: userEmail,
    extension
  };

  if (existing?.id) {
    const { data, error } = await supabase
      .from('grupos_drive')
      .update(patch)
      .eq('id', existing.id)
      .select('id, group_name, folder_id, administrador, owner_id, extension')
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('grupos_drive')
    .insert(patch)
    .select('id, group_name, folder_id, administrador, owner_id, extension')
    .single();
  if (error) throw error;
  return data;
}

async function upsertFolderShareRecords({ ownerUserId, adminEmail, folderId, emails, role }) {
  const normalizedEmails = Array.from(new Set((Array.isArray(emails) ? emails : []).map((e) => String(e || '').trim().toLowerCase()).filter(Boolean)));
  if (!ownerUserId || !adminEmail || !folderId || !normalizedEmails.length) return [];
  const mappedRole = role === 'writer' ? 'editor' : 'lector';
  const results = [];

  for (const email of normalizedEmails) {
    const { data: existing, error: existingError } = await supabase
      .from('grupos_carpetas')
      .select('id')
      .eq('carpeta_id', folderId)
      .eq('usuario_lector', email)
      .maybeSingle();
    if (existingError) throw existingError;

    const patch = {
      user_id: ownerUserId,
      role: mappedRole,
      carpeta_id: folderId,
      administrador: adminEmail,
      usuario_lector: email
    };

    if (existing?.id) {
      const { data, error } = await supabase
        .from('grupos_carpetas')
        .update(patch)
        .eq('id', existing.id)
        .select('id, carpeta_id, usuario_lector, role')
        .single();
      if (error) throw error;
      results.push(data);
      continue;
    }

    const { data, error } = await supabase
      .from('grupos_carpetas')
      .insert(patch)
      .select('id, carpeta_id, usuario_lector, role')
      .single();
    if (error) throw error;
    results.push(data);
  }

  return results;
}

async function createRegisteredGroupForUser({ session, userEmail, groupName }) {
  const finalGroupName = String(groupName || '').trim();
  if (!session?.user_id || !userEmail || finalGroupName.length < 2) {
    throw new Error('Faltan datos para crear el grupo');
  }

  const rootFolderId = await resolveRootFolderIdForUser(userEmail, session.user_id, session.phone_number, { sessionId: session.id });
  if (!rootFolderId) {
    throw new Error('No encontré la carpeta raíz del usuario');
  }

  const folder = await createDriveFolder({
    userId: session.user_id,
    parentFolderId: rootFolderId,
    name: finalGroupName
  });

  try {
    const groupRecord = await upsertGrupoDriveRecord({
      ownerUserId: session.user_id,
      userEmail,
      folderId: folder.id,
      groupName: finalGroupName,
      extension: 'brify'
    });
    await setWspSessionGlobal(session.id, {
      last_group_record_result: {
        ok: true,
        group_name: finalGroupName,
        folder_id: folder.id,
        grupos_drive_id: groupRecord?.id || null,
        ts: new Date().toISOString()
      }
    });
  } catch (groupRecordError) {
    await setWspSessionGlobal(session.id, {
      last_group_record_result: {
        ok: false,
        group_name: finalGroupName,
        folder_id: folder.id,
        error: {
          message: groupRecordError?.message || 'unknown',
          code: groupRecordError?.code || null,
          details: groupRecordError?.details || null,
          hint: groupRecordError?.hint || null
        },
        ts: new Date().toISOString()
      }
    });
    throw groupRecordError;
  }

  return {
    id: null,
    group_name: finalGroupName,
    folder_id: folder.id,
    administrador: userEmail
  };
}

async function shareDriveFolder({ userId, folderId, emails, role, ownerUserId, adminEmail }) {
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
  if (ownerUserId && adminEmail && folderId && results.length) {
    await upsertFolderShareRecords({
      ownerUserId,
      adminEmail,
      folderId,
      emails: results.map((r) => r.email),
      role: normalizedRole
    });
  }
  return results;
}

async function moveDriveFileToFolder({ userId, fileId, targetFolderId }) {
  const drive = await getDriveClientForUser(userId);
  const current = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, size, webViewLink, parents'
  });
  const currentParents = Array.isArray(current?.data?.parents) ? current.data.parents.filter(Boolean) : [];
  const removeParents = currentParents.filter((id) => id !== targetFolderId).join(',');
  const updated = await drive.files.update({
    fileId,
    addParents: targetFolderId,
    removeParents: removeParents || undefined,
    fields: 'id, name, mimeType, size, webViewLink, parents'
  });
  return updated.data;
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
  if (!url) {
    throw new Error('No llegó URL del archivo para descargar desde WAHA');
  }
  const headers = {
    ...(WAHA_API_KEY ? { 'X-Api-Key': WAHA_API_KEY } : {})
  };
  const response = await fetchWithTimeout(
    url,
    { headers },
    Number.isFinite(WAHA_MEDIA_TIMEOUT_MS) && WAHA_MEDIA_TIMEOUT_MS > 0 ? WAHA_MEDIA_TIMEOUT_MS : 12000
  );
  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`No se pudo descargar el archivo desde WAHA: ${response.status} ${details}`);
  }
  const buf = Buffer.from(await response.arrayBuffer());
  const effectiveMimeType =
    String(mimeType || '').trim() ||
    String(response.headers.get('content-type') || '').trim() ||
    'application/octet-stream';
  const created = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [parentFolderId],
      mimeType: effectiveMimeType || undefined
    },
    media: {
      mimeType: effectiveMimeType,
      body: Readable.from(buf)
    },
    fields: 'id, webViewLink, name, mimeType, size'
  });
  return created.data;
}

function uploadWaitReminder(ctx) {
  const groupName = String(ctx?.selectedGroup?.group_name || '').trim();
  if (groupName) return `Cuando quieras, adjunta el archivo y lo guardo en "${groupName}" 📎`;
  return `Cuando quieras, adjunta el archivo y seguimos con la subida 📎`;
}

async function noteUploadProcessing(sessionId, patch) {
  await setWspSessionGlobal(sessionId, {
    last_upload_processing_result: {
      ...(patch && typeof patch === 'object' ? patch : {}),
      ts: new Date().toISOString()
    }
  });
}

async function startUploadFileFlow({ session, chatId, text, sessionName, defaultTarget = 'root' }) {
  const textTrim = normalizeIncomingText(text);
  const groupMention = extractGroupMention(textTrim);
  let branchContext = { stage: 'wait_file', saveTarget: defaultTarget === 'group' ? 'group' : 'root' };

  if (groupMention) {
    const { data: user } = await supabase.from('users').select('email').eq('id', session.user_id).single();
    const groups = await listUserGroupsByEmail(user?.email);
    const picked = findGroupByName(groups, groupMention);
    if (picked) {
      branchContext = { stage: 'wait_file', saveTarget: 'group', selectedGroup: picked };
      const updated = await updateWspSession(session.id, { current_branch: 'subir_archivo', branch_context: branchContext });
      await wahaSendText(chatId, `Dale 🙌 Súbelo por aquí y lo guardo en "${picked.group_name}".`, sessionName, { skipRewrite: true });
      return updated;
    }
    if (groups.length) {
      const lines = groups.slice(0, 15).map((g, idx) => `${idx + 1}️⃣ 📁 ${g.group_name}`);
      const updated = await updateWspSession(session.id, {
        current_branch: 'subir_archivo',
        branch_context: { stage: 'choose_group_before_file', groups, saveTarget: 'group' }
      });
      await wahaSendText(chatId, `No pillé el grupo "${groupMention}" 😕\n\nElige uno y después subes el archivo:\n\n${lines.join('\n')}`, sessionName, {
        skipRewrite: true
      });
      return updated;
    }
  }

  const updated = await updateWspSession(session.id, { current_branch: 'subir_archivo', branch_context: branchContext });
  await wahaSendText(chatId, uploadWaitReminder(branchContext), sessionName, { skipRewrite: true });
  return updated;
}

async function downloadWahaMediaBuffer(url) {
  const headers = {
    ...(WAHA_API_KEY ? { 'X-Api-Key': WAHA_API_KEY } : {})
  };
  const response = await fetchWithTimeout(
    url,
    { headers },
    Number.isFinite(WAHA_MEDIA_TIMEOUT_MS) && WAHA_MEDIA_TIMEOUT_MS > 0 ? WAHA_MEDIA_TIMEOUT_MS : 12000
  );
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}

function escapeDriveQueryString(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, ' ')
    .trim();
}

async function listDriveFiles({ userId, folderId, kind, nameContains, pageSize }) {
  const drive = await getDriveClientForUser(userId);
  const qBase = `'${folderId}' in parents and trashed=false`;
  let q = qBase;
  if (kind === 'images') {
    q = `${qBase} and mimeType contains 'image/'`;
  } else if (kind === 'docs') {
    q = `${qBase} and mimeType != 'application/vnd.google-apps.folder' and not mimeType contains 'image/'`;
  }
  const nameQ = escapeDriveQueryString(nameContains);
  if (nameQ) {
    q = `${q} and name contains '${nameQ}'`;
  }
  const response = await drive.files.list({
    q,
    pageSize: Number.isFinite(pageSize) ? Math.max(1, Math.min(50, pageSize)) : 15,
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

function splitTextIntoChunks(text, maxChars = 2200, overlap = 200) {
  const s = String(text || '').replace(/\r/g, '').trim();
  if (!s) return [];
  const size = Math.max(400, Math.min(6000, Number(maxChars) || 2200));
  const ov = Math.max(0, Math.min(800, Number(overlap) || 200));

  const chunks = [];
  let start = 0;
  while (start < s.length) {
    const end = Math.min(s.length, start + size);
    const part = s.slice(start, end).trim();
    if (part) chunks.push(part);
    if (end >= s.length) break;
    start = Math.max(0, end - ov);
  }
  return chunks;
}

function normalizeExtractedText(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\u0000/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function getTextSignalStats(text) {
  const normalized = normalizeExtractedText(text);
  const visibleChars = normalized.replace(/\s/g, '').length;
  const alphaNumChars = (normalized.match(/[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ]/g) || []).length;
  const words = normalized.split(/\s+/).filter(Boolean).length;
  return { normalized, visibleChars, alphaNumChars, words };
}

function hasUsefulExtractedText(text, minVisibleChars = 20) {
  const stats = getTextSignalStats(text);
  return stats.visibleChars >= minVisibleChars && (stats.alphaNumChars >= 12 || stats.words >= 4);
}

function inferMimeTypeFromFileName(fileName) {
  const name = String(fileName || '').trim().toLowerCase();
  if (!name) return '';
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (name.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (name.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.csv') || name.endsWith('.json')) return 'text/plain';
  return '';
}

async function loadPdfJsLib() {
  try {
    return require('pdfjs-dist/legacy/build/pdf.js');
  } catch (_) {}
  try {
    return await import('pdfjs-dist/legacy/build/pdf.mjs');
  } catch (_) {}
  return null;
}

async function extractPdfTextWithGemini({ buffer, mimeType, fileName }) {
  if (!WAHA_VISION_ENABLED) return { text: '', skippedReason: 'vision_disabled' };
  if (!GEMINI_API_KEY) return { text: '', skippedReason: 'missing_gemini_api_key' };
  if (!buffer || !Buffer.isBuffer(buffer) || !buffer.length) return { text: '', skippedReason: 'missing_buffer' };
  const maxInlineBytes = 8 * 1024 * 1024;
  if (buffer.length > maxInlineBytes) return { text: '', skippedReason: 'pdf_too_large_for_inline_gemini' };
  const prompt = [
    {
      text:
        `Extrae el texto legible del documento PDF adjunto.\n` +
        `Devuelve solo texto plano, en espanol, sin markdown, sin explicaciones y conservando la estructura lo mejor posible.\n` +
        `Si una pagina no tiene texto util, omite el ruido.`
    },
    {
      inlineData: {
        data: buffer.toString('base64'),
        mimeType: String(mimeType || '').trim() || 'application/pdf'
      }
    },
    ...(fileName ? [{ text: `\nNombre del archivo: ${String(fileName).trim()}` }] : [])
  ];
  const text = await geminiGenerateText({
    modelName: GEMINI_VISION_MODEL,
    prompt,
    timeoutMs: Number.isFinite(WAHA_VISION_TIMEOUT_MS) && WAHA_VISION_TIMEOUT_MS > 0 ? WAHA_VISION_TIMEOUT_MS : 25000
  });
  return { text, skippedReason: text ? null : 'empty_gemini_response' };
}

async function extractPdfTextViaDriveImport({ userId, buffer, fileName }) {
  if (!userId || !buffer || !Buffer.isBuffer(buffer) || !buffer.length) {
    return { text: '', skippedReason: 'missing_params' };
  }
  const drive = await getDriveClientForUser(userId);
  const tempName = `[Brify OCR] ${String(fileName || 'Documento PDF').replace(/\.pdf$/i, '')}`.slice(0, 120);
  let tempFileId = null;

  try {
    const created = await drive.files.create({
      requestBody: {
        name: tempName,
        mimeType: 'application/vnd.google-apps.document'
      },
      media: {
        mimeType: 'application/pdf',
        body: Readable.from(buffer)
      },
      ocrLanguage: 'es',
      fields: 'id,name,mimeType'
    });

    tempFileId = created?.data?.id || null;
    if (!tempFileId) {
      return { text: '', skippedReason: 'drive_import_missing_file_id' };
    }

    const exported = await drive.files.export(
      {
        fileId: tempFileId,
        mimeType: 'text/plain'
      },
      { responseType: 'arraybuffer' }
    );
    const text = Buffer.from(exported.data).toString('utf8');
    return { text, skippedReason: text ? null : 'drive_export_empty' };
  } catch (error) {
    return { text: '', skippedReason: error?.message || 'drive_import_failed' };
  } finally {
    if (tempFileId) {
      try {
        await drive.files.delete({ fileId: tempFileId });
      } catch (_) {}
    }
  }
}

async function extractDriveFileTextAdvanced({ userId, fileId, mimeType, fileName }) {
  const drive = await getDriveClientForUser(userId);
  let resolvedName = String(fileName || '').trim();
  let mt = String(mimeType || '').trim().toLowerCase();

  if (!mt || mt === 'application/octet-stream') {
    try {
      const meta = await drive.files.get({ fileId, fields: 'id,name,mimeType,size' });
      if (!resolvedName) resolvedName = String(meta?.data?.name || '').trim();
      mt = String(meta?.data?.mimeType || mt || '').trim().toLowerCase();
    } catch (_) {}
  }

  if ((!mt || mt === 'application/octet-stream') && resolvedName) {
    mt = inferMimeTypeFromFileName(resolvedName);
  }

  if (mt === 'application/vnd.google-apps.document' || mt.startsWith('text/')) {
    const t = await getDriveFileText({ userId, fileId, mimeType: mt });
    const normalized = normalizeExtractedText(t);
    return normalized
      ? {
          text: normalized,
          extractor: mt === 'application/vnd.google-apps.document' ? 'drive_export_text' : 'drive_plain_text',
          mimeType: mt,
          textStats: getTextSignalStats(normalized),
          attempts: [
            {
              extractor: mt === 'application/vnd.google-apps.document' ? 'drive_export_text' : 'drive_plain_text',
              ok: true,
              text_chars: getTextSignalStats(normalized).visibleChars
            }
          ]
        }
      : null;
  }

  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
  const buf = Buffer.from(res.data);

  if (mt === 'application/pdf') {
    let out = '';
    const attempts = [];
    try {
      const pdfjsLib = await loadPdfJsLib();
      const getDocument = pdfjsLib?.getDocument || pdfjsLib?.default?.getDocument;
      if (!getDocument) {
        attempts.push({ extractor: 'pdfjs', ok: false, reason: 'pdfjs_module_not_available' });
      } else {
        const doc = await getDocument({ data: new Uint8Array(buf) }).promise;
      const pages = Math.min(doc.numPages || 0, 25);
        for (let i = 1; i <= pages; i++) {
          const page = await doc.getPage(i);
          const content = await page.getTextContent();
          const line = (content?.items || []).map((it) => it?.str || '').join(' ');
          out += `${line}\n`;
        }
      }
    } catch (error) {
      attempts.push({
        extractor: 'pdfjs',
        ok: false,
        reason: error?.message || 'pdfjs_error'
      });
    }

    const normalizedPdfText = normalizeExtractedText(out);
    const pdfStats = getTextSignalStats(normalizedPdfText);
    if (hasUsefulExtractedText(normalizedPdfText)) {
      attempts.push({ extractor: 'pdfjs', ok: true, text_chars: pdfStats.visibleChars });
      return {
        text: normalizedPdfText,
        extractor: 'pdfjs',
        mimeType: mt,
        textStats: pdfStats,
        attempts
      };
    }
    attempts.push({ extractor: 'pdfjs', ok: false, reason: 'no_useful_text', text_chars: pdfStats.visibleChars });

    const driveImportResult = await extractPdfTextViaDriveImport({ userId, buffer: buf, fileName: resolvedName });
    const driveImportText = normalizeExtractedText(driveImportResult?.text || '');
    const driveImportStats = getTextSignalStats(driveImportText);
    if (hasUsefulExtractedText(driveImportText)) {
      attempts.push({ extractor: 'drive_pdf_import_ocr', ok: true, text_chars: driveImportStats.visibleChars });
      return {
        text: driveImportText,
        extractor: 'drive_pdf_import_ocr',
        mimeType: mt,
        textStats: driveImportStats,
        attempts
      };
    }
    attempts.push({
      extractor: 'drive_pdf_import_ocr',
      ok: false,
      reason: driveImportResult?.skippedReason || 'no_useful_text',
      text_chars: driveImportStats.visibleChars
    });

    const geminiResult = await extractPdfTextWithGemini({ buffer: buf, mimeType: mt, fileName: resolvedName });
    const geminiPdfText = normalizeExtractedText(geminiResult?.text || '');
    const geminiStats = getTextSignalStats(geminiPdfText);
    if (hasUsefulExtractedText(geminiPdfText)) {
      attempts.push({ extractor: 'gemini_pdf_fallback', ok: true, text_chars: geminiStats.visibleChars });
      return {
        text: geminiPdfText,
        extractor: 'gemini_pdf_fallback',
        mimeType: mt,
        textStats: geminiStats,
        attempts
      };
    }
    attempts.push({
      extractor: 'gemini_pdf_fallback',
      ok: false,
      reason: geminiResult?.skippedReason || 'no_useful_text',
      text_chars: geminiStats.visibleChars
    });
    return {
      text: '',
      extractor: null,
      mimeType: mt,
      textStats: geminiStats,
      attempts
    };
  }

  if (mt === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer: buf });
    const value = normalizeExtractedText(typeof result?.value === 'string' ? result.value : '');
    return value
      ? {
          text: value,
          extractor: 'mammoth_raw_text',
          mimeType: mt,
        textStats: getTextSignalStats(value),
        attempts: [{ extractor: 'mammoth_raw_text', ok: true, text_chars: getTextSignalStats(value).visibleChars }]
        }
      : null;
  }

  if (mt === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || mt === 'application/vnd.ms-excel') {
    const XLSX = require('xlsx');
    const workbook = XLSX.read(buf, { type: 'buffer' });
    const sheetNames = workbook.SheetNames || [];
    const parts = [];
    for (const name of sheetNames.slice(0, 6)) {
      const ws = workbook.Sheets[name];
      if (!ws) continue;
      const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
      if (csv && csv.trim()) parts.push(`Hoja: ${name}\n${csv}`);
    }
    const joined = normalizeExtractedText(parts.join('\n\n'));
    return joined
      ? {
          text: joined,
          extractor: 'xlsx_to_csv',
          mimeType: mt,
        textStats: getTextSignalStats(joined),
        attempts: [{ extractor: 'xlsx_to_csv', ok: true, text_chars: getTextSignalStats(joined).visibleChars }]
        }
      : null;
  }

  return null;
}

async function upsertDocumentoAdministradorByFile({ userEmail, fileId, patch }) {
  if (!userEmail || !fileId) return null;
  const { data: existing } = await supabase
    .from('documentos_administrador')
    .select('id, metadata')
    .eq('administrador', userEmail)
    .eq('file_id', fileId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const prevMeta = existing?.metadata && typeof existing.metadata === 'object' ? existing.metadata : {};
  const nextPatch = { ...(patch || {}) };
  if (nextPatch.metadata && typeof nextPatch.metadata === 'object') {
    nextPatch.metadata = { ...prevMeta, ...nextPatch.metadata };
  }

  if (existing?.id) {
    const { data, error } = await supabase
      .from('documentos_administrador')
      .update({ ...nextPatch, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select('id')
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('documentos_administrador')
    .insert({
      file_id: fileId,
      administrador: userEmail,
      cliente: userEmail,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...nextPatch
    })
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

async function vectorizeDriveFileToSupabase({ userId, userEmail, fileId, fileName, mimeType, fileSize, phoneNumber, service = 'general', sourceAction = 'upload_file' }) {
  if (!WAHA_EMBEDDINGS_ENABLED) return { ok: false, reason: 'disabled' };
  if (!userId || !userEmail || !fileId) return { ok: false, reason: 'missing_params' };
  const wspPatch = documentWsspPatch(phoneNumber);

  await upsertDocumentoAdministradorByFile({
    userEmail,
    fileId,
    patch: {
      ...wspPatch,
      name: fileName || null,
      file_type: mimeType || null,
      file_size: Number.isFinite(Number(fileSize)) ? Number(fileSize) : null,
      servicio: service,
      pendiente: true,
      metadata: { source: 'waha', action: sourceAction, vector_status: 'pending' },
      nombre_limpio: String(fileName || '').toLowerCase().replace(/[^a-z0-9]/g, '_')
    }
  });

  let extracted = null;
  try {
    extracted = await extractDriveFileTextAdvanced({ userId, fileId, mimeType, fileName });
  } catch (_) {
    extracted = null;
  }

  const text = normalizeExtractedText(extracted?.text || '');
  const extractor = extracted?.extractor || null;
  const extractedChars = extracted?.textStats?.visibleChars || 0;
  const extractionAttempts = Array.isArray(extracted?.attempts) ? extracted.attempts.slice(0, 6) : null;

  if (!text) {
    await upsertDocumentoAdministradorByFile({
      userEmail,
      fileId,
      patch: {
        ...wspPatch,
        pendiente: true,
        metadata: {
          vector_status: 'pending_no_text',
          extraction_extractor: extractor,
          extraction_chars: extractedChars,
          extraction_mime_type: extracted?.mimeType || mimeType || null,
          extraction_attempts: extractionAttempts
        }
      }
    });
    return {
      ok: false,
      reason: 'no_text',
      extractor,
      text_chars: extractedChars,
      mime_type: extracted?.mimeType || mimeType || null,
      attempts: extractionAttempts
    };
  }

  const trimmed = text.length > 90000 ? text.slice(0, 90000) : text;
  const chunks = splitTextIntoChunks(trimmed, 2200, 200).slice(0, Number.isFinite(WAHA_EMBEDDINGS_MAX_CHUNKS) ? WAHA_EMBEDDINGS_MAX_CHUNKS : 24);
  if (!chunks.length) {
    await upsertDocumentoAdministradorByFile({
      userEmail,
      fileId,
      patch: {
        ...wspPatch,
        pendiente: true,
        metadata: {
          vector_status: 'pending_empty_text',
          extraction_extractor: extractor,
          extraction_chars: extractedChars,
          extraction_attempts: extractionAttempts
        }
      }
    });
    return { ok: false, reason: 'empty_text', extractor, text_chars: extractedChars, attempts: extractionAttempts };
  }

  const embeddingBuild = await buildEmbeddingsWithFallback(chunks, 'RETRIEVAL_DOCUMENT');
  const embeddings = embeddingBuild?.embeddings;
  const embeddingProvider = embeddingBuild?.provider || null;
  const embeddingModel = embeddingBuild?.model || null;
  const embeddingError = embeddingBuild?.error || null;
  if (!embeddings || embeddings.length !== chunks.length) {
    await upsertDocumentoAdministradorByFile({
      userEmail,
      fileId,
      patch: {
        ...wspPatch,
        pendiente: true,
        metadata: {
          vector_status: 'pending_embed_error',
          extraction_extractor: extractor,
          extraction_chars: extractedChars,
          chunk_count: chunks.length,
          extraction_attempts: extractionAttempts,
          embedding_provider: embeddingProvider,
          embedding_model: embeddingModel,
          embedding_error: embeddingError
        }
      }
    });
    return { ok: false, reason: 'embed_failed', extractor, text_chars: extractedChars, chunks: chunks.length, attempts: extractionAttempts, embedding_provider: embeddingProvider, embedding_model: embeddingModel, embedding_error: embeddingError };
  }

  try {
    await supabase.from('documentos_entrenador').delete().eq('entrenador', userEmail).eq('metadata->>file_id', fileId);
  } catch (_) {}

  const rows = chunks.map((c, idx) => ({
    content: c,
    embedding: serializeVectorForDb(embeddings[idx]),
    entrenador: userEmail,
    folder_id: null,
    metadata: {
      file_id: fileId,
      file_name: fileName || null,
      chunk_type: 'chunk',
      chunk_index: idx,
      chunk_of_total: chunks.length
    },
    created_at: new Date().toISOString()
  }));
  const { error: insertError } = await supabase.from('documentos_entrenador').insert(rows);
  if (insertError) {
    const chunkInsertError = summarizeSupabaseError(insertError, { stage: 'documentos_entrenador_insert' });
    const mainText = trimmed.slice(0, 12000);
    const mainEmbedding = serializeVectorForDb(embeddings[0]);
    await upsertDocumentoAdministradorByFile({
      userEmail,
      fileId,
      patch: {
        ...wspPatch,
        content: mainText,
        embedding: mainEmbedding,
        pendiente: false,
        metadata: {
          vector_status: 'ready_main_only',
          vectorized_at: new Date().toISOString(),
          extraction_extractor: extractor,
          extraction_chars: extractedChars,
          chunk_count: chunks.length,
          extraction_attempts: extractionAttempts,
          embedding_provider: embeddingProvider,
          embedding_model: embeddingModel,
          embedding_error: embeddingError,
          chunk_insert_error: chunkInsertError
        }
      }
    });
    return {
      ok: true,
      partial: true,
      reason: 'chunk_insert_failed_main_saved',
      extractor,
      text_chars: extractedChars,
      chunks: chunks.length,
      attempts: extractionAttempts,
      embedding_provider: embeddingProvider,
      embedding_model: embeddingModel,
      embedding_error: embeddingError,
      chunk_insert_error: chunkInsertError
    };
  }

  const mainText = trimmed.slice(0, 12000);
  const mainEmbedding = serializeVectorForDb(embeddings[0]);
  await upsertDocumentoAdministradorByFile({
    userEmail,
    fileId,
    patch: {
      ...wspPatch,
      content: mainText,
      embedding: mainEmbedding,
      pendiente: false,
      metadata: {
        vector_status: 'ready',
        vectorized_at: new Date().toISOString(),
        chunk_count: chunks.length,
        extraction_extractor: extractor,
        extraction_chars: extractedChars,
        extraction_attempts: extractionAttempts,
        embedding_provider: embeddingProvider,
        embedding_model: embeddingModel,
        embedding_error: embeddingError
      }
    }
  });

  return { ok: true, chunks: chunks.length, extractor, text_chars: extractedChars, attempts: extractionAttempts, embedding_provider: embeddingProvider, embedding_model: embeddingModel, embedding_error: embeddingError };
}

async function vectorizeTextToSupabaseForFile({ userEmail, fileId, fileName, mimeType, fileSize, text, source, phoneNumber }) {
  if (!userEmail || !fileId) return { ok: false, reason: 'missing_params' };
  const wspPatch = documentWsspPatch(phoneNumber);

  const contentText = String(text || '').trim();
  if (!contentText) {
    await upsertDocumentoAdministradorByFile({
      userEmail,
      fileId,
      patch: { ...wspPatch, pendiente: true, metadata: { vector_status: 'pending_no_text', source: source || 'text' } }
    });
    return { ok: false, reason: 'no_text' };
  }

  await upsertDocumentoAdministradorByFile({
    userEmail,
    fileId,
    patch: {
      ...wspPatch,
      name: fileName || null,
      file_type: mimeType || null,
      file_size: Number.isFinite(Number(fileSize)) ? Number(fileSize) : null,
      servicio: 'general',
      pendiente: true,
      metadata: { source: source || 'text', vector_status: 'pending' },
      nombre_limpio: String(fileName || '').toLowerCase().replace(/[^a-z0-9]/g, '_')
    }
  });

  if (!WAHA_EMBEDDINGS_ENABLED) {
    await upsertDocumentoAdministradorByFile({
      userEmail,
      fileId,
      patch: { ...wspPatch, content: contentText.slice(0, 12000), pendiente: true, metadata: { vector_status: 'pending_embed_disabled' } }
    });
    return { ok: false, reason: 'embed_disabled' };
  }

  const trimmed = contentText.length > 90000 ? contentText.slice(0, 90000) : contentText;
  const chunks = splitTextIntoChunks(trimmed, 2200, 200).slice(
    0,
    Number.isFinite(WAHA_EMBEDDINGS_MAX_CHUNKS) ? WAHA_EMBEDDINGS_MAX_CHUNKS : 24
  );
  if (!chunks.length) {
    await upsertDocumentoAdministradorByFile({
      userEmail,
      fileId,
      patch: { ...wspPatch, pendiente: true, metadata: { vector_status: 'pending_empty_text', source: source || 'text' } }
    });
    return { ok: false, reason: 'empty_text' };
  }

  const embeddingBuild = await buildEmbeddingsWithFallback(chunks, 'RETRIEVAL_DOCUMENT');
  const embeddings = embeddingBuild?.embeddings;
  const embeddingProvider = embeddingBuild?.provider || null;
  const embeddingModel = embeddingBuild?.model || null;
  const embeddingError = embeddingBuild?.error || null;
  if (!embeddings || embeddings.length !== chunks.length) {
    await upsertDocumentoAdministradorByFile({
      userEmail,
      fileId,
      patch: { ...wspPatch, pendiente: true, metadata: { vector_status: 'pending_embed_error', source: source || 'text', embedding_provider: embeddingProvider, embedding_model: embeddingModel, embedding_error: embeddingError } }
    });
    return { ok: false, reason: 'embed_failed', embedding_provider: embeddingProvider, embedding_model: embeddingModel, embedding_error: embeddingError };
  }

  try {
    await supabase.from('documentos_entrenador').delete().eq('entrenador', userEmail).eq('metadata->>file_id', fileId);
  } catch (_) {}

  const rows = chunks.map((c, idx) => ({
    content: c,
    embedding: serializeVectorForDb(embeddings[idx]),
    entrenador: userEmail,
    folder_id: null,
    metadata: {
      file_id: fileId,
      file_name: fileName || null,
      chunk_type: 'chunk',
      chunk_index: idx,
      chunk_of_total: chunks.length,
      source: source || 'text'
    },
    created_at: new Date().toISOString()
  }));

  const { error: insertError } = await supabase.from('documentos_entrenador').insert(rows);
  if (insertError) {
    const chunkInsertError = summarizeSupabaseError(insertError, { stage: 'documentos_entrenador_insert' });
    await upsertDocumentoAdministradorByFile({
      userEmail,
      fileId,
      patch: {
        ...wspPatch,
        content: trimmed.slice(0, 12000),
        embedding: serializeVectorForDb(embeddings[0]),
        pendiente: false,
        metadata: {
          vector_status: 'ready_main_only',
          vectorized_at: new Date().toISOString(),
          chunk_count: chunks.length,
          source: source || 'text',
          embedding_provider: embeddingProvider,
          embedding_model: embeddingModel,
          embedding_error: embeddingError,
          chunk_insert_error: chunkInsertError
        }
      }
    });
    return {
      ok: true,
      partial: true,
      reason: 'chunk_insert_failed_main_saved',
      chunks: chunks.length,
      embedding_provider: embeddingProvider,
      embedding_model: embeddingModel,
      embedding_error: embeddingError,
      chunk_insert_error: chunkInsertError
    };
  }

  await upsertDocumentoAdministradorByFile({
    userEmail,
    fileId,
    patch: {
      ...wspPatch,
      content: trimmed.slice(0, 12000),
      embedding: serializeVectorForDb(embeddings[0]),
      pendiente: false,
      metadata: { vector_status: 'ready', vectorized_at: new Date().toISOString(), chunk_count: chunks.length, source: source || 'text', embedding_provider: embeddingProvider, embedding_model: embeddingModel, embedding_error: embeddingError }
    }
  });

  return { ok: true, chunks: chunks.length, embedding_provider: embeddingProvider, embedding_model: embeddingModel, embedding_error: embeddingError };
}

async function handleCrearGrupo({ session, chatId, text, sessionName }) {
  const ctx = session.branch_context || {};
  const textTrim = normalizeIncomingText(text);
  const textLower = normalizeForIntent(textTrim);

  if (isMenuTrigger(textLower)) {
    await showMainMenu({ session, chatId, sessionName });
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
      await wahaSendText(chatId, `Dime el nombre del grupo 📁 (si quieres, escríbelo entre comillas).`, sessionName);
      return;
    }
    const extraEmails = parseEmails(textTrim);
    const prefilledEmails = Array.isArray(ctx.prefilled_emails) ? ctx.prefilled_emails : [];
    const mergedEmails = Array.from(new Set([...prefilledEmails, ...extraEmails]));
    await updateWspSession(session.id, {
      current_branch: 'crear_grupo',
      branch_context: { stage: 'confirm_details', group_name: name, prefilled_emails: mergedEmails, prompted: false }
    });
    await handleCrearGrupo({
      session: { ...session, branch_context: { stage: 'confirm_details', group_name: name, prefilled_emails: mergedEmails, prompted: false } },
      chatId,
      text: '',
      sessionName
    });
    return;
  }

  if (ctx.stage === 'confirm_name') {
    await updateWspSession(session.id, {
      current_branch: 'crear_grupo',
      branch_context: {
        stage: 'confirm_details',
        group_name: ctx.group_name || null,
        prefilled_emails: Array.isArray(ctx.prefilled_emails) ? ctx.prefilled_emails : [],
        prompted: false
      }
    });
    await handleCrearGrupo({
      session: {
        ...session,
        branch_context: {
          stage: 'confirm_details',
          group_name: ctx.group_name || null,
          prefilled_emails: Array.isArray(ctx.prefilled_emails) ? ctx.prefilled_emails : [],
          prompted: false
        }
      },
      chatId,
      text: '',
      sessionName
    });
    return;
  }

  if (ctx.stage === 'confirm_details') {
    const groupName = String(ctx.group_name || '').trim();
    const prefilledEmails = Array.isArray(ctx.prefilled_emails) ? ctx.prefilled_emails : [];

    if (!ctx.prompted) {
      const summary = formatCreateGroupSummary({ groupName, emails: prefilledEmails });
      await updateWspSession(session.id, {
        current_branch: 'crear_grupo',
        branch_context: { ...ctx, stage: 'confirm_details', group_name: groupName || null, prefilled_emails: prefilledEmails, prompted: true }
      });
      await wahaSendText(
        chatId,
        `${summary}\n\n¿Todo correcto? 🙌`,
        sessionName,
        { skipRewrite: true }
      );
      return;
    }

    let action = parseCreateGroupUserAction(textTrim);
    if (action.action === 'unknown') {
      const aiAction = await minimaxParseCreateGroupUserAction(textTrim);
      if (aiAction?.action && aiAction.action !== 'unknown') {
        action = {
          ...action,
          ...aiAction,
          emails: Array.from(new Set([...(action.emails || []), ...(aiAction.emails || [])]))
        };
      }
    }
    const mergedEmails = action.emails?.length ? Array.from(new Set([...prefilledEmails, ...action.emails])) : prefilledEmails;

    if (action.action === 'cancel') {
      await returnSessionToCasual(session.id);
      await wahaSendText(chatId, `Listo 🙌 ¿Qué necesitas ahora?`, sessionName, { skipRewrite: true });
      return;
    }

    if (action.action === 'no_share') {
      const nextCtx = { ...ctx, prefilled_emails: [], prompted: false };
      await updateWspSession(session.id, { current_branch: 'crear_grupo', branch_context: nextCtx });
      await handleCrearGrupo({ session: { ...session, branch_context: nextCtx }, chatId, text: '', sessionName });
      return;
    }

    if (action.action === 'add_emails') {
      const nextCtx = { ...ctx, prefilled_emails: mergedEmails, prompted: false };
      await updateWspSession(session.id, { current_branch: 'crear_grupo', branch_context: nextCtx });
      await handleCrearGrupo({ session: { ...session, branch_context: nextCtx }, chatId, text: '', sessionName });
      return;
    }

    if (action.action === 'edit_name') {
      const nextName = String(action.name || '').trim();
      if (!nextName || nextName.length < 2) {
        await wahaSendText(chatId, `Dime el nombre nuevo del grupo 📁`, sessionName, { skipRewrite: true });
        return;
      }
      const nextCtx = { ...ctx, group_name: nextName, prompted: false };
      await updateWspSession(session.id, { current_branch: 'crear_grupo', branch_context: nextCtx });
      await handleCrearGrupo({ session: { ...session, branch_context: nextCtx }, chatId, text: '', sessionName });
      return;
    }

    if (action.action !== 'confirm') {
      await wahaSendText(chatId, `¿Quieres que lo cree así o prefieres cambiar algo? 🙌`, sessionName, { skipRewrite: true });
      return;
    }

    const { data: user, error } = await supabase.from('users').select('email').eq('id', session.user_id).single();
    const userEmail = user?.email;
    if (error || !userEmail) {
      await returnSessionToCasual(session.id);
      await wahaSendText(chatId, `No pude obtener tu usuario 😕 Escribe "menú" para reiniciar.`, sessionName);
      return;
    }

    const rootFolderId = await resolveRootFolderIdForUser(userEmail, session.user_id, session.phone_number, { sessionId: session.id });
    if (!rootFolderId) {
      await returnSessionToCasual(session.id);
      await wahaSendText(chatId, `No encontré tu carpeta raíz de Brify 😕 Revisa tu configuración en ${BRIFY_PROFILE_URL}`, sessionName);
      return;
    }

    const finalGroupName = groupName || 'Grupo';
    const folder = await createDriveFolder({ userId: session.user_id, parentFolderId: rootFolderId, name: finalGroupName });

    try {
      const groupRecord = await upsertGrupoDriveRecord({
        ownerUserId: session.user_id,
        userEmail,
        folderId: folder.id,
        groupName: finalGroupName,
        extension: 'brify'
      });
      await setWspSessionGlobal(session.id, {
        last_group_record_result: {
          ok: true,
          group_name: finalGroupName,
          folder_id: folder.id,
          grupos_drive_id: groupRecord?.id || null,
          ts: new Date().toISOString()
        }
      });
    } catch (groupRecordError) {
      await setWspSessionGlobal(session.id, {
        last_group_record_result: {
          ok: false,
          group_name: finalGroupName,
          folder_id: folder.id,
          error: {
            message: groupRecordError?.message || 'unknown',
            code: groupRecordError?.code || null,
            details: groupRecordError?.details || null,
            hint: groupRecordError?.hint || null
          },
          ts: new Date().toISOString()
        }
      });
    }

    const role = process.env.WAHA_DRIVE_SHARE_ROLE || 'reader';
    if (mergedEmails.length) {
      try {
        await shareDriveFolder({
          userId: session.user_id,
          folderId: folder.id,
          emails: mergedEmails,
          role,
          ownerUserId: session.user_id,
          adminEmail: userEmail
        });
        await setWspSessionGlobal(session.id, {
          last_folder_share_result: {
            ok: true,
            folder_id: folder.id,
            group_name: finalGroupName,
            emails: mergedEmails,
            ts: new Date().toISOString()
          }
        });
        await returnSessionToCasual(session.id);
        await wahaSendText(chatId, `¡Listo! 🎉 Creé "${finalGroupName}" y lo compartí con: ${mergedEmails.join(', ')}\n\n¿Algo más?`, sessionName, { skipRewrite: true });
        return;
      } catch (shareError) {
        await setWspSessionGlobal(session.id, {
          last_folder_share_result: {
            ok: false,
            folder_id: folder.id,
            group_name: finalGroupName,
            emails: mergedEmails,
            error: {
              message: shareError?.message || 'unknown',
              code: shareError?.code || null,
              details: shareError?.details || null,
              hint: shareError?.hint || null
            },
            ts: new Date().toISOString()
          }
        });
        await updateWspSession(session.id, {
          current_branch: 'crear_grupo',
          branch_context: { stage: 'ask_share', folder_id: folder.id, group_name: finalGroupName }
        });
        await wahaSendText(
          chatId,
          `Creé "${finalGroupName}" ✅\n\nNo pude compartirlo todavía 😕\nPásame los correos (separados por coma) o escribe "no".`,
          sessionName,
          { skipRewrite: true }
        );
        return;
      }
    }

    await updateWspSession(session.id, {
      current_branch: 'crear_grupo',
      branch_context: { stage: 'ask_share', folder_id: folder.id, group_name: finalGroupName }
    });
    await wahaSendText(chatId, `¡Listo! 🎉 Creé "${finalGroupName}".\n\n¿Con quién lo compartimos?`, sessionName, { skipRewrite: true });
    return;
  }

  if (ctx.stage === 'ask_share') {
    const ok = normalizeYesNo(textTrim);
    if (ok === false) {
      await returnSessionToCasual(session.id);
      await wahaSendText(chatId, `Perfecto ✅ ¿Qué necesitas ahora?`, sessionName);
      return;
    }
    if (textLower.includes('despues') || textLower.includes('después') || textLower.includes('mas tarde') || textLower.includes('más tarde')) {
      await returnSessionToCasual(session.id);
      await wahaSendText(chatId, `Dale 🙌 Cuando quieras lo compartimos. ¿Qué más hacemos?`, sessionName);
      return;
    }

    const emails = parseEmails(textTrim);
    if (!emails.length) {
      await wahaSendText(chatId, `Pásame los correos (pueden ser varios) o dime "no".`, sessionName);
      return;
    }

    const role = process.env.WAHA_DRIVE_SHARE_ROLE || 'reader';
    try {
      await shareDriveFolder({
        userId: session.user_id,
        folderId: ctx.folder_id,
        emails,
        role,
        ownerUserId: session.user_id,
        adminEmail: userEmail
      });
      await setWspSessionGlobal(session.id, {
        last_folder_share_result: {
          ok: true,
          folder_id: ctx.folder_id,
          group_name: ctx.group_name || null,
          emails,
          ts: new Date().toISOString()
        }
      });
      await returnSessionToCasual(session.id);
      await wahaSendText(chatId, `¡Hecho! ✅ Compartí "${ctx.group_name}" con: ${emails.join(', ')}\n\n¿Algo más?`, sessionName);
    } catch (shareError) {
      await setWspSessionGlobal(session.id, {
        last_folder_share_result: {
          ok: false,
          folder_id: ctx.folder_id,
          group_name: ctx.group_name || null,
          emails,
          error: {
            message: shareError?.message || 'unknown',
            code: shareError?.code || null,
            details: shareError?.details || null,
            hint: shareError?.hint || null
          },
          ts: new Date().toISOString()
        }
      });
      await returnSessionToCasual(session.id);
      await wahaSendText(chatId, `Tuve un problema compartiendo el grupo 😕\n\n¿Quieres intentarlo de nuevo? Escribe "compartir grupo"`, sessionName);
    }
    return;
  }
}

async function handleCompartirGrupo({ session, chatId, text, sessionName }) {
  const ctx = session.branch_context || {};
  const textTrim = normalizeIncomingText(text);
  const textLower = normalizeForIntent(textTrim);

  if (isExplicitCreateGroupRequest(textTrim)) {
    await startCreateGroupFlow({ session, chatId, text: textTrim, sessionName });
    return;
  }

  if (isMenuTrigger(textLower)) {
    await showMainMenu({ session, chatId, sessionName });
    return;
  }

  const { data: user, error } = await supabase.from('users').select('email').eq('id', session.user_id).single();
  const userEmail = user?.email;
  if (error || !userEmail) {
    await returnSessionToCasual(session.id);
    await wahaSendText(chatId, `No pude obtener tu usuario 😕 Escribe "menú" para reiniciar.`, sessionName);
    return;
  }

  if (!ctx.stage || ctx.stage === 'start') {
    const groups = await listUserGroupsByEmail(userEmail);
    if (!groups.length) {
      await returnSessionToCasual(session.id);
      await wahaSendText(chatId, `Aún no tienes grupos creados 📭\n\n¿Te gustaría crear uno? Escribe "crear grupo"`, sessionName);
      return;
    }

    const picked = pickGroupFromInput(groups, textTrim);
    if (picked) {
      const prefilledEmails = Array.isArray(ctx.prefilled_emails) ? ctx.prefilled_emails : [];
      if (prefilledEmails.length) {
        const role = process.env.WAHA_DRIVE_SHARE_ROLE || 'reader';
        try {
          await shareDriveFolder({
            userId: session.user_id,
            folderId: picked.folder_id,
            emails: prefilledEmails,
            role,
            ownerUserId: session.user_id,
            adminEmail: userEmail
          });
          await setWspSessionGlobal(session.id, {
            last_folder_share_result: {
              ok: true,
              folder_id: picked.folder_id,
              group_name: picked.group_name,
              emails: prefilledEmails,
              ts: new Date().toISOString()
            }
          });
          await updateWspSession(session.id, { current_branch: null, branch_context: {} });
          await wahaSendText(
            chatId,
            `¡Hecho! ✅ Compartí "${picked.group_name}" con ${prefilledEmails.join(', ')}\n\n¿Necesitas algo más? Escribe "menú" 🙌`,
            sessionName
          );
        } catch (shareError) {
          await setWspSessionGlobal(session.id, {
            last_folder_share_result: {
              ok: false,
              folder_id: picked.folder_id,
              group_name: picked.group_name,
              emails: prefilledEmails,
              error: {
                message: shareError?.message || 'unknown',
                code: shareError?.code || null,
                details: shareError?.details || null,
                hint: shareError?.hint || null
              },
              ts: new Date().toISOString()
            }
          });
          await updateWspSession(session.id, { current_branch: null, branch_context: {} });
          await wahaSendText(chatId, `Tuve un problema compartiendo el grupo 😕\n\nVuelve a intentar escribiendo "compartir grupo".`, sessionName);
        }
        return;
      }

      await updateWspSession(session.id, {
        current_branch: 'compartir_grupo',
        branch_context: { stage: 'ask_emails', group: picked, prefilled_emails: prefilledEmails }
      });
      await wahaSendText(chatId, `¡Perfecto! 🤝 ¿Con qué correo(s) quieres compartir "${picked.group_name}"?\n\nPuedes escribir uno o varios separados por coma.`, sessionName);
      return;
    }

    const lines = groups.slice(0, 15).map((g, idx) => `${idx + 1}️⃣ 📁 ${g.group_name}`);
    await updateWspSession(session.id, {
      current_branch: 'compartir_grupo',
      branch_context: { stage: 'choose_group', groups, prefilled_emails: Array.isArray(ctx.prefilled_emails) ? ctx.prefilled_emails : [] }
    });
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
    const prefilledEmails = Array.isArray(ctx.prefilled_emails) ? ctx.prefilled_emails : [];
    if (prefilledEmails.length) {
      const role = process.env.WAHA_DRIVE_SHARE_ROLE || 'reader';
      try {
        await shareDriveFolder({
          userId: session.user_id,
          folderId: picked.folder_id,
          emails: prefilledEmails,
          role,
          ownerUserId: session.user_id,
          adminEmail: userEmail
        });
        await setWspSessionGlobal(session.id, {
          last_folder_share_result: {
            ok: true,
            folder_id: picked.folder_id,
            group_name: picked.group_name,
            emails: prefilledEmails,
            ts: new Date().toISOString()
          }
        });
        await updateWspSession(session.id, { current_branch: null, branch_context: {} });
        await wahaSendText(
          chatId,
          `¡Hecho! ✅ Compartí "${picked.group_name}" con ${prefilledEmails.join(', ')}\n\n¿Necesitas algo más? Escribe "menú" 🙌`,
          sessionName
        );
      } catch (shareError) {
        await setWspSessionGlobal(session.id, {
          last_folder_share_result: {
            ok: false,
            folder_id: picked.folder_id,
            group_name: picked.group_name,
            emails: prefilledEmails,
            error: {
              message: shareError?.message || 'unknown',
              code: shareError?.code || null,
              details: shareError?.details || null,
              hint: shareError?.hint || null
            },
            ts: new Date().toISOString()
          }
        });
        await updateWspSession(session.id, { current_branch: null, branch_context: {} });
        await wahaSendText(chatId, `Tuve un problema compartiendo el grupo 😕\n\nVuelve a intentar escribiendo "compartir grupo".`, sessionName);
      }
      return;
    }

    await updateWspSession(session.id, {
      current_branch: 'compartir_grupo',
      branch_context: { stage: 'ask_emails', group: picked, prefilled_emails: prefilledEmails }
    });
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
      await shareDriveFolder({
        userId: session.user_id,
        folderId: ctx.group?.folder_id,
        emails,
        role,
        ownerUserId: session.user_id,
        adminEmail: userEmail
      });
      await setWspSessionGlobal(session.id, {
        last_folder_share_result: {
          ok: true,
          folder_id: ctx.group?.folder_id || null,
          group_name: ctx.group?.group_name || null,
          emails,
          ts: new Date().toISOString()
        }
      });
      await updateWspSession(session.id, { current_branch: null, branch_context: {} });
      await wahaSendText(chatId, `¡Hecho! ✅ Compartiste "${ctx.group?.group_name}" con ${emails.join(', ')}\n\n¿Necesitas algo más? Escribe "menú" 🙌`, sessionName);
    } catch (shareError) {
      await setWspSessionGlobal(session.id, {
        last_folder_share_result: {
          ok: false,
          folder_id: ctx.group?.folder_id || null,
          group_name: ctx.group?.group_name || null,
          emails,
          error: {
            message: shareError?.message || 'unknown',
            code: shareError?.code || null,
            details: shareError?.details || null,
            hint: shareError?.hint || null
          },
          ts: new Date().toISOString()
        }
      });
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
    await showMainMenu({ session, chatId, sessionName });
    return;
  }

  if (!ctx.stage) {
    await startUploadFileFlow({ session, chatId, text: textTrim, sessionName });
    return;
  }

  if (ctx.stage === 'wait_file') {
    if (!media?.url) {
      const groupMention = extractGroupMention(textTrim);
      if (groupMention) {
        const { data: user } = await supabase.from('users').select('email').eq('id', session.user_id).single();
        const groups = await listUserGroupsByEmail(user?.email);
        const picked = findGroupByName(groups, groupMention);
        if (picked) {
          await updateWspSession(session.id, {
            current_branch: 'subir_archivo',
            branch_context: { ...ctx, saveTarget: 'group', selectedGroup: picked, stage: 'wait_file' }
          });
          await wahaSendText(chatId, `Perfecto 🙌 Lo dejo apuntado para "${picked.group_name}". Ahora súbelo por aquí 📎`, sessionName, {
            skipRewrite: true
          });
          return;
        }
      }
      if (textTrim) {
        await handleCasualConversation({ session, chatId, text: textTrim, sessionName });
        await wahaSendText(chatId, uploadWaitReminder(ctx), sessionName, { skipRewrite: true });
        return;
      }
      await wahaSendText(chatId, uploadWaitReminder(ctx), sessionName, { skipRewrite: true });
      return;
    }
    const pending = {
      url: normalizeMediaUrl(media.url),
      mimetype: media.mimetype,
      filename: media.filename
    };

    const groupMention = extractGroupMention(textTrim);
    if (groupMention) {
      const { data: user } = await supabase.from('users').select('email').eq('id', session.user_id).single();
      const groups = await listUserGroupsByEmail(user?.email);
      const picked = findGroupByName(groups, groupMention);
      if (picked) {
        const updated = await updateWspSession(session.id, {
          current_branch: 'subir_archivo',
          branch_context: { ...ctx, stage: 'save_now', saveTarget: 'group', selectedGroup: picked, pending }
        });
        await handleSubirArchivo({ session: updated, chatId, text, sessionName, payload });
        return;
      }
      if (groups.length) {
        const lines = groups.slice(0, 15).map((g, idx) => `${idx + 1}️⃣ 📁 ${g.group_name}`);
        await updateWspSession(session.id, { current_branch: 'subir_archivo', branch_context: { ...ctx, stage: 'choose_group', groups, pending, saveTarget: 'group' } });
        await wahaSendText(chatId, `No encontré el grupo "${groupMention}" 😕\n\nElige uno:\n\n${lines.join('\n')}\n\nEscribe el número o el nombre.`, sessionName);
        return;
      }
    }

    const updated = await updateWspSession(session.id, {
      current_branch: 'subir_archivo',
      branch_context: {
        ...ctx,
        stage: 'save_now',
        saveTarget: ctx.saveTarget === 'group' && ctx.selectedGroup?.folder_id ? 'group' : 'root',
        selectedGroup: ctx.saveTarget === 'group' ? ctx.selectedGroup || null : null,
        pending
      }
    });
    await handleSubirArchivo({ session: updated, chatId, text, sessionName, payload });
    return;
  }

  if (ctx.stage === 'choose_group_before_file') {
    const groups = Array.isArray(ctx.groups) ? ctx.groups : [];
    const picked = pickGroupFromInput(groups, textTrim);
    if (!picked) {
      if (textTrim) {
        await handleCasualConversation({ session, chatId, text: textTrim, sessionName });
        await wahaSendText(chatId, `Sigo atento. Cuando quieras, elige el grupo y después subes el archivo 📎`, sessionName, {
          skipRewrite: true
        });
        return;
      }
      await wahaSendText(chatId, `Elige un grupo válido 🙌 (número o nombre)`, sessionName);
      return;
    }
    await updateWspSession(session.id, {
      current_branch: 'subir_archivo',
      branch_context: { stage: 'wait_file', saveTarget: 'group', selectedGroup: picked }
    });
    await wahaSendText(chatId, `Buenísimo 🙌 Ahora sube el archivo y lo guardo en "${picked.group_name}".`, sessionName, {
      skipRewrite: true
    });
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
      if (textTrim) {
        await handleCasualConversation({ session, chatId, text: textTrim, sessionName });
        await wahaSendText(chatId, `Sigo atento para que me digas el grupo 📁`, sessionName, { skipRewrite: true });
        return;
      }
      await wahaSendText(chatId, `Elige un grupo válido 🙌 (número o nombre)`, sessionName);
      return;
    }
    const nextStage = ctx.pending?.url ? 'save_now' : 'wait_file';
    const updated = await updateWspSession(session.id, {
      current_branch: 'subir_archivo',
      branch_context: { ...ctx, stage: nextStage, saveTarget: 'group', selectedGroup: picked }
    });
    if (nextStage === 'wait_file') {
      await wahaSendText(chatId, `Perfecto 🙌 Ahora sube el archivo y lo guardo en "${picked.group_name}".`, sessionName, {
        skipRewrite: true
      });
      return;
    }
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
      parentFolderId = await resolveRootFolderIdForUser(user.email, session.user_id, session.phone_number, { sessionId: session.id });
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
      const folderName = ctx.saveTarget === 'group' ? String(ctx.selectedGroup?.group_name || '').trim() || 'Grupo' : 'Carpeta raíz';
      await setWspSessionGlobal(session.id, {
        last_upload_file_result: {
          ok: true,
          file_name: file.name,
          file_id: file.id,
          mime_type: file.mimeType || pending.mimetype || null,
          folder_id: parentFolderId,
          folder_name: folderName,
          ts: new Date().toISOString()
        }
      });
      try {
        await upsertDocumentoAdministradorByFile({
          userEmail: user.email,
          fileId: file.id,
          patch: {
            ...documentWsspPatch(session.phone_number),
            name: file.name,
            file_type: file.mimeType || pending.mimetype || null,
            file_size: Number.isFinite(Number(file.size)) ? Number(file.size) : null,
            servicio: 'general',
            pendiente: true,
            carpeta_actual: parentFolderId,
            nombre_carpeta_actual: folderName,
            metadata: { source: 'waha', action: 'upload_file', vector_status: 'uploaded' },
            nombre_limpio: String(file.name || '').toLowerCase().replace(/[^a-z0-9]/g, '_')
          }
        });
        await noteUploadProcessing(session.id, {
          ok: true,
          step: 'insert_base_record',
          file_id: file.id
        });
      } catch (recordError) {
        await noteUploadProcessing(session.id, {
          ok: false,
          step: 'insert_base_record',
          file_id: file.id,
          error: {
            message: recordError?.message || 'unknown'
          }
        });
      }
      const afterUploadAction = ctx.after_upload_action && typeof ctx.after_upload_action === 'object' ? ctx.after_upload_action : null;
      if (afterUploadAction?.type === 'analyze_document') {
        const casualSession = await returnSessionToCasual(session.id);
        const locationLine = ctx.saveTarget === 'group' ? ` en "${folderName}"` : '';
        await wahaSendText(
          chatId,
          `✅ Listo. Guardé "${file.name}"${locationLine}.\n${file.webViewLink}\n\n🧐 Estamos analizando tu documento para darte una respuesta completa.`,
          sessionName,
          { skipRewrite: true }
        );
        await wahaSendText(chatId, `⏳ Dentro de poco tendré tu respuesta.`, sessionName, { skipRewrite: true });
        await analyzeDocumentFileAndReply({
          session: casualSession || session,
          chatId,
          sessionName,
          question: afterUploadAction.question || `Analiza ${file.name}`,
          file: {
            id: file.id,
            name: file.name,
            mimeType: file.mimeType || pending.mimetype || null,
            webViewLink: file.webViewLink || null
          }
        });
      } else if (ctx.saveTarget === 'group') {
        await returnSessionToCasual(session.id);
        await wahaSendText(
          chatId,
          `✅ Listo. Guardé "${file.name}" en "${folderName}".\n${file.webViewLink}\n\n¿Algo más?`,
          sessionName,
          { skipRewrite: true }
        );
      } else {
        await updateWspSession(session.id, {
          current_branch: 'subir_archivo',
          branch_context: {
            stage: 'offer_move',
            uploaded_file: {
              file_id: file.id,
              file_name: file.name,
              mime_type: file.mimeType || pending.mimetype || null,
              folder_id: parentFolderId,
              folder_name: folderName,
              webViewLink: file.webViewLink || null
            }
          }
        });
        await wahaSendText(
          chatId,
          `✅ Listo. Guardé "${file.name}".\n${file.webViewLink}\n\nSi quieres, también lo puedo mover a uno de tus grupos 🙌`,
          sessionName,
          { skipRewrite: true }
        );
      }

      const mt = String(file.mimeType || pending.mimetype || '').trim();
      const canVectorizeNow = isImmediateVectorizableMime(mt);

      if (!WAHA_EMBEDDINGS_ENABLED) {
        await noteUploadProcessing(session.id, {
          ok: false,
          step: 'vectorize',
          file_id: file.id,
          reason: 'embed_disabled'
        });
        return;
      }

      if (mt.startsWith('image/')) {
        try {
          const buf = await downloadWahaMediaBuffer(pending.url);
          const analysis = buf
            ? await geminiAnalyzeImage({
                imageBuffer: buf,
                mimeType: mt,
                userMessage: ''
              })
            : '';

          if (analysis) {
            await vectorizeTextToSupabaseForFile({
              userEmail: user.email,
              fileId: file.id,
              fileName: file.name,
              mimeType: mt || null,
              fileSize: file.size || null,
              text: analysis,
              source: 'waha_image_analysis',
              phoneNumber: session.phone_number
            });
            await noteUploadProcessing(session.id, {
              ok: true,
              step: 'vectorize_image',
              file_id: file.id
            });

            await wahaSendText(chatId, `🖼️ Análisis de la imagen:\n\n${sanitizeWhatsAppText(analysis)}`, sessionName, {
              skipRewrite: true
            });
          } else {
            await upsertDocumentoAdministradorByFile({
              userEmail: user.email,
              fileId: file.id,
              patch: {
                name: file.name,
                file_type: mt || null,
                file_size: file.size || null,
                ...documentWsspPatch(session.phone_number),
                servicio: 'general',
                pendiente: true,
                metadata: { source: 'waha', action: 'upload_file', vector_status: 'pending_image_analysis_failed' },
                nombre_limpio: String(file.name || '').toLowerCase().replace(/[^a-z0-9]/g, '_')
              }
            });
            await noteUploadProcessing(session.id, {
              ok: false,
              step: 'vectorize_image',
              file_id: file.id,
              reason: 'pending_image_analysis_failed'
            });
          }
        } catch (imageError) {
          await noteUploadProcessing(session.id, {
            ok: false,
            step: 'vectorize_image',
            file_id: file.id,
            error: { message: imageError?.message || 'unknown' }
          });
          try {
            await upsertDocumentoAdministradorByFile({
              userEmail: user.email,
              fileId: file.id,
              patch: {
                name: file.name,
                file_type: mt || null,
                file_size: file.size || null,
                ...documentWsspPatch(session.phone_number),
                servicio: 'general',
                pendiente: true,
                metadata: { source: 'waha', action: 'upload_file', vector_status: 'pending_image_analysis_error' },
                nombre_limpio: String(file.name || '').toLowerCase().replace(/[^a-z0-9]/g, '_')
              }
            });
          } catch (_) {}
        }
        return;
      }

      if (!canVectorizeNow) {
        try {
          await upsertDocumentoAdministradorByFile({
            userEmail: user.email,
            fileId: file.id,
            patch: {
              name: file.name,
              file_type: mt || null,
              file_size: file.size || null,
              ...documentWsspPatch(session.phone_number),
              servicio: 'general',
              pendiente: true,
              metadata: { source: 'waha', action: 'upload_file', vector_status: 'pending_deferred' },
              nombre_limpio: String(file.name || '').toLowerCase().replace(/[^a-z0-9]/g, '_')
            }
          });
          await noteUploadProcessing(session.id, {
            ok: false,
            step: 'vectorize',
            file_id: file.id,
            reason: 'pending_deferred'
          });
        } catch (_) {}
        return;
      }

      try {
        const vectorized = await vectorizeDriveFileToSupabase({
          userId: session.user_id,
          userEmail: user.email,
          fileId: file.id,
          fileName: file.name,
          mimeType: mt || null,
          fileSize: file.size || null,
          phoneNumber: session.phone_number
        });
        await noteUploadProcessing(session.id, {
          ok: Boolean(vectorized?.ok),
          step: 'vectorize',
          file_id: file.id,
          reason: vectorized?.reason || null,
          partial: Boolean(vectorized?.partial),
          chunks: vectorized?.chunks || null,
          extractor: vectorized?.extractor || null,
          text_chars: Number.isFinite(Number(vectorized?.text_chars)) ? Number(vectorized.text_chars) : null,
          mime_type: vectorized?.mime_type || mt || null,
          extraction_attempts: Array.isArray(vectorized?.attempts) ? vectorized.attempts.slice(0, 6) : null,
          embedding_provider: vectorized?.embedding_provider || null,
          embedding_model: vectorized?.embedding_model || null,
          embedding_error: vectorized?.embedding_error || null,
          chunk_insert_error: vectorized?.chunk_insert_error || null
        });
      } catch (vectorError) {
        await noteUploadProcessing(session.id, {
          ok: false,
          step: 'vectorize',
          file_id: file.id,
          error: { message: vectorError?.message || 'unknown' }
        });
      }
    } catch (error) {
      await setWspSessionGlobal(session.id, {
        last_upload_file_result: {
          ok: false,
          file_name: fileName,
          mime_type: pending.mimetype || null,
          source_url: pending.url || null,
          folder_id: parentFolderId || null,
          error: {
            message: error?.message || 'unknown',
            stack: String(error?.stack || '').split('\n').slice(0, 4)
          },
          ts: new Date().toISOString()
        }
      });
      await updateWspSession(session.id, { current_branch: null, branch_context: {} });
      await wahaSendText(chatId, `Tuve un problema subiendo el archivo 😕\n\nIntenta de nuevo enviándolo otra vez 📎`, sessionName);
    }
    return;
  }

  if (ctx.stage === 'offer_move') {
    const uploadedFile = ctx.uploaded_file || {};
    const yn = normalizeYesNo(textTrim);
    const { data: user } = await supabase.from('users').select('email').eq('id', session.user_id).single();
    const groups = await listUserGroupsByEmail(user?.email);
    const groupMention = extractGroupMention(textTrim);
    const picked = findGroupMentionInText(groups, textTrim) || (groupMention ? findGroupByName(groups, groupMention) : null);
    const continuationAfterKeep = extractContinuationAfterKeepInPlace(textTrim);

    if (yn === false || textLower.includes('dejalo ahi') || textLower.includes('déjalo ahi') || textLower.includes('asi esta') || textLower.includes('así está')) {
      const casualSession = await returnSessionToCasual(session.id);
      if (continuationAfterKeep) {
        await wahaSendText(chatId, `Perfecto 🙌 Lo dejo donde está.`, sessionName, { skipRewrite: true });
        await continueWithFreshIntent({ session: casualSession || session, chatId, text: continuationAfterKeep, sessionName });
        return;
      }
      await wahaSendText(chatId, `Perfecto 🙌 Lo dejo donde está. ¿Qué necesitas ahora?`, sessionName, { skipRewrite: true });
      return;
    }

    if (picked) {
      const followUpAfterMove = extractContinuationAfterGroupReference(textTrim, picked.group_name);
      const updated = await updateWspSession(session.id, {
        current_branch: 'subir_archivo',
        branch_context: { ...ctx, stage: 'move_now', selectedGroup: picked, follow_up_after_move: followUpAfterMove || null }
      });
      await handleSubirArchivo({ session: updated, chatId, text: textTrim, sessionName, payload });
      return;
    }

    if (groupMention && !picked) {
      await updateWspSession(session.id, {
        current_branch: 'subir_archivo',
        branch_context: { ...ctx, stage: 'resolve_missing_move_group', groups, missing_group_name: groupMention }
      });
      await wahaSendText(
        chatId,
        `No encontré el grupo "${groupMention}" 😕\n\nSi quieres, lo creo y muevo el archivo ahí. Si no, dime el grupo correcto.`,
        sessionName,
        { skipRewrite: true }
      );
      return;
    }

    if (yn === true || textLower.includes('mueve') || textLower.includes('pasalo') || textLower.includes('pásalo') || textLower.includes('mandalo al grupo') || textLower.includes('mándalo al grupo')) {
      if (!groups.length) {
        await returnSessionToCasual(session.id);
        await wahaSendText(chatId, `No encontré grupos creados 📭 Entonces lo dejo en la carpeta raíz.`, sessionName, { skipRewrite: true });
        return;
      }
      const lines = groups.slice(0, 15).map((g, idx) => `${idx + 1}️⃣ 📁 ${g.group_name}`);
      await updateWspSession(session.id, {
        current_branch: 'subir_archivo',
        branch_context: { ...ctx, stage: 'choose_move_group', groups }
      });
      await wahaSendText(chatId, `¿A cuál grupo lo movemos? 📁\n\n${lines.join('\n')}`, sessionName, { skipRewrite: true });
      return;
    }

    if (textTrim) {
      const casualSession = await returnSessionToCasual(session.id);
      await wahaSendText(chatId, `Perfecto 🙌 Lo dejo donde está.`, sessionName, { skipRewrite: true });
      await continueWithFreshIntent({ session: casualSession || session, chatId, text: textTrim, sessionName });
      return;
    }
    await wahaSendText(chatId, `Si quieres, puedo mover "${uploadedFile.file_name || 'el archivo'}" a uno de tus grupos 🙌`, sessionName, {
      skipRewrite: true
    });
    return;
  }

  if (ctx.stage === 'choose_move_group') {
    const groups = Array.isArray(ctx.groups) ? ctx.groups : [];
    const yn = normalizeYesNo(textTrim);
    const picked = pickGroupFromInput(groups, textTrim) || findGroupMentionInText(groups, textTrim);
    const groupMention = extractGroupMention(textTrim);
    const continuationAfterKeep = extractContinuationAfterKeepInPlace(textTrim);
    if (yn === false || textLower.includes('dejalo ahi') || textLower.includes('déjalo ahi') || textLower.includes('asi esta') || textLower.includes('así está')) {
      const casualSession = await returnSessionToCasual(session.id);
      if (continuationAfterKeep) {
        await wahaSendText(chatId, `Perfecto 🙌 Lo dejo donde está.`, sessionName, { skipRewrite: true });
        await continueWithFreshIntent({ session: casualSession || session, chatId, text: continuationAfterKeep, sessionName });
        return;
      }
      await wahaSendText(chatId, `Perfecto 🙌 Lo dejo donde está. ¿Qué necesitas ahora?`, sessionName, { skipRewrite: true });
      return;
    }
    if (!picked) {
      if (groupMention) {
        await updateWspSession(session.id, {
          current_branch: 'subir_archivo',
          branch_context: { ...ctx, stage: 'resolve_missing_move_group', missing_group_name: groupMention }
        });
        await wahaSendText(
          chatId,
          `No encontré el grupo "${groupMention}" 😕\n\nSi quieres, lo creo y muevo el archivo ahí. Si no, dime el grupo correcto.`,
          sessionName,
          { skipRewrite: true }
        );
        return;
      }
      if (textTrim) {
        const casualSession = await returnSessionToCasual(session.id);
        await wahaSendText(chatId, `Perfecto 🙌 Lo dejo donde está.`, sessionName, { skipRewrite: true });
        await continueWithFreshIntent({ session: casualSession || session, chatId, text: textTrim, sessionName });
        return;
      }
      await wahaSendText(chatId, `Elige un grupo válido 🙌 (número o nombre)`, sessionName);
      return;
    }
    const followUpAfterMove = extractContinuationAfterGroupReference(textTrim, picked.group_name);
    const updated = await updateWspSession(session.id, {
      current_branch: 'subir_archivo',
      branch_context: { ...ctx, stage: 'move_now', selectedGroup: picked, follow_up_after_move: followUpAfterMove || null }
    });
    await handleSubirArchivo({ session: updated, chatId, text: textTrim, sessionName, payload });
    return;
  }

  if (ctx.stage === 'resolve_missing_move_group') {
    const missingGroupName = String(ctx.missing_group_name || '').trim();
    const { data: user } = await supabase.from('users').select('email').eq('id', session.user_id).single();
    const groups = Array.isArray(ctx.groups) && ctx.groups.length ? ctx.groups : await listUserGroupsByEmail(user?.email);
    const yn = normalizeYesNo(textTrim);
    const picked = pickGroupFromInput(groups, textTrim) || findGroupMentionInText(groups, textTrim);
    const continuationAfterKeep = extractContinuationAfterKeepInPlace(textTrim);
    const wantsCreate =
      yn === true ||
      textLower.includes('crea') ||
      textLower.includes('crear') ||
      textLower.includes('crealo') ||
      textLower.includes('créalo') ||
      textLower.includes('crea ese grupo') ||
      textLower.includes('crea el grupo');

    if (yn === false || textLower.includes('dejalo ahi') || textLower.includes('déjalo ahi') || textLower.includes('asi esta') || textLower.includes('así está')) {
      const casualSession = await returnSessionToCasual(session.id);
      if (continuationAfterKeep) {
        await wahaSendText(chatId, `Perfecto 🙌 Lo dejo donde está.`, sessionName, { skipRewrite: true });
        await continueWithFreshIntent({ session: casualSession || session, chatId, text: continuationAfterKeep, sessionName });
        return;
      }
      await wahaSendText(chatId, `Perfecto 🙌 Lo dejo donde está. ¿Qué necesitas ahora?`, sessionName, { skipRewrite: true });
      return;
    }

    if (picked) {
      const followUpAfterMove = extractContinuationAfterGroupReference(textTrim, picked.group_name);
      const updated = await updateWspSession(session.id, {
        current_branch: 'subir_archivo',
        branch_context: { ...ctx, stage: 'move_now', groups, selectedGroup: picked, follow_up_after_move: followUpAfterMove || null }
      });
      await handleSubirArchivo({ session: updated, chatId, text: textTrim, sessionName, payload });
      return;
    }

    if (wantsCreate && missingGroupName) {
      try {
        if (!user?.email) throw new Error('No pude obtener el correo del usuario');
        const createdGroup = await createRegisteredGroupForUser({
          session,
          userEmail: user.email,
          groupName: missingGroupName
        });
        const updated = await updateWspSession(session.id, {
          current_branch: 'subir_archivo',
          branch_context: { ...ctx, stage: 'move_now', groups: [], selectedGroup: createdGroup, follow_up_after_move: null }
        });
        await wahaSendText(chatId, `Perfecto 🙌 Creé "${createdGroup.group_name}". Ahora muevo el archivo ahí.`, sessionName, {
          skipRewrite: true
        });
        await handleSubirArchivo({ session: updated, chatId, text: textTrim, sessionName, payload });
        return;
      } catch (createError) {
        await returnSessionToCasual(session.id);
        await wahaSendText(chatId, `No pude crear "${missingGroupName}" 😕\n\nSi quieres, dime el grupo correcto o lo intentamos de nuevo.`, sessionName, {
          skipRewrite: true
        });
        return;
      }
    }

    if (textTrim) {
      await wahaSendText(
        chatId,
        `Puedo hacer dos cosas con "${missingGroupName || 'ese grupo'}":\n\n1️⃣ Crearlo y mover el archivo ahí\n2️⃣ Moverlo a un grupo existente\n\nDime "créalo" o escribe el grupo correcto 🙌`,
        sessionName,
        { skipRewrite: true }
      );
      return;
    }

    await wahaSendText(chatId, `Dime si quieres que cree "${missingGroupName || 'ese grupo'}" o escribe el grupo correcto 🙌`, sessionName, {
      skipRewrite: true
    });
    return;
  }

  if (ctx.stage === 'move_now') {
    const uploadedFile = ctx.uploaded_file || {};
    const targetGroup = ctx.selectedGroup;
    const { data: user } = await supabase.from('users').select('email').eq('id', session.user_id).single();
    if (!uploadedFile.file_id || !targetGroup?.folder_id || !user?.email) {
      await returnSessionToCasual(session.id);
      await wahaSendText(chatId, `Perdí el dato del archivo o del grupo 😕 Intentémoslo otra vez cuando quieras.`, sessionName, { skipRewrite: true });
      return;
    }
    try {
      const moved = await moveDriveFileToFolder({
        userId: session.user_id,
        fileId: uploadedFile.file_id,
        targetFolderId: targetGroup.folder_id
      });
      await upsertDocumentoAdministradorByFile({
        userEmail: user.email,
        fileId: uploadedFile.file_id,
        patch: {
          ...documentWsspPatch(session.phone_number),
          carpeta_actual: targetGroup.folder_id,
          nombre_carpeta_actual: targetGroup.group_name,
          metadata: {
            source: 'waha',
            action: 'upload_file',
            moved_to_group_at: new Date().toISOString()
          }
        }
      });
      try {
        await supabase
          .from('documentos_entrenador')
          .update({ folder_id: targetGroup.folder_id })
          .eq('entrenador', user.email)
          .eq('metadata->>file_id', uploadedFile.file_id);
      } catch (_) {}
      await noteUploadProcessing(session.id, {
        ok: true,
        step: 'move',
        file_id: uploadedFile.file_id,
        folder_id: targetGroup.folder_id
      });
      const casualSession = await returnSessionToCasual(session.id);
      const followUpAfterMove = cleanContinuationText(ctx.follow_up_after_move || extractContinuationAfterGroupReference(textTrim, targetGroup.group_name));
      await wahaSendText(
        chatId,
        `✅ Listo. Moví "${moved.name || uploadedFile.file_name || 'el archivo'}" a "${targetGroup.group_name}".\n${moved.webViewLink || uploadedFile.webViewLink || ''}`.trim(),
        sessionName,
        { skipRewrite: true }
      );
      if (followUpAfterMove) {
        await continueWithFreshIntent({ session: casualSession || session, chatId, text: followUpAfterMove, sessionName });
      }
    } catch (moveError) {
      await noteUploadProcessing(session.id, {
        ok: false,
        step: 'move',
        file_id: uploadedFile.file_id,
        error: { message: moveError?.message || 'unknown' }
      });
      await returnSessionToCasual(session.id);
      await wahaSendText(chatId, `Tuve un problema moviendo el archivo 😕 Inténtalo de nuevo cuando quieras.`, sessionName, {
        skipRewrite: true
      });
    }
    return;
  }
}

async function handleListarArchivos({ session, chatId, text, sessionName }) {
  const ctx = session.branch_context || {};
  const textTrim = normalizeIncomingText(text);
  const textLower = normalizeForIntent(textTrim);

  if (isMenuTrigger(textLower)) {
    await showMainMenu({ session, chatId, sessionName });
    return;
  }

  if (ctx.stage === 'list_now') {
    const { data: user, error } = await supabase.from('users').select('email').eq('id', session.user_id).single();
    if (error || !user?.email) {
      await updateWspSession(session.id, { current_branch: null, branch_context: {} });
      await wahaSendText(chatId, `No pude obtener tu usuario 😕 Escribe "menú" para reiniciar.`, sessionName);
      return;
    }

    let folderId = null;
    if (ctx.saveTarget === 'group' && ctx.selectedGroup?.folder_id) folderId = ctx.selectedGroup.folder_id;
    else folderId = await resolveRootFolderIdForUser(user.email, session.user_id, session.phone_number, { sessionId: session.id });

    if (!folderId) {
      await updateWspSession(session.id, { current_branch: null, branch_context: {} });
      await wahaSendText(chatId, `No encontré tu carpeta raíz de Brify 😕 Revisa tu configuración en ${BRIFY_PROFILE_URL}`, sessionName);
      return;
    }

    const q = String(ctx.query || '').trim();
    const kind = ctx.kind === 'docs' || ctx.kind === 'images' ? ctx.kind : null;
    const files = await listDriveFiles({ userId: session.user_id, folderId, kind, nameContains: q, pageSize: 15 });
    if (!files.length) {
      await updateWspSession(session.id, { current_branch: null, branch_context: {} });
      await wahaSendText(chatId, `No encontré archivos${q ? ` que coincidan con "${q}"` : ''} 📭\n\n¿Quieres intentar con otra palabra?`, sessionName);
      return;
    }

    const folderLabel = ctx.saveTarget === 'group' ? String(ctx.selectedGroup?.group_name || '').trim() || 'Grupo' : 'Carpeta raíz';
    const listedFiles = files.slice(0, 12);
    const lines = listedFiles.map((f, idx) => {
      const label = f.mimeType?.startsWith('image/') ? 'Img' : 'Doc';
      return `${idx + 1}️⃣ ${label}: ${f.name} - Carpeta: ${folderLabel}`;
    });

    await updateWspSession(session.id, {
      current_branch: 'listar_archivos',
      branch_context: {
        stage: 'pick_file',
        files: listedFiles,
        folder_label: folderLabel
      }
    });
    await wahaSendText(
      chatId,
      `Encontré esto${q ? ` para "${q}"` : ''} 👇\n\n${lines.join('\n\n')}\n\nSi quieres el link de alguno, escribe su número.`,
      sessionName
    );
    return;
  }

  if (!ctx.stage) {
    const q = extractNameContainsQuery(textTrim);
    if (q) {
      const updated = await updateWspSession(session.id, {
        current_branch: 'listar_archivos',
        branch_context: { stage: 'list_now', saveTarget: 'root', query: q }
      });
      await handleListarArchivos({ session: updated, chatId, text, sessionName });
      return;
    }

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
      folderId = await resolveRootFolderIdForUser(user.email, session.user_id, session.phone_number, { sessionId: session.id });
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
    const folderLabel = ctx.saveTarget === 'group' ? String(ctx.selectedGroup?.group_name || '').trim() || 'Grupo' : 'Carpeta raíz';
    const listedFiles = files.slice(0, 12);
    const lines = listedFiles.map((f, idx) => {
      const label = f.mimeType?.startsWith('image/') ? 'Img' : 'Doc';
      return `${idx + 1}️⃣ ${label}: ${f.name} - Carpeta: ${folderLabel}`;
    });
    await updateWspSession(session.id, {
      current_branch: 'listar_archivos',
      branch_context: { stage: 'pick_file', files: listedFiles, folder_label: folderLabel }
    });
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
    const folderLabel = String(ctx.folder_label || '').trim() || 'Carpeta raíz';
    await wahaSendText(
      chatId,
      `🔗 Doc: ${picked.name}\n📁 Carpeta: ${folderLabel}\n${picked.webViewLink || 'Link no disponible'}\n\n¿Quieres ver otro? Escribe "listar documentos" o "menú" 🙌`,
      sessionName
    );
    return;
  }
}

async function handleListarGrupos({ session, chatId, text, sessionName }) {
  const textLower = normalizeForIntent(text);
  if (isMenuTrigger(textLower)) {
    await showMainMenu({ session, chatId, sessionName });
    return;
  }

  const { data: user, error } = await supabase.from('users').select('email').eq('id', session.user_id).single();
  if (error || !user?.email) {
    await updateWspSession(session.id, { current_branch: null, branch_context: {} });
    await wahaSendText(chatId, `No pude obtener tu usuario 😕 Escribe "menú" para reiniciar.`, sessionName);
    return;
  }

  const groups = await listUserGroupsByEmail(user.email);
  if (!groups.length) {
    await updateWspSession(session.id, { current_branch: null, branch_context: {} });
    await wahaSendText(chatId, `Aún no tienes grupos creados 📭\n\nSi quieres, puedo crear uno.`, sessionName);
    return;
  }

  const lines = groups.slice(0, 20).map((g, idx) => `${idx + 1}️⃣ Grupo: ${g.group_name}`);
  await updateWspSession(session.id, { current_branch: null, branch_context: {} });
  await wahaSendText(chatId, `Estos son tus grupos disponibles 📂\n\n${lines.join('\n')}\n\nSi quieres trabajar con uno, dime su nombre.`, sessionName);
}

async function handleAnalizarDocumento({ session, chatId, text, sessionName, payload }) {
  const ctx = session.branch_context || {};
  const textTrim = normalizeIncomingText(text);
  const textLower = normalizeForIntent(textTrim);
  const media = extractMediaFromPayload(payload);

  if (isMenuTrigger(textLower)) {
    await showMainMenu({ session, chatId, sessionName });
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
      try {
        const downloaded = await fetchWithTimeout(
          url,
          { headers },
          Number.isFinite(WAHA_MEDIA_TIMEOUT_MS) && WAHA_MEDIA_TIMEOUT_MS > 0 ? WAHA_MEDIA_TIMEOUT_MS : 12000
        );
        if (downloaded.ok) {
          const content = Buffer.from(await downloaded.arrayBuffer()).toString('utf8');
          if (MINIMAX_API_KEY) {
            const system = `Eres un analista de documentos en WhatsApp para Brify. Responde en español, claro y útil.
No uses Markdown (sin asteriscos, sin guiones como viñetas, sin líneas separadoras). Si haces lista, usa emojis.
Entrega: 1) resumen, 2) puntos clave, 3) riesgos/observaciones, 4) preguntas de aclaración si aplica.`;
            let analysis = '';
            try {
              const response = await fetchWithTimeout(
                MINIMAX_ENDPOINT,
                {
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
                },
                Number.isFinite(WAHA_MINIMAX_TIMEOUT_MS) && WAHA_MINIMAX_TIMEOUT_MS > 0 ? WAHA_MINIMAX_TIMEOUT_MS : 8000
              );
              if (response.ok) {
                const data = await response.json().catch(() => ({}));
                let raw = data?.content;
                if (Array.isArray(raw)) raw = raw.map((b) => (typeof b === 'string' ? b : b?.text || '')).join('');
                if (typeof raw !== 'string') raw = data?.choices?.[0]?.message?.content;
                analysis = typeof raw === 'string' ? sanitizeWhatsAppText(raw) : '';
              }
            } catch (_) {
              analysis = '';
            }

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
      } catch (_) {}
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
    else folderId = await resolveRootFolderIdForUser(user.email, session.user_id, session.phone_number, { sessionId: session.id });

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
    await updateWspSession(session.id, { current_branch: null, branch_context: {} });
    await analyzeDocumentFileAndReply({
      session,
      chatId,
      sessionName,
      question: ctx.analysis_question || textTrim || `Analiza ${picked.name || 'este documento'}`,
      file: picked
    });
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
      branch_context: { ...(session.branch_context || {}), stage: 'choose_mode' }
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
    await startUploadFileFlow({ session, chatId, text: '', sessionName });
    return true;
  }

  if (branch === 'list_groups') {
    await updateWspSession(session.id, {
      current_branch: 'listar_grupos',
      branch_context: {}
    });
    await handleListarGrupos({ session: { ...session, current_branch: 'listar_grupos', branch_context: {} }, chatId, text: '', sessionName });
    return true;
  }

  if (branch === 'list_files') {
    await updateWspSession(session.id, {
      current_branch: 'listar_archivos',
      branch_context: { stage: 'choose_kind', saveTarget: 'root' }
    });
    await wahaSendText(chatId, `¿Qué quieres ver en tu carpeta raíz? 📋\n\n1️⃣ 📄 Documentos\n2️⃣ 🖼️ Imágenes\n3️⃣ 📦 Todo`, sessionName);
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

async function startCreateGroupFlow({ session, chatId, text, sessionName }) {
  const textTrim = normalizeIncomingText(text);
  const directEmails = parseEmails(textTrim);
  let groupName = guessGroupName(textTrim);
  const normalizedGroupName = normalizeForIntent(groupName);
  const suspicious =
    groupName &&
    (normalizedGroupName.startsWith('necesito ') ||
      normalizedGroupName.startsWith('quiero ') ||
      normalizedGroupName.includes('compart') ||
      normalizedGroupName.includes('invit') ||
      normalizedGroupName.includes('@'));

  if (directEmails.length && (!groupName || suspicious)) {
    const extracted = await minimaxExtractCreateGroupDetails(textTrim);
    if (extracted?.group_name) groupName = extracted.group_name;
    const extraEmails = Array.isArray(extracted?.emails) ? extracted.emails : [];
    const mergedEmails = Array.from(new Set([...directEmails, ...extraEmails]));
    const updated = await updateWspSession(session.id, {
      current_branch: 'crear_grupo',
      branch_context: {
        stage: groupName ? 'confirm_details' : 'ask_name',
        group_name: groupName || null,
        prefilled_emails: mergedEmails,
        prompted: false
      }
    });
    await handleCrearGrupo({ session: updated, chatId, text: groupName ? '' : textTrim, sessionName });
    return true;
  }

  const updated = await updateWspSession(session.id, {
    current_branch: 'crear_grupo',
    branch_context: {
      stage: groupName ? 'confirm_details' : 'ask_name',
      group_name: groupName || null,
      prefilled_emails: directEmails,
      prompted: false
    }
  });
  await handleCrearGrupo({ session: updated, chatId, text: groupName ? '' : textTrim, sessionName });
  return true;
}

async function startShareGroupFlow({ session, chatId, text, sessionName }) {
  const textTrim = normalizeIncomingText(text);
  const directEmails = parseEmails(textTrim);
  const groupNameHint = extractGroupNameForShare(textTrim);
  const updated = await updateWspSession(session.id, {
    current_branch: 'compartir_grupo',
    branch_context: { stage: 'start', prefilled_emails: directEmails, prefilled_group_name: groupNameHint || null }
  });
  await handleCompartirGrupo({ session: updated, chatId, text: groupNameHint || textTrim, sessionName });
  return true;
}

async function continueWithFreshIntent({ session, chatId, text, sessionName }) {
  const nextText = normalizeIncomingText(text);
  if (!nextText) return false;
  const textLower = normalizeForIntent(nextText);
  if (!textLower) return false;

  if (isMenuTrigger(textLower)) {
    await showMainMenu({ session, chatId, sessionName });
    return true;
  }

  if (isExplicitCreateGroupRequest(nextText)) {
    await startCreateGroupFlow({ session, chatId, text: nextText, sessionName });
    return true;
  }

  const explicitIntent = detectIntentRuleBased(nextText);
  if (explicitIntent.intent === 'share_group') {
    await startShareGroupFlow({ session, chatId, text: nextText, sessionName });
    return true;
  }
  if (explicitIntent.intent === 'list_groups') {
    await enterBranch(session, chatId, sessionName, 'list_groups');
    return true;
  }
  if (explicitIntent.intent === 'upload_file') {
    await startUploadFileFlow({ session, chatId, text: nextText, sessionName });
    return true;
  }
  if (['legal', 'list_files', 'analyze_document'].includes(explicitIntent.intent)) {
    await enterBranch(session, chatId, sessionName, explicitIntent.intent);
    return true;
  }

  const casualSession = session?.current_branch === 'casual' ? session : await returnSessionToCasual(session.id, {});
  await handleCasualConversation({
    session: casualSession || { ...session, current_branch: 'casual', branch_context: {} },
    chatId,
    text: nextText,
    sessionName
  });
  return true;
}

async function getOrCreateWspSession(phoneNumber, patch = {}) {
  const { data: existing, error } = await supabase
    .from('wsp_sessions')
    .select('*')
    .eq('phone_number', phoneNumber)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!error && existing) {
    const nextPatch = {};
    if (patch.user_id && existing.user_id !== patch.user_id) nextPatch.user_id = patch.user_id;
    if (phoneNumber && existing.phone_number !== phoneNumber) nextPatch.phone_number = phoneNumber;
    if (patch.current_branch !== undefined && existing.current_branch !== patch.current_branch) nextPatch.current_branch = patch.current_branch;
    if (patch.branch_context && JSON.stringify(existing.branch_context || {}) !== JSON.stringify(patch.branch_context)) {
      nextPatch.branch_context = patch.branch_context;
    }
    return Object.keys(nextPatch).length ? updateWspSession(existing.id, nextPatch) : existing;
  }

  const { data: created, error: createError } = await supabase
    .from('wsp_sessions')
    .insert({
      id: crypto.randomUUID(),
      phone_number: phoneNumber,
      ...(patch.user_id ? { user_id: patch.user_id } : {}),
      ...(patch.current_branch !== undefined ? { current_branch: patch.current_branch } : { current_branch: null }),
      ...(patch.branch_context ? { branch_context: patch.branch_context } : { branch_context: {} }),
      last_interaction: new Date().toISOString()
    })
    .select('*')
    .single();

  if (createError) throw createError;
  return created;
}

async function returnSessionToCasual(sessionId, branchContext = {}) {
  return updateWspSession(sessionId, {
    current_branch: 'casual',
    branch_context: branchContext && typeof branchContext === 'object' ? branchContext : {}
  });
}

async function setWspSessionGlobal(sessionId, globalPatch) {
  const patch = globalPatch && typeof globalPatch === 'object' ? globalPatch : {};
  if (!sessionId || !Object.keys(patch).length) return null;
  try {
    const { data: existing } = await supabase.from('wsp_sessions').select('branch_context').eq('id', sessionId).single();
    const currentCtx = existing?.branch_context && typeof existing.branch_context === 'object' ? existing.branch_context : {};
    const currentGlobal = currentCtx._global && typeof currentCtx._global === 'object' ? currentCtx._global : {};
    return await updateWspSession(sessionId, {
      branch_context: {
        ...currentCtx,
        _global: {
          ...currentGlobal,
          ...patch
        }
      }
    });
  } catch (_) {
    return null;
  }
}

async function updateWspSession(sessionId, patch) {
  let nextPatch = patch;
  if (patch && typeof patch === 'object' && patch.branch_context && typeof patch.branch_context === 'object') {
    try {
      const { data: existing } = await supabase.from('wsp_sessions').select('branch_context').eq('id', sessionId).single();
      const global = existing?.branch_context?._global;
      if (global && !patch.branch_context._global) {
        nextPatch = { ...patch, branch_context: { ...patch.branch_context, _global: global } };
      }
    } catch (_) {}
  }

  const { data, error } = await supabase
    .from('wsp_sessions')
    .update({
      ...nextPatch,
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
  const phone = String(phoneNumber || '').trim();
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, '');
  const tail11 = digits.length >= 11 ? digits.slice(-11) : digits;
  const tail9 = digits.length >= 9 ? digits.slice(-9) : digits;
  const tail8 = digits.length >= 8 ? digits.slice(-8) : digits;
  const variants = Array.from(
    new Set([
      phone,
      digits || null,
      tail11 || null,
      tail9 || null,
      tail8 || null,
      `+${digits || phone}`,
      tail11 && `+${tail11}`,
      digits.startsWith('569') && digits.length >= 11 ? digits.slice(0, 11) : null,
      digits.startsWith('569') && digits.length >= 11 ? digits.slice(2, 11) : null,
      digits.startsWith('569') && digits.length >= 11 ? digits.slice(3, 11) : null
    ].filter(Boolean))
  );

  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .in('wssp', variants)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('[WAHA webhook] getUserByPhone (users.wssp) error:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
    }
    if (data) return data;
  } catch (_) {}

  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .in('phone_number', variants)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('[WAHA webhook] getUserByPhone (users.phone_number) error:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
    }
    if (data) return data;
  } catch (_) {}

  const patterns = Array.from(new Set([digits, tail11, tail9, tail8].filter((p) => typeof p === 'string' && p.length >= 8)));
  if (patterns.length) {
    const safePatterns = patterns.map((p) => p.replace(/[^\d]/g, '')).filter((p) => p.length >= 8);
    const orFilters = safePatterns
      .flatMap((p) => [`wssp.ilike.%${p}%`, `phone_number.ilike.%${p}%`])
      .join(',');
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .or(orFilters)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error('[WAHA webhook] getUserByPhone (users.or ilike) error:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
      }
      if (data) return data;
    } catch (_) {}
  }

  return null;
}

async function probeUserLookupByPhone(phoneNumber) {
  const input = String(phoneNumber || '').trim();
  const digits = input.replace(/[^\d]/g, '');
  const normalized = normalizePhoneFromChatId(digits) || digits || input;
  const candidates = Array.from(new Set([normalized, digits, input].filter((v) => typeof v === 'string' && v.trim().length > 0)));
  const orParts = candidates.flatMap((c) => [`wssp.eq.${c}`, `phone_number.eq.${c}`]);
  const startedAt = Date.now();
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id,email,wssp,phone_number,created_at')
      .or(orParts.join(','))
      .order('created_at', { ascending: false })
      .limit(1);
    return {
      ok: !error,
      hasServiceRole: Boolean(supabaseServiceKey),
      candidates,
      found: Array.isArray(data) && data.length > 0,
      sample: Array.isArray(data) && data[0] ? { id: data[0].id, email: data[0].email, wssp: data[0].wssp, phone_number: data[0].phone_number } : null,
      error: error ? { message: error.message, code: error.code, details: error.details, hint: error.hint } : null,
      ms: Date.now() - startedAt
    };
  } catch (e) {
    return {
      ok: false,
      hasServiceRole: Boolean(supabaseServiceKey),
      candidates,
      found: false,
      sample: null,
      error: { message: e?.message ? String(e.message) : String(e || 'probe error') },
      ms: Date.now() - startedAt
    };
  }
}

async function resolveUserByIncomingPhone(phoneNumber) {
  const normalizedPhone = normalizePhoneFromChatId(phoneNumber);
  if (!normalizedPhone) return { user: null, matchedByAdminFolder: false };

  let user = await getUserByPhone(normalizedPhone);
  let matchedByAdminFolder = false;

  if (!user) {
    user = await getUserFromAdminFolderByWsp(normalizedPhone);
    matchedByAdminFolder = Boolean(user);
  }

  return { user: user || null, matchedByAdminFolder, normalizedPhone };
}

async function getUserByEmail(email) {
  const { data, error } = await supabase.from('users').select('*').eq('email', email).single();
  if (error) return null;
  return data;
}

async function safeUpdateUserPhone(userId, phoneNumber) {
  const uid = String(userId || '').trim();
  if (!uid) return false;
  const phone = String(phoneNumber || '').trim();
  if (!phone) return false;

  try {
    const { error } = await supabase
      .from('users')
      .update({ phone_number: phone, wssp: phone, phone_verified: true })
      .eq('id', uid);
    if (!error) return true;
  } catch (_) {}

  try {
    const { error } = await supabase.from('users').update({ wssp: phone }).eq('id', uid);
    if (!error) return true;
  } catch (_) {}

  return false;
}

async function getUserFromAdminFolderByWsp(phoneNumber) {
  const phone = String(phoneNumber || '').trim();
  if (!phone) return null;
  try {
    const { data, error } = await supabase
      .from('carpeta_administrador')
      .select('user_id, correo, id_drive_carpeta')
      .eq('wsp', phone)
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    if (data.user_id) {
      const { data: user } = await supabase.from('users').select('*').eq('id', data.user_id).maybeSingle();
      return user || null;
    }
    if (data.correo) {
      const { data: user } = await supabase.from('users').select('*').eq('email', data.correo).maybeSingle();
      return user || null;
    }
    return null;
  } catch (_) {
    return null;
  }
}

async function tryAttachWspToAdminFolder({ userId, userEmail, phoneNumber }) {
  const phone = String(phoneNumber || '').trim();
  if (!phone) return false;
  try {
    const q = supabase.from('carpeta_administrador').update({ wsp: phone });
    if (userId) {
      const { error } = await q.eq('user_id', userId);
      if (!error) return true;
    }
  } catch (_) {}

  if (userEmail) {
    try {
      const { error } = await supabase
        .from('carpeta_administrador')
        .update({ wsp: phone })
        .ilike('correo', String(userEmail).trim());
      if (!error) return true;
    } catch (_) {}
  }
  return false;
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

async function semanticSearchUserDocs({ userId, query, limit = 5 }) {
  const q = String(query || '').trim();
  if (!q) return [];

  const { data: user } = await supabase.from('users').select('email').eq('id', userId).single();
  const userEmail = user?.email;
  if (!userEmail) return [];

  let embedding = null;
  let usedProviderEmbedding = false;
  try {
    const embs = await geminiEmbedTexts([q], 'RETRIEVAL_QUERY');
    embedding = Array.isArray(embs) && embs[0] ? embs[0] : null;
    usedProviderEmbedding = Boolean(embedding);
  } catch (_) {
    embedding = null;
  }
  if (!embedding) {
    embedding = generateDeterministicEmbedding(q);
  }

  try {
    const { data, error } = await supabase.rpc('match_documentos_administrador', {
      query_embedding: embedding,
      match_count: limit,
      administrador: userEmail,
      servicio: null
    });
    if (!error && Array.isArray(data)) {
      const mapped = data
        .filter((r) => r?.file_id && r?.name)
        .slice(0, limit)
        .map((r) => ({
          name: r.name,
          fileId: r.file_id,
          snippet: String(r.content || '').replace(/\s+/g, ' ').trim().slice(0, 220),
          similarity: Number(r.similarity || 0)
        }));
      if (mapped.length) return mapped;
    }
  } catch (_) {}

  if (usedProviderEmbedding) {
    try {
      const det = generateDeterministicEmbedding(q);
      const { data, error } = await supabase.rpc('match_documentos_administrador', {
        query_embedding: det,
        match_count: limit,
        administrador: userEmail,
        servicio: null
      });
      if (!error && Array.isArray(data)) {
        const mapped = data
          .filter((r) => r?.file_id && r?.name)
          .slice(0, limit)
          .map((r) => ({
            name: r.name,
            fileId: r.file_id,
            snippet: String(r.content || '').replace(/\s+/g, ' ').trim().slice(0, 220),
            similarity: Number(r.similarity || 0)
          }));
        if (mapped.length) return mapped;
      }
    } catch (_) {}
  }

  const normalized = normalizeForEmbedding(q);
  const terms = normalized.split(' ').filter((t) => t.length > 2).slice(0, 8);

  let dbQuery = supabase
    .from('documentos_administrador')
    .select('name,file_id,content,metadata,created_at')
    .eq('administrador', userEmail);

  if (terms.length) {
    const orConditions = terms.flatMap((t) => [`content.ilike.%${t}%`, `name.ilike.%${t}%`]).join(',');
    dbQuery = dbQuery.or(orConditions);
  } else {
    dbQuery = dbQuery.or(`content.ilike.%${q}%,name.ilike.%${q}%`);
  }

  const { data: docs, error: searchError } = await dbQuery.order('created_at', { ascending: false }).limit(Math.max(limit * 3, limit));
  if (searchError || !Array.isArray(docs)) return [];

  const scored = docs
    .map((d) => {
      const haystack = `${d?.name || ''}\n${d?.content || ''}`.toLowerCase();
      let score = 0;
      for (const t of terms) {
        if (t && haystack.includes(t)) score += 1;
      }
      return {
        name: d?.name,
        fileId: d?.file_id,
        snippet: String(d?.content || '').replace(/\s+/g, ' ').trim().slice(0, 220),
        similarity: score
      };
    })
    .filter((r) => r.fileId && r.name)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return scored;
}

async function findUserDocumentsByNameHint({ userId, nameHint, limit = 3 }) {
  const hint = cleanDocumentNameCandidate(nameHint);
  if (!userId || !hint) return [];

  const { data: user } = await supabase.from('users').select('email').eq('id', userId).single();
  const userEmail = user?.email;
  if (!userEmail) return [];

  const safeHint = sanitizeSearchFragment(hint);
  const normalizedHint = normalizeForIntent(hint);
  const normalizedHintCompact = normalizedHint.replace(/[^a-z0-9]+/g, '_');

  let query = supabase
    .from('documentos_administrador')
    .select('name,file_id,content,metadata,created_at,nombre_limpio')
    .eq('administrador', userEmail);

  if (safeHint) {
    query = query.or(`name.ilike.%${safeHint}%,nombre_limpio.ilike.%${normalizedHintCompact}%`);
  }

  const { data, error } = await query.order('created_at', { ascending: false }).limit(12);
  if (error || !Array.isArray(data)) return [];

  return data
    .map((doc) => {
      const normalizedName = normalizeForIntent(doc?.name || '');
      let score = 0;
      if (normalizedName === normalizedHint) score += 200;
      if (normalizedName.includes(normalizedHint)) score += 120;
      if (normalizedHint.includes(normalizedName) && normalizedName) score += 60;
      if (String(doc?.nombre_limpio || '').includes(normalizedHintCompact)) score += 100;
      if (doc?.name && normalizeForIntent(doc.name.replace(/\.[a-z0-9]+$/i, '')) === normalizedHint.replace(/\.[a-z0-9]+$/i, '')) score += 140;
      return {
        name: doc?.name,
        fileId: doc?.file_id,
        content: String(doc?.content || ''),
        metadata: doc?.metadata || {},
        created_at: doc?.created_at || null,
        score
      };
    })
    .filter((doc) => doc.fileId && doc.name && doc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

async function loadUserDocsByFileIds({ userId, fileIds }) {
  const ids = Array.from(new Set((Array.isArray(fileIds) ? fileIds : []).map((id) => String(id || '').trim()).filter(Boolean)));
  if (!userId || !ids.length) return [];

  const { data: user } = await supabase.from('users').select('email').eq('id', userId).single();
  const userEmail = user?.email;
  if (!userEmail) return [];

  const { data, error } = await supabase
    .from('documentos_administrador')
    .select('name,file_id,content,metadata,created_at')
    .eq('administrador', userEmail)
    .in('file_id', ids);

  if (error || !Array.isArray(data)) return [];

  const byId = new Map(data.map((doc) => [String(doc.file_id), doc]));
  return ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((doc) => ({
      name: doc?.name,
      fileId: doc?.file_id,
      content: String(doc?.content || ''),
      metadata: doc?.metadata || {},
      created_at: doc?.created_at || null
    }));
}

function mapStoredDocToAnalysisFile(doc) {
  const metadata = doc?.metadata && typeof doc.metadata === 'object' ? doc.metadata : {};
  const mimeType = metadata.mime_type || metadata.file_type || metadata.mimetype || null;
  return {
    id: doc?.fileId || doc?.file_id || null,
    name: doc?.name || '',
    mimeType,
    webViewLink: metadata.webViewLink || metadata.web_view_link || driveOpenLink(doc?.fileId || doc?.file_id || '')
  };
}

function isLegalStyleDocumentAnalysis({ question, fileName }) {
  const combined = normalizeForIntent(`${String(question || '').trim()} ${String(fileName || '').trim()}`);
  if (!combined) return false;
  const keywords = [
    'contrato',
    'clausula',
    'cláusula',
    'anexo',
    'firma',
    'firmado',
    'firmar',
    'tribut',
    'impuesto',
    'sii',
    'boleta',
    'factura',
    'declaracion',
    'declaración',
    'finiquito',
    'demanda',
    'poder',
    'escritura',
    'arrend',
    'representacion',
    'representación',
    'sociedad',
    'prestacion de servicios',
    'prestación de servicios',
    'terminos y condiciones',
    'términos y condiciones'
  ];
  return keywords.some((keyword) => combined.includes(keyword));
}

function detectDocumentExpectationMismatch({ question, fileName, textContent }) {
  const expectedLegal = isLegalStyleDocumentAnalysis({ question, fileName });
  const normalized = normalizeForIntent(String(textContent || '').slice(0, 5000));
  if (!expectedLegal || !normalized) {
    return { expectedLegal, looksLegal: expectedLegal, mismatch: false, detectedType: null };
  }

  const legalKeywords = [
    'contrato',
    'clausula',
    'cláusula',
    'arrend',
    'anexo',
    'finiquito',
    'mandante',
    'prestador',
    'servicio',
    'vigencia',
    'partes',
    'obligacion',
    'obligación',
    'firma',
    'tribut',
    'factura',
    'boleta',
    'impuesto',
    'sii',
    'sociedad',
    'representante legal'
  ];
  const nonLegalHints = [
    { type: 'una guia de ejercicios', keywords: ['burpee', 'burpees', 'entrenamiento', 'rutina', 'ejercicio', 'ejercicios', 'cardio'] },
    { type: 'un manual o instructivo', keywords: ['manual', 'instructivo', 'instrucciones', 'paso a paso', 'tutorial'] },
    { type: 'una guia informativa', keywords: ['guia', 'guía', 'recomendaciones', 'consejos', 'introduccion', 'introducción'] }
  ];

  const legalHits = legalKeywords.filter((keyword) => normalized.includes(keyword)).length;
  const detectedNonLegal = nonLegalHints.find((item) => item.keywords.some((keyword) => normalized.includes(keyword))) || null;
  const looksLegal = legalHits >= 3;
  const mismatch = expectedLegal && !looksLegal;
  return {
    expectedLegal,
    looksLegal,
    mismatch,
    detectedType: detectedNonLegal?.type || null
  };
}

async function generateDocumentAnalysisReply({ question, fileName, textContent, webViewLink }) {
  const cleanQuestion = normalizeIncomingText(question);
  const content = normalizeExtractedText(textContent);
  if (!content) return '';
  const useLegalLens = isLegalStyleDocumentAnalysis({ question: cleanQuestion, fileName });
  const mismatch = detectDocumentExpectationMismatch({ question: cleanQuestion, fileName, textContent: content });
  const closing = buildDocumentAnalysisClosing({ mismatch, useLegalLens, fileName });

  if (MINIMAX_API_KEY) {
    const system = useLegalLens
      ? `Eres un analista legal de documentos en WhatsApp para Brify. Responde en español, claro, útil y con criterio jurídico práctico.
No uses Markdown (sin asteriscos, sin guiones como viñetas, sin líneas separadoras). Si haces lista, usa emojis.
Si el documento parece contrato, tributario, societario o de firma, prioriza: alcance, obligaciones, riesgos, vacíos, inconsistencias, puntos sensibles y siguientes pasos.
No inventes normas ni cites leyes si no aparecen o no son necesarias. Si algo no se puede afirmar con seguridad, dilo con claridad.
Si el usuario esperaba un contrato o documento legal y el archivo en realidad no corresponde a eso, dilo de forma explícita al inicio, explica qué tipo de documento sí es y luego entrega igual un análisis útil del contenido.
La respuesta debe quedar siempre completa, cerrada y sin frases cortadas. Si falta espacio, condensa, pero no la dejes a medias.
Entrega obligatoria y en este orden: 1) conclusión inicial, 2) qué documento parece ser realmente, 3) puntos clave, 4) riesgos/alertas, 5) siguiente paso sugerido. Cierra siempre con una frase que invite a continuar la conversación.`
      : `Eres un analista de documentos en WhatsApp para Brify. Responde en español, claro y útil.
No uses Markdown (sin asteriscos, sin guiones como viñetas, sin líneas separadoras). Si haces lista, usa emojis.
Si el usuario pidió opinión, además del resumen indica observaciones prácticas, riesgos o puntos sensibles.
Si el usuario esperaba un tipo de documento específico y el archivo subido no coincide, dilo con claridad al inicio y luego analiza igual el documento real.
La respuesta debe quedar siempre completa, cerrada y sin frases cortadas. Si falta espacio, condensa, pero no la dejes a medias.
Entrega obligatoria y en este orden: 1) conclusión inicial, 2) qué documento parece ser realmente, 3) puntos clave, 4) observaciones o riesgos, 5) siguiente paso sugerido. Cierra siempre con una frase que invite a continuar la conversación.`;
    try {
      const response = await fetchWithTimeout(
        MINIMAX_ENDPOINT,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${MINIMAX_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: MINIMAX_MODEL,
            system,
            temperature: 0.35,
            max_tokens: 1200,
            messages: [
              {
                role: 'user',
                content: `Documento: ${String(fileName || 'Documento').trim()}\n\nConsulta original del usuario:\n${cleanQuestion || 'Analiza este documento'}\n\nEvaluación preliminar:\n${mismatch.mismatch ? `El usuario esperaba un documento legal o contractual, pero el contenido no parece corresponder a eso${mismatch.detectedType ? ` y se parece más a ${mismatch.detectedType}` : ''}. Debes decirlo claramente al inicio y luego analizar igual el documento real.` : 'Mantén el análisis alineado con la intención original del usuario.'}\n\nCierre esperado:\nTermina con una frase tipo: "${closing}"\n\nContenido:\n${content.slice(0, 14000)}\n\nAnaliza este documento y responde a la consulta del usuario:`
              }
            ]
          })
        },
        Number.isFinite(WAHA_MINIMAX_TIMEOUT_MS) && WAHA_MINIMAX_TIMEOUT_MS > 0 ? WAHA_MINIMAX_TIMEOUT_MS : 9000
      );
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        let raw = data?.content;
        if (Array.isArray(raw)) raw = raw.map((b) => (typeof b === 'string' ? b : b?.text || '')).join('');
        if (typeof raw !== 'string') raw = data?.choices?.[0]?.message?.content;
        const cleaned = typeof raw === 'string' ? sanitizeWhatsAppText(raw) : '';
        if (cleaned) return cleaned;
      }
    } catch (_) {}
  }

  const fallbackSummary = buildDocumentFallbackSummary(content, cleanQuestion, 1050);
  if (!fallbackSummary) {
    return `Encontré el documento${fileName ? ` "${fileName}"` : ''}, pero no alcancé a extraer contenido suficiente para darte una opinión confiable${webViewLink ? `.\n\nLink: ${webViewLink}` : '.'}`;
  }
  if (mismatch.mismatch) {
    const intro = `Este documento no parece ser ${normalizeForIntent(cleanQuestion).includes('contrato') ? 'un contrato' : 'el tipo de documento legal que esperabas'}. ${mismatch.detectedType ? `Más bien parece ${mismatch.detectedType}.` : 'Más bien parece un documento no legal o informativo.'}`;
    return `${intro}\n\nQué encontré realmente en ${fileName ? `"${fileName}"` : 'el archivo'}:\n${fallbackSummary}\n\nMi recomendación:\nSi tu idea era revisar un contrato, probablemente el archivo correcto tiene otro nombre o está en otra carpeta. ${closing}${webViewLink ? `\n\nLink del archivo: ${webViewLink}` : ''}`;
  }
  if (useLegalLens) {
    return `Conclusión inicial:\nRevisé ${fileName ? `"${fileName}"` : 'el documento'} con enfoque legal.\n\nPuntos más relevantes:\n${fallbackSummary}\n\nSiguiente paso sugerido:\n${closing}${webViewLink ? `\n\nLink del archivo: ${webViewLink}` : ''}`;
  }
  return `Conclusión inicial:\nRevisé ${fileName ? `"${fileName}"` : 'el documento'}.\n\nPuntos más relevantes:\n${fallbackSummary}\n\nSiguiente paso sugerido:\n${closing}${webViewLink ? `\n\nLink del archivo: ${webViewLink}` : ''}`;
}

async function analyzeDocumentFileAndReply({ session, chatId, sessionName, question, file }) {
  const fileId = String(file?.id || '').trim();
  if (!fileId) return false;

  const extracted = await extractDriveFileTextAdvanced({
    userId: session.user_id,
    fileId,
    mimeType: file?.mimeType || null,
    fileName: file?.name || null
  }).catch(() => null);

  const textContent = normalizeExtractedText(extracted?.text || '');
  if (!textContent) {
    const openLink = file?.webViewLink || driveOpenLink(fileId);
    await wahaSendText(
      chatId,
      `Encontré ${file?.name ? `"${file.name}"` : 'el documento'}, pero todavía no pude extraer texto suficiente para analizarlo por WhatsApp 😕\n\n${openLink ? `Puedes abrirlo aquí:\n${openLink}\n\n` : ''}Si quieres, súbelo o compárteme el archivo y lo revisamos por esa vía.`,
      sessionName
    );
    return true;
  }

  const analysis = await generateDocumentAnalysisReply({
    question,
    fileName: file?.name || 'Documento',
    textContent,
    webViewLink: file?.webViewLink || driveOpenLink(fileId)
  });
  if (!analysis) return false;

  await wahaStartTyping(chatId, sessionName).catch(() => null);
  try {
    await wahaSendLongText({ chatId, text: analysis, sessionName, options: { skipRewrite: true } });
  } finally {
    await wahaStopTyping(chatId, sessionName).catch(() => null);
  }
  return true;
}

async function handleExistingDriveDocumentAnalysisQuery({ session, chatId, text, sessionName }) {
  const question = normalizeIncomingText(text);
  if (!question || !isLikelyDocumentAnalysisRequest(question)) return false;

  const documentHint = extractAnalysisDocumentHint(question);
  const containerHint = extractDocumentContainerName(question);
  let preferredUploadGroup = null;

  let namedCandidates = [];
  if (documentHint) {
    namedCandidates = await findUserDocumentsByNameHint({ userId: session.user_id, nameHint: documentHint, limit: 5 });
  }

  let candidates = [...namedCandidates];
  if (!documentHint) {
    const semantic = await semanticSearchUserDocs({ userId: session.user_id, query: question, limit: 5 });
    if (semantic.length) {
      const loaded = await loadUserDocsByFileIds({ userId: session.user_id, fileIds: semantic.map((item) => item.fileId) });
      candidates.push(...loaded);
    }
  }

  let uniqueCandidates = Array.from(
    new Map(
      candidates
        .filter((doc) => doc?.fileId || doc?.file_id)
        .map((doc) => [String(doc.fileId || doc.file_id), doc])
    ).values()
  );

  if (containerHint && uniqueCandidates.length) {
    const normalizedContainer = normalizeForIntent(containerHint);
    const filtered = uniqueCandidates.filter((doc) => {
      const metadata = doc?.metadata && typeof doc.metadata === 'object' ? doc.metadata : {};
      const folderName = normalizeForIntent(metadata.nombre_carpeta_actual || metadata.folder_name || metadata.group_name || '');
      return folderName && folderName.includes(normalizedContainer);
    });
    if (filtered.length) uniqueCandidates = filtered;
  }

  if (!uniqueCandidates.length && containerHint) {
    const { data: user } = await supabase.from('users').select('email').eq('id', session.user_id).single();
    const groups = await listUserGroupsByEmail(user?.email);
    const pickedGroup = findGroupByName(groups, containerHint);
    if (pickedGroup?.folder_id) {
      preferredUploadGroup = pickedGroup;
      const driveFiles = await listDriveFiles({
        userId: session.user_id,
        folderId: pickedGroup.folder_id,
        kind: 'docs',
        nameContains: documentHint || null,
        pageSize: 8
      }).catch(() => []);
      if (driveFiles.length === 1) {
        return await analyzeDocumentFileAndReply({
          session,
          chatId,
          sessionName,
          question,
          file: driveFiles[0]
        });
      }
      if (driveFiles.length > 1) {
        const lines = driveFiles.map((f, idx) => `${idx + 1}️⃣ 📄 ${f.name}`);
        await updateWspSession(session.id, {
          current_branch: 'analizar_documento',
          branch_context: { stage: 'pick_file_select', files: driveFiles, analysis_question: question }
        });
        await wahaSendText(chatId, `Encontré varios documentos en "${pickedGroup.group_name}" 👇\n\n${lines.join('\n')}\n\nEscribe el número del que quieres analizar.`, sessionName);
        return true;
      }
    }
    if (!pickedGroup) {
      const pending = {
        type: 'choice',
        subtype: 'create_group_upload_and_analyze_document',
        source_user_text: question,
        group_name: containerHint,
        prompt: `No encontré una carpeta o grupo llamado "${containerHint}" 😕\n\nSi quieres, puedo hacer estas dos cosas: 📁 crear "${containerHint}", esperar tu documento y analizarlo ahí; o 📤 subir el documento ahora a la carpeta raíz y analizarlo igual.\n\nIndícame qué prefieres: crear primero la carpeta/grupo o subir directamente el documento.`,
        options: [
          { id: 'create_group_upload', label: 'Crear grupo y subir', keywords: buildOptionKeywords(['crear grupo', 'crear carpeta', 'crear primero la carpeta', 'crear primero el grupo', 'crea la carpeta', 'crea el grupo', 'primero crea', 'hazlo', 'dale con la carpeta'], 0) },
          { id: 'upload_root', label: 'Subir a raíz', keywords: buildOptionKeywords(['subir', 'subir documento', 'subir directamente', 'subir el documento', 'mejor subo', 'adjuntarlo ahora', 'raiz', 'raíz', 'root', 'sin grupo'], 1) },
          { id: 'later', label: 'Más tarde', keywords: ['no', 'despues', 'después', 'mas tarde', 'más tarde', 'luego'] }
        ],
        created_at: new Date().toISOString()
      };
      const persisted = await persistPendingFollowup(session.id, session.branch_context || {}, pending).catch(() => null);
      if (persisted) session = persisted;
      await wahaSendText(chatId, pending.prompt, sessionName, { skipRewrite: true });
      return true;
    }
  }

  if (!uniqueCandidates.length && documentHint) {
    const { data: user } = await supabase.from('users').select('email').eq('id', session.user_id).single();
    const rootFolderId = await resolveRootFolderIdForUser(user?.email, session.user_id, session.phone_number, { sessionId: session.id }).catch(() => null);
    if (rootFolderId) {
      const driveFiles = await listDriveFiles({
        userId: session.user_id,
        folderId: rootFolderId,
        kind: 'docs',
        nameContains: documentHint,
        pageSize: 8
      }).catch(() => []);
      if (driveFiles.length === 1) {
        return await analyzeDocumentFileAndReply({
          session,
          chatId,
          sessionName,
          question,
          file: driveFiles[0]
        });
      }
      if (driveFiles.length > 1) {
        const lines = driveFiles.map((f, idx) => `${idx + 1}️⃣ 📄 ${f.name}`);
        await updateWspSession(session.id, {
          current_branch: 'analizar_documento',
          branch_context: { stage: 'pick_file_select', files: driveFiles, analysis_question: question }
        });
        await wahaSendText(chatId, `Encontré varios documentos en tu carpeta raíz que podrían calzar 👇\n\n${lines.join('\n')}\n\nEscribe el número del que quieres analizar.`, sessionName);
        return true;
      }
    }
  }

  if (!uniqueCandidates.length) {
    const pending = {
      type: 'choice',
      subtype: 'upload_missing_document_for_analysis',
      source_user_text: question,
      save_target: preferredUploadGroup?.folder_id ? 'group' : 'root',
      selected_group: preferredUploadGroup?.folder_id ? preferredUploadGroup : null,
      prompt: documentHint
        ? `No encontré un documento claro que coincida con "${documentHint}"${containerHint ? ` en "${containerHint}"` : ''} 😕\n\nSi quieres, puedes 📤 subirlo ahora y lo analizo en cuanto llegue${preferredUploadGroup?.group_name ? ` dentro de "${preferredUploadGroup.group_name}"` : ''}, o dejarlo para después.\n\nDime si prefieres subir el documento ahora o dejarlo pendiente.`
        : `No pude identificar con claridad qué documento del Drive quieres que analice 😕\n\nSi quieres, puedes 📤 subirlo ahora y lo analizo en cuanto llegue, o dejarlo para después.\n\nDime si prefieres subir el documento ahora o dejarlo pendiente.`,
      options: [
        { id: 'upload_now', label: 'Subir ahora', keywords: buildOptionKeywords(['subir', 'subir ahora', 'subir documento', 'adjuntar', 'adjuntarlo', 'enviar', 'mandarlo', 'dale', 'hagamoslo', 'hagámoslo'], 0) },
        { id: 'later', label: 'Más tarde', keywords: buildOptionKeywords(['no', 'despues', 'después', 'mas tarde', 'más tarde', 'luego'], 1) }
      ],
      created_at: new Date().toISOString()
    };
    const persisted = await persistPendingFollowup(session.id, session.branch_context || {}, pending).catch(() => null);
    if (persisted) session = persisted;
    await wahaSendText(chatId, pending.prompt, sessionName, { skipRewrite: true });
    return true;
  }

  const mappedFiles = uniqueCandidates.map(mapStoredDocToAnalysisFile).filter((file) => file.id && file.name);
  if (mappedFiles.length === 1) {
    return await analyzeDocumentFileAndReply({
      session,
      chatId,
      sessionName,
      question,
      file: mappedFiles[0]
    });
  }

  const lines = mappedFiles.slice(0, 8).map((f, idx) => `${idx + 1}️⃣ 📄 ${f.name}`);
  await updateWspSession(session.id, {
    current_branch: 'analizar_documento',
    branch_context: { stage: 'pick_file_select', files: mappedFiles.slice(0, 8), analysis_question: question }
  });
  await wahaSendText(chatId, `Encontré varios documentos que podrían calzar con lo que pides 👇\n\n${lines.join('\n')}\n\nEscribe el número del que quieres analizar.`, sessionName);
  return true;
}

async function minimaxAnswerFromUserDocs({ question, documents, preferredDocumentName }) {
  if (!MINIMAX_API_KEY || !WAHA_MINIMAX_ENABLED) return '';
  const docs = Array.isArray(documents) ? documents.filter((d) => d?.name && d?.content) : [];
  if (!docs.length) return '';

  const context = docs
    .slice(0, 3)
    .map((doc, idx) => {
      const excerpt = extractRelevantDocExcerpt(doc.content, question, 1200);
      return `Documento ${idx + 1}: ${doc.name}\nContenido relevante:\n${excerpt || '(sin contenido útil)'}`;
    })
    .join('\n\n');

  const system = `Eres Brify respondiendo preguntas en WhatsApp usando SOLO documentos del usuario.
Responde en español chileno neutral, claro, humano y útil.
No uses Markdown (sin asteriscos, sin guiones como viñetas, sin líneas separadoras).
No inventes información. Si el contexto no alcanza, dilo explícitamente.
Si hay un documento preferido, priorízalo.
Responde primero la consulta y al final agrega una línea breve con "Fuente:" seguida de los nombres de los documentos usados.
No entregues links salvo que el usuario los pida.`;

  try {
    const response = await fetchWithTimeout(
      MINIMAX_ENDPOINT,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${MINIMAX_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: MINIMAX_MODEL,
          system,
          temperature: 0.2,
          max_tokens: 700,
          messages: [
            {
              role: 'user',
              content: `Documento preferido: ${preferredDocumentName || '(ninguno)'}\n\nPregunta del usuario:\n${String(question || '').trim()}\n\nContexto documental:\n${context}\n\nResponde usando solo este contexto:`
            }
          ]
        })
      },
      Number.isFinite(WAHA_MINIMAX_TIMEOUT_MS) && WAHA_MINIMAX_TIMEOUT_MS > 0 ? WAHA_MINIMAX_TIMEOUT_MS : 9000
    );

    if (!response.ok) return '';
    const data = await response.json().catch(() => ({}));
    let raw = data?.content;
    if (Array.isArray(raw)) raw = raw.map((b) => (typeof b === 'string' ? b : b?.text || '')).join('');
    if (typeof raw !== 'string') raw = data?.choices?.[0]?.message?.content;
    return typeof raw === 'string' ? sanitizeWhatsAppText(raw) : '';
  } catch (_) {
    return '';
  }
}

function buildFallbackAnswerFromUserDocs({ question, documents, preferredDocumentName, includeLinks = false }) {
  const docs = Array.isArray(documents) ? documents.filter((d) => d?.name) : [];
  if (!docs.length) return '';

  if (includeLinks) {
    const lines = docs.slice(0, 3).map((doc, idx) => `${idx + 1}️⃣ ${doc.name}\n${driveOpenLink(doc.fileId) || 'Link no disponible'}`);
    return `Encontré estos accesos${preferredDocumentName ? ` para "${preferredDocumentName}"` : ''} 👇\n\n${lines.join('\n\n')}`;
  }

  const topDoc = docs[0];
  const excerpt = extractRelevantDocExcerpt(topDoc.content, question, 420) || String(topDoc.content || '').replace(/\s+/g, ' ').trim().slice(0, 420);
  const sourceNames = docs.slice(0, 2).map((doc) => doc.name).join(', ');
  if (!excerpt) {
    return `Encontré información relacionada${preferredDocumentName ? ` en "${preferredDocumentName}"` : ''}, pero no alcancé a extraer suficiente contenido para responder con seguridad.\n\nFuente: ${sourceNames}`;
  }
  return `Revisé ${preferredDocumentName ? `"${preferredDocumentName}"` : `"${topDoc.name}"`} y esto es lo más relevante que encontré: ${excerpt}${excerpt.length >= 400 ? '…' : ''}\n\nFuente: ${sourceNames}`;
}

async function handleDocumentKnowledgeQuery({ session, chatId, text, sessionName }) {
  const question = normalizeIncomingText(text);
  if (!question) return false;

  const wantsLink = wantsDocumentLink(question);
  const preferredDocumentName = extractDocumentReferenceName(question);
  const shouldAnswer = isLikelyDocumentKnowledgeQuestion(question);
  if (!wantsLink && !shouldAnswer) return false;

  let freshCtx = session?.branch_context || {};
  try {
    const updatedAfterUser = await appendGlobalHistory(session.id, freshCtx, 'user', question);
    freshCtx = updatedAfterUser?.branch_context || freshCtx;
  } catch (_) {}

  let documents = [];
  if (preferredDocumentName) {
    documents = await findUserDocumentsByNameHint({ userId: session.user_id, nameHint: preferredDocumentName, limit: wantsLink ? 3 : 2 });
    if (!documents.length) {
      const notFoundReply = `No encontré un documento que coincida con "${preferredDocumentName}" en tu banco informativo 😕\n\nSi quieres, prueba con el nombre exacto o pídeme que lo busque de otra forma.`;
      try {
        await appendGlobalHistory(session.id, freshCtx, 'assistant', notFoundReply);
      } catch (_) {}
      await wahaSendText(chatId, notFoundReply, sessionName, { skipRewrite: true });
      return true;
    }
  }

  if (!documents.length) {
    const results = await semanticSearchUserDocs({ userId: session.user_id, query: question, limit: wantsLink ? 3 : 4 });
    if (!results.length) return false;
    documents = await loadUserDocsByFileIds({ userId: session.user_id, fileIds: results.map((r) => r.fileId) });
    if (!documents.length) return false;
  }

  let answer = '';
  if (wantsLink) {
    answer = buildFallbackAnswerFromUserDocs({
      question,
      documents,
      preferredDocumentName,
      includeLinks: true
    });
  } else {
    answer = await minimaxAnswerFromUserDocs({
      question,
      documents,
      preferredDocumentName
    });
    if (!answer) {
      answer = buildFallbackAnswerFromUserDocs({
        question,
        documents,
        preferredDocumentName,
        includeLinks: false
      });
    }
  }

  if (!answer) return false;

  try {
    await appendGlobalHistory(session.id, freshCtx, 'assistant', answer);
  } catch (_) {}
  await wahaSendText(chatId, answer, sessionName, { skipRewrite: true });
  return true;
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

async function resolveRootFolderIdForUser(userEmail, userId, phoneNumber, options = {}) {
  const email = String(userEmail || '').trim();
  const uid = String(userId || '').trim();
  const phone = String(phoneNumber || '').trim();
  const sessionId = String(options?.sessionId || '').trim();
  const digits = phone.replace(/[^\d]/g, '');
  const phoneVariants = Array.from(
    new Set([
      phone,
      digits || null,
      digits.length >= 11 ? digits.slice(-11) : null,
      digits.length >= 9 ? digits.slice(-9) : null,
      digits.length >= 8 ? digits.slice(-8) : null,
      digits ? `+${digits}` : null
    ].filter(Boolean))
  );
  const attempts = [];

  try {
    if (phoneVariants.length) {
      const { data, error } = await supabase
        .from('carpeta_administrador')
        .select('id_drive_carpeta')
        .in('wsp', phoneVariants)
        .limit(1)
        .maybeSingle();
      attempts.push({
        via: 'wsp',
        ok: !error,
        found: Boolean(data?.id_drive_carpeta),
        error: error ? { message: error.message, code: error.code, details: error.details, hint: error.hint } : null
      });
      if (data?.id_drive_carpeta) {
        await setWspSessionGlobal(sessionId, {
          last_root_folder_resolution: {
            via: 'wsp',
            has_service_role: Boolean(supabaseServiceKey),
            phone_variants: phoneVariants,
            email: email || null,
            user_id: uid || null,
            folder_id: data.id_drive_carpeta,
            attempts,
            ts: new Date().toISOString()
          }
        });
        return data.id_drive_carpeta;
      }
    }
  } catch (_) {}

  try {
    if (email) {
      const { data, error } = await supabase
        .from('carpeta_administrador')
        .select('id_drive_carpeta')
        .ilike('correo', email)
        .limit(1)
        .maybeSingle();
      attempts.push({
        via: 'correo',
        ok: !error,
        found: Boolean(data?.id_drive_carpeta),
        error: error ? { message: error.message, code: error.code, details: error.details, hint: error.hint } : null
      });
      if (data?.id_drive_carpeta) {
        await setWspSessionGlobal(sessionId, {
          last_root_folder_resolution: {
            via: 'correo',
            has_service_role: Boolean(supabaseServiceKey),
            phone_variants: phoneVariants,
            email,
            user_id: uid || null,
            folder_id: data.id_drive_carpeta,
            attempts,
            ts: new Date().toISOString()
          }
        });
        return data.id_drive_carpeta;
      }
    }
  } catch (_) {}

  try {
    if (uid) {
      const { data, error } = await supabase
        .from('carpeta_administrador')
        .select('id_drive_carpeta')
        .eq('user_id', uid)
        .limit(1)
        .maybeSingle();
      attempts.push({
        via: 'user_id',
        ok: !error,
        found: Boolean(data?.id_drive_carpeta),
        error: error ? { message: error.message, code: error.code, details: error.details, hint: error.hint } : null
      });
      if (data?.id_drive_carpeta) {
        await setWspSessionGlobal(sessionId, {
          last_root_folder_resolution: {
            via: 'user_id',
            has_service_role: Boolean(supabaseServiceKey),
            phone_variants: phoneVariants,
            email: email || null,
            user_id: uid,
            folder_id: data.id_drive_carpeta,
            attempts,
            ts: new Date().toISOString()
          }
        });
        return data.id_drive_carpeta;
      }
    }
  } catch (_) {}

  await setWspSessionGlobal(sessionId, {
    last_root_folder_resolution: {
      via: 'no_match',
      has_service_role: Boolean(supabaseServiceKey),
      phone_variants: phoneVariants,
      email: email || null,
      user_id: uid || null,
      folder_id: null,
      attempts,
      ts: new Date().toISOString()
    }
  });
  return null;
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
      parentFolderId = await resolveRootFolderIdForUser(user.email, user.id, session.phone_number, { sessionId: session.id });
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
  const phoneNumber = normalizePhoneFromChatId(payload?._data?.key?.remoteJidAlt || chatId);
  if (!phoneNumber) return;

  const { user: userByIncomingPhone, matchedByAdminFolder, normalizedPhone } = await resolveUserByIncomingPhone(phoneNumber);
  let session = await getOrCreateWspSession(
    normalizedPhone || phoneNumber,
    userByIncomingPhone?.id
      ? {
          user_id: userByIncomingPhone.id
        }
      : {}
  );

  if (matchedByAdminFolder && !session.user_id && userByIncomingPhone?.id) {
    session = await updateWspSession(session.id, { user_id: userByIncomingPhone.id });
  }

  if (userByIncomingPhone?.id) {
    try {
      await safeUpdateUserPhone(userByIncomingPhone.id, normalizedPhone || phoneNumber);
    } catch (_) {}
    try {
      await tryAttachWspToAdminFolder({
        userId: userByIncomingPhone.id,
        userEmail: userByIncomingPhone.email,
        phoneNumber: normalizedPhone || phoneNumber
      });
    } catch (_) {}
  }

  const textTrim = normalizeIncomingText(body);
  const textLower = normalizeForIntent(textTrim);
  const media = extractMediaFromPayload(payload);
  const explicitIntent = detectIntentRuleBased(textTrim);

  if (isMenuTrigger(textLower)) {
    if (!session.user_id) {
      const userByPhone = await getUserByPhone(phoneNumber);
      if (userByPhone) {
        try {
          await tryAttachWspToAdminFolder({ userId: userByPhone.id, userEmail: userByPhone.email, phoneNumber });
        } catch (_) {}
        session = await updateWspSession(session.id, { user_id: userByPhone.id, branch_context: {}, current_branch: null });
      }
    }

    if (!session.user_id) {
      const userByAdminWsp = await getUserFromAdminFolderByWsp(phoneNumber);
      if (userByAdminWsp) {
        try {
          await safeUpdateUserPhone(userByAdminWsp.id, phoneNumber);
        } catch (_) {}
        try {
          await tryAttachWspToAdminFolder({ userId: userByAdminWsp.id, userEmail: userByAdminWsp.email, phoneNumber });
        } catch (_) {}
        session = await updateWspSession(session.id, { user_id: userByAdminWsp.id, branch_context: {}, current_branch: null });
      }
    }

    if (!session.user_id) {
      const probe = await probeUserLookupByPhone(phoneNumber);
      await updateWspSession(session.id, { current_branch: 'verify_phone', branch_context: { awaiting_email: true, _global: { last_user_lookup: probe } } });
      await wahaSendText(chatId, `¡Hola! No encontré una cuenta asociada a este número 😊 ¿Me puedes indicar el correo con el que te registraste en Brify?`, sessionName);
      return;
    }

    await showMainMenu({ session, chatId, sessionName });
    return;
  }

  if (!session.user_id) {
    const user = await getUserByPhone(phoneNumber);
    if (user) {
      try {
        await tryAttachWspToAdminFolder({ userId: user.id, userEmail: user.email, phoneNumber });
      } catch (_) {}
      session = await updateWspSession(session.id, { user_id: user.id, branch_context: {}, current_branch: null });
    } else {
      const userByAdminWsp = await getUserFromAdminFolderByWsp(phoneNumber);
      if (userByAdminWsp) {
        try {
          await safeUpdateUserPhone(userByAdminWsp.id, phoneNumber);
        } catch (_) {}
        try {
          await tryAttachWspToAdminFolder({ userId: userByAdminWsp.id, userEmail: userByAdminWsp.email, phoneNumber });
        } catch (_) {}
        session = await updateWspSession(session.id, { user_id: userByAdminWsp.id, branch_context: {}, current_branch: null });
      } else {
      const awaitingEmail = Boolean(session.branch_context?.awaiting_email);
      if (!awaitingEmail) {
        const probe = await probeUserLookupByPhone(phoneNumber);
        session = await updateWspSession(session.id, { current_branch: 'verify_phone', branch_context: { awaiting_email: true, _global: { last_user_lookup: probe } } });
        await wahaSendText(chatId, `¡Hola! No encontré una cuenta asociada a este número 😊 ¿Me puedes indicar el correo con el que te registraste en Brify?`, sessionName);
        return;
      }

      const email = textTrim.trim().toLowerCase();
      if (!isValidEmail(email)) {
        await updateWspSession(session.id, { current_branch: 'verify_phone', branch_context: { awaiting_email: true } });
        await wahaSendText(chatId, `Para vincular tu cuenta necesito tu correo 🙌\n\nEjemplo: nombre@correo.com`, sessionName);
        return;
      }
      const byEmail = await getUserByEmail(email);
      if (!byEmail) {
        await updateWspSession(session.id, { current_branch: null, branch_context: { awaiting_email: true } });
        await wahaSendText(chatId, `Parece que aún no tienes cuenta en Brify 🙌 Puedes registrarte fácilmente aquí: ${BRIFY_REGISTER_URL}\n\nSi ya tienes cuenta, revisa el correo e inténtalo de nuevo.`, sessionName);
        return;
      }

      try {
        await safeUpdateUserPhone(byEmail.id, phoneNumber);
      } catch (_) {}
      try {
        await tryAttachWspToAdminFolder({ userId: byEmail.id, userEmail: byEmail.email, phoneNumber });
      } catch (_) {}
      session = await updateWspSession(session.id, { user_id: byEmail.id, current_branch: null, branch_context: {} });
      }
    }
  }

  const hasDrive = await isDriveLinked(session.user_id);
  if (!hasDrive) {
    const looksLikeDriveAction =
      Boolean(extractMediaFromPayload(payload)?.url) ||
      textLower.includes('archivo') ||
      textLower.includes('document') ||
      textLower.includes('imagen') ||
      textLower.includes('foto') ||
      textLower.includes('subir') ||
      textLower.includes('adjunt') ||
      textLower.includes('guardar') ||
      textLower.includes('guarda') ||
      textLower.includes('crear grupo') ||
      textLower.includes('carpeta') ||
      textLower.includes('grupo') ||
      textLower.includes('compartir') ||
      textLower.includes('invita') ||
      textLower.includes('listar') ||
      textLower.includes('muestrame') ||
      textLower.includes('muéstrame');

    if (looksLikeDriveAction) {
      await updateWspSession(session.id, { current_branch: 'await_drive', branch_context: {} });
      await wahaSendText(
        chatId,
        `Para usar las herramientas (subir/listar/compartir/crear grupos) necesitas vincular tu Google Drive primero 📂\n\nPuedes hacerlo desde tu perfil en ${BRIFY_PROFILE_URL}.`,
        sessionName
      );
      return;
    }
  }

  if (!media?.url && (!session.current_branch || session.current_branch === 'casual')) {
    const pendingResult = await tryResolvePendingFollowup({ session, chatId, text: textTrim, sessionName, payload });
    if (pendingResult.handled) return;
    session = pendingResult.session || session;
  }

  if (isExplicitCreateGroupRequest(textTrim) && session.current_branch !== 'crear_grupo') {
    await startCreateGroupFlow({ session, chatId, text: textTrim, sessionName });
    return;
  }

  if (session.current_branch && explicitIntent.intent === 'create_group' && session.current_branch !== 'crear_grupo') {
    await startCreateGroupFlow({ session, chatId, text: textTrim, sessionName });
    return;
  }

  if (session.current_branch && explicitIntent.intent === 'share_group' && session.current_branch !== 'compartir_grupo') {
    await startShareGroupFlow({ session, chatId, text: textTrim, sessionName });
    return;
  }

  if ((isLikelyDocumentKnowledgeQuestion(textTrim) || wantsDocumentLink(textTrim)) && session.current_branch !== 'subir_archivo') {
    const handledKnowledgeQuery = await handleDocumentKnowledgeQuery({ session, chatId, text: textTrim, sessionName });
    if (handledKnowledgeQuery) {
      if (session.current_branch && session.current_branch !== 'casual') {
        session = await returnSessionToCasual(session.id, {});
      }
      return;
    }
  }

  if (!media?.url && (!session.current_branch || session.current_branch === 'casual') && isLikelyDocumentAnalysisRequest(textTrim)) {
    const handledExistingDriveAnalysis = await handleExistingDriveDocumentAnalysisQuery({
      session,
      chatId,
      text: textTrim,
      sessionName
    });
    if (handledExistingDriveAnalysis) return;
  }

  if (session.current_branch && explicitIntent.intent === 'list_groups' && session.current_branch !== 'listar_grupos') {
    await enterBranch(session, chatId, sessionName, 'list_groups');
    return;
  }

  if (session.current_branch === 'asesor_legal') {
    await handleAsesorLegal({ session, chatId, text: textTrim, sessionName, payload });
    return;
  }

  if (session.current_branch === 'crear_grupo') {
    await handleCrearGrupo({ session, chatId, text: textTrim, sessionName });
    return;
  }

  if (session.current_branch === 'compartir_grupo') {
    await handleCompartirGrupo({ session, chatId, text: textTrim, sessionName });
    return;
  }

  if (session.current_branch === 'subir_archivo') {
    await handleSubirArchivo({ session, chatId, text: textTrim, sessionName, payload });
    return;
  }

  if (session.current_branch === 'listar_archivos') {
    await handleListarArchivos({ session, chatId, text: textTrim, sessionName });
    return;
  }

  if (session.current_branch === 'listar_grupos') {
    await handleListarGrupos({ session, chatId, text: textTrim, sessionName });
    return;
  }

  if (session.current_branch === 'analizar_documento') {
    await handleAnalizarDocumento({ session, chatId, text: textTrim, sessionName, payload });
    return;
  }

  if (session.current_branch === 'crear_documento') {
    await handleCrearDocumento({ session, chatId, text: textTrim, sessionName });
    return;
  }

  if (media?.url) {
    if (!hasDrive) {
      await updateWspSession(session.id, { current_branch: 'await_drive', branch_context: {} });
      await wahaSendText(
        chatId,
        `Recibí tu archivo 📎\n\nPara guardarlo en Brify necesito que vincules tu Google Drive primero: ${BRIFY_PROFILE_URL}`,
        sessionName
      );
      return;
    }

    session = await updateWspSession(session.id, { current_branch: 'subir_archivo', branch_context: { stage: 'wait_file' } });
    await handleSubirArchivo({ session, chatId, text: textTrim, sessionName, payload });
    return;
  }

  const wantsCreateGroup =
    textLower.includes('crear grupo') ||
    textLower.includes('nuevo grupo') ||
    textLower.includes('nueva carpeta') ||
    textLower.includes('crear carpeta');
  if (!session.current_branch && wantsCreateGroup) {
    if (!hasDrive) {
      await updateWspSession(session.id, { current_branch: 'await_drive', branch_context: {} });
      await wahaSendText(chatId, `Para crear grupos necesito que vincules tu Google Drive: ${BRIFY_PROFILE_URL}`, sessionName);
      return;
    }
    await startCreateGroupFlow({ session, chatId, text: textTrim, sessionName });
    return;
  }

  const wantsUpload =
    textLower.includes('subir') ||
    textLower.includes('adjunt') ||
    textLower.includes('enviar') ||
    textLower.includes('guarda') ||
    textLower.includes('guardar') ||
    textLower.includes('te enviare') ||
    textLower.includes('te enviaré') ||
    textLower.includes('te voy a enviar');
  if (!session.current_branch && wantsUpload) {
    if (!hasDrive) {
      await updateWspSession(session.id, { current_branch: 'await_drive', branch_context: {} });
      await wahaSendText(chatId, `Para guardar archivos necesito que vincules tu Google Drive: ${BRIFY_PROFILE_URL}`, sessionName);
      return;
    }

    await startUploadFileFlow({ session, chatId, text: textTrim, sessionName });
    return;
  }

  const listQuery = extractNameContainsQuery(textTrim);
  const wantsList =
    hasListIntentVerb(textLower) ||
    textLower.includes('mostrar') ||
    textLower.includes('busca') ||
    textLower.includes('buscar') ||
    (Boolean(listQuery) && (textLower.includes('archivo') || textLower.includes('document') || textLower.includes('imagen') || textLower.includes('foto')));

  if (!session.current_branch && wantsList && listQuery) {
    if (!hasDrive) {
      await updateWspSession(session.id, { current_branch: 'await_drive', branch_context: {} });
      await wahaSendText(chatId, `Para listar/buscar archivos necesito que vincules tu Google Drive: ${BRIFY_PROFILE_URL}`, sessionName);
      return;
    }

    let saveTarget = 'root';
    let selectedGroup = null;
    const groupMention = extractGroupMention(textTrim);
    if (groupMention) {
      const { data: user } = await supabase.from('users').select('email').eq('id', session.user_id).single();
      const groups = await listUserGroupsByEmail(user?.email);
      selectedGroup = findGroupByName(groups, groupMention);
      if (selectedGroup) saveTarget = 'group';
    }

    const kind =
      textLower.includes('imagen') || textLower.includes('foto') ? 'images' : textLower.includes('doc') || textLower.includes('pdf') ? 'docs' : null;

    session = await updateWspSession(session.id, {
      current_branch: 'listar_archivos',
      branch_context: { stage: 'list_now', saveTarget, selectedGroup, query: listQuery, kind }
    });
    await handleListarArchivos({ session, chatId, text: textTrim, sessionName });
    return;
  }

  if (!session.current_branch && isLikelyDocumentSearch(textTrim)) {
    const handledKnowledgeQuery = await handleDocumentKnowledgeQuery({ session, chatId, text: textTrim, sessionName });
    if (handledKnowledgeQuery) {
      return;
    }

    const results = await semanticSearchUserDocs({ userId: session.user_id, query: textTrim, limit: 5 });
    if (!results.length) {
      await handleCasualConversation({ session, chatId, text: textTrim, sessionName });
      return;
    }

    const lines = results.map((r, idx) => {
      const link = driveOpenLink(r.fileId);
      const snippet = r.snippet ? `\n🔎 ${r.snippet}${r.snippet.length >= 220 ? '…' : ''}` : '';
      return `${idx + 1}️⃣ 📄 ${r.name}\n${link}${snippet}`;
    });

    await wahaSendText(
      chatId,
      `Encontré contenido relacionado en tus archivos 👇\n\n${lines.join('\n\n')}\n\nSi quieres, dime qué parte necesitas o qué estás buscando exactamente.`,
      sessionName,
      { skipRewrite: true }
    );
    return;
  }

  const wantsShareGroup =
    textLower.includes('compartir') ||
    textLower.includes('dar acceso') ||
    textLower.includes('invita') ||
    textLower.includes('invitar') ||
    textLower.includes('agrega') ||
    textLower.includes('agregar') ||
    textLower.includes('añade') ||
    textLower.includes('anade');
  const directEmails = parseEmails(textTrim);
  if (!session.current_branch && wantsShareGroup && directEmails.length) {
    if (!hasDrive) {
      await updateWspSession(session.id, { current_branch: 'await_drive', branch_context: {} });
      await wahaSendText(chatId, `Para compartir grupos necesito que vincules tu Google Drive: ${BRIFY_PROFILE_URL}`, sessionName);
      return;
    }
    await startShareGroupFlow({ session, chatId, text: textTrim, sessionName });
    return;
  }

  const intent = await detectIntent(textTrim);
  if (intent.intent === 'menu_1') {
    await enterBranch(session, chatId, sessionName, 'legal');
    return;
  } else if (intent.intent === 'menu_2') {
    if (!hasDrive) {
      await updateWspSession(session.id, { current_branch: 'await_drive', branch_context: {} });
      await wahaSendText(chatId, `Para crear grupos necesito que vincules tu Google Drive: ${BRIFY_PROFILE_URL}`, sessionName);
      return;
    }
    await enterBranch(session, chatId, sessionName, 'create_group');
    return;
  } else if (intent.intent === 'menu_3') {
    if (!hasDrive) {
      await updateWspSession(session.id, { current_branch: 'await_drive', branch_context: {} });
      await wahaSendText(chatId, `Para compartir grupos necesito que vincules tu Google Drive: ${BRIFY_PROFILE_URL}`, sessionName);
      return;
    }
    await enterBranch(session, chatId, sessionName, 'share_group');
    return;
  } else if (intent.intent === 'menu_4') {
    if (!hasDrive) {
      await updateWspSession(session.id, { current_branch: 'await_drive', branch_context: {} });
      await wahaSendText(chatId, `Para guardar archivos necesito que vincules tu Google Drive: ${BRIFY_PROFILE_URL}`, sessionName);
      return;
    }
    await enterBranch(session, chatId, sessionName, 'upload_file');
    return;
  } else if (intent.intent === 'menu_5') {
    if (!hasDrive) {
      await updateWspSession(session.id, { current_branch: 'await_drive', branch_context: {} });
      await wahaSendText(chatId, `Para listar archivos necesito que vincules tu Google Drive: ${BRIFY_PROFILE_URL}`, sessionName);
      return;
    }
    await enterBranch(session, chatId, sessionName, 'list_files');
    return;
  } else if (intent.intent === 'menu_6') {
    if (!hasDrive) {
      await updateWspSession(session.id, { current_branch: 'await_drive', branch_context: {} });
      await wahaSendText(chatId, `Para analizar documentos necesito que vincules tu Google Drive: ${BRIFY_PROFILE_URL}`, sessionName);
      return;
    }
    await enterBranch(session, chatId, sessionName, 'analyze_document');
    return;
  }

  if (intent.intent === 'legal') {
    session = await updateWspSession(session.id, { current_branch: 'asesor_legal', branch_context: { ...(session.branch_context || {}), stage: 'choose_mode' } });
    await handleAsesorLegal({ session, chatId, text: textTrim, sessionName, payload });
    return;
  }

  if (intent.intent === 'create_group') {
    if (!hasDrive) {
      await updateWspSession(session.id, { current_branch: 'await_drive', branch_context: {} });
      await wahaSendText(chatId, `Para crear grupos necesito que vincules tu Google Drive: ${BRIFY_PROFILE_URL}`, sessionName);
      return;
    }
    await startCreateGroupFlow({ session, chatId, text: textTrim, sessionName });
    return;
  }

  if (intent.intent === 'share_group') {
    if (!hasDrive) {
      await updateWspSession(session.id, { current_branch: 'await_drive', branch_context: {} });
      await wahaSendText(chatId, `Para compartir grupos necesito que vincules tu Google Drive: ${BRIFY_PROFILE_URL}`, sessionName);
      return;
    }
    await startShareGroupFlow({ session, chatId, text: textTrim, sessionName });
    return;
  }

  if (intent.intent === 'upload_file') {
    if (!hasDrive) {
      await updateWspSession(session.id, { current_branch: 'await_drive', branch_context: {} });
      await wahaSendText(chatId, `Para guardar archivos necesito que vincules tu Google Drive: ${BRIFY_PROFILE_URL}`, sessionName);
      return;
    }
    session = await updateWspSession(session.id, { current_branch: 'subir_archivo', branch_context: { stage: 'wait_file' } });
    await handleSubirArchivo({ session, chatId, text: textTrim, sessionName, payload });
    return;
  }

  if (intent.intent === 'list_files') {
    if (!hasDrive) {
      await updateWspSession(session.id, { current_branch: 'await_drive', branch_context: {} });
      await wahaSendText(chatId, `Para listar archivos necesito que vincules tu Google Drive: ${BRIFY_PROFILE_URL}`, sessionName);
      return;
    }
    session = await updateWspSession(session.id, { current_branch: 'listar_archivos', branch_context: { stage: 'choose_location' } });
    await handleListarArchivos({ session, chatId, text: textTrim, sessionName });
    return;
  }

  if (intent.intent === 'list_groups') {
    if (!hasDrive) {
      await updateWspSession(session.id, { current_branch: 'await_drive', branch_context: {} });
      await wahaSendText(chatId, `Para listar grupos necesito que vincules tu Google Drive: ${BRIFY_PROFILE_URL}`, sessionName);
      return;
    }
    await enterBranch(session, chatId, sessionName, 'list_groups');
    return;
  }

  if (intent.intent === 'analyze_document') {
    session = await updateWspSession(session.id, { current_branch: 'analizar_documento', branch_context: { stage: 'choose_mode' } });
    await handleAnalizarDocumento({ session, chatId, text: textTrim, sessionName, payload });
    return;
  }

  if (intent.intent === 'unknown' && (isLikelyLegalTopic(textTrim) || isLikelyLawSearch(textTrim))) {
    session = await updateWspSession(session.id, { current_branch: 'asesor_legal', branch_context: { ...(session.branch_context || {}), stage: 'choose_mode' } });
    await handleAsesorLegal({ session, chatId, text: textTrim, sessionName, payload });
    return;
  }

  if (intent.intent === 'unknown' && WAHA_CASUAL_ENABLED) {
    await handleCasualConversation({ session, chatId, text: textTrim, sessionName });
    return;
  }

  await showMainMenu({ session, chatId, sessionName });
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

    const chatId = payload?._data?.key?.remoteJidAlt;
    const body = payload.body;
    if (!chatId) {
      return res.status(400).json({ success: false });
    }

    try {
      await wahaSendSeen(chatId, sessionName);
      await wahaStartTyping(chatId, sessionName);
      await handleWahaMessage({ chatId, body, payload, sessionName });
    } finally {
      await wahaStopTyping(chatId, sessionName);
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error procesando webhook WAHA (Serverless):', error);
    try {
      const payload = req.body?.payload || {};
      const sessionName = req.body?.session || DEFAULT_WAHA_SESSION;
      const chatId = payload?._data?.key?.remoteJidAlt;
      if (chatId) {
        await wahaStopTyping(chatId, sessionName);
        await wahaSendText(chatId, `Tuve un problema procesando tu mensaje 😕\n\nEscribe "menú" para reiniciar y lo intentamos de nuevo.`, sessionName, { skipRewrite: true });
      }
    } catch (_) {}
    return res.status(200).json({ success: true });
  }
};
