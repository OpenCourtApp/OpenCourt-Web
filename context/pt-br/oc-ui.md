# OpenCourt — Contexto de UI

## Direção de design

Sóbrio e profissional, no espírito de Notion/Linear: paleta majoritariamente
neutra, bastante espaço em branco, bordas de 1px em vez de sombras flutuantes,
hierarquia tipográfica clara, densidade de informação confortável. **A cor de
destaque é usada com parcimônia** — apenas para ações primárias, focus rings,
indicadores de estado/live, links e gráficos. Estados ativos de navegação, avatares
e elementos decorativos ficam neutros. **Gradientes são permitidos, mas com
parcimônia e bom gosto** — somente quando sutis, derivados dos tokens do tema (não
de matizes arbitrários) e genuinamente aditivos numa superfície de destaque
deliberada. Usos sancionados hoje: o painel hero do login
(`from-chart-3 via-primary to-chart-5` + um scrim de legibilidade `black/60`) e o
fundo de matriz de pontos do gráfico semanal (`radial-gradient` de
`--muted-foreground` em baixa opacidade). (O antigo brilho do botão "Nova reserva"
foi removido — os CTAs primários agora são um preenchimento sólido e chapado de
`--btn`; veja Botões.) A régua para adicionar um novo: ele precisa parecer parte do
mesmo material minimalista e engenheirado — sem rampas multi-matiz chamativas, sem
gradientes em superfícies de conteúdo/dados (cards, tabelas, linhas de lista) e
nunca como substituto de um token sólido. Ainda banidos de vez: glassmorphism,
brilho e emojis.

## Tema

- **Modo:** claro / escuro / sistema. Um script inline em `app/layout.tsx` aplica a
  classe de tema armazenada antes do primeiro paint (sem flash);
  `components/shared/theme-provider.tsx` gerencia isso depois e acompanha mudanças
  do SO ao vivo quando "system" está selecionado. A UI do seletor fica em
  Configurações → Aparência.
- **Controles nativos:** `globals.css` define `color-scheme: light` em `:root` e
  `color-scheme: dark` em `.dark`, para que a UI renderizada pelo navegador (ícones
  e popups dos seletores `<input type="date">` / `type="time"` no diálogo de
  reserva, scrollbars, partes nativas do Big Calendar) corresponda ao tema ativo em
  vez de cair no claro por padrão.
- **Escala de cinza puro monocromático (chroma 0, sem matiz).** Superfícies *e* o
  destaque são cinzas neutros, então `--primary` lê como "um elemento de UI
  claro/escuro", não como cor de marca — adequado a uma ferramenta utilitária de
  agendamento. Sem tom azul/teal em lugar nenhum.
  - `--primary`: `oklch(0.40 0 0)` (claro) / `oklch(0.72 0 0)` (escuro). **Nota de
    contraste:** modo claro = primary escuro + `--primary-foreground` quase branco;
    modo escuro = primary claro + `--primary-foreground` **escuro**
    (`oklch(0.20 0 0)`) — branco-sobre-0.72 falha no WCAG AA, então o foreground
    inverte. Ambos os pares passam no AA (~6:1). `--primary` é para destaques de
    baixa ênfase (marca da sidebar, chips tingidos com `/10`), **não** para o
    preenchimento sólido do CTA — isso é `--btn` (veja Botões).
- **Escala neutra (chroma 0).** Claro: `--background oklch(0.99 0 0)`, cards quase
  brancos `oklch(0.995 0 0)`, `--sidebar oklch(0.97 0 0)`,
  `--border oklch(0.91 0 0)`. Escuro: `--background oklch(0.16 0 0)`, cards `0.21`,
  sidebar `0.185`, bordas finas `oklch(1 0 0 / 8%)`.
- **Tokens de status:** `--success`, `--warning`, `--destructive` — matizes
  semânticos dessaturados, **mantidos separados do monocromático** (juntá-los
  mataria a sinalização de erro/aviso/sucesso). Variantes clara + escura. Uso:
  `bg-success/10 text-success`. Nunca codifique cores de paleta fixas (`emerald-*`,
  `red-*`, etc.). **Contraste:** eles são ajustados para que o foreground
  (`text-success`/`text-warning`/`text-destructive`) passe no WCAG AA (4.5:1)
  **como texto pequeno de badge sobre seu próprio tom `/10`–`/15`** — o uso mais
  exigente. `--success`/`--warning` no claro foram escurecidos (L 0.55→0.51,
  0.62→0.52) para isso; os valores originais mais claros falhavam
  (~4.2:1 / ~3.4:1). Ao editar um token de status, reveja a razão `text-* on
  bg-*/10`, não apenas o preenchimento sólido.
- **Gráficos:** `--chart-1..5` é uma rampa de cinza (L 0.80→0.40, chroma 0), igual
  nos dois modos.
- **Focus ring:** `--ring` é um cinza neutro (chroma 0) com 50–60% de alfa.
- **CSS:** Tailwind v4 via `@import "tailwindcss"` em `app/globals.css`; importa
  `tw-animate-css` + `shadcn/tailwind.css`.
- **Raio:** base `0.5rem`. **Botões e inputs são pílulas** (`rounded-4xl`); cards
  `rounded-xl`, badges `rounded-md`. O raio de pílula é compartilhado por botões +
  inputs para ficarem visualmente pareados.
- **Superfícies:** cards são `border border-border bg-card`, sem sombra. A área de
  conteúdo do app fica sobre `bg-sidebar` para que os cards brancos leiam como
  painéis discretos.

---

## Botões (`components/ui/button.tsx`)

Variantes `cva`, todas em formato de pílula (`rounded-4xl`), com `shadow-xs`/`-sm`
para uma sensação sólida e elevada:

- **`default`** — o CTA sólido de alto contraste. Preenche com o token dedicado
  **`--btn`**: um **quase-preto** rico `oklch(0.21 0 0)` (claro) / **quase-branco**
  `oklch(0.93 0 0)` (escuro) — deliberadamente *não* `#000`/`#fff`, para parecer
  ousado e profissional sem dureza (~16:1 claro, ~15:1 escuro).
  `text-btn-foreground`, `shadow-sm`, `hover:bg-btn/90` sutil +
  `active:scale-[0.98]`. `--btn` é desacoplado de `--foreground` para que o valor
  escuro possa ser suavizado a partir do quase-branco. Sem brilho/shimmer.
- **`secondary`** — neutro preenchido (`bg-secondary` + `border-border` +
  `shadow-xs`); visível em toda superfície nos dois temas.
- **`outline`** — com borda; transparente sobre superfícies claras, mas se destaca
  da página quase-preta no escuro via `dark:bg-secondary/40`, para nunca parecer um
  contorno flutuante. `hover:bg-muted`.
- **`ghost`** — somente texto, `hover:bg-muted`; para botões de ícone / toolbars.
- **`destructive`** — perigo suavemente tingido (`bg-destructive/10
  text-destructive` + borda tingida), não um vermelho sólido chamativo; o texto
  passa no AA sobre o tom.
- **`link`** — `text-foreground` com sublinhado.

**Regra:** nunca codifique `white`/`black`/`#fff`/`#000` nos estilos de botão — use
os tokens (`--btn`, `--foreground`, `--secondary`, `--destructive`, …). O contraste
do CTA primário é intencionalmente alto, mas ajustado via `--btn`, nunca
preto/branco puro.

---

## Fonte

- **DM Sans** via `next/font/google`
- Variável CSS: `--font-dm-sans`, mapeada para `--font-sans`/`--font-heading` em
  `@theme inline` (globals.css)
- Aplicada tanto como `variable` (para a variável CSS) quanto como `className` (no
  `<body>`)

---

## Ícone do app

- Ícone da aba do navegador / PWA: `app/icon.png` (512×512) +
  `app/apple-icon.png` (180×180), detectados automaticamente pelo Next.js App
  Router (sem `<link>` / metadados manuais). O `app/favicon.ico` padrão foi
  removido. Arte de origem: uma marca monocromática azul-acinzentada de quadra de
  basquete — também a semente do `--primary` slate.
- **Escopo:** este é apenas o favicon/ícone do app. Os componentes SVG de logo
  dentro do app (`components/shared/oc-logo.tsx` — `OpenCourtLogo` /
  `OpenCourtMark`) estão **inalterados**; eles continuam sendo a fonte da verdade
  para o wordmark da sidebar/páginas de auth e permanecem nítidos/tematizáveis.

## Ícones

- **Principal:** Remixicon (`@remixicon/react`) — componentes `Ri*`
- **Secundário:** Lucide React (`lucide-react`) — para componentes gerados pelo
  shadcn
- Navegação da sidebar: `RiDashboardLine`, `RiCalendarCheckLine`, `RiTeamLine`
- Formulários de auth: `RiLockLine` (token de acesso), `RiArrowUpDownLine`
  (dropdown de usuário), `RiSettingsLine`, `RiLogoutBoxLine`

---

## Barra lateral (`components/app-sidebar.tsx`)

- `collapsible="icon"` — recolhe para o modo somente ícone
- **Convenção de posicionamento:** contexto do workspace no topo, conta pessoal no
  rodapé — o padrão Notion/Linear/Slack/Vercel. Para um produto multi-escola, o
  contexto da escola ativa é a orientação primária, então o seletor de escola lidera
  e serve de branding (sem logo de produto independente na sidebar). A conta fica
  somente aqui — não há menu de usuário na barra de cabeçalho superior (ela carrega
  apenas título/CTA).
- **Cabeçalho:** `NavSchoolSwitcher` — `OpenCourtMark` num quadrado arredondado +
  nome da escola ativa + papel + `RiExpandUpDownLine`; recolhe para a marca apenas
  no modo ícone. O dropdown abre **para baixo** (`side="bottom"`): lista de escolas
  (`RiCheckLine` na ativa) + "Create organization". Placeholder `NavRowSkeleton`
  enquanto os dados carregam.
- **Nav:** `NavMain` com 3 itens — Dashboard (`RiDashboardLine`), Calendar
  (`RiCalendarCheckLine`), Collaborators (`RiTeamLine`). A gestão de quadras **não**
  é item de navegação — fica em Configurações → Quadras (seção somente principal).
- **Rodapé:** `NavUser` — avatar (iniciais) + nome + papel; recolhe para
  somente-avatar no modo ícone; dropdown abre ao lado (`side="right"`) com Settings
  + Log out. Placeholder `NavRowSkeleton` enquanto o perfil carrega.
- `SidebarRail` para a alça de redimensionamento manual

## `components/nav-main.tsx`

- Links simples (sem grupos recolhíveis)
- Detecção de ativo via `usePathname()`:
  - Correspondência exata: `pathname === item.url`
  - Correspondência de prefixo: `pathname.startsWith(item.url + '/')`
- Usa `Link` do Next.js dentro de `SidebarMenuButton`

## `components/nav-user.tsx`

- Props: `{ name: string, email: string, role: Role, avatarUrl?: string | null }`
- Renderiza `AvatarImage` quando `avatarUrl` está definido, com fallback para as
  iniciais (duas primeiras letras do nome, em maiúsculas). `avatarUrl` é a foto
  enviada (usuários de e-mail+senha) ou a foto da identidade Google, resolvida em
  `app-sidebar.tsx`.
- DropdownMenu:
  - Rótulo: avatar + nome + e-mail
  - Settings: Link para `/settings`
  - Log out: chama a server action `signOut()`, depois
    `window.location.href = '/login'`

---

## Componentes shadcn/ui instalados

Todos em `components/ui/` — gerados automaticamente pelo CLI do `shadcn`,
customizados para o estilo Radix Maia:

`alert`, `alert-dialog`, `avatar`, `badge`, `breadcrumb`, `button`, `card`,
`chart`, `collapsible`, `context-menu`, `dialog`, `dropdown-menu`, `field`,
`input`, `label`, `select`, `separator`, `sheet`, `sidebar` (705 linhas, núcleo),
`skeleton`, `switch`, `table`, `tabs`, `textarea`, `tooltip`

---

## Hooks

### `hooks/use-mobile.ts`
- Detecta mobile via `matchMedia('(max-width: 768px)')`
- Usado pela sidebar do shadcn para comportamento responsivo

---

Versão em inglês: [`../en/oc-ui.md`](../en/oc-ui.md)
