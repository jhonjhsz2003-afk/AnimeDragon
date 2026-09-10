INSERT OR IGNORE INTO settings(key,value) VALUES
('site','{"siteName":"AnimeDragon","tagline":"Seu universo de animes.","accent":"#ef1523","secondary":"#ff3b30","heroAutoplay":true,"announcement":"AnimeDragon online — seu catálogo salvo na conta.","autoDiscover":true}');
INSERT OR IGNORE INTO categories(id,name,slug,color) VALUES
(1,'Ação','acao','#ef1523'),(2,'Aventura','aventura','#22c55e'),(3,'Comédia','comedia','#eab308'),(4,'Fantasia','fantasia','#8b5cf6'),(5,'Romance','romance','#ec4899'),(6,'Shounen','shounen','#3b82f6'),(7,'Isekai','isekai','#14b8a6'),(8,'Mistério','misterio','#64748b');
INSERT OR IGNORE INTO sections(id,title,subtitle,type,category_id,anime_ids_json,enabled,position) VALUES
(1,'Continuando a jornada','Retome de onde parou','continue',NULL,'[]',1,1),
(2,'Em alta agora','Os mais vistos pela comunidade','trending',NULL,'[]',1,2),
(3,'Novos episódios','Direto do catálogo','latestEpisodes',NULL,'[]',1,3),
(4,'Ação & Shounen','Batalhas, rivalidades e energia','category',6,'[]',1,4),
(5,'Descobertas da semana','Escolhidos pelo algoritmo','featured',NULL,'[]',1,5);
