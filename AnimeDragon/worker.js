/**
 * AnimeDragon Ultra Remastered v6
 * Cloudflare Worker + Static Assets + TMDB proxy + D1 + R2.
 * The TMDB credential is ONLY read from the Worker secret TMDB_API_KEY.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Cache-Control": "no-store"
};

const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    try {
      if (url.pathname === "/api/health") {
        return json({ ok: true, service: "AnimeDragon", version: "6.0.0", tmdb: Boolean(env.TMDB_API_KEY) }, 200);
      }

      if (url.pathname === "/api/config") {
        return json({ ok: true, tmdb: Boolean(env.TMDB_API_KEY), imageBase: IMG_BASE }, 200);
      }

      if (url.pathname === "/api/tmdb/home") {
        requireTMDB(env);
        const [trending, anime, movies, top] = await Promise.all([
          tmdb("/trending/all/week", { language: "pt-BR", include_adult: "false" }, env),
          tmdb("/discover/tv", {
            language: "pt-BR", include_adult: "false", sort_by: "popularity.desc",
            with_genres: "16", with_origin_country: "JP", vote_count_gte: "30", page: "1"
          }, env),
          tmdb("/discover/movie", {
            language: "pt-BR", include_adult: "false", sort_by: "popularity.desc",
            with_genres: "16", with_origin_country: "JP", vote_count_gte: "10", page: "1"
          }, env),
          tmdb("/tv/top_rated", { language: "pt-BR", page: "1" }, env)
        ]);
        return json({
          ok: true,
          imageBase: IMG_BASE,
          trending: normalize(trending.results || []),
          anime: normalize(anime.results || [], "tv"),
          movies: normalize(movies.results || [], "movie"),
          top: normalize(top.results || [], "tv")
        });
      }

      if (url.pathname === "/api/tmdb/search") {
        requireTMDB(env);
        const q = url.searchParams.get("q")?.trim();
        if (!q) return json({ ok: true, results: [] });
        const data = await tmdb("/search/multi", {
          query: q, language: "pt-BR", include_adult: "false", page: url.searchParams.get("page") || "1"
        }, env);
        return json({ ok: true, imageBase: IMG_BASE, results: normalize((data.results || []).filter(x => x.media_type === "tv" || x.media_type === "movie")) });
      }

      const detail = url.pathname.match(/^\/api\/tmdb\/(tv|movie)\/(\d+)$/);
      if (detail) {
        requireTMDB(env);
        const type = detail[1], id = detail[2];
        const data = await tmdb(`/${type}/${id}`, { language: "pt-BR", append_to_response: "credits,videos,images" }, env);
        return json({ ok: true, imageBase: IMG_BASE, item: normalizeOne(data, type) });
      }

      const season = url.pathname.match(/^\/api\/tmdb\/tv\/(\d+)\/season\/(\d+)$/);
      if (season) {
        requireTMDB(env);
        const data = await tmdb(`/tv/${season[1]}/season/${season[2]}`, { language: "pt-BR" }, env);
        return json({ ok: true, imageBase: IMG_BASE, season: data });
      }

      if (url.pathname === "/api/tmdb/genres/tv") {
        requireTMDB(env);
        return json({ ok: true, genres: (await tmdb("/genre/tv/list", { language: "pt-BR" }, env)).genres || [] });
      }

      if (url.pathname === "/api/tmdb/genres/movie") {
        requireTMDB(env);
        return json({ ok: true, genres: (await tmdb("/genre/movie/list", { language: "pt-BR" }, env)).genres || [] });
      }

      if (url.pathname === "/api/tmdb/discover") {
        requireTMDB(env);
        const type = url.searchParams.get("type") === "movie" ? "movie" : "tv";
        const page = url.searchParams.get("page") || "1";
        const genre = url.searchParams.get("genre") || "";
        const params = {
          language: "pt-BR", include_adult: "false", sort_by: url.searchParams.get("sort") || "popularity.desc", page
        };
        if (genre) params.with_genres = genre;
        if (type === "tv" && url.searchParams.get("anime") === "1") {
          params.with_genres = params.with_genres ? `${params.with_genres},16` : "16";
          params.with_origin_country = "JP";
          params.vote_count_gte = "10";
        }
        const data = await tmdb(`/discover/${type}`, params, env);
        return json({ ok: true, imageBase: IMG_BASE, page: data.page, totalPages: data.total_pages, results: normalize(data.results || [], type) });
      }

      return json({ ok: false, error: "Rota não encontrada" }, 404);
    } catch (error) {
      return json({ ok: false, error: friendlyError(error) }, error.status || 500);
    }
  },

  async scheduled(controller, env, ctx) {
    // Lightweight health/sync hook. Full catalog synchronization can be expanded later.
    ctx.waitUntil(Promise.resolve(controller.scheduledTime));
  }
};

function requireTMDB(env) {
  if (!env.TMDB_API_KEY) throw httpError(500, "TMDB_API_KEY não configurada no Worker. Adicione-a em Settings > Variables and Secrets > Secret.");
}

async function tmdb(path, params, env) {
  const u = new URL(TMDB_BASE + path);
  Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, String(v)); });
  const response = await fetch(u.toString(), {
    headers: { Authorization: `Bearer ${env.TMDB_API_KEY}`, Accept: "application/json" },
    cf: { cacheTtl: 300, cacheEverything: true }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw httpError(response.status, data.status_message || `TMDB retornou HTTP ${response.status}`);
  return data;
}

function normalize(items, forcedType) {
  return items.map(x => normalizeOne(x, forcedType || x.media_type)).filter(Boolean);
}

function normalizeOne(x, forcedType) {
  if (!x) return null;
  const type = forcedType || x.media_type || (x.title ? "movie" : "tv");
  return {
    id: x.id,
    media_type: type,
    title: x.title || x.name || "Sem título",
    original_title: x.original_title || x.original_name || "",
    overview: x.overview || "Descrição indisponível.",
    poster_path: x.poster_path || null,
    backdrop_path: x.backdrop_path || null,
    vote_average: Number(x.vote_average || 0),
    vote_count: Number(x.vote_count || 0),
    first_air_date: x.first_air_date || "",
    release_date: x.release_date || "",
    genres: x.genres || [],
    genre_ids: x.genre_ids || [],
    number_of_seasons: x.number_of_seasons || 0,
    number_of_episodes: x.number_of_episodes || 0,
    runtime: x.runtime || 0,
    status: x.status || "",
    credits: x.credits || null,
    videos: x.videos || null,
    images: x.images || null
  };
}

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function friendlyError(error) {
  if (error?.message?.includes("TMDB_API_KEY")) return error.message;
  if (error?.status === 401) return "A chave/token do TMDB é inválido ou não está autorizado.";
  if (error?.status === 429) return "O TMDB atingiu o limite temporário de requisições. Tente novamente em alguns segundos.";
  return error?.message || "Erro interno do AnimeDragon.";
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=UTF-8" }
  });
}
