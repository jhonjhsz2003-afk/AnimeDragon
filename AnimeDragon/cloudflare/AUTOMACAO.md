# Automação do catálogo AnimeDragon

Esta versão adiciona descoberta automática de animes do ano corrente via AniList, atualização de capas/banners/nota/status, organização automática de categorias e proteção contra duplicados.

## Cron
O Worker mantém o Cron `0 */6 * * *` e executa a sincronização automaticamente a cada 6 horas. Cron Triggers do Cloudflare são executados em UTC.

## Manual
No painel admin existe a seção **Automação** com `Sincronizar agora`, status da última execução e configuração de páginas/itens por execução.

## Limites seguros
A execução manual/automática limita a descoberta a no máximo 6 páginas por rodada e 50 itens por página para reduzir risco de excesso de requisições.

## Fontes
A automação usa metadados e imagens disponibilizados pela AniList. Ela não baixa nem redistribui vídeos de terceiros. Episódios precisam usar URLs de vídeo que o administrador esteja autorizado a disponibilizar.
