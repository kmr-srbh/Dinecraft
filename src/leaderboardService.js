/**
 * Leaderboard service using jsonbin.io free JSON storage API.
 *
 * API key is loaded from Vite env vars (VITE_JSONBIN_API_KEY).
 * Bin ID can be set via env var (VITE_JSONBIN_BIN_ID) or auto-created
 * on first use and cached in localStorage.
 *
 * localStorage is used as a write-through cache so the leaderboard
 * still displays when jsonbin is unreachable.
 */

const API_KEY = import.meta.env.VITE_JSONBIN_API_KEY || '';
const ENV_BIN_ID = import.meta.env.VITE_JSONBIN_BIN_ID || '';
const JSONBIN_BASE = 'https://api.jsonbin.io/v3';
const LS_BIN_ID_KEY = 'dino3d_jsonbin_bin_id';
const LS_LEADERBOARD_KEY = 'dino3d_leaderboard_v4';
const MAX_DISPLAY = 50;

/**
 * Get the bin ID — from env var, or from localStorage (set after first creation).
 */
function getBinId() {
  return ENV_BIN_ID || localStorage.getItem(LS_BIN_ID_KEY) || '';
}

/**
 * Save the bin ID to localStorage for future sessions.
 */
function saveBinId(id) {
  localStorage.setItem(LS_BIN_ID_KEY, id);
}

/**
 * Read the cached leaderboard from localStorage.
 */
function getCachedLeaderboard() {
  try {
    const raw = localStorage.getItem(LS_LEADERBOARD_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Write the leaderboard to localStorage cache.
 */
function setCachedLeaderboard(list) {
  localStorage.setItem(LS_LEADERBOARD_KEY, JSON.stringify(list));
}

/**
 * Create a new jsonbin bin with an empty leaderboard.
 * Called once on first game over if no bin exists yet.
 * Returns the new bin ID.
 */
async function createBin() {
  if (!API_KEY) {
    console.warn('[Leaderboard] No VITE_JSONBIN_API_KEY set — leaderboard is local-only.');
    return '';
  }

  const res = await fetch(`${JSONBIN_BASE}/b`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': API_KEY,
      'X-Bin-Private': 'false',
      'X-Bin-Name': 'dinecraft-leaderboard',
    },
    body: JSON.stringify({ leaderboard: [] }),
  });

  if (!res.ok) {
    throw new Error(`Failed to create bin: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const binId = data.metadata?.id;
  if (binId) {
    console.log('[Leaderboard] Successfully created new remote bin on jsonbin.io:', binId);
    saveBinId(binId);
  }
  return binId || '';
}

/**
 * Ensure a bin exists. Returns the bin ID.
 * If no bin exists yet, creates one.
 */
async function ensureBin() {
  let binId = getBinId();
  if (!binId) {
    binId = await createBin();
  }
  return binId;
}

/**
 * Fetch the current leaderboard from jsonbin.
 * Returns a sorted array of { name, score } entries.
 * Falls back to localStorage cache on failure.
 */
export async function fetchLeaderboard() {
  const binId = getBinId();
  if (!binId) {
    return getCachedLeaderboard();
  }

  try {
    const res = await fetch(`${JSONBIN_BASE}/b/${binId}/latest`, {
      headers: {
        'X-Master-Key': API_KEY,
      },
    });

    if (!res.ok) {
      throw new Error(`Fetch failed: ${res.status}`);
    }

    const data = await res.json();
    const list = Array.isArray(data.record?.leaderboard) ? data.record.leaderboard : [];

    // Sort descending by score, return top MAX_DISPLAY for display
    list.sort((a, b) => b.score - a.score);
    const trimmed = list.slice(0, MAX_DISPLAY);

    // Update cache
    setCachedLeaderboard(trimmed);
    return trimmed;
  } catch (err) {
    console.warn('[Leaderboard] Fetch failed, using cache:', err.message);
    return getCachedLeaderboard();
  }
}

/**
 * Return the total number of unique players who have ever submitted a score.
 * Uses the full (uncapped) remote leaderboard list length.
 * Falls back to the cached leaderboard length.
 */
export async function fetchPlayerCount() {
  const binId = getBinId();
  if (!binId) {
    return getCachedLeaderboard().length;
  }

  try {
    const res = await fetch(`${JSONBIN_BASE}/b/${binId}/latest`, {
      headers: {
        'X-Master-Key': API_KEY,
      },
    });

    if (!res.ok) {
      throw new Error(`Fetch failed: ${res.status}`);
    }

    const data = await res.json();
    const list = Array.isArray(data.record?.leaderboard) ? data.record.leaderboard : [];
    return list.length;
  } catch (err) {
    console.warn('[Leaderboard] Player count fetch failed, using cache:', err.message);
    return getCachedLeaderboard().length;
  }
}

/**
 * Submit a score to the global leaderboard.
 * If the player already exists, only updates if the new score is higher.
 * Returns the updated leaderboard array.
 */
export async function submitScore(name, score) {
  if (!name || score <= 0) return getCachedLeaderboard();

  const flooredScore = Math.floor(score);

  // Optimistically update the local cache first
  let list = getCachedLeaderboard();
  list = mergeScore(list, name, flooredScore);
  setCachedLeaderboard(list);

  // Try to sync with jsonbin
  try {
    const binId = await ensureBin();
    if (!binId) {
      console.warn('[Leaderboard] No bin ID available. Leaderboard will remain local.');
      return list;
    }

    console.log('[Leaderboard] Fetching current remote leaderboard from bin:', binId);
    // Fetch current remote state
    const res = await fetch(`${JSONBIN_BASE}/b/${binId}/latest`, {
      headers: {
        'X-Master-Key': API_KEY,
      },
    });

    let remoteList = [];
    if (res.ok) {
      const data = await res.json();
      remoteList = Array.isArray(data.record?.leaderboard) ? data.record.leaderboard : [];
    }

    // Merge the new score into the remote list
    remoteList = mergeScore(remoteList, name, flooredScore);

    // Write back
    const putRes = await fetch(`${JSONBIN_BASE}/b/${binId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': API_KEY,
      },
      body: JSON.stringify({ leaderboard: remoteList }),
    });

    if (putRes.ok) {
      console.log('[Leaderboard] Successfully saved updated score to remote bin.');
      setCachedLeaderboard(remoteList);
      return remoteList;
    } else {
      console.warn('[Leaderboard] Failed to save score. status:', putRes.status);
    }

    return list;
  } catch (err) {
    console.warn('[Leaderboard] Submit failed, using local cache:', err.message);
    return list;
  }
}

/**
 * Merge a score into a leaderboard list.
 * Updates existing entry if new score is higher, otherwise adds a new entry.
 * Returns sorted, capped list.
 */
function mergeScore(list, name, score) {
  const copy = [...list];
  const existingIdx = copy.findIndex(
    (item) => item.name.toUpperCase() === name.toUpperCase()
  );

  if (existingIdx !== -1) {
    if (score > copy[existingIdx].score) {
      copy[existingIdx].score = score;
    }
  } else {
    copy.push({ name, score });
  }

  copy.sort((a, b) => b.score - a.score);
  return copy;
}
