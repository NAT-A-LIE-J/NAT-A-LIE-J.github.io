import * as auth from './auth.js';
import * as gmailApi from './gmail-api.js';
import * as store from './store.js';
import { CardStack } from './card-stack.js';

const views = {
  signedOut: document.getElementById('signedOutView'),
  loading: document.getElementById('loadingView'),
  error: document.getElementById('errorView'),
  empty: document.getElementById('emptyView'),
  stack: document.getElementById('stackView'),
};

const signInBtn = document.getElementById('signInBtn');
const signOutBtn = document.getElementById('signOutBtn');
const authError = document.getElementById('authError');
const loadingText = document.getElementById('loadingText');
const errorText = document.getElementById('errorText');
const retryBtn = document.getElementById('retryBtn');
const refreshBtn = document.getElementById('refreshBtn');
const undoBtn = document.getElementById('undoBtn');
const toastEl = document.getElementById('toast');

const cardStack = new CardStack(document.getElementById('cardStack'), {
  onSwipe: handleSwipe,
  onTapLeft: () => showCard(cursor - 1),
  onTapRight: () => showCard(cursor + 1),
});

let queueIds = [];
let nextPageToken = null;
let allLoaded = false;
let loadingMorePromise = null;
let cursor = 0;
const cardCache = new Map();
let excludedIds = new Set();
let lastAction = null;
let toastTimer = null;

function showView(name) {
  for (const [key, el] of Object.entries(views)) {
    el.hidden = key !== name;
  }
}

function showLoading(text) {
  loadingText.textContent = text;
  showView('loading');
}

function showError(message) {
  errorText.textContent = message;
  showView('error');
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2500);
}

function updateUndoButton() {
  undoBtn.disabled = !lastAction;
}

async function loadMoreIds() {
  if (allLoaded) return;
  if (loadingMorePromise) return loadingMorePromise;
  loadingMorePromise = (async () => {
    const { ids, nextPageToken: token } = await gmailApi.listMessageIds({ pageToken: nextPageToken });
    nextPageToken = token;
    const existing = new Set(queueIds);
    const fresh = ids.filter((id) => !excludedIds.has(id) && !existing.has(id));
    queueIds.push(...fresh);
    if (!nextPageToken) allLoaded = true;
  })();
  try {
    await loadingMorePromise;
  } finally {
    loadingMorePromise = null;
  }
}

function prefetch(index) {
  const id = queueIds[index];
  if (!id || cardCache.has(id)) return;
  gmailApi.getMessage(id).then((data) => cardCache.set(id, data)).catch(() => {});
}

async function showCard(index) {
  if (index < 0) index = 0;
  cursor = index;

  while (cursor >= queueIds.length && !allLoaded) {
    showLoading('Loading more…');
    try {
      await loadMoreIds();
    } catch (err) {
      showError(err.message);
      return;
    }
  }

  if (cursor >= queueIds.length) {
    showView('empty');
    return;
  }

  const id = queueIds[cursor];
  let data = cardCache.get(id);
  if (!data) {
    showLoading('Loading…');
    try {
      data = await gmailApi.getMessage(id);
      cardCache.set(id, data);
    } catch (err) {
      showError(err.message);
      return;
    }
  }

  showView('stack');
  cardStack.render(data);
  prefetch(cursor + 1);
}

async function handleSwipe(direction) {
  const id = queueIds[cursor];
  if (!id) return;
  const swipedCursor = cursor;
  let actionType;

  try {
    if (direction === 'right') {
      actionType = 'archive';
      await gmailApi.archiveMessage(id);
      queueIds.splice(swipedCursor, 1);
    } else if (direction === 'left') {
      actionType = 'delete';
      await gmailApi.deleteMessage(id);
      queueIds.splice(swipedCursor, 1);
    } else if (direction === 'up') {
      actionType = 'star';
      await gmailApi.starMessage(id);
      excludedIds.add(id);
      store.addExcludedId(id);
      queueIds.splice(swipedCursor, 1);
    } else if (direction === 'down') {
      actionType = 'unread';
      await gmailApi.markUnread(id);
    }
  } catch (err) {
    showToast('Action failed — try again');
    showCard(swipedCursor);
    return;
  }

  const action = { type: actionType, id, cursor: swipedCursor };
  lastAction = action;
  store.setLastAction(action);
  updateUndoButton();

  showCard(actionType === 'unread' ? swipedCursor + 1 : swipedCursor);
}

async function handleUndo() {
  const action = lastAction;
  if (!action) return;
  undoBtn.disabled = true;

  try {
    if (action.type === 'archive') {
      await gmailApi.undoArchive(action.id);
      queueIds.splice(Math.min(action.cursor, queueIds.length), 0, action.id);
    } else if (action.type === 'delete') {
      await gmailApi.undoDelete(action.id);
      queueIds.splice(Math.min(action.cursor, queueIds.length), 0, action.id);
    } else if (action.type === 'star') {
      await gmailApi.undoStar(action.id);
      excludedIds.delete(action.id);
      store.removeExcludedId(action.id);
      queueIds.splice(Math.min(action.cursor, queueIds.length), 0, action.id);
    } else if (action.type === 'unread') {
      await gmailApi.undoMarkUnread(action.id);
    }
  } catch (err) {
    showToast('Undo failed — try again');
    undoBtn.disabled = false;
    return;
  }

  cardCache.delete(action.id);
  lastAction = null;
  store.setLastAction(null);
  updateUndoButton();
  showCard(Math.min(action.cursor, queueIds.length));
}

async function loadInbox() {
  showLoading('Loading inbox…');
  queueIds = [];
  nextPageToken = null;
  allLoaded = false;
  cardCache.clear();
  excludedIds = store.getExcludedIds();
  lastAction = store.getLastAction();
  updateUndoButton();

  try {
    while (queueIds.length < 10 && !allLoaded) {
      await loadMoreIds();
    }
  } catch (err) {
    showError(err.message);
    return;
  }

  showCard(0);
}

function onSignedIn() {
  signOutBtn.hidden = false;
  loadInbox();
}

signInBtn.addEventListener('click', async () => {
  authError.hidden = true;
  try {
    await auth.requestToken();
    onSignedIn();
  } catch (err) {
    authError.textContent = 'Sign-in failed. Please try again.';
    authError.hidden = false;
  }
});

signOutBtn.addEventListener('click', () => {
  auth.signOut();
  signOutBtn.hidden = true;
  showView('signedOut');
});

retryBtn.addEventListener('click', () => showCard(cursor));
refreshBtn.addEventListener('click', () => loadInbox());
undoBtn.addEventListener('click', handleUndo);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

showView('signedOut');
