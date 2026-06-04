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
const WAHA_WEBHOOK_SECRET = process.env.WAHA_WEBHOOK_SECRET || '';
const BRIFY_PROFILE_URL = process.env.BRIFY_PROFILE_URL || 'https://agente.brifyai.com/profile';
const BRIFY_REGISTER_URL = process.env.BRIFY_REGISTER_URL || 'https://agente.brifyai.com/register';

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || process.env.REACT_APP_MINIMAX_API_KEY || '';
const MINIMAX_ENDPOINT = process.env.MINIMAX_ENDPOINT || process.env.REACT_APP_MINIMAX_ENDPOINT || 'https://api.minimax.io/anthropic/v1/messages';
const MINIMAX_MODEL = process.env.MINIMAX_MODEL || process.env.REACT_APP_MINIMAX_MODEL || 'MiniMax-M2.7';
const WAHA_MINIMAX_ENABLED = (process.env.WAHA_MINIMAX_ENABLED || 'true').toLowerCase() === 'true';
const WAHA_MINIMAX_TEMPERATURE = Number(process.env.WAHA_MINIMAX_TEMPERATURE || '0.7');

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

  const baseUrl = WAHA_BASE_URL.replace(/\/$/, '');
  const endpoint = WAHA_SEND_ENDPOINT.startsWith('/') ? WAHA_SEND_ENDPOINT : `/${WAHA_SEND_ENDPOINT}`;
  const response = await fetch(`${baseUrl}${endpoint}`, {
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
    const selection = textLower;
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
      await wahaSendText(chatId, `Elige un número válido 🙌`, sessionName);
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

async function handleWahaMessage({ chatId, body, sessionName }) {
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

  if (session.current_branch === 'crear_documento') {
    await handleCrearDocumento({ session, chatId, text, sessionName });
    return;
  }

  if (isCreateDocumentTrigger(textLower)) {
    await handleCrearDocumento({ session, chatId, text, sessionName });
    return;
  }

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

    await handleWahaMessage({ chatId, body, sessionName });
    return res.json({ success: true });
  } catch (error) {
    console.error('Error procesando webhook WAHA (Serverless):', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

