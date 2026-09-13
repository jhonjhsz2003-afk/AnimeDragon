# Arquitetura

Frontend SPA:
- Home
- Anime
- Filmes
- Gêneros
- Calendário
- Minha Lista
- Histórico
- Perfil
- Configurações
- Notificações
- Busca
- Detalhes
- Player

Backend:
- Worker
- D1
- R2
- TMDB secret
- Cron de sincronização

Persistência demo:
- localStorage para perfil, avatar, lista, histórico e preferências.

Persistência produção:
- D1 para conta/perfil/favoritos/histórico/configurações/cache.
- R2 para avatares.

Segurança:
- TMDB API key somente no Worker Secret.
- Sessões em cookie HttpOnly/Secure/SameSite no backend de produção.
- Hash de senha no backend usando algoritmo moderno; o hash PBKDF2 no frontend é apenas demonstração.
