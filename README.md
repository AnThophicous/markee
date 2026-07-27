<div align="center">

<img src="assets/icon.png" width="96" alt="Markee" />

# Markee

**Um caderno infinito no bolso.**

Abre, escreve, fecha. Em menos de 10 segundos.

</div>

---

Você está na aula, o professor fala uma coisa que você não pode esquecer, e o
app de notas demora três telas até você conseguir digitar. O Markee existe por
causa disso.

Abre no lugar certo. Escreve. Pronto — já salvou.

## O que dá pra fazer

**Escrever de verdade**
Títulos, listas, caixinhas para marcar, tabelas, código, links e fotos. Tudo
funciona sem internet, porque suas notas ficam no seu celular.

**Achar depois**
Busca instantânea em título, conteúdo e tags. Escreveu `#biologia` no meio de
uma nota? Virou tag sozinho.

**Começar com o pé direito**
Modelos prontos para anotação de aula, resumo de matéria, plano de prova, lista
de tarefas e reunião de grupo. Ou uma folha em branco, se preferir.

**Não esquecer**
Lembretes para daqui a 30 minutos, amanhã, uma data específica, todo dia ou toda
semana.

**Estudar junto**
Grupos com salas de conversa, feed de avisos com fotos e enquetes, agenda de
provas e trabalhos, cargos e permissões (quem posta, quem fixa, quem manda
mensagem).

**Falar com quem importa**
Adicione amigos apontando a câmera para o QR code — ou passe seu código de 8
caracteres. As conversas são cifradas de ponta a ponta.

**Pedir ajuda pra IA**
Resumir a nota, explicar um trecho, gerar flashcards, montar um simulado com
gabarito, organizar em tópicos, melhorar o texto, criar um plano de estudos.

## Sobre suas coisas

Poucas frases, sem enrolação:

- **Suas notas ficam no seu celular.** Não sobem para lugar nenhum.
- **Suas conversas são cifradas no seu aparelho.** Não é força de expressão: nem
  eu consigo ler. Se você reinstalar o app sem a chave, nem você lê o histórico
  antigo.
- **Imagens de fora não carregam.** Se alguém colar um link de imagem de outro
  site, ele vira um link comum em vez de aparecer sozinho — porque carregar uma
  imagem entrega seu IP e o horário para quem hospeda ela.

## Baixar

**[⬇️ Baixar o APK mais recente](https://github.com/AnThophicous/markee/releases)**

Android. É um APK fora da Play Store, então o celular vai perguntar se você
confia — precisa liberar "instalar de fontes desconhecidas" uma vez.

Ainda não tem versão para iPhone.

## Grátis e Pro

Quase tudo é grátis, e continua sendo. Notas, pastas, tags, busca, lembretes,
grupos, salas, feed, amigos e conversas cifradas: **sem limite**.

O Pro (R$ 9,90/mês) cobre o que custa processamento e enfeite:

| | Grátis | Pro |
|---|---|---|
| Pedidos de IA por mês | 20 | 500 |
| Cor do grupo e do perfil | sólida | gradiente que você monta |
| Efeitos de luz | — | ✓ |
| Banner e ícone animado | — | ✓ |
| Cartão do grupo personalizado | — | ✓ |

> **Ainda não dá pra assinar.** O meio de pagamento não está conectado. Enquanto
> isso, tudo que é gratuito segue sem limite.

E a IA hoje usa **sua própria chave** da [OpenRouter](https://openrouter.ai)
(tem modelos gratuitos), que você cola em Configurações. Ela fica só no seu
aparelho.

## Mexer no código

```bash
git clone https://github.com/AnThophicous/markee.git
cd markee
npm install
cp .env.example .env      # seu projeto Supabase

npm run android           # precisa de Android SDK + JDK 17
```

O app usa módulos nativos, então **não roda no Expo Go**. As migrações do banco
estão em `supabase/migrations/`, na ordem.

Feito com React Native, Expo, TypeScript e Supabase.

## Licença

Código sob **Apache 2.0** — use, modifique, distribua. Veja [`LICENSE`](LICENSE).

A marca tem regra própria ([`TRADEMARKS.md`](TRADEMARKS.md)): fork sem fins
lucrativos pode manter o nome; para uso comercial, troque toda a identidade
antes. Ou seja — ganhe dinheiro com o código, não com a cara do Markee.
