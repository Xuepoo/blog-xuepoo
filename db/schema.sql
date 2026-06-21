-- 存储文章的阅读数
CREATE TABLE IF NOT EXISTS post_views (
    slug TEXT PRIMARY KEY,
    views INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 用于防刷限流的临时日志
CREATE TABLE IF NOT EXISTS view_logs (
    ip TEXT,
    slug TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (ip, slug)
);

-- 索引以加快防刷查询
CREATE INDEX IF NOT EXISTS idx_view_logs_ip_slug ON view_logs(ip, slug, created_at);
