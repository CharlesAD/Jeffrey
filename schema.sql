-- PostgreSQL schema for Jeffrey bot

-- Table of queues students can join
CREATE TABLE IF NOT EXISTS queues (
    id          SERIAL PRIMARY KEY,
    server_id   BIGINT NOT NULL,
    queue_name  TEXT   NOT NULL,
    members     BIGINT[] NOT NULL DEFAULT '{}',
    description TEXT,
    UNIQUE (server_id, queue_name)
);

-- Table recording which users are blacklisted from specific queues
CREATE TABLE IF NOT EXISTS blacklisted_users (
    server_id BIGINT NOT NULL,
    queue_id  INTEGER NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
    user_id   BIGINT NOT NULL,
    PRIMARY KEY (server_id, queue_id, user_id)
);

-- Logged public messages for dmHistory lookups
CREATE TABLE IF NOT EXISTS public_messages (
    id         BIGINT PRIMARY KEY,
    guild_id   BIGINT NOT NULL,
    channel_id BIGINT NOT NULL,
    author_id  BIGINT NOT NULL,
    author_tag TEXT  NOT NULL,
    content    TEXT  NOT NULL,
    ts         TIMESTAMPTZ NOT NULL,
    tsv        TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
);

CREATE INDEX IF NOT EXISTS idx_public_messages_guild ON public_messages(guild_id);
CREATE INDEX IF NOT EXISTS idx_public_messages_tsv ON public_messages USING GIN(tsv);
