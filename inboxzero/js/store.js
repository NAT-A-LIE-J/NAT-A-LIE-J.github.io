const EXCLUDED_KEY = 'swipebox_excluded_ids';
const LAST_ACTION_KEY = 'swipebox_last_action';

export function getExcludedIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(EXCLUDED_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function saveExcludedIds(set) {
  localStorage.setItem(EXCLUDED_KEY, JSON.stringify([...set]));
}

export function addExcludedId(id) {
  const set = getExcludedIds();
  set.add(id);
  saveExcludedIds(set);
}

export function removeExcludedId(id) {
  const set = getExcludedIds();
  set.delete(id);
  saveExcludedIds(set);
}

export function getLastAction() {
  try {
    return JSON.parse(localStorage.getItem(LAST_ACTION_KEY) || 'null');
  } catch {
    return null;
  }
}

export function setLastAction(action) {
  if (action === null) {
    localStorage.removeItem(LAST_ACTION_KEY);
  } else {
    localStorage.setItem(LAST_ACTION_KEY, JSON.stringify(action));
  }
}
