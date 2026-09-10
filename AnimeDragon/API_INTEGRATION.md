# APIs automáticas do AnimeDragon

O painel administrativo agora possui **APIs externas (JSON)**. Você pode cadastrar até 30 APIs.

Cada API pode informar:
- `url`: endpoint JSON; aceita `{page}` e `{limit}`.
- `method`: `GET` ou `POST`.
- `headers`: cabeçalhos da requisição.
- `itemsPath`: caminho até a lista de animes, por exemplo `data.items`.
- `pagination`: paginação automática.
- `mapping`: caminhos dos campos de título, descrição, capa, banner, ano, status, nota, tipo, episódios, gêneros etc.
- `episodesList`: quando cada anime já traz seus episódios dentro do objeto.
- `episodeUrlTemplate`: endpoint separado para episódios; use `{id}` para o ID externo do anime.
- `episodeItemsPath`: caminho da lista de episódios nesse endpoint.

Exemplo mínimo:

```json
{
  "id": "minha-api",
  "name": "Minha API",
  "enabled": true,
  "url": "https://exemplo.com/api/animes?page={page}&limit={limit}",
  "method": "GET",
  "headers": {},
  "itemsPath": "data.items",
  "pagination": {"enabled": true, "pageStart": 1, "limit": 100, "maxPages": 50},
  "mapping": {
    "title": "title",
    "synopsis": "description",
    "cover": "cover",
    "banner": "banner",
    "year": "year",
    "status": "status",
    "score": "score",
    "type": "type",
    "episodes": "episodes",
    "id": "id",
    "slug": "slug",
    "tags": "genres",
    "episodesList": "episodes"
  }
}
```

A sincronização automática roda a cada 6 horas enquanto o servidor estiver ligado. Também existe o botão **Sincronizar catálogo agora** no painel. O processo é assíncrono e grava o progresso por página.

Importante: o sistema importa tudo que a API realmente disponibiliza e que esteja mapeado. Ele não inventa vídeos/links que a API não fornece. Para reprodução, a fonte precisa disponibilizar um URL de vídeo/stream ou uma página de exibição válida.

## Fallback real

O sincronizador local usa **AniList como fonte principal** e, se ela não responder, tenta **Jikan** automaticamente. A AniList é consultada sem conteúdo adulto (`isAdult:false`). O catálogo usa paginação limitada para respeitar o limite de 5000 entradas por consulta da AniList, em vez de fazer milhares de requisições por ano.

O botão **Sincronizar catálogo agora** não depende de dados fictícios: ele grava somente o que as APIs realmente retornarem. Se nenhuma API estiver acessível, o painel mostra o erro em vez de criar animes falsos.
