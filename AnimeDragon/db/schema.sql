CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT DEFAULT '',
  country TEXT DEFAULT 'BR',
  language TEXT DEFAULT 'pt-BR',
  plan TEXT DEFAULT 'free',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id TEXT NOT NULL,
  tmdb_id INTEGER NOT NULL,
  media_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(user_id, tmdb_id, media_type)
);

CREATE TABLE IF NOT EXISTS history (
  user_id TEXT NOT NULL,
  tmdb_id INTEGER NOT NULL,
  media_type TEXT NOT NULL,
  season INTEGER,
  episode INTEGER,
  progress_seconds INTEGER DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, tmdb_id, media_type, season, episode)
);

CREATE TABLE IF NOT EXISTS settings (
  user_id TEXT PRIMARY KEY,
  autoplay INTEGER DEFAULT 1,
  auto_subtitles INTEGER DEFAULT 1,
  notifications INTEGER DEFAULT 1,
  dark_mode INTEGER DEFAULT 1,
  analytics INTEGER DEFAULT 0,
  language TEXT DEFAULT 'pt-BR',
  quality TEXT DEFAULT 'auto',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS catalog_cache (
  tmdb_id INTEGER PRIMARY KEY,
  media_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);