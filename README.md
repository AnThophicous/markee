# Markee

Um caderno infinito no bolso. Captura de notas rápida, minimalista e local-first
— inspirado no Apple Notes, na organização do Notion e na filosofia local-first
do Obsidian. Com grupos de estudo, feed, amigos e conversas cifradas.

**A promessa:** abrir o app, escrever uma nota e fechar em menos de 10 segundos.

## Stack

React Native + Expo (SDK 57) · Expo Router · TypeScript · NativeWind ·
React Query · Zustand · MMKV · FlashList v2 · Reanimated v4 ·
expo-sqlite (FTS5) · Supabase (Postgres + Auth + Storage + Realtime)

## Arquitetura

```
app/                  rotas (expo-router) — finas, delegam para src/features
src/
  features/           notes, folders, tags, reminders, search, settings, editor,
                      groups, feed, friends, profile, billing, ai, crypto
    components/ hooks/ services/ store/
  components/         kit de UI compartilhado (AppText, Button, Sheet, ...)
  database/           SQLite local: client, schema, migrations
  theme/              tokens, ThemeProvider, tema visual (cores e efeitos)
  utils/              qrcode, color, markee-link, url-safety, text, date
supabase/migrations/  o backend inteiro, em SQL versionado
scripts/              testes que rodam sem aparelho (QR, criptografia)
```

## O modelo de segurança

O aplicativo **não é a fonte da verdade**. Todo o cliente é apenas uma interface;
quem decide é o Postgres. Isso é intencional, e importa mais ainda agora que o
código é aberto: quem quiser modificar o app e remover as travas vai conseguir —
e não vai adiantar nada.

| Regra | Onde é aplicada |
|---|---|
| Quem lê o feed de um grupo | RLS em `posts` + view com `security_invoker` |
| Quem pode enviar mensagem, fixar post, criar sala | bitfield de permissões, conferido em SQL |
| Gradiente, efeitos e cartão personalizado (Pro) | gatilho `validate_group_customization` |
| Entrar em grupo privado | função `join_group`, nunca INSERT direto |
| Voto em enquete (escolha única) | função `vote_poll`, numa transação só |
| Onde cada pessoa pode enviar arquivo | RLS em `storage.objects`, por prefixo de pasta |
| Conteúdo das conversas entre amigos | cifrado no aparelho; o servidor só vê bytes |

Alterar o app muda o que **você** vê. Não muda o que os outros veem, nem o que o
banco aceita.

### Conversas cifradas

As mensagens entre amigos usam NaCl `box` (X25519 + XSalsa20-Poly1305) via
tweetnacl. A chave privada nasce no aparelho e nunca sai dele.

O que isso **não** garante, e é honesto dizer: não há sigilo futuro (chave fixa),
os metadados continuam visíveis ao servidor, e a verificação contra troca de
chave depende das duas pessoas compararem o código de verificação que o app
mostra.

### Imagens

Só são exibidas imagens hospedadas no nosso próprio storage. Link de fora vira
link comum, que a pessoa abre se quiser — carregar uma imagem remota entregaria
IP e horário de quem apenas abriu a tela.

## Rodando

O app usa módulos nativos (MMKV, câmera, SQLite com FTS5), então **não funciona
no Expo Go**. É preciso um dev client.

```bash
npm install
cp .env.example .env      # preencha com o seu projeto Supabase

npm run android           # exige Android SDK + JDK 17
```

Aplique as migrações de `supabase/migrations/` em ordem, no seu próprio projeto
Supabase.

### Testes sem aparelho

```bash
node scripts/qr-test.js    # codificador de QR, conferido contra a ISO/IEC 18004
node scripts/e2e-test.js   # criptografia ponta a ponta
npx tsc --noEmit
```

Os três rodam no CI antes de qualquer compilação.

## Licença

O **código** está sob a Apache License 2.0 — veja [`LICENSE`](LICENSE).
Use, modifique, redistribua, contribua.

A **marca** (nome, logotipo, identidade visual) tem regra própria, em
[`TRADEMARKS.md`](TRADEMARKS.md):

- **uso não comercial** — pode manter o nome e o logotipo do Markee, desde que
  deixe claro que o fork não é oficial;
- **uso comercial** — pode, mas troque toda a identidade antes: nome, ícone,
  `com.markee.app`, `markee://` e a identidade visual.

Ou seja: faça dinheiro com o código, não com a cara do Markee.
