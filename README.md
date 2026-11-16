# OpenCourt

> Sistema de agendamento de quadras para escolas e espaços privados.

O OpenCourt centraliza a reserva de quadras de uma organização. A direção cria a
escola, convida professores e representantes estudantis, cadastra as quadras e
todos reservam e acompanham a ocupação em um calendário compartilhado, sempre
no escopo da organização em que o membro está atuando.

---

## Integrantes

| Nome completo                     | RM       |
| --------------------------------- | -------- |
| Breno Valentim Bernardo           | 20240207 |
| João Pedro Crepaldi Gonçalves     | 20230465 |
| Gabriel Loureiro Amorim Hugi      | 20240192 |

---

## Descrição do projeto

Na Etec Bento Quirino, a quadra é um espaço compartilhado por toda a comunidade
escolar. A mesma quadra usada pelo professor de Educação Física nas aulas é a
quadra que a coordenação utiliza para agendar eventos (como apresentações de TCC
e o aluguel para escolas de fora) e que o Grêmio Estudantil usa para organizar o
interclasse — e assim por diante.

Como cada um desses grupos fazia seus agendamentos por canais separados e sem
uma visão comum da ocupação, as reservas frequentemente colidiam ou não eram
transparentes para o restante da escola. Isso tornava a gestão da quadra
desorganizada: um evento marcado pela coordenação podia ser sobreposto por uma
aula de Educação Física, e nem sempre era possível saber quem havia reservado
qual horário.

Foi a partir dessa necessidade da comunidade escolar que surgiu o **OpenCourt**:
uma aplicação web que reúne em um único lugar o cadastro dos espaços, as regras
de acesso e todas as reservas da quadra, com calendário compartilhado e
prevenção de conflitos de horário.

---

## Objetivos

**Objetivo geral:** centralizar e organizar o agendamento da quadra da escola,
garantindo que todos os usos — aulas, eventos institucionais e atividades
estudantis — convivam sem choques de horário e com total visibilidade.

**Objetivos específicos:**

- **Impedir colisões de agendamento** — impedir que um evento marcado pela
  coordenação seja sobreposto por uma aula de Educação Física, e vice-versa, com
  validação de conflito no momento da reserva.
- **Dar transparência à ocupação** — qualquer membro da organização enxerga, em
  um calendário único (mês, semana, dia e agenda), o que já está reservado, por
  quem e em qual horário.
- **Organizar o acesso por papel** — definir quem pode reservar, gerenciar
  quadras e convidar pessoas, por meio de papéis (`principal`, `teacher`,
  `student_rep`) atribuídos no convite.
- **Facilitar o uso no dia a dia** — oferecer um painel com o status da quadra,
  as reservas do dia e os horários disponíveis, reduzindo a dependência de
  comunicação informal.

**Resultados esperados:** uma quadra com ocupação clara e rastreável, menos
conflitos de horário, menos retrabalho para a coordenação e mais autonomia para
professores e Grêmio consultarem e reservarem o espaço.

---

## Metodologia

O desenvolvimento foi conduzido de forma incremental, com as seguintes etapas e
procedimentos:

1. **Levantamento de requisitos.** A equipe conversou com a comunidade escolar
   da Etec Bento Quirino para entender como a quadra é usada hoje e quais
   conflitos precisavam ser resolvidos. Esse contato foi viabilizado pela
   coordenação do curso técnico, que fez a ponte entre a equipe e os diferentes
   setores da escola (professores, coordenação e Grêmio Estudantil).

2. **Definição de escopo e regras de negócio.** A partir do levantamento, foram
   definidos os papéis de acesso (direção/coordenação, professor e representante
   estudantil), o fluxo de convite de membros, o cadastro de quadras e a regra
   central do sistema: **não permitir reservas com sobreposição de horário na
   mesma quadra**.

3. **Modelagem de dados.** A estrutura do sistema (organizações, integrantes,
   convites, quadras e reservas) foi modelada como um banco relacional no
   Supabase, com as regras de negócio aplicadas também no banco, por meio de
   funções SQL (`RPC`).

4. **Desenvolvimento.** A aplicação foi construída como uma web app com
   **Next.js 16 (App Router)**, **React 19** e **TypeScript**, com interface em
   **Tailwind CSS v4** e **shadcn/ui**, autenticação e persistência via
   **Supabase**.

5. **Implantação.** A aplicação foi publicada na **Vercel**, com o ambiente de
   produção configurado a partir do repositório do projeto.

> As etapas foram executadas de forma iterativa: cada funcionalidade era
> implementada, revisada junto ao grupo e ajustada conforme o entendimento da
> necessidade evoluía.

---

## Tecnologias utilizadas
<img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nextjs/nextjs-original.svg" width=100/>
<img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/typescript/typescript-original.svg" width=100/>
<img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/supabase/supabase-original.svg" width=100/>
<img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/vercel/vercel-original.svg" width=100/>
          
          
          
### Banco de dados

**Supabase (PostgreSQL).** O banco de dados é um PostgreSQL hospedado no
Supabase, responsável por armazenar organizações, integrantes, convites, quadras
e reservas. Além do armazenamento, o banco concentra as regras de negócio por
meio de funções SQL (`RPC`) executadas pelo servidor, como criação de escola,
convite de membros e verificação de conflito de horário. O Supabase também provê
o serviço de autenticação (e-mail/senha como método principal e Google como
facilitador opcional).

### Inteligência Artificial

**Claude Code.** Assistente de IA utilizado como apoio ao desenvolvimento —
auxiliou na escrita e refatoração de código, na revisão de trechos da aplicação
e na organização da estrutura do projeto. As decisões de produto, modelagem e
regras de negócio permaneceram sob responsabilidade da equipe.

### Demais tecnologias

| Camada        | Tecnologia                                   |
| ------------- | -------------------------------------------- |
| Framework     | Next.js 16 (App Router) · React 19           |
| Linguagem     | TypeScript                                   |
| Estilização   | Tailwind CSS v4                              |
| UI            | shadcn/ui · Radix · Remixicon / Lucide       |
| Gráficos      | Recharts                                     |
| Calendário    | react-big-calendar                           |
| Auth e dados  | Supabase (Auth + PostgreSQL)                 |
| Acesso a dados| `@supabase/ssr` (sem ORM)                    |
| Formulários   | react-hook-form + Zod                        |
| Fonte         | DM Sans (`next/font/google`)                 |
| E-mail        | Brevo (API de e-mail transacional)           |
| Hospedagem    | Vercel                                       |

### Ambiente de execução e infraestrutura

- **Runtime:** Node.js 20.9+ (exigido pelo Next.js 16), executando a aplicação
  como server components e serverless functions.
- **Aplicação:** Next.js 16 com App Router, servida pela Vercel.
- **Banco de dados e autenticação:** Supabase Cloud (PostgreSQL gerenciado +
  Supabase Auth), acessado via `@supabase/ssr`.
- **Hospedagem e deploy:** Vercel, com a branch `main` como ambiente de produção.

### Serviços externos e integrações

Para funcionar, a aplicação depende de serviços externos:

| Serviço                 | Obrigatório?       | Papel |
| ----------------------- | :----------------: | ----- |
| **Supabase**            | Sim                | Banco de dados PostgreSQL e autenticação por e-mail/senha. É a base de persistência e acesso da aplicação. |
| **Brevo**               | Sim (para convites) | Envio dos e-mails de convite via API. Necessário para o fluxo de convite por e-mail. |
| **Vercel**              | Sim                | Hospedagem da aplicação e execução das serverless functions em produção. |
| **Google Cloud OAuth**  | Não (facilitador)  | Login com Google via OAuth/PKCE. É um facilitador opcional — o acesso por e-mail e senha funciona de forma independente. |

> O login com Google é uma conveniência de acesso, não uma dependência: sem ele,
> a aplicação continua operando normalmente com e-mail e senha.

---

## Funcionalidades

- **Workspaces multi-escola** — uma conta pode pertencer a várias escolas com
  papéis diferentes em cada uma, alternando o contexto ativo pela barra lateral.
- **Membros somente por convite** — a direção convida colaboradores por e-mail;
  os papéis (`principal` / `teacher` / `student_rep`) são definidos por quem
  convida, nunca escolhidos pelo próprio usuário.
- **Reserva de quadras** — criar, visualizar e gerenciar reservas em calendário
  de mês / semana / dia / agenda, com prevenção de sobreposição.
- **Painel** — status da quadra, reservas do dia, horários disponíveis e gráfico
  semanal de ocupação.
- **Login com e-mail e com Google** — entrar com e-mail + senha (método
  principal) ou com Google (OAuth/PKCE, facilitador opcional).
- **Perfis e configurações** — avatares, troca de instituição, preferências de
  notificação e gerenciamento de quadras por organização.

---

## Arquitetura

**Autenticação e modelo de acesso.** O Supabase Auth emite a sessão. A
organização ativa de cada usuário fica no JWT
(`user_metadata.active_school_id` + `role`), de modo que as políticas de **Row
Level Security (RLS)** autorizam cada consulta a partir do token — sem `join` na
tabela `users`, o que evita recursão. Após qualquer mudança de contexto
(`create_school`, `accept_invitation`, `switch_school`) a aplicação chama
`refreshSession()` para que as novas informações cheguem ao cookie.

**Mutações são server actions.** As escritas passam por actions `'use server'` em
`lib/*/actions.ts`, que chamam funções PostgreSQL (`RPC`). As regras de negócio
vivem no banco, não apenas na interface.

**Três clientes Supabase.** `lib/supabase/client.ts` (navegador), `server.ts`
(server components / actions, ciente de cookies) e `admin.ts` (service-role,
somente no servidor — fornece `hasAdminKey()`, que libera o envio de convites). A
chave service-role nunca é exposta ao navegador.

**Proteção de rotas** feita por `proxy.ts` (middleware do Next.js 16) →
`lib/supabase/proxy.ts`: usuários não autenticados vão para `/login`;
autenticados sem escola ativa vão para `/onboarding`; os demais chegam à
aplicação.

**O Google OAuth é opcional e começa no cliente.** Quando configurado, o navegador
inicia o fluxo PKCE (`google-sign-in-button.tsx`) para ser dono do code verifier;
o Google retorna para `app/auth/callback/route.ts`, que troca o código por uma
sessão no servidor. O mesmo callback trata convites enviados pelo **Brevo** (via
`invitation_id`) e magic links do Supabase (via `verifyOtp`). Sem Google, o login
por e-mail e senha continua funcionando normalmente.

Para o panorama completo, veja a documentação detalhada em [`context/`](context/).

---

## Estrutura do projeto

```
opencourt/
├── app/
│   ├── (auth)/            # login, register, onboarding, welcome
│   ├── (app)/             # dashboard, calendar, collaborators, settings, courts
│   ├── auth/callback/     # troca de token OAuth + convite (route handler)
│   ├── layout.tsx         # layout raiz (DM Sans, Toaster)
│   ├── page.tsx           # redireciona → /dashboard
│   └── globals.css        # Tailwind v4 + design tokens do shadcn
├── components/            # componentes de feature + compartilhados (ui/ = shadcn)
├── hooks/                 # hooks React reutilizáveis
├── lib/
│   ├── auth/              # validação, erros, actions de login/cadastro
│   ├── bookings/          # actions de reserva (checagem de sobreposição)
│   ├── collaborators/     # actions de convite / remoção / revogação
│   ├── courts/            # actions de CRUD de quadras
│   ├── supabase/          # client · server · admin · proxy (sessão)
│   └── strings/           # textos de UI centralizados
├── types/                 # tipos TypeScript compartilhados
├── proxy.ts               # middleware do Next.js 16 → proteção de rotas
├── supabase/
│   ├── seed.sql           # instalação canônica (schema + triggers + RPCs)
│   ├── migrations/        # histórico de migrações incrementais
│   └── *.sql              # helpers de setup / e-mail
└── context/               # docs em pt-br/ e en/ (produto, banco, backend, frontend, UI)
```

---

## Como executar

### Pré-requisitos

- **Node.js 20.9+** (exigido pelo Next.js 16)
- Um projeto **Supabase** ([supabase.com](https://supabase.com))

### 1. Instalar

```bash
npm install
```

### 2. Configurar o ambiente

Copie o arquivo de exemplo e preencha com os valores do seu projeto Supabase:

```bash
cp .env.example .env.local
```

| Variável                        | Obrigatória | Observações                                                    |
| ------------------------------- | :---------: | -------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      |     ✅      | URL do projeto (Dashboard → Project Settings → API).           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` |     ✅      | Chave publicável/anon — segura para o navegador.               |
| `SUPABASE_SERVICE_ROLE_KEY`     |     ✅      | **Segredo somente do servidor**, ignora as regras de acesso. Necessária para liberar o envio de convites. Nunca prefixe com `NEXT_PUBLIC_`. |
| `BREVO_API_KEY`                 |     ✅      | Chave da API do Brevo, usada para enviar os convites por e-mail. Somente no servidor. |
| `BREVO_FROM_EMAIL`              |     ✅      | Remetente verificado no Brevo (ex.: `OpenCourt <no-reply@dominio.com>`). |
| `NEXT_PUBLIC_SITE_URL`          |      —      | Origem de fallback opcional para redirecionamentos; o OAuth usa `window.location.origin`. |

> Reinicie o `next dev` após alterar o `.env.local`.

### 3. Configurar o banco

`supabase/seed.sql` é uma instalação idempotente de uso único — schema, políticas
de RLS, triggers e todas as RPCs. Aplique de uma das formas:

- **Hospedado:** cole o conteúdo no **SQL Editor** do Supabase e execute, ou
- **CLI local:** `supabase db reset` (aplica o `seed.sql`).

Os arquivos datados em `supabase/migrations/` são o histórico incremental —
aplique-os em ordem ao evoluir um banco já inicializado.

### 4. Configurar o dashboard do Supabase (uma vez, manual)

Estes passos não podem ser feitos por código:

1. **Auth → Settings:** desligue "Confirm email".
2. **Auth → Providers → Google (opcional):** para habilitar o login com Google,
   ative o provedor e cole um **Client ID + Secret** do Google Cloud. No Google
   Cloud, adicione o callback do Supabase
   `https://<project-ref>.supabase.co/auth/v1/callback` às *Authorized redirect
   URIs* do cliente.
3. **Auth → URL Configuration:** defina a **Site URL** e adicione as origens da
   aplicação às **Redirect URLs** (ex.: `http://localhost:3000/auth/callback`).
   Veja [Implantação](#implantação) para a lista de produção.
4. **Brevo (convites):** verifique o remetente na conta do Brevo e defina
   `BREVO_API_KEY` + `BREVO_FROM_EMAIL`. Os e-mails de convite são enviados pela
   API do Brevo (o template padrão *Invite user* do Supabase não é mais usado).

### 5. Executar

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

---

## Scripts

| Comando         | Descrição                        |
| --------------- | -------------------------------- |
| `npm run dev`   | Inicia o servidor de desenvolvimento |
| `npm run build` | Build de produção                |
| `npm run start` | Serve o build de produção        |
| `npm run lint`  | Executa o ESLint                 |

---

## Implantação

A aplicação é feita para a **Vercel**, e a branch `main` é a de produção —
um push em `main` dispara o deploy de produção.

1. Defina as três variáveis de ambiente obrigatórias nas configurações do
   projeto na Vercel.
2. **Configure a allow-list de OAuth de produção** no Supabase → Auth → URL
   Configuration. Esta é a causa mais comum de "funciona local, falha em
   produção": o Supabase só aceita um `redirectTo` que corresponda à sua
   allow-list de **Redirect URLs**; caso contrário, ele volta silenciosamente
   para a **Site URL**.
   - **Site URL:** a origem canônica de produção (ex.: `https://opencourt.app`).
   - **Redirect URLs:** adicione `https://<seu-dominio>/**` e mantenha
     `http://localhost:3000/**` para desenvolvimento local. Para preview
     deployments da Vercel, adicione um curinga como
     `https://<projeto>-*.vercel.app/**`.

   A *Authorized redirect URI* do Google Cloud aponta para o Supabase, então é a
   mesma para dev e produção — nenhuma mudança específica ali.

---

## Modelo de domínio

- **Escolas** são organizações; cada uma gera um identificador `OC-XXXX-XXXX`
  (reservado para uso futuro — não é credencial de login).
- **Memberships** ligam um usuário a uma escola com um papel; um usuário tem no
  máximo um vínculo por escola.
- **Convites** são linhas de e-mail + papel criadas pela direção; um convite
  pendente por e-mail por escola, expirando após 7 dias.
- **Quadras** pertencem a uma escola (gerenciadas pela direção). Uma escola nova
  começa sem quadras — a direção cadastra a primeira dentro da aplicação.
- **Reservas** ocupam uma quadra em uma janela de data/hora; sobreposições são
  rejeitadas.

Papéis: `principal` (controle total, não pode ser removido), `teacher`,
`student_rep`.

---

## Documentação

O contexto aprofundado fica em [`context/pt-br/`](context/pt-br/) (versões em
inglês em [`context/en/`](context/en/)):

| Doc | Conteúdo |
| --- | -------- |
| [`oc-product.md`](context/pt-br/oc-product.md)   | Visão de produto, rotas, telas, regras de negócio |
| [`oc-db.md`](context/pt-br/oc-db.md)             | Schema, regras do banco, triggers, RPCs, storage  |
| [`oc-backend.md`](context/pt-br/oc-backend.md)   | Clientes Supabase, fluxos de auth, server actions |
| [`oc-frontend.md`](context/pt-br/oc-frontend.md) | Estrutura de páginas, componentes, sidebar, configurações |
| [`oc-ui.md`](context/pt-br/oc-ui.md)             | Design tokens, movimento, convenções visuais |

---

## English version

An English version of this README is available in
[`README.en.md`](README.en.md).
