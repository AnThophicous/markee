# Markee

Um caderno infinito no bolso. Captura de notas rápida, minimalista e local-first — inspirado no Apple Notes, na organização do Notion e na filosofia local-first do Obsidian.

## Stack

React Native + Expo (SDK 57) · Expo Router · TypeScript · NativeWind (Tailwind) · React Query · Zustand · MMKV · FlashList v2 · Reanimated v4 · Expo Notifications · expo-sqlite (com FTS5)

## Arquitetura

```
app/                  rotas (expo-router) — finas, delegam para src/features
src/
  features/           notes, folders, tags, reminders, search, settings, editor, navigation
    components/ hooks/ services/ store/
  components/          kit de UI compartilhado (AppText, Button, Sheet, ...)
  database/            client SQLite, schema, migrations
  theme/               tokens de cor/tipografia + ThemeProvider
  storage/             MMKV
  services/            React Query client, export para Markdown
  types/ utils/
```

## Executando o projeto

⚠️ **Importante:** o app usa `react-native-mmkv`, que é um módulo nativo **não disponível no Expo Go**. É preciso gerar um dev client:

```bash
npm install

# Android (precisa do Android SDK instalado e um emulador/dispositivo conectado)
npm run android

# iOS (precisa de macOS + Xcode)
npm run ios
```

Isso roda `expo run:android` / `expo run:ios`, que compila e instala um dev client com todos os módulos nativos (SQLite com FTS5, notificações, MMKV, date picker). Depois da primeira instalação, `npx expo start` reaproveita esse build.

Outros comandos úteis:

```bash
npm run typecheck   # tsc --noEmit
npx expo-doctor      # valida dependências/config nativa
```

## Funcionalidades (MVP)

- **Notas**: Markdown com títulos, listas, checklist, código, tabelas, links, citações — modo leitura (renderizado) e modo edição (fonte + toolbar flutuante).
- **Organização**: pastas com subpastas, tags automáticas via `#hashtag` inline, favoritos, fixar notas, lixeira com restaurar/excluir definitivamente.
- **Busca instantânea**: full-text search via SQLite FTS5, com filtros por tag, pasta e data.
- **Lembretes**: notificações locais — horário específico, amanhã, em 30 minutos, diário e semanal.
- **Tema**: claro/escuro/sistema, paleta preto e branco com o rosa da marca (`#F62283`) reservado para chamar ação — botão de nova nota, estado ativo, links e favoritos. Tema escuro em preto absoluto (`#000`), que economiza bateria em telas OLED.
- **Exportar**: qualquer nota pode ser exportada como arquivo `.md` via o menu de compartilhamento nativo.
- 100% offline — as notas vivem em SQLite local e **funcionam sem conta**.

## Conta e área social (Supabase)

O login é exigido apenas para grupos de estudo e compartilhamento. Escrever notas nunca pede conta —
isso manteria a promessa de "abrir, escrever e fechar em menos de 10 segundos".

- **Autenticação: somente Google.** E-mail/senha está desligado no painel do Supabase; para reativar,
  ligue o provedor Email lá e restaure `signInWithPassword`/`signUp` em `src/features/auth/services/auth.service.ts`.
- **Perfil**: nome de exibição, bio e ícone custom (upload para o bucket `avatars`).
- **Permissões por cargo** (bitfield estilo Discord) aplicadas via RLS no Postgres — não no app.
  Validação só no cliente seria contornável chamando a API direto.
- Schema em `supabase/migrations/`. Aplique pelo SQL Editor do painel, em ordem.

### Variáveis de ambiente

Copie `.env.example` para `.env` e preencha com os valores de `Settings → API` do seu projeto.
A `publishable key` é segura no app — quem protege os dados é o RLS.

## Decisões e simplificações conscientes (ver plano de implementação)

- **Editor**: modo leitura/edição (como Apple Notes/Bear), não WYSIWYG por tecla — mais rápido, previsível e 60 FPS.
- **Tags**: somente via `#hashtag` inline no conteúdo (sem seletor manual de tags) — mais rápido de usar, no espírito Obsidian.
- **Imagens** no editor: fora do MVP, planejadas para a V2 junto de OCR/Scanner.
- **Data/hora de lembrete específico**: usa `@react-native-community/datetimepicker` — única dependência nativa adicionada além da lista original, por ser o padrão de fato do ecossistema Expo para esse propósito.
- **Dashboard/estatísticas/flashcards/widgets/IA**: intencionalmente fora deste MVP, conforme o roadmap V2/V3.

## Próximos passos sugeridos

1. Rodar em um dispositivo/emulador real e testar o fluxo completo (criar → editar → fechar em menos de 10s, lembretes disparando, exportação, dark mode).
2. V2: flashcards com repetição espaçada, estatísticas de escrita, widget Android, OCR/scanner.
3. V3: sincronização, compartilhamento/colaboração, plugins.
