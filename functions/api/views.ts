interface Env {
  DB: D1Database;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");

  // 1. GET 请求：获取阅读数
  if (request.method === "GET") {
    try {
      if (slug) {
        // 获取单篇文章阅读数
        const result = await env.DB.prepare(
          "SELECT views FROM post_views WHERE slug = ?"
        )
          .bind(slug)
          .first<{ views: number }>();

        return new Response(JSON.stringify({ views: result?.views || 0 }), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=10",
          },
        });
      } else {
        // 获取所有文章阅读数映射 (slug -> views)
        const { results } = await env.DB.prepare(
          "SELECT slug, views FROM post_views"
        ).all<{ slug: string; views: number }>();

        const mapping: Record<string, number> = {};
        for (const row of results) {
          mapping[row.slug] = row.views;
        }

        return new Response(JSON.stringify(mapping), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=10",
          },
        });
      }
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // 2. POST 请求：递增阅读数
  if (request.method === "POST") {
    if (!slug) {
      return new Response(JSON.stringify({ error: "Missing slug" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const ip = request.headers.get("CF-Connecting-IP") || "127.0.0.1";
      const userAgent = request.headers.get("User-Agent") || "";
      const referer = request.headers.get("Referer") || "";

      // 🛡️ 防御 1：Referer 过滤
      // 允许本地开发 localhost 以及 xuepoo 的域名
      const isAllowedOrigin =
        !referer || // 允许无 referer（比如调试，但防刷主要拦截有跨域的）
        referer.includes("localhost") ||
        referer.includes("127.0.0.1") ||
        referer.includes("blog.xuepoo.xyz");

      if (!isAllowedOrigin) {
        return new Response(JSON.stringify({ error: "Forbidden: Invalid referer" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      // 🛡️ 防御 2：UA 爬虫过滤
      const isBot = /bot|spider|crawl|slurp|screenshot|lighthouse|chrome-lighthouse|headless/i.test(
        userAgent
      );
      if (isBot) {
        // 爬虫直接返回当前 views 数量，不做自增
        const result = await env.DB.prepare(
          "SELECT views FROM post_views WHERE slug = ?"
        )
          .bind(slug)
          .first<{ views: number }>();
        return new Response(JSON.stringify({ views: result?.views || 0, skip: "bot" }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // 🛡️ 防御 3：数据库 24 小时内 IP + Slug 去重
      const logCheck = await env.DB.prepare(
        "SELECT 1 FROM view_logs WHERE ip = ? AND slug = ? AND created_at > datetime('now', '-24 hours')"
      )
        .bind(ip, slug)
        .first();

      if (logCheck) {
        // 该 IP 24 小时内已读过，不自增，直接返回当前数据
        const result = await env.DB.prepare(
          "SELECT views FROM post_views WHERE slug = ?"
        )
          .bind(slug)
          .first<{ views: number }>();
        return new Response(
          JSON.stringify({ views: result?.views || 0, skip: "cooldown" }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      // 递增 views & 插入阅读日志
      // 每次有新阅读，有 1% 的概率清理一下 24h 之前的过期日志以控制大小
      const shouldCleanup = Math.random() < 0.01;
      const statements = [
        env.DB.prepare("INSERT OR REPLACE INTO view_logs (ip, slug) VALUES (?, ?)")
          .bind(ip, slug),
        env.DB.prepare(
          "INSERT INTO post_views (slug, views) VALUES (?, 1) ON CONFLICT(slug) DO UPDATE SET views = views + 1, updated_at = CURRENT_TIMESTAMP"
        )
          .bind(slug),
        env.DB.prepare("SELECT views FROM post_views WHERE slug = ?")
          .bind(slug)
      ];

      if (shouldCleanup) {
        statements.push(
          env.DB.prepare("DELETE FROM view_logs WHERE created_at < datetime('now', '-24 hours')")
        );
      }

      const batchResult = await env.DB.batch(statements);
      const updatedViews = (batchResult[2].results[0] as { views: number })?.views || 1;

      return new Response(JSON.stringify({ views: updatedViews }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
};
