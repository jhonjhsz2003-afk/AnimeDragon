# AnimeDragon Ultra Remastered v5

Uma reconstrução profissional inspirada diretamente na referência visual enviada: dark navy, neon blue/cyan, glass panels, sidebar, right rail, perfil completo, catálogo, calendário, lista, histórico e player independente.

## O que já funciona no demo
- Navegação real entre categorias
- Busca local
- Catálogo, filmes, gêneros e calendário
- Minha Lista com localStorage
- Histórico com localStorage
- Criação de conta local para demonstração
- Perfil completo
- Seleção de vários avatares
- Upload de avatar próprio (salvo localmente no demo)
- Configurações e switches
- Página de notificações
- Detalhes de anime com temporadas/episódios
- Player fullscreen sem sidebar
- Layout responsivo para desktop/tablet/mobile
- Arquitetura preparada para TMDB + Cloudflare D1/R2/Worker

## Produção
O navegador nunca deve receber a chave TMDB. Configure `TMDB_API_KEY` como secret no Worker.

1. `npm install`
2. Crie D1 e R2.
3. Execute `wrangler d1 execute animedragon-db --remote --file=db/schema.sql`
4. `wrangler secret put TMDB_API_KEY`
5. Ajuste `wrangler.toml` com o ID do D1.
6. `npx wrangler deploy`

## Importante
A parte de catálogo/streaming do demo usa dados ilustrativos e um vídeo de teste público. Para uma plataforma real, conecte fontes/licenças de vídeo e legendas que você tenha autorização para usar.

## Próximas integrações recomendadas
- TMDB: metadados, posters, backdrop, elenco, trailers
- D1: usuários, favoritos, histórico, configurações
- R2: avatares enviados
- Worker: autenticação/sessão e proxy seguro
- Cron: sincronização periódica do catálogo
- Sistema de provedores de vídeo/legendas autorizados
- Painel admin para curadoria e gerenciamento de avatares
