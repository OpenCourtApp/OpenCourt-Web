# OpenCourt — Contexto de Frontend

## Estrutura de páginas

```
app/
├── page.tsx                        # Redireciona → /dashboard
├── layout.tsx                      # Layout raiz (DM Sans, modo claro, Toaster)
├── globals.css                     # Tailwind v4 + variáveis CSS do shadcn
│
├── (auth)/                         # Páginas de auth independentes
│   ├── login/page.tsx              # Login (layout 2 colunas espelhado)
│   ├── register/page.tsx           # Cadastro (coluna única)
│   ├── onboarding/page.tsx         # Página de criar escola (exige sessão, sem escola ativa)
│   └── welcome/page.tsx            # Aceite de convite (exige sessão)
│
├── auth/
│   └── callback/route.ts           # Troca de código OAuth (exchangeCodeForSession)
│
└── (app)/                          # Rotas autenticadas + já onboardadas
    ├── layout.tsx                  # SidebarProvider + AppSidebar + HeaderBar
    ├── dashboard/page.tsx          # Linha de stats, gráfico semanal, lista de próximos
    ├── calendar/page.tsx           # BigCalendarView (react-big-calendar)
    ├── collaborators/page.tsx      # Server component → CollaboratorsView
    ├── courts/page.tsx             # Redireciona → /settings (gestão de quadras movida para Configurações)
    └── settings/page.tsx           # Perfil, Instituições, Autorização, Quadras, Notificações, Aparência
```

---

## Páginas de auth

### Login (`/login`)
Layout em 2 colunas. Esquerda: `OpenCourtLogo` + LoginForm. Direita: imagem hero +
gradiente. `LoginForm` (`components/login-form.tsx`) é e-mail + senha → `signIn()`,
mais um botão Google opcional (exibido apenas quando o provedor Google está
configurado) e um link "Cadastre-se". **Não** há login sem senha em `/login`: o
único convite de saída é o e-mail do principal (enviado via Brevo — veja
`inviteMember` / oc-backend.md), que leva os convidados para `/welcome`.

### Cadastro (`/register`)
Coluna única. `OpenCourtLogo` + SignupForm (Card, max-w-sm).

### Onboarding (`/onboarding`)
Server component. Redireciona para `/login` sem sessão, para `/dashboard` se já
onboardado (tem `active_school_id`). Renderiza `OnboardingForm` com e-mail + nome
pré-preenchidos. Apenas uma aba agora — **Criar uma escola** (sem fluxo de entrada
por token).

### Welcome (`/welcome`)
Server component. Exige sessão (o proxy garante). Busca um convite `pending` e não
expirado para o e-mail do usuário autenticado na tabela `invitations`.

- **Com convite**: renderiza `WelcomeForm` (`components/auth/welcome-form.tsx`)
  mostrando nome da organização, Badge de papel, campo de Nome completo
  (pré-preenchido), campo de senha opcional (oculto para Google OAuth). Envio →
  `acceptInvitation()` → `/dashboard`.
- **Sem convite**: Card neutro com CTA "Criar uma organização" + Encerrar sessão.

---

## Layout autenticado (`app/(app)/layout.tsx`)

```tsx
<SidebarProvider>
  <AppSidebar />     {/* NavSchoolSwitcher (header), NavMain, NavUser (footer) */}
  <SidebarInset>
    <HeaderBar />    {/* título/descrição + CTA opcional — sem menu de conta */}
    <main>{children}</main>
  </SidebarInset>
</SidebarProvider>
```

---

## Componentes de formulário

### `components/onboarding-form.tsx`
Formulário apenas de criar escola (sem abas). Campos: Nome completo + Nome da
escola (`RiSchoolLine`). Chama `createSchool()`. Saída de escape: encerrar sessão.

### `components/auth/welcome-form.tsx`
Formulário de aceite de convite. Mostra nome da organização, Badge de papel
(somente leitura), campo de Nome completo e uma senha. A senha é **oculta para
usuários Google** e **obrigatória para todos os outros** (torna-se a única
credencial deles — o link do convite é de uso único). O resolver alterna em
`isGoogleUser` (`acceptInvitationSchema` vs `acceptInvitationWithPasswordSchema`).
Chama `acceptInvitation()`.

---

## Barra lateral (`components/app-sidebar.tsx`)

`'use client'` — carrega escolas + papel ativo + o perfil do usuário via
`useEffect`, depois renderiza. **Posicionamento (convenção Notion/Linear/Slack):**
contexto do workspace (seletor de escola) no **cabeçalho**, conta pessoal
(`NavUser`) no **rodapé**. Num app multi-escola, o contexto da escola ativa é a
orientação primária, então o seletor lidera e serve de branding (sem logo
independente). A barra de cabeçalho superior, portanto, não tem menu de conta —
apenas título/descrição/CTA.

### `components/nav-school-switcher.tsx` (SidebarHeader)
- **Trigger** (`SidebarMenuButton size="lg"`): `OpenCourtMark` num quadrado
  arredondado (`bg-sidebar-primary`), nome da escola (primário), papel (muted),
  `RiExpandUpDownLine`. No modo ícone recolhido: só a marca aparece.
- **DropdownMenu** (`side="bottom"`, abre para baixo a partir do cabeçalho):
  rótulo "Organizations" → lista todas as escolas com `RiCheckLine` na ativa.
  Selecionar → `switchSchool(school_id)` → `window.location.reload()`. Separador →
  "Create organization" (`RiAddLine`) → `/onboarding`.

### `components/nav-user.tsx` (SidebarFooter)
- Props `{ name, email, role }` (vindas do fetch de perfil do `app-sidebar.tsx`).
- **Trigger**: avatar (iniciais) + nome + papel + `RiArrowUpDownLine`; recolhe para
  **somente avatar** no modo ícone (`group-data-[collapsible=icon]:hidden` no texto
  + chevron).
- **DropdownMenu** (`side="right"`, abre ao lado da barra): rótulo avatar + nome +
  e-mail, Settings → `/settings`, Log out → `signOut()`.
- Ambos os slots mostram um `NavRowSkeleton` (avatar + duas linhas) enquanto
  carregam. O antigo componente `HeaderUser` da barra superior foi removido.

### NavMain
Itens `Link` simples dentro de `SidebarMenuButton`; ativo via `usePathname()`.

---

## Páginas do app

| Página          | Status      | Conteúdo                                                                          |
| --------------- | ----------- | --------------------------------------------------------------------------------- |
| `/dashboard`    | Pronto      | Cards de stats, gráfico de barras Recharts, lista de próximos de hoje             |
| `/calendar`     | Pronto      | Shadcn UI Big Calendar (`components/calendar/big-calendar-view.tsx`) — react-big-calendar com toolbar customizada no tema do app + células de evento |
| `/collaborators`| Pronto      | Tabela combinada de membros + convites pendentes, diálogo de convite, badges de papel/status |
| `/settings`     | Pronto      | Perfil, seletor de Instituições, token de acesso (somente principal), quadras (somente principal), notificações, aparência |
| `/courts`       | Redireciona | Redireciona para `/settings`; a gestão de quadras agora é a seção Quadras em Configurações |

---

## Collaborators (`/collaborators`)

Server component busca duas queries em paralelo (no escopo de `active_school_id`):
1. `memberships` com join em `users` (perfis) → `ActiveMember[]`
2. `invitations` onde `status = 'pending'` → `PendingInvite[]`

Tipos exportados de `app/(app)/collaborators/page.tsx`:
```ts
type ActiveMember = { type:'member', id, user_id, full_name, email, role }
type PendingInvite = { type:'invite', id, email, role, expires_at }
type CollaboratorRow = ActiveMember | PendingInvite
```

### `components/collaborators/collaborators-view.tsx`
Define o cabeçalho: "Collaborators" + CTA "Invite collaborator" (`RiUserAddLine`,
somente principal). Mescla membros + pendentes em `allRows`, filtra por busca de
nome/e-mail.

### `components/collaborators/collaborators-table.tsx`
Colunas: Nome | E-mail | Papel | Status | Ações.
- Linha **Active**: avatar + full_name, RoleBadge, `StatusBadge active`, botão
  Remover (`RemoveMemberButton`) para linhas não-principais e que não sejam o
  próprio usuário.
- Linha **Pending**: nome "—", e-mail, RoleBadge, `StatusBadge pending`, Reenviar
  (`ResendInvitationButton`) + Cancelar (`RevokeInvitationButton`).

### `components/collaborators/collaborator-actions.tsx`
Três botões: `RemoveMemberButton` (AlertDialog → `removeMember`),
`RevokeInvitationButton` (ícone → `revokeInvitation`), `ResendInvitationButton`
(ícone → `inviteMember` com o mesmo e-mail+papel).

### `components/collaborators/add-collaborator-dialog.tsx`
Campos: E-mail + Papel (Professor / Representante Estudantil). Envio →
`inviteMember` → `toast.success('Invitation sent')`.

---

## Configurações (`/settings`)

Navegação lateral com scrollspy com seções: Perfil · Instituições · Autorização ·
Quadras · Notificações · Aparência. (Autorização e Quadras não renderizam nada
para não-principais.)

### `components/settings/ProfileForm.tsx`
Seção de perfil: avatar + Nome completo + E-mail + Nova senha. O **bloco de
avatar** mostra a foto atual (upload → Google → fallback de iniciais). Usuários de
e-mail+senha têm controles Enviar/Alterar/Remover que fazem PUT do arquivo no
bucket de storage `avatars` (`<user_id>/avatar-<ts>.<ext>`, máx. 2 MB, apenas
imagens) e então gravam a URL pública nos **metadados de auth** (`avatar_url`) —
sem coluna de perfil. Usuários Google veem a foto somente leitura ("Gerenciada
pela sua conta Google"). O avatar (circular) aparece na barra lateral (`NavUser`)
no próximo carregamento. A troca de senha aplica a política de cadastro e expõe
erros do Supabase via `friendlyAuthError`.

### `components/settings/InstitutionsPanel.tsx`
Carrega as memberships do usuário no cliente. Lista escolas com Badge de papel +
indicador de ativa (`RiCheckLine`). Se >1 escola: botão "Trocar" →
`switchSchool()` → `window.location.reload()`. Informativo se houver apenas uma
escola.

### `components/settings/AuthorizationPanel.tsx`
Somente principal. Busca `access_token` da tabela `schools` para a escola ativa.
Mostra o token com botão Copiar (`RiFileCopyLine`). Aviso: "Identificador da
organização — reservado para uso futuro."

### `components/settings/CourtsPanel.tsx`
Somente principal (retorna null para membros), junto de Autorização. A gestão de
quadras foi movida para cá a partir da antiga página isolada `/courts` (que agora
redireciona para `/settings`). Lista enxuta: adicionar (formulário inline),
renomear (inline), excluir (AlertDialog; bloqueado enquanto a quadra tiver
reservas), apoiada por `createCourt` / `renameCourt` / `deleteCourt` (RLS:
INSERT/UPDATE/DELETE somente principal — inalterado). Lê quadras/reservas do
`BookingsProvider`; `EmptyState` cobre o caso sem quadras (a primeiríssima quadra é
tratada antes pelo `FirstCourtGate`).

---

## Componentes compartilhados

### `components/shared/header-context.tsx`
`HeaderProvider` + `useHeader()` — as páginas definem `{ title, description, cta }`
em `useEffect`.

### `components/shared/oc-logo.tsx`
`OpenCourtLogo` (SVG horizontal completo) e `OpenCourtMark` (marca compacta).
Usados nas páginas de auth e dentro do seletor de escola da barra lateral.

### `components/shared/empty-state.tsx`
`EmptyState({ icon, title, description?, action? })` — usado por Calendar,
Collaborators e pela lista de próximos.

---

## Convenções de Badge / Token

| Estado      | Classes                               |
| ----------- | ------------------------------------- |
| Active      | `bg-muted text-muted-foreground`      |
| Pending     | `bg-warning/10 text-warning`          |
| Principal   | `bg-success/10 text-success`          |
| Teacher     | `bg-muted text-muted-foreground`      |
| Student Rep | `variant="outline"` `border-primary/40 text-primary` |

Nunca codifique nomes de cor fixos. Sempre use os tokens de variável CSS.

---

## Convenções de movimento

Micro-movimento sóbrio, inspirado em Notion/Linear — sem easing saltitante, sem
scale-pop, sem decoração de brilho. Um leve brilho em gradiente é aceitável quando
é uma única passada contida (ex.: o shimmer de hover `white/25` do botão "Nova
reserva"); evite animação de gradiente em loop ou chamativa. Movido pelas
utilitários de transição do Tailwind v4 e por `tw-animate-css` (importado em
`globals.css`); **sem bibliotecas de animação extras**.

| Padrão | Implementação | Duração |
| --- | --- | --- |
| Mudanças de cor em hover/active | `transition-colors` (ease padrão) | 150ms |
| Pressão do botão primário | `motion-safe:active:scale-[0.98]` (apenas variante default; ghost/link/outline excluídas). Todos os botões mantêm o nudge base `active:translate-y-px`. | base `transition-all` |
| Botões do menu lateral | base adiciona `color,background-color` a `transition-[…] duration-150` para que estados ativo/hover esmaeçam em vez de saltar | 150ms |
| Expandir/recolher do logo lateral | duas camadas empilhadas fazem cross-fade via `transition-opacity` + `delay-*`: expandindo → a marca some instantaneamente, o logo completo surge após 200ms; recolhendo → o logo some instantaneamente, a marca surge após 200ms | 200ms |
| Dialog / AlertDialog / Sheet / Dropdown | padrões shadcn + Radix via `tw-animate-css` (`data-open:animate-in fade-in-0 zoom-in-95` / slide para superfícies laterais). Não adicione easing extra nem sobrescreva. | ~100ms |
| Linhas de tabela | `transition-colors hover:bg-muted/50` (embutido em `ui/table.tsx` `TableRow`) | 150ms |
| Toasts | padrões do Sonner (inalterados) | — |
| Skeletons | `ui/skeleton.tsx` `animate-pulse`; use em qualquer carregamento client-side (sidebar `NavRowSkeleton` para switcher + NavUser, InstitutionsPanel) | — |
| Entradas únicas | Cards de stats do Dashboard: `motion-safe:animate-in fade-in-0 slide-in-from-bottom-2` com stagger `delay-75`/`delay-150` via o container do grid. Entradas podem durar ~300ms; reserve isso para mount, não para decoração persistente. | 300ms |

Regras:
- **Todas as transições interativas ficam em 100–200ms.** Apenas entradas de mount
  podem chegar a ~300ms.
- **Respeite o movimento reduzido:** envolva qualquer entrada de movimento/scale em
  `motion-safe:` para que seja desativada sob `prefers-reduced-motion`. Fades puros
  de cor/opacidade podem ficar sem prefixo (degradam para mudança instantânea).
- Gradientes são permitidos quando sutis e derivados de tokens (veja `oc-ui.md`
  para a barra); sem brilho ou glassmorphism em superfícies de UI.

**Pendência (não implementada):** animar as linhas de colaborador *saindo* em
`removeMember`/`revokeInvitation` exige estado de saída no cliente (as linhas vêm
de um re-render de server component após `revalidatePath`, então hoje elas somem
abruptamente). Acompanhe os ids saindo em `collaborators-view.tsx`, aplique
`animate-out fade-out-0` e depois revalide — adiado para evitar acoplamento de
estado cliente/servidor aqui.

---

Versão em inglês: [`../en/oc-frontend.md`](../en/oc-frontend.md)
