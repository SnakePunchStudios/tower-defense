import type { MapData } from '../types';
import { DataManager } from './DataManager';

// ── GitHub repo config ──
const REPO_OWNER = 'SnakePunchStudios';
const REPO_NAME = 'tower-defense';
const BRANCH = 'main';
const MAPS_DIR = 'community-maps';
const INDEX_FILE = `${MAPS_DIR}/index.json`;

// ── localStorage keys ──
const TOKEN_KEY = 'td-github-token';
const AUTHOR_KEY = 'td-author-name';
const LAST_SYNC_KEY = 'td-last-sync';

// ── Types ──
export interface CommunityMapEntry {
  id: string;
  name: string;
  author: string;
  uploadedAt: string;
}

export interface CommunityIndex {
  version: number;
  maps: CommunityMapEntry[];
}

// ── Token management ──

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token.trim());
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getAuthorName(): string | null {
  return localStorage.getItem(AUTHOR_KEY);
}

export function setAuthorName(name: string): void {
  localStorage.setItem(AUTHOR_KEY, name.trim());
}

export function getLastSyncTime(): string | null {
  return localStorage.getItem(LAST_SYNC_KEY);
}

// ── Fetch helper with timeout ──

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = 8000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    return resp;
  } finally {
    clearTimeout(timer);
  }
}

// ── Raw file reading (no auth needed — public repo) ──

function rawUrl(path: string): string {
  return `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${path}`;
}

function apiUrl(path: string): string {
  return `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;
}

// ── Read community index ──

export async function fetchCommunityIndex(): Promise<CommunityIndex> {
  try {
    // Add cache-busting query param so we always get the latest
    const resp = await fetchWithTimeout(rawUrl(INDEX_FILE) + `?t=${Date.now()}`);
    if (!resp.ok) {
      // 404 means no index yet — that's fine
      return { version: 1, maps: [] };
    }
    return (await resp.json()) as CommunityIndex;
  } catch {
    // Network error — return empty
    return { version: 1, maps: [] };
  }
}

// ── Read a single community map ──

export async function fetchCommunityMap(id: string): Promise<MapData | null> {
  try {
    const resp = await fetchWithTimeout(rawUrl(`${MAPS_DIR}/${id}.json`) + `?t=${Date.now()}`);
    if (!resp.ok) return null;
    return (await resp.json()) as MapData;
  } catch {
    return null;
  }
}

// ── Sync: download any maps we don't have locally ──

export async function syncCommunityMaps(): Promise<{ added: number; total: number }> {
  const index = await fetchCommunityIndex();
  const existingMaps = DataManager.loadMaps();
  const existingIds = new Set(existingMaps.map(m => m.id));

  let added = 0;

  // Download maps we don't have yet
  const downloads = index.maps
    .filter(entry => !existingIds.has(entry.id))
    .map(async (entry) => {
      const mapData = await fetchCommunityMap(entry.id);
      if (mapData) {
        DataManager.saveCustomMap(mapData);
        added++;
      }
    });

  await Promise.all(downloads);

  // Update last sync time
  localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());

  return { added, total: index.maps.length };
}

// ── Upload: commit a map to the GitHub repo ──

export async function uploadMap(map: MapData, author: string): Promise<void> {
  const token = getToken();
  if (!token) {
    throw new Error('No GitHub token configured');
  }

  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };

  // Step 1: Upload the map JSON file
  const mapPath = `${MAPS_DIR}/${map.id}.json`;
  const mapContent = btoa(unescape(encodeURIComponent(JSON.stringify(map, null, 2))));

  // Check if the file already exists (need SHA to update)
  let existingMapSha: string | undefined;
  try {
    const existing = await fetchWithTimeout(apiUrl(mapPath) + `?ref=${BRANCH}`, { headers });
    if (existing.ok) {
      const data = await existing.json();
      existingMapSha = data.sha;
    }
  } catch {
    // File doesn't exist, that's fine
  }

  const mapPutBody: Record<string, string> = {
    message: `Add community map: ${map.name} (by ${author})`,
    content: mapContent,
    branch: BRANCH,
  };
  if (existingMapSha) {
    mapPutBody.sha = existingMapSha;
  }

  const mapResp = await fetchWithTimeout(apiUrl(mapPath), {
    method: 'PUT',
    headers,
    body: JSON.stringify(mapPutBody),
  });

  if (!mapResp.ok) {
    const err = await mapResp.json().catch(() => ({}));
    if (mapResp.status === 401) {
      clearToken();
      throw new Error('Invalid token — please re-enter your Upload Key.');
    }
    if (mapResp.status === 403) {
      throw new Error('No permission. Check that your token has Contents write access.');
    }
    throw new Error(`Upload failed: ${(err as { message?: string }).message ?? mapResp.statusText}`);
  }

  // Step 2: Update the community index
  await updateCommunityIndex(map, author, headers);
}

async function updateCommunityIndex(
  map: MapData,
  author: string,
  headers: HeadersInit,
  retryCount = 0,
): Promise<void> {
  // Get current index file (need SHA for update)
  let currentIndex: CommunityIndex = { version: 1, maps: [] };
  let indexSha: string | undefined;

  try {
    const indexResp = await fetchWithTimeout(apiUrl(INDEX_FILE) + `?ref=${BRANCH}`, { headers });
    if (indexResp.ok) {
      const data = await indexResp.json();
      indexSha = data.sha;
      // Decode base64 content
      const content = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))));
      currentIndex = JSON.parse(content);
    }
  } catch {
    // Index doesn't exist yet — start fresh
  }

  // Add or update the map entry
  const existingIdx = currentIndex.maps.findIndex(m => m.id === map.id);
  const entry: CommunityMapEntry = {
    id: map.id,
    name: map.name,
    author,
    uploadedAt: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    currentIndex.maps[existingIdx] = entry;
  } else {
    currentIndex.maps.push(entry);
  }

  const indexContent = btoa(unescape(encodeURIComponent(JSON.stringify(currentIndex, null, 2))));
  const indexPutBody: Record<string, string> = {
    message: `Update community maps index (${currentIndex.maps.length} maps)`,
    content: indexContent,
    branch: BRANCH,
  };
  if (indexSha) {
    indexPutBody.sha = indexSha;
  }

  const resp = await fetchWithTimeout(apiUrl(INDEX_FILE), {
    method: 'PUT',
    headers,
    body: JSON.stringify(indexPutBody),
  });

  if (!resp.ok) {
    // 409 = conflict — someone else updated at the same time. Retry once.
    if (resp.status === 409 && retryCount < 1) {
      await updateCommunityIndex(map, author, headers, retryCount + 1);
      return;
    }
    // Non-critical — map file was already uploaded, index will catch up next upload
    console.warn('Failed to update community index:', resp.statusText);
  }
}
