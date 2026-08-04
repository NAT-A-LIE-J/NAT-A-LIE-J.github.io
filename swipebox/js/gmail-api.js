import { ensureAccessToken, requestToken } from './auth.js';

const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

async function apiFetch(path, options = {}, allowRetry = true) {
  const token = await ensureAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401 && allowRetry) {
    await requestToken();
    return apiFetch(path, options, false);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gmail API ${res.status}: ${body.slice(0, 200)}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function listMessageIds({ pageToken } = {}) {
  const params = new URLSearchParams({ labelIds: 'INBOX', maxResults: '25' });
  if (pageToken) params.set('pageToken', pageToken);
  const data = await apiFetch(`/messages?${params.toString()}`);
  return {
    ids: (data.messages || []).map((m) => m.id),
    nextPageToken: data.nextPageToken || null,
  };
}

function decodeBase64Url(data) {
  if (!data) return '';
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

function extractParts(payload) {
  let html = null;
  let text = null;
  let hasAttachments = false;

  function walk(part) {
    if (!part) return;
    if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
      hasAttachments = true;
    }
    if (part.mimeType === 'text/html' && part.body?.data && html === null) {
      html = decodeBase64Url(part.body.data);
    } else if (part.mimeType === 'text/plain' && part.body?.data && text === null) {
      text = decodeBase64Url(part.body.data);
    }
    if (part.parts) part.parts.forEach(walk);
  }

  walk(payload);
  return { html, text, hasAttachments };
}

function parseMessage(msg) {
  const headers = msg.payload?.headers || [];
  const get = (name) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
  const { html, text, hasAttachments } = extractParts(msg.payload);
  const labelIds = msg.labelIds || [];

  return {
    id: msg.id,
    threadId: msg.threadId,
    from: get('From'),
    subject: get('Subject') || '(no subject)',
    dateHeader: get('Date'),
    internalDate: Number(msg.internalDate) || 0,
    unread: labelIds.includes('UNREAD'),
    starred: labelIds.includes('STARRED'),
    hasAttachments,
    bodyHtml: html,
    bodyText: text,
  };
}

export async function getMessage(id) {
  const data = await apiFetch(`/messages/${id}?format=full`);
  return parseMessage(data);
}

function modifyMessage(id, { add = [], remove = [] } = {}) {
  return apiFetch(`/messages/${id}/modify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ addLabelIds: add, removeLabelIds: remove }),
  });
}

function trashMessage(id) {
  return apiFetch(`/messages/${id}/trash`, { method: 'POST' });
}

function untrashMessage(id) {
  return apiFetch(`/messages/${id}/untrash`, { method: 'POST' });
}

// Archiving, deleting, and starring also mark the message read, since
// swiping on it means you've now seen the full body (spec §6).

export function archiveMessage(id) {
  return modifyMessage(id, { remove: ['INBOX', 'UNREAD'] });
}
export function undoArchive(id) {
  return modifyMessage(id, { add: ['INBOX'] });
}

export async function deleteMessage(id) {
  await modifyMessage(id, { remove: ['UNREAD'] });
  return trashMessage(id);
}
export function undoDelete(id) {
  return untrashMessage(id);
}

export function starMessage(id) {
  return modifyMessage(id, { add: ['STARRED'], remove: ['UNREAD'] });
}
export function undoStar(id) {
  return modifyMessage(id, { remove: ['STARRED'] });
}

export function markUnread(id) {
  return modifyMessage(id, { add: ['UNREAD'] });
}
export function undoMarkUnread(id) {
  return modifyMessage(id, { remove: ['UNREAD'] });
}
