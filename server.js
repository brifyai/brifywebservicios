const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config(); // Cargar variables de entorno
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const crypto = require('crypto');
const { plantillas, MapeoDeClaves } = require('./api/wspTemplates');

const app = express();
const PORT = process.env.PORT || 3001;

// Configuración de Mercado Pago
const mpAccessToken = process.env.REACT_APP_MERCADO_PAGO_ACCESS_TOKEN;
const client = new MercadoPagoConfig({ accessToken: mpAccessToken });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración de Supabase
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://leoyybfbnjajkktprhro.supabase.co';
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY ||
  null;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxlb3l5YmZibmphamtrdHByaHJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4MTQ0MTYsImV4cCI6MjA2NDM5MDQxNn0.VfJoDIHgXB1k4kwgndmr2yLNDeDBBIrOVsbqaSWrjHU';
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

const WAHA_BASE_URL = process.env.WAHA_BASE_URL || '';
const WAHA_API_KEY = process.env.WAHA_API_KEY || '';
const WAHA_SESSION = process.env.WAHA_SESSION || 'default';
const WAHA_WEBHOOK_SECRET = process.env.WAHA_WEBHOOK_SECRET || '';
const BRIFY_PROFILE_URL = process.env.BRIFY_PROFILE_URL || 'https://agente.brifyai.com/profile';
const BRIFY_REGISTER_URL = process.env.BRIFY_REGISTER_URL || 'https://agente.brifyai.com/register';
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || process.env.REACT_APP_MINIMAX_API_KEY || '';
const MINIMAX_ENDPOINT = process.env.MINIMAX_ENDPOINT || process.env.REACT_APP_MINIMAX_ENDPOINT || 'https://api.minimax.io/anthropic/v1/messages';
const MINIMAX_MODEL = process.env.MINIMAX_MODEL || process.env.REACT_APP_MINIMAX_MODEL || 'MiniMax-M2.7';
const WAHA_MINIMAX_ENABLED = (process.env.WAHA_MINIMAX_ENABLED || 'true').toLowerCase() === 'true';
const WAHA_MINIMAX_TEMPERATURE = Number(process.env.WAHA_MINIMAX_TEMPERATURE || '0.7');

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

function normalizeIncomingText(text) {
  if (!text) return '';
  return String(text).trim();
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

async function wahaSendText(chatId, text) {
  if (!WAHA_BASE_URL) {
    throw new Error('WAHA_BASE_URL no configurado');
  }

  let finalText = text;
  try {
    finalText = await minimaxRewriteForWhatsApp(text);
  } catch (_) {
    finalText = text;
  }

  const response = await fetch(`${WAHA_BASE_URL.replace(/\/$/, '')}/api/sendText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(WAHA_API_KEY ? { 'X-Api-Key': WAHA_API_KEY } : {})
    },
    body: JSON.stringify({
      session: WAHA_SESSION,
      chatId,
      text: finalText
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`WAHA sendText failed: ${response.status} ${details}`);
  }

  return response.json().catch(() => null);
}

function buildMainMenu(nombre) {
  const displayName = nombre ? `, ${nombre}` : '';
  return `¡Hola${displayName}! 👋 Bienvenido/a a Brify. ¿En qué te puedo ayudar hoy?\n\n1️⃣ ⚖️ Asesor Legal\n2️⃣ 📁 Crear Grupo\n3️⃣ 🤝 Compartir Grupo\n4️⃣ 📤 Subir Archivo / Documento / Imagen\n5️⃣ 📋 Listar Documentos e Imágenes\n6️⃣ ✍️ Crear Documento\n7️⃣ 🔍 Analizar Documento\n\nPuedes escribir el número de la opción o directamente lo que necesitas hacer.`;
}

async function getOrCreateWspSession(phoneNumber) {
  const { data: existing, error } = await supabase
    .from('wsp_sessions')
    .select('*')
    .eq('phone_number', phoneNumber)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!error && existing) {
    return existing;
  }

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

  if (createError) {
    throw createError;
  }

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

  if (error) {
    throw error;
  }

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
    const { data } = await supabase
      .from('users')
      .select('*')
      .in('wssp', variants)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data;
  } catch (_) {}

  try {
    const { data } = await supabase
      .from('users')
      .select('*')
      .in('phone_number', variants)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data;
  } catch (_) {}

  return null;
}

async function getUserByEmail(email) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

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

  if (error || !adminFolder?.id_drive_carpeta) {
    return null;
  }

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
  const { error } = await supabase
    .from('documentos_administrador')
    .insert({
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

  if (error) {
    throw error;
  }
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
  const n = Number(String(text).trim());
  if (!Number.isFinite(n)) return null;
  return n;
}

async function handleCrearDocumento({ session, chatId, text }) {
  const ctx = session.branch_context || {};
  const textTrim = normalizeIncomingText(text);
  const textLower = textTrim.toLowerCase();

  if (!ctx.stage) {
    const updated = await updateWspSession(session.id, {
      current_branch: 'crear_documento',
      branch_context: { stage: 'choose_mode' }
    });
    await wahaSendText(chatId, `¡Vamos a crear tu documento! ✍️ ¿Qué tipo de documento necesitas?\n\n1️⃣ 📋 Desde plantilla predefinida\n2️⃣ 📝 Documento en blanco personalizado`);
    return updated;
  }

  if (ctx.stage === 'choose_mode') {
    if (textLower === '1' || textLower.includes('plantilla')) {
      const keys = Object.keys(plantillas);
      const lines = keys.map((k, idx) => `${idx + 1}️⃣ 📄 ${plantillas[k].nombre}`);
      await updateWspSession(session.id, {
        current_branch: 'crear_documento',
        branch_context: { stage: 'choose_template', keys }
      });
      await wahaSendText(chatId, `Perfecto ✅ Elige una plantilla:\n\n${lines.join('\n')}\n\nEscribe el número.`);
      return;
    }

    if (textLower === '2' || textLower.includes('blanco')) {
      await updateWspSession(session.id, {
        current_branch: 'crear_documento',
        branch_context: { stage: 'blank_title' }
      });
      await wahaSendText(chatId, `Genial 📝 ¿Cuál es el título del documento?`);
      return;
    }

    await wahaSendText(chatId, `No entendí esa opción 😅\n\n1️⃣ 📋 Plantilla\n2️⃣ 📝 Documento en blanco`);
    return;
  }

  if (ctx.stage === 'choose_template') {
    const selection = parseNumberSelection(textTrim);
    const keys = Array.isArray(ctx.keys) ? ctx.keys : Object.keys(plantillas);
    const selectedKey = selection ? keys[selection - 1] : null;
    if (!selectedKey || !plantillas[selectedKey]) {
      await wahaSendText(chatId, `Porfa elige un número válido 🙌`);
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
    await wahaSendText(chatId, `Perfecto ✅ Vamos con la plantilla "${plantilla.nombre}".\n\n1/${labels.length} ✍️ Ingresa: ${firstLabel}\n\nSi es opcional, puedes escribir "omitir".`);
    return;
  }

  if (ctx.stage === 'collect_vars') {
    const labels = Array.isArray(ctx.labels) ? ctx.labels : [];
    const varIndex = Number.isFinite(ctx.varIndex) ? ctx.varIndex : 0;
    const label = labels[varIndex];
    if (!label) {
      await updateWspSession(session.id, {
        current_branch: null,
        branch_context: {}
      });
      await wahaSendText(chatId, `Tuve un problema con la plantilla 😕 Escribe "menú" para volver a empezar.`);
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
      await wahaSendText(chatId, `¡Listo! ✅ ¿Dónde quieres guardarlo?\n\n1️⃣ 📂 Carpeta raíz de Brify\n2️⃣ 📁 En un grupo específico`);
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

    await wahaSendText(chatId, `${nextIndex + 1}/${labels.length} ✍️ Ingresa: ${labels[nextIndex]}\n\nSi es opcional, puedes escribir "omitir".`);
    return;
  }

  if (ctx.stage === 'blank_title') {
    const title = textTrim;
    if (!title) {
      await wahaSendText(chatId, `¿Cuál sería el título? ✍️`);
      return;
    }
    await updateWspSession(session.id, {
      current_branch: 'crear_documento',
      branch_context: { stage: 'blank_description', title }
    });
    await wahaSendText(chatId, `Perfecto ✅ Ahora dime una descripción breve o el contexto para redactarlo 📝`);
    return;
  }

  if (ctx.stage === 'blank_description') {
    const description = textTrim;
    if (!description) {
      await wahaSendText(chatId, `Dame una descripción breve para poder redactarlo 📝`);
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
    await wahaSendText(chatId, `Listo ✅ ¿Dónde quieres guardarlo?\n\n1️⃣ 📂 Carpeta raíz de Brify\n2️⃣ 📁 En un grupo específico`);
    return;
  }

  if (ctx.stage === 'choose_save_location' || ctx.stage === 'choose_save_location_blank') {
    const selection = textLower;
    if (selection !== '1' && selection !== '2') {
      await wahaSendText(chatId, `Elige una opción 🙌\n\n1️⃣ 📂 Carpeta raíz\n2️⃣ 📁 Grupo específico`);
      return;
    }

    let groups = [];
    if (selection === '2') {
      const { data, error } = await supabase
        .from('grupos_drive')
        .select('id, group_name, folder_id')
        .eq('owner_id', session.user_id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (!error && Array.isArray(data)) groups = data;
      if (!groups.length) {
        await wahaSendText(chatId, `No encontré grupos creados 📭\n\nTe lo guardo en la carpeta raíz ✅`);
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
      await wahaSendText(chatId, `¿En cuál grupo lo guardamos? 📁\n\n${lines.join('\n')}\n\nEscribe el número.`);
      return;
    }

    await updateWspSession(session.id, {
      current_branch: 'crear_documento',
      branch_context: {
        ...ctx,
        stage: 'save_now',
        saveTarget: 'root'
      }
    });
  }

  if (ctx.stage === 'choose_group') {
    const selection = parseNumberSelection(textTrim);
    const groups = Array.isArray(ctx.groups) ? ctx.groups : [];
    const selected = selection ? groups[selection - 1] : null;
    if (!selected) {
      await wahaSendText(chatId, `Elige un número válido 🙌`);
      return;
    }
    await updateWspSession(session.id, {
      current_branch: 'crear_documento',
      branch_context: {
        ...ctx,
        stage: 'save_now',
        saveTarget: 'group',
        selectedGroup: selected
      }
    });
  }

  if (ctx.stage === 'save_now') {
    const { data: user, error } = await supabase.from('users').select('*').eq('id', session.user_id).single();
    if (error || !user) {
      await updateWspSession(session.id, { current_branch: null, branch_context: {} });
      await wahaSendText(chatId, `No pude encontrar tu cuenta 😕 Escribe "menú" para reiniciar.`);
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
      await wahaSendText(chatId, `No encontré tu carpeta raíz de Brify 😕 Revisa tu configuración en ${BRIFY_PROFILE_URL}`);
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
      await wahaSendText(chatId, `✅ Listo. Guardé tu documento: ${file.webViewLink}\n\n¿Quieres hacer algo más? Escribe "menú" 🙌`);
      return;
    } catch (e) {
      await updateWspSession(session.id, { current_branch: null, branch_context: {} });
      await wahaSendText(chatId, `Tuve un error guardando el documento 😕\n\nRevisa que tu Drive esté vinculado en ${BRIFY_PROFILE_URL} y vuelve a intentar. Escribe "menú" para empezar de nuevo.`);
      return;
    }
  }
}

async function handleWahaMessage({ chatId, body, payload }) {
  const phoneLookupId = payload?._data?.key?.remoteJidAlt || payload?._data?.key?.remoteJidAlt?.toString?.() || payload?._data?.key?.remoteJid || payload?.from || chatId;
  const phoneNumber = normalizePhoneFromChatId(phoneLookupId);
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
      await wahaSendText(chatId, `¡Hola! No encontré una cuenta asociada a este número 😊 ¿Me puedes indicar el correo con el que te registraste en Brify?`);
      return;
    }

    const { data: user } = await supabase.from('users').select('name, full_name').eq('id', session.user_id).single();
    await wahaSendText(chatId, buildMainMenu(user?.name || user?.full_name || ''));
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
        await wahaSendText(chatId, `¡Hola! No encontré una cuenta asociada a este número 😊 ¿Me puedes indicar el correo con el que te registraste en Brify?`);
        return;
      }

      const email = text.trim().toLowerCase();
      const byEmail = await getUserByEmail(email);
      if (!byEmail) {
        await updateWspSession(session.id, { current_branch: null, branch_context: { awaiting_email: true } });
        await wahaSendText(chatId, `Parece que aún no tienes cuenta en Brify 🙌 Puedes registrarte fácilmente aquí: ${BRIFY_REGISTER_URL}\n\nSi ya tienes cuenta, revisa el correo e inténtalo de nuevo.`);
        return;
      }

      await supabase
        .from('users')
        .update({ phone_number: phoneNumber, wssp: phoneNumber, phone_verified: true, updated_at: new Date().toISOString() })
        .eq('id', byEmail.id);
      session = await updateWspSession(session.id, { user_id: byEmail.id, current_branch: null, branch_context: {} });
    }
  }

  const hasDrive = await isDriveLinked(session.user_id);
  if (!hasDrive) {
    await updateWspSession(session.id, { current_branch: 'await_drive', branch_context: {} });
    await wahaSendText(chatId, `Para usar todas las herramientas de Brify en WhatsApp necesitas vincular tu Google Drive primero 📂\n\nPuedes hacerlo desde tu perfil en ${BRIFY_PROFILE_URL}. ¡Avísame cuando lo hagas!`);
    return;
  }

  if (session.current_branch === 'crear_documento') {
    await handleCrearDocumento({ session, chatId, text });
    return;
  }

  if (isCreateDocumentTrigger(textLower)) {
    await handleCrearDocumento({ session, chatId, text });
    return;
  }

  const { data: user } = await supabase.from('users').select('name, full_name').eq('id', session.user_id).single();
  await wahaSendText(chatId, buildMainMenu(user?.name || user?.full_name || ''));
}

// Endpoint para crear preferencia de Mercado Pago
app.post('/api/create_preference', async (req, res) => {
  try {
    const { items, payer, metadata, back_urls } = req.body;
    
    if (!mpAccessToken) {
      console.error('❌ Mercado Pago Access Token no configurado en variables de entorno');
      return res.status(500).json({ error: 'Mercado Pago Access Token no configurado' });
    }

    console.log('📝 Creando preferencia MP con datos:', JSON.stringify({ items, payer, metadata }, null, 2));

    const preference = new Preference(client);
    
    // Determinar URL base para redirección
    const isDev = process.env.NODE_ENV !== 'production';
    
    // Configuración robusta de URL base para producción
    // Prioridad: 1. Variable de entorno FRONTEND_URL, 2. URL hardcodeada de producción, 3. Detección automática
    let baseUrl;
    if (process.env.FRONTEND_URL) {
      baseUrl = process.env.FRONTEND_URL;
    } else if (!isDev) {
      baseUrl = 'https://agente.brifyai.com';
    } else {
      baseUrl = 'http://localhost:3000';
    }

    // Asegurar que no termine en slash
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }

    console.log(`🔗 Usando Base URL para redirecciones: ${baseUrl}`);

    // Validar que back_urls tenga estructura correcta
    const successUrl = back_urls?.success || `${baseUrl}/payment/result`;
    const failureUrl = back_urls?.failure || `${baseUrl}/payment/result`;
    const pendingUrl = back_urls?.pending || `${baseUrl}/payment/result`;

    const preferenceBody = {
      items,
      payer,
      metadata,
      back_urls: {
        success: successUrl,
        failure: failureUrl,
        pending: pendingUrl
      },
      auto_return: 'approved',
    };

    console.log('🚀 Enviando preferencia a Mercado Pago:', JSON.stringify(preferenceBody, null, 2));

    const result = await preference.create({
      body: preferenceBody
    });

    res.json({
      id: result.id,
      init_point: result.init_point,
    });
  } catch (error) {
    console.error('Error creando preferencia MP:', error);
    res.status(500).json({ error: 'Error al crear la preferencia de pago', details: error.message });
  }
});

// Endpoint para verificar pago
app.post('/api/verify_payment', async (req, res) => {
  try {
    const { payment_id } = req.body;
    
    if (!payment_id) {
      return res.status(400).json({ error: 'Payment ID requerido' });
    }

    const payment = new Payment(client);
    const paymentData = await payment.get({ id: payment_id });

    res.json({
      status: paymentData.status,
      status_detail: paymentData.status_detail,
      metadata: paymentData.metadata,
      transaction_amount: paymentData.transaction_amount,
      currency_id: paymentData.currency_id,
      date_approved: paymentData.date_approved
    });

  } catch (error) {
    console.error('Error verificando pago MP:', error);
    res.status(500).json({ error: 'Error al verificar el pago', details: error.message });
  }
});

// Función para extraer el ID del archivo de la URI de Google Drive
function extractFileIdFromUri(resourceUri) {
  if (!resourceUri) return null;
  
  // Buscar patrones comunes en las URIs de Google Drive
  const patterns = [
    /\/files\/([a-zA-Z0-9_-]+)/,
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
    /\/([a-zA-Z0-9_-]{25,})/
  ];
  
  for (const pattern of patterns) {
    const match = resourceUri.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

// Función para obtener detalles del archivo desde Google Drive API
async function getFileDetails(fileId, accessToken) {
  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    
    const drive = google.drive({ 
      version: 'v3',
      auth: oauth2Client
    });
    
    const response = await drive.files.get({
      fileId: fileId,
      fields: 'id,name,mimeType,size,createdTime,modifiedTime,parents,owners,webViewLink'
    });
    
    return response.data;
  } catch (error) {
    console.error('Error obteniendo detalles del archivo:', error);
    return null;
  }
}

// Endpoint para recibir notificaciones de Google Drive desde n8n
app.post('/api/webhook/drive-notifications', async (req, res) => {
  try {
    console.log('📨 Notificación recibida desde n8n:', JSON.stringify(req.body, null, 2));
    
    const { headers, body, processedData } = req.body;
    
    if (!headers) {
      return res.status(400).json({ 
        success: false, 
        error: 'Headers requeridos no encontrados' 
      });
    }
    
    // Extraer información de los headers
    const channelId = headers['x-goog-channel-id'];
    const resourceState = headers['x-goog-resource-state'];
    const resourceUri = headers['x-goog-resource-uri'];
    const changed = headers['x-goog-changed'];
    const messageNumber = headers['x-goog-message-number'];
    
    console.log('🔍 Datos extraídos:', {
      channelId,
      resourceState,
      resourceUri,
      changed,
      messageNumber
    });
    
    if (!channelId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Channel ID no encontrado en headers' 
      });
    }
    
    // Buscar el watch channel en la base de datos
    // Buscar por 'channel_id' que es el campo que contiene el ID del canal de Google Drive
    const { data: watchChannel, error: watchError } = await supabase
      .from('drive_watch_channels')
      .select('*')
      .eq('channel_id', channelId)
      .eq('is_active', true)
      .single();
    
    if (watchError || !watchChannel) {
      console.error('❌ Watch channel no encontrado:', watchError);
      console.error('❌ Detalles del error:', JSON.stringify(watchError, null, 2));
      return res.status(404).json({ 
        success: false, 
        error: 'Watch channel no encontrado o inactivo',
        details: watchError?.message 
      });
    }
    
    console.log('✅ Watch channel encontrado:', watchChannel);
    
    // Obtener credenciales de Google del usuario (opcional para esta prueba)
    let userCredentials = null;
    try {
      const { data, error } = await supabase
        .from('user_credentials')
        .select('google_access_token')
        .eq('user_id', watchChannel.user_id)
        .single();
      
      if (!error) {
        userCredentials = data;
        console.log('🔑 Credenciales obtenidas correctamente');
      } else {
        console.log('⚠️ No se pudieron obtener credenciales:', error.message);
      }
    } catch (err) {
      console.log('⚠️ Error al obtener credenciales:', err.message);
    }
    
    console.log('✅ Watch channel encontrado:', watchChannel.id);
    
    // Extraer ID del archivo de la URI
    const fileId = extractFileIdFromUri(resourceUri);
    console.log('📁 ID del archivo extraído:', fileId);
    
    // Obtener detalles del archivo si tenemos el ID
    let fileDetails = null;
    if (fileId && userCredentials?.google_access_token) {
      fileDetails = await getFileDetails(fileId, userCredentials.google_access_token);
      console.log('📋 Detalles del archivo:', fileDetails);
    }
    
    // Determinar el tipo de cambio
    let changeType = 'unknown';
    if (resourceState === 'update') {
      if (changed === 'children') {
        changeType = 'file_added_or_removed';
      } else if (changed === 'content') {
        changeType = 'file_modified';
      } else if (changed === 'permissions') {
        changeType = 'permissions_changed';
      }
    } else if (resourceState === 'trash') {
      changeType = 'file_trashed';
    } else if (resourceState === 'sync') {
      changeType = 'sync_event';
    }
    
    console.log('🔄 Tipo de cambio determinado:', changeType);
    
    // Guardar la notificación en la base de datos
    const notificationData = {
      channel_id: channelId,
      resource_state: resourceState,
      resource_uri: resourceUri,
      changed_files: changed,
      notification_data: {
        headers: headers,
        body: body,
        processedData: processedData,
        fileDetails: fileDetails,
        changeType: changeType,
        fileId: fileId
      },
      processed_at: new Date().toISOString()
    };
    
    const { data: savedNotification, error: saveError } = await supabase
      .from('drive_notifications')
      .insert(notificationData)
      .select()
      .single();
    
    if (saveError) {
      console.error('❌ Error guardando notificación:', saveError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error guardando notificación en la base de datos' 
      });
    }
    
    console.log('✅ Notificación guardada exitosamente:', savedNotification.id);
    
    // Respuesta exitosa
    res.json({
      success: true,
      message: 'Notificación procesada exitosamente',
      data: {
        notificationId: savedNotification.id,
        changeType: changeType,
        fileId: fileId,
        fileName: fileDetails?.name || 'Desconocido',
        resourceState: resourceState,
        changed: changed
      }
    });
    
  } catch (error) {
    console.error('💥 Error procesando notificación:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
});

app.post('/api/waha/webhook', async (req, res) => {
  try {
    if (WAHA_WEBHOOK_SECRET) {
      const provided = req.headers['x-brify-webhook-secret'];
      if (provided !== WAHA_WEBHOOK_SECRET) {
        return res.status(401).json({ success: false });
      }
    }

    const event = req.body?.event;
    const payload = req.body?.payload || {};
    if (event !== 'message') {
      return res.json({ success: true });
    }

    if (payload.fromMe) {
      return res.json({ success: true });
    }

    const chatId = payload.from || payload.chatId;
    const body = payload.body;
    if (!chatId) {
      return res.status(400).json({ success: false });
    }

    await handleWahaMessage({ chatId, body, payload });
    res.json({ success: true });
  } catch (error) {
    console.error('Error procesando webhook WAHA:', error);
    res.status(500).json({ success: false });
  }
});

// Endpoint de prueba
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Servir archivos estáticos de React en producción
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
}

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
  console.log(`📡 API disponible en http://localhost:${PORT}/api`);
  if (process.env.NODE_ENV !== 'production') {
    console.log('🔧 Modo desarrollo: React debe ejecutarse por separado en puerto 3000');
  }
});
