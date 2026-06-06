const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY ||
  null;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

const ADMIN_SECRET = process.env.BRIFY_ADMIN_SECRET || '';

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.REACT_APP_GEMINI_API_KEY ||
  process.env.REACT_APP_GOOGLE_GEMINI_API_KEY ||
  process.env.GOOGLE_GEMINI_API_KEY ||
  '';
const GEMINI_EMBEDDINGS_MODEL =
  process.env.GEMINI_EMBEDDINGS_MODEL ||
  process.env.REACT_APP_GEMINI_EMBEDDINGS_MODEL ||
  'text-embedding-004';

const TIMEOUT_MS = Number(process.env.WAHA_EMBEDDINGS_TIMEOUT_MS || '15000');
const MAX_CHUNKS = Number(process.env.WAHA_EMBEDDINGS_MAX_CHUNKS || '24');

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

async function minimaxEmbedTexts(texts, embedType = 'db') {
  void embedType;
  if (!GEMINI_API_KEY) return null;
  const inputs = Array.isArray(texts) ? texts.map((t) => String(t || '').trim()).filter(Boolean) : [];
  if (!inputs.length) return null;

  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: GEMINI_EMBEDDINGS_MODEL });

  const out = [];
  const timeoutMs = Number.isFinite(TIMEOUT_MS) && TIMEOUT_MS > 0 ? TIMEOUT_MS : 15000;

  for (const input of inputs) {
    const embedCall = async () => {
      try {
        return await model.embedContent({
          content: { parts: [{ text: input }] },
          taskType: 'RETRIEVAL_DOCUMENT'
        });
      } catch (_) {
        try {
          return await model.embedContent(input);
        } catch (__) {
          try {
            return await model.embedContent({ content: input });
          } catch (___) {
            return null;
          }
        }
      }
    };

    const result = await Promise.race([
      embedCall(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini embeddings timeout')), timeoutMs))
    ]).catch(() => null);

    const values = result?.embedding?.values;
    if (!Array.isArray(values)) return null;
    out.push(normalizeEmbeddingTo768(values));
  }

  return out.length ? out : null;
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

async function extractDriveFileTextAdvanced({ userId, fileId, mimeType }) {
  const drive = await getDriveClientForUser(userId);
  const mt = String(mimeType || '').trim();

  if (mt === 'application/vnd.google-apps.document') {
    const res = await drive.files.export({ fileId, mimeType: 'text/plain' }, { responseType: 'arraybuffer' });
    return Buffer.from(res.data).toString('utf8').trim() || null;
  }

  if (mt.startsWith('text/')) {
    const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
    return Buffer.from(res.data).toString('utf8').trim() || null;
  }

  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
  const buf = Buffer.from(res.data);

  if (mt === 'application/pdf') {
    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
    const pages = Math.min(doc.numPages || 0, 25);
    let out = '';
    for (let i = 1; i <= pages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const line = (content?.items || []).map((it) => it?.str || '').join(' ');
      out += `${line}\n`;
    }
    return out.trim() || null;
  }

  if (mt === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer: buf });
    const value = typeof result?.value === 'string' ? result.value : '';
    return value.trim() || null;
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
    const joined = parts.join('\n\n');
    return joined.trim() || null;
  }

  return null;
}

async function upsertDocumentoAdministradorByFile({ userEmail, fileId, patch }) {
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

async function vectorizeDriveFileToSupabase({ userId, userEmail, fileId, fileName, mimeType, fileSize }) {
  await upsertDocumentoAdministradorByFile({
    userEmail,
    fileId,
    patch: {
      name: fileName || null,
      file_type: mimeType || null,
      file_size: Number.isFinite(Number(fileSize)) ? Number(fileSize) : null,
      servicio: 'general',
      pendiente: true,
      metadata: { source: 'memory', vector_status: 'pending' },
      nombre_limpio: String(fileName || '').toLowerCase().replace(/[^a-z0-9]/g, '_')
    }
  });

  const text = await extractDriveFileTextAdvanced({ userId, fileId, mimeType });
  if (!text) {
    await upsertDocumentoAdministradorByFile({ userEmail, fileId, patch: { pendiente: true, metadata: { vector_status: 'pending_no_text' } } });
    return { ok: false, reason: 'no_text' };
  }

  const trimmed = text.length > 90000 ? text.slice(0, 90000) : text;
  const chunks = splitTextIntoChunks(trimmed, 2200, 200).slice(0, Number.isFinite(MAX_CHUNKS) ? MAX_CHUNKS : 24);
  if (!chunks.length) {
    await upsertDocumentoAdministradorByFile({ userEmail, fileId, patch: { pendiente: true, metadata: { vector_status: 'pending_empty_text' } } });
    return { ok: false, reason: 'empty_text' };
  }

  const embeddings = await minimaxEmbedTexts(chunks, 'db');
  if (!embeddings || embeddings.length !== chunks.length) {
    await upsertDocumentoAdministradorByFile({ userEmail, fileId, patch: { pendiente: true, metadata: { vector_status: 'pending_embed_error' } } });
    return { ok: false, reason: 'embed_failed' };
  }

  try {
    await supabase.from('documentos_entrenador').delete().eq('entrenador', userEmail).eq('metadata->>file_id', fileId);
  } catch (_) {}

  const rows = chunks.map((c, idx) => ({
    content: c,
    embedding: embeddings[idx],
    entrenador: userEmail,
    folder_id: null,
    metadata: {
      file_id: fileId,
      file_name: fileName || null,
      chunk_type: 'chunk',
      chunk_index: idx,
      chunk_of_total: chunks.length
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));
  const { error: insertError } = await supabase.from('documentos_entrenador').insert(rows);
  if (insertError) {
    await upsertDocumentoAdministradorByFile({ userEmail, fileId, patch: { pendiente: true, metadata: { vector_status: 'pending_chunk_insert_error' } } });
    return { ok: false, reason: 'chunk_insert_failed' };
  }

  await upsertDocumentoAdministradorByFile({
    userEmail,
    fileId,
    patch: {
      content: trimmed.slice(0, 12000),
      embedding: embeddings[0],
      pendiente: false,
      metadata: { vector_status: 'ready', vectorized_at: new Date().toISOString(), chunk_count: chunks.length }
    }
  });

  return { ok: true, chunks: chunks.length };
}

async function resolveUser({ userId, userEmail }) {
  if (userId) {
    const { data } = await supabase.from('users').select('id,email').eq('id', userId).single();
    if (data?.id && data?.email) return { id: data.id, email: data.email };
  }
  if (userEmail) {
    const { data } = await supabase.from('users').select('id,email').eq('email', userEmail).single();
    if (data?.id && data?.email) return { id: data.id, email: data.email };
  }
  return null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-brify-admin-secret');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    if (ADMIN_SECRET) {
      const provided = req.headers['x-brify-admin-secret'];
      if (provided !== ADMIN_SECRET) {
        return res.status(401).json({ success: false });
      }
    }

    const mode = String(req.body?.mode || 'backfill').toLowerCase();
    const fileId = req.body?.fileId ? String(req.body.fileId) : null;
    const userId = req.body?.userId ? String(req.body.userId) : null;
    const userEmail = req.body?.userEmail ? String(req.body.userEmail) : null;
    const limit = Number(req.body?.limit || 10);

    const user = await resolveUser({ userId, userEmail });
    if (!user) return res.status(400).json({ success: false, error: 'user_not_found' });

    if (mode === 'single') {
      if (!fileId) return res.status(400).json({ success: false, error: 'missing_fileId' });
      const drive = await getDriveClientForUser(user.id);
      const info = await drive.files.get({ fileId, fields: 'id,name,mimeType,size' });
      const meta = info?.data || {};
      const result = await vectorizeDriveFileToSupabase({
        userId: user.id,
        userEmail: user.email,
        fileId,
        fileName: meta.name || null,
        mimeType: meta.mimeType || null,
        fileSize: meta.size || null
      });
      return res.json({ success: true, mode: 'single', result });
    }

    const take = Number.isFinite(limit) ? Math.max(1, Math.min(50, limit)) : 10;
    const { data: docs } = await supabase
      .from('documentos_administrador')
      .select('file_id,name,file_type,file_size,pendiente,updated_at')
      .eq('administrador', user.email)
      .not('file_id', 'is', null)
      .or('pendiente.eq.true,embedding.is.null')
      .order('updated_at', { ascending: false })
      .limit(take);

    const list = Array.isArray(docs) ? docs : [];
    const results = [];
    for (const d of list) {
      if (!d?.file_id) continue;
      try {
        const r = await vectorizeDriveFileToSupabase({
          userId: user.id,
          userEmail: user.email,
          fileId: d.file_id,
          fileName: d.name || null,
          mimeType: d.file_type || null,
          fileSize: d.file_size || null
        });
        results.push({ fileId: d.file_id, ok: Boolean(r?.ok), reason: r?.reason || null, chunks: r?.chunks || 0 });
      } catch (e) {
        results.push({ fileId: d.file_id, ok: false, reason: e?.message || 'error', chunks: 0 });
      }
    }

    return res.json({ success: true, mode: 'backfill', processed: results.length, results });
  } catch (error) {
    return res.status(500).json({ success: false, error: error?.message || 'error' });
  }
};
