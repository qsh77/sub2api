CREATE TABLE IF NOT EXISTS image_projects (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(160) NOT NULL DEFAULT '',
    cover_version_id BIGINT,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS image_versions (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES image_projects(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_version_id BIGINT REFERENCES image_versions(id) ON DELETE SET NULL,
    source_version_id BIGINT REFERENCES image_versions(id) ON DELETE SET NULL,
    mode VARCHAR(20) NOT NULL,
    prompt TEXT NOT NULL DEFAULT '',
    revised_prompt TEXT,
    model VARCHAR(100) NOT NULL DEFAULT '',
    size VARCHAR(32) NOT NULL DEFAULT '',
    mime_type VARCHAR(64) NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    sha256 VARCHAR(64) NOT NULL DEFAULT '',
    width INT NOT NULL DEFAULT 0,
    height INT NOT NULL DEFAULT 0,
    mask_file_path TEXT,
    mask_mime_type VARCHAR(64),
    api_key_id BIGINT,
    usage_log_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_image_projects_user_created
    ON image_projects (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_image_projects_status_created
    ON image_projects (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_image_projects_deleted_at
    ON image_projects (deleted_at);

CREATE INDEX IF NOT EXISTS idx_image_versions_project_created
    ON image_versions (project_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_image_versions_user_created
    ON image_versions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_image_versions_parent
    ON image_versions (parent_version_id);

CREATE INDEX IF NOT EXISTS idx_image_versions_deleted_at
    ON image_versions (deleted_at);
