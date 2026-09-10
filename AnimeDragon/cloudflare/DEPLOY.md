# Deploy gratuito do AnimeDragon

Esta versão usa **Cloudflare Workers + D1** para o backend e banco persistente. Você não precisa deixar o seu PC ligado.

## 1. Criar o banco D1

No painel/CLI da Cloudflare:

```bash
npx wrangler d1 create animedragon-db
```

Copie o `database_id` mostrado no comando e substitua `COLOQUE_O_ID_DA_D1_AQUI` em `wrangler.toml`.

## 2. Criar tabelas e dados iniciais

Dentro da pasta `cloudflare/`:

```bash
npx wrangler d1 execute animedragon-db --remote --file=schema.sql
npx wrangler d1 execute animedragon-db --remote --file=seed.sql
```

## 3. Configurar o administrador

No `wrangler.toml`, coloque seu e-mail em `ADMIN_EMAIL`.

Depois salve a senha como secret, em vez de deixar a senha escrita no repositório:

```bash
npx wrangler secret put ADMIN_PASSWORD
```

## 4. Publicar

```bash
npx wrangler deploy
```

A Cloudflare fornece um endereço `workers.dev`, então o site pode ficar online sem manter sua máquina ligada.

## 5. Atualização automática de capas

O Worker possui um Cron a cada 6 horas. Ele consulta a **AniList GraphQL API**, atualiza capa/banner/nota/ano/status e pode descobrir títulos do ano atual quando `autoDiscover` estiver habilitado nas configurações.

O painel administrativo também possui o botão **Sincronizar capas** para executar a atualização manualmente.

## 6. Como ficam os dados

As contas, favoritos, histórico, progresso, comentários, catálogo, episódios, categorias, seções, permissões e logs ficam no banco D1. Assim, trocar de celular/PC ou acessar de outro navegador não apaga o histórico da conta.

## 7. Backup

O painel possui exportação de dados. Antes de alterações importantes, exporte um backup e guarde o JSON.

## 8. Vídeo

O projeto não fornece mídia protegida por direitos autorais. No painel, cadastre somente fontes de vídeo que você tenha autorização para disponibilizar.
