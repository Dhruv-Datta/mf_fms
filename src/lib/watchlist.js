import fs from 'fs';
import path from 'path';

const WATCHLIST_PATH = path.join(process.cwd(), 'watchlist.json');

const DEFAULT_WATCHLIST = { stocks: [] };

export function loadWatchlist() {
  if (!fs.existsSync(WATCHLIST_PATH)) {
    return { ...DEFAULT_WATCHLIST };
  }
  try {
    const raw = fs.readFileSync(WATCHLIST_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { ...DEFAULT_WATCHLIST };
  }
}

export function saveWatchlist(data) {
  fs.writeFileSync(WATCHLIST_PATH, JSON.stringify(data, null, 2));
}
