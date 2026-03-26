-- The Listening Post — D1 Schema
-- 7 tables for published content, legislative data, and economic indicators

-- Stories (articles from all sources)
CREATE TABLE IF NOT EXISTS stories (
    id TEXT PRIMARY KEY,
    headline TEXT NOT NULL,
    summary TEXT,
    body TEXT,
    slug TEXT UNIQUE NOT NULL,
    topic TEXT NOT NULL,
    source TEXT NOT NULL,
    source_url TEXT,
    image_url TEXT,
    image_caption TEXT,
    image_attribution TEXT,
    sentiment_positive REAL,
    sentiment_negative REAL,
    relevance_score REAL,
    perigon_cluster_id TEXT,
    edition TEXT,
    episode_id TEXT,
    audio_segment_key TEXT,
    sources_json TEXT,
    bill_data_json TEXT,
    fred_series_id TEXT,
    published_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stories_topic ON stories(topic);
CREATE INDEX IF NOT EXISTS idx_stories_edition ON stories(edition, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_slug ON stories(slug);

-- Episodes (podcast editions)
CREATE TABLE IF NOT EXISTS episodes (
    id TEXT PRIMARY KEY,
    edition TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL,
    audio_r2_key TEXT,
    transcript TEXT,
    duration_seconds INTEGER,
    segment_count INTEGER,
    segments_json TEXT,
    story_ids_json TEXT,
    published_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_episodes_date ON episodes(date DESC, edition);

-- Legislators (federal + state)
CREATE TABLE IF NOT EXISTS legislators (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    party TEXT,
    chamber TEXT,
    state TEXT DEFAULT 'WI',
    district TEXT,
    image_url TEXT,
    source TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Bills (federal + state)
CREATE TABLE IF NOT EXISTS bills (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    status TEXT,
    sponsor_id TEXT,
    sponsor_name TEXT,
    topic TEXT,
    source TEXT,
    source_url TEXT,
    actions_json TEXT,
    last_action TEXT,
    last_action_date TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bills_topic ON bills(topic);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);

-- Floor actions (daily House + Senate activity)
CREATE TABLE IF NOT EXISTS floor_actions (
    id TEXT PRIMARY KEY,
    chamber TEXT NOT NULL,
    date TEXT NOT NULL,
    action_type TEXT,
    description TEXT NOT NULL,
    bill_id TEXT,
    bill_identifier TEXT,
    source_url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_floor_chamber_date ON floor_actions(chamber, date DESC);
CREATE INDEX IF NOT EXISTS idx_floor_bill ON floor_actions(bill_id);

-- Presidential actions (presented, signed, vetoed)
CREATE TABLE IF NOT EXISTS presidential_actions (
    id TEXT PRIMARY KEY,
    bill_identifier TEXT NOT NULL,
    title TEXT NOT NULL,
    date_presented TEXT,
    date_signed TEXT,
    date_vetoed TEXT,
    status TEXT,
    congress INTEGER,
    source_url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_presidential_status ON presidential_actions(status, date_presented DESC);

-- Congressional Record (daily proceedings)
CREATE TABLE IF NOT EXISTS congressional_record (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    volume INTEGER,
    issue_number TEXT,
    section TEXT,
    title TEXT,
    description TEXT,
    url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_record_date ON congressional_record(date DESC, section);

-- FRED data (also cached in KV, D1 for chart history)
CREATE TABLE IF NOT EXISTS fred_observations (
    series_id TEXT NOT NULL,
    date TEXT NOT NULL,
    value REAL,
    PRIMARY KEY (series_id, date)
);

CREATE INDEX IF NOT EXISTS idx_fred_series ON fred_observations(series_id, date DESC);
