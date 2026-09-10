# AnimeDragon — edição web persistente

Plataforma de catálogo de animes com visual premium, contas obrigatórias, biblioteca pessoal, histórico/progresso, comentários e painel administrativo.

## O que foi acrescentado

- Tela de entrada obrigatória: sem conta o visitante não acessa o catálogo.
- Cadastro com nome de exibição, e-mail e senha.
- Sessão persistente por conta.
- Favoritos, histórico e progresso vinculados ao usuário.
- Comentários públicos em cada anime + moderação no painel.
- Painel para promover usuários a administradores, bloquear e excluir contas.
- Sincronização de capas/banners/metadados pela AniList.
- Cron automático de sincronização a cada 6 horas na versão Cloudflare.
- Descoberta automática de títulos do ano atual pode ser habilitada.
- Banco persistente na nuvem com Cloudflare D1 na versão para publicação gratuita.
- Backup/exportação e auditoria.

## Publicação gratuita recomendada

A pasta `cloudflare/` é a versão para deixar o site online sem depender do seu computador:

- `Workers` serve o frontend e API.
- `D1` guarda contas, biblioteca, comentários, catálogo, episódios e configurações.
- `Cron` executa a sincronização automática.

Veja `cloudflare/DEPLOY.md` para publicar.

## Desenvolvimento local

```bash
npm start
```

Abra `http://localhost:3000`.

## Conta administrativa local

- E-mail: `admin@animedragon.local`
- Senha inicial: `TroqueEstaSenha-Agora!`

Troque as credenciais antes de disponibilizar o site publicamente.

## API de imagens/metadados

A sincronização usa a AniList GraphQL API e mantém os URLs retornados no cadastro dos animes. A integração foi desenhada para ter fallback: se a API ficar indisponível, as capas existentes permanecem no site.

## Observação de conteúdo

O projeto é um sistema de catálogo e reprodução apontada para fontes que o operador tenha autorização para disponibilizar. Ele não incorpora material protegido por direitos autorais.
