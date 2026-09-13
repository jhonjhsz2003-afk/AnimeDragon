# AnimeDragon Ultra Remastered v6

Versão Cloudflare Workers + Static Assets + TMDB proxy.

## O que foi corrigido
- `wrangler.toml` aponta para `./web` na raiz.
- Static Assets com binding `ASSETS`.
- SPA fallback com `not_found_handling = "single-page-application"`.
- `/api/*` passa pelo Worker.
- Worker entrega os arquivos estáticos via `ASSETS`.
- TMDB usa Bearer token no servidor, nunca no navegador.
- Home dinâmica: Em Alta, Animes, Filmes e Mais Bem Avaliados.
- Busca real via TMDB.
- Descoberta de animes e filmes via TMDB.
- Detalhes, gêneros, elenco/vídeos/imagens recebidos do TMDB.
- Temporadas e episódios reais para séries de TV.
- Posters/backdrops usam o CDN de imagens do TMDB.
- Fallback visual se o TMDB estiver indisponível.
- D1 e R2 permanecem configurados.

## Estrutura obrigatória

```text
AnimeDragon/
├── wrangler.toml
├── worker.js
├── package.json
├── db/schema.sql
└── web/
    ├── index.html
    ├── css/app.css
    ├── js/app.js
    └── assets/...
```

## Cloudflare

No projeto de Workers Builds:

- Build command: vazio
- Deploy command: `npx wrangler deploy`
- Non-production deploy: `npx wrangler versions upload`
- Root/Path: `/`

## TMDB

Crie um secret no Worker chamado `TMDB_API_KEY`. Nunca coloque a chave dentro do `app.js`, HTML ou GitHub.

O Worker usa o token como `Authorization: Bearer ...` e consulta a API TMDB v3.

O aplicativo deve exibir a atribuição exigida pelo TMDB:
“This product uses the TMDB API but is not endorsed or certified by TMDB.”

## D1

O `wrangler.toml` está apontando para:

- database: `animedragon-db`
- id: `fdf0ea3e-42f9-46a3-b92f-e8b9632cca63`

Execute o schema remoto uma vez:

`npx wrangler d1 execute animedragon-db --remote --file=db/schema.sql`

## R2

Bucket configurado:

`animedragon-avatars`

## Importante sobre vídeos

TMDB fornece metadados e imagens; não fornece os vídeos dos episódios. O player desta versão é uma interface segura preparada para receber uma fonte de vídeo que você tenha autorização para usar. Não incluí fontes de streaming não autorizadas.
