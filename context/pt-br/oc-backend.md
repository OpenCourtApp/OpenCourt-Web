# OpenCourt — Contexto de Backend

## Supabase

- **Project ref:** `pmllugwxnbfmspbtzmzm`
- **URL:** `https://pmllugwxnbfmspbtzmzm.supabase.co`
- **Anon key:** veja `.env.example` (chave publicável — segura para expor ao navegador)
- **Senha do banco:** não armazenada no repositório (dashboard do Supabase → Project Settings → Database)
- **Localização:** Fly.io (Frankfurt)
- **Confirmação de e-mail:** desativada nas configurações de Auth

---

## Variáveis de ambiente (`.env.local`, documentadas em `.env.example`)

O template canônico fica na raiz do repositório em `.env.example` — copie-o para
`.env.local` e preencha os valores. Conteúdo completo:

```dotenv
# OpenCourt — variáveis de ambiente
# Copie este arquivo para .env.local e preencha com seus valores.
# Nunca commite o .env.local com credenciais reais.

# ============================================================
# Supabase (obrigatório)
# ============================================================

# URL do projeto Supabase. Obtenha em:
#   Supabase Dashboard → Project Settings → API → Project URL
NEXT_PUBLIC_SUPABASE_URL=

# Anon key (public safe). Obtenha em:
#   Supabase Dashboard → Project Settings → API → anon public key
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Service role key (server-only secret). Obtenha em:
#   Supabase Dashboard → Project Settings → API → service_role key
#   ⚠️ Nunca exponha este valor no frontend nem commitá-lo.
SUPABASE_SERVICE_ROLE_KEY=

# ============================================================
# Brevo (envio de convites por email)
# ============================================================

# Chave de API do Brevo (gerada em SMTP & API → API Keys)
BREVO_API_KEY=

# Endereço de remetente verificado no Brevo (ex: nome <seu-email@gmail.com>)
BREVO_FROM_EMAIL=

# ============================================================
# Site URL (opcional, recomendado para produção)
# ============================================================

# Origem canônica do seu site (ex: https://opencourt.vercel.app).
# Usado como fallback para redirects de OAuth e links de email.
NEXT_PUBLIC_SITE_URL=
```

`SUPABASE_SERVICE_ROLE_KEY` **nunca** é exposta ao navegador nem via variável
`NEXT_PUBLIC_*`. É importada apenas de arquivos `'use server'` via
`lib/supabase/admin.ts` e libera convites por meio de `hasAdminKey()`.

`BREVO_API_KEY` / `BREVO_FROM_EMAIL` são somente do servidor e usadas por
`lib/email/brevo.ts` (`sendInviteEmail`) para enviar os e-mails de convite.

---

## Clientes Supabase

### Browser (`lib/supabase/client.ts`)
`createBrowserClient(url, anonKey)` — usado em componentes client.

### Server (`lib/supabase/server.ts`)
`createServerClient(url, anonKey, { cookies })` — lê/escreve cookies do Next.js;
usado em server components e server actions.

### Admin (`lib/supabase/admin.ts`)
`createClient(url, serviceRoleKey, { auth: { persistSession: false } })` — ignora
o RLS; importado apenas de arquivos `'use server'`. `hasAdminKey()` é uma guarda
de pré-checagem.

---

## Camada de Auth (`lib/auth/`)

- **`validation.ts`** — `signInSchema`, `signUpSchema`, `createSchoolSchema`,
  `acceptInvitationSchema` (+ `acceptInvitationWithPasswordSchema` para o
  formulário de welcome de usuários não-Google), `inviteMemberSchema` + tipos
  exportados. `joinSchoolSchema` foi removido (o fluxo de entrada por token não
  existe mais).
- **`errors.ts`** — `friendlyAuthError(AuthError)`, `friendlyOnboardingError(message)`.
  Chaves de exceção de RPC conhecidas: `not_authenticated`, `no_invitation`,
  `already_member`, `not_a_member`, `member_already_exists`, `not_authorized`.
- **`actions.ts`** — actions `'use server'` que retornam `AuthActionResult`.

### `signIn`, `signUp`, `signOut`
Fluxos de e-mail/senha (server actions). `signUp` redireciona para `/onboarding`,
onde o usuário cria uma escola (único caminho para autocadastro).

### Google OAuth — iniciado no cliente, concluído no servidor

> **Facilitador opcional.** O login com Google é uma conveniência, não um
> requisito. O método principal, sempre disponível, é e-mail + senha. O app
> funciona plenamente sem o Google configurado; apenas o botão "Continuar com
> Google" fica indisponível. Habilite-o somente se quiser o provedor extra.

O login com Google **não** é uma server action (uma Server Action não consegue
realizar de forma confiável o redirecionamento cross-origin para o Google, e o
code verifier do PKCE precisa viver no navegador). A divisão:

- **Cliente (iniciado no navegador):** `components/google-sign-in-button.tsx`
  (usado por `LoginForm` e `SignupForm`) chama o cliente **browser**
  `createClient().auth.signInWithOAuth({ provider:'google', options:{ redirectTo:
  '<origin>/auth/callback?next=/dashboard' } })`. O cliente browser armazena o
  cookie do verifier PKCE e navega a página para o Google automaticamente.
- **Servidor (callback):** `app/auth/callback/route.ts` executa
  `supabase.auth.exchangeCodeForSession(code)` (o cliente server lê o cookie do
  verifier) e então redireciona para o `?next` relativo validado. O `proxy.ts`
  então roteia conforme o estado da conta.
- **Roteamento após o login:** novos usuários Google têm `active_school_id = NULL`
  (criado pelo trigger `handle_new_user()`) → o `proxy.ts` os envia para
  `/onboarding`; a página `/onboarding` redireciona para `/welcome` se existir um
  convite pendente para o e-mail deles (para que convidados aceitem em vez de criar
  uma escola). Os e-mails de convite levam direto para
  `/auth/callback?next=/welcome`.
- Não existe mais a server action `signInWithGoogle`.

> **Checklist do dashboard (manual, não dá para fazer por código):** no Supabase
> → Authentication → Providers, habilite **Google** e cole um **Client ID +
> Secret** do Google Cloud; adicione a URL de callback do Supabase
> (`https://<project>.supabase.co/auth/v1/callback`) às *Authorized redirect URIs*
> do cliente OAuth do Google, e adicione a(s) origem(ns) do app no Supabase →
> Authentication → URL Configuration (Site URL + allow-list de redirect). Sem isso
> o botão dá erro no Google.

> **Configuração de produção — obrigatória, separada do dev (esta é a causa nº 1
> de "funciona local, falha na Vercel").** O Supabase só aceita um `redirectTo`
> que corresponda à sua allow-list de **Redirect URLs**; qualquer outro valor cai
> silenciosamente para a **Site URL**. Se a origem de produção não estiver na
> allow-list, a autenticação Google conclui, mas o Supabase devolve o usuário para
> a Site URL (muitas vezes ainda `http://localhost:3000` do dev) — o código então
> chega a um domínio sem o cookie do verifier PKCE, `exchangeCodeForSession` falha
> e o usuário cai em `/login?error=oauth_failed`. Para corrigir, no Supabase →
> Authentication → URL Configuration:
> - **Site URL:** defina a origem canônica de produção, ex. `https://<your-app>.vercel.app`.
> - **Redirect URLs (allow-list):** adicione `https://<your-app>.vercel.app/auth/callback`.
>   Para também suportar preview deployments da Vercel, adicione um curinga como
>   `https://<project>-*.vercel.app/auth/callback` (as URLs de preview variam por
>   deployment).
> - Mantenha `http://localhost:3000/auth/callback` na allow-list para o dev local
>   continuar funcionando.
>
> A *Authorized redirect URI* do Google Cloud
> (`https://<project>.supabase.co/auth/v1/callback`) é a mesma para dev e produção,
> então não precisa de mudança específica. O app não lê `NEXT_PUBLIC_SITE_URL`
> para este fluxo — a origem do redirect vem de `window.location.origin` no
> navegador — então nenhuma variável da Vercel é necessária para o OAuth.

### E-mails de convite são enviados via Brevo (não pelo Supabase)

**Não** há login sem senha em `/login`. O único convite de saída é o que o
principal dispara em Collaborators: `inviteMember` →
`supabase.rpc('invite_member', …)` grava a linha em `invitations` e retorna seu
`id` → `sendInviteEmail` (`lib/email/brevo.ts`) envia um e-mail pela API do Brevo
com o link `<origin>/auth/callback?invitation_id=<id>&type=invite&next=/welcome`.
As regras de entrada somente por convite e papel definido pelo convidante (regras
de negócio #1 e #3) se mantêm porque a linha do convite + a RPC são o caminho de
entrada — o e-mail é apenas o canal de entrega.

`app/auth/callback/route.ts` trata `?invitation_id=` validando o convite no banco
(precisa estar `pending` e não expirado):

- **Sem sessão** → `/login?invitation_id=<id>&next=/welcome` (faça login ou
  cadastre-se primeiro; o convite é carregado pelo fluxo de login).
- **E-mail da sessão ≠ e-mail do convite** → `/login?error=invitation_email_mismatch`.
- **Correspondência** → `/welcome?invitation_id=<id>`.

Em `/welcome`, convidados não-Google **precisam** definir uma senha (sua única
credencial, aplicada via `updateUser` em `acceptInvitation`); convidados Google não
definem nenhuma. A aceitação em si é a RPC `accept_invitation`, que busca o convite
pendente pelo e-mail autenticado. Depois, os usuários fazem login normalmente em
`/login`.

> **Variantes do callback.** O callback ainda suporta `?code=` (Google OAuth /
> PKCE iniciado no mesmo navegador → `exchangeCodeForSession`) e
> `?token_hash=&type=` (magic links do Supabase → `verifyOtp`). Apenas o convite
> do Brevo usa `?invitation_id=`.

> **Configuração do Brevo (manual, não dá para fazer por código):** verifique o
> endereço remetente no Brevo e defina `BREVO_API_KEY` + `BREVO_FROM_EMAIL` no
> ambiente do servidor. O template padrão **Invite user** do Supabase não é mais
> usado, então não é necessário editar template.

### `createSchool(input)`
Chama a RPC `create_school` → `refreshSession()` → `redirect('/dashboard')`.

### `acceptInvitation(input)`
1. Usuários não-Google (`provider !== 'google'`) **precisam** fornecer uma senha —
   a action rejeita a ausência; então `supabase.auth.updateUser({ password })`.
   Usuários Google não definem nenhuma.
2. `supabase.rpc('accept_invitation', { p_full_name })`
3. `refreshSession()` → `redirect('/dashboard')`

### `switchSchool(schoolId)`
1. `supabase.rpc('switch_school', { p_school_id: schoolId })`
2. `refreshSession()`
3. `revalidatePath('/', 'layout')` — o cliente chama `window.location.reload()` depois

---

## Camada de Collaborators (`lib/collaborators/`)

- **`validation.ts`** — `inviteMemberSchema` (e-mail + papel), `removeMemberSchema`,
  `revokeInvitationSchema`. `addCollaboratorSchema` foi removido.
- **`errors.ts`** — `GENERIC_COLLABORATOR_ERROR`, `NOT_PRINCIPAL_ERROR`,
  `MISSING_ADMIN_KEY_ERROR`.
- **`actions.ts`** — actions `'use server'`; todas chamam `revalidatePath('/collaborators')`.

### `inviteMember(input)`
1. Valida + `requirePrincipal()` (checagem de papel no JWT) + guarda `hasAdminKey()`
2. `supabase.rpc('invite_member', { p_email, p_role })` — grava a linha em
   `invitations` e retorna seu `id`
3. Monta `inviteUrl = <origin>/auth/callback?invitation_id=<id>&type=invite&next=/welcome`
   e chama `sendInviteEmail({ email, inviteUrl })` (Brevo)
4. Se o e-mail falhar, a linha do convite já existe — a action retorna um erro de
   "reenviar" e o principal pode tentar de novo em Collaborators

### `revokeInvitation(invitationId)`
`supabase.rpc('revoke_invitation', { p_invitation_id })` → revalidate

### `removeMember(userId)`
`supabase.rpc('remove_member', { p_user_id })` → revalidate

---

## Proteção de rotas (`proxy.ts`)

Delega para `lib/supabase/proxy.ts → updateSession()`:

- Caminhos públicos: `/login`, `/register`, `/auth/callback`
- **Não autenticado** → `/login`
- `/auth/callback` → sempre passa (handshake do OAuth)
- **Autenticado, sem `active_school_id`** → permite `/onboarding` e `/welcome`;
  caso contrário → `/onboarding`
- **Autenticado, com `active_school_id`** → permite `/welcome` (aceitar convites
  adicionais); redireciona público/onboarding para `/dashboard`

O proxy verifica `user.user_metadata?.active_school_id` (não `school_id`).

---

Versão em inglês: [`../en/oc-backend.md`](../en/oc-backend.md)
