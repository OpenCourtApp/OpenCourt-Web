# OpenCourt — Contexto de Produto

## O que é o OpenCourt?

Uma aplicação web para centralizar o agendamento de quadras em escolas e espaços
privados. Professores, representantes estudantis e a direção podem reservar
quadras, visualizar a ocupação e gerenciar quem tem acesso.

---

## Stack

| Camada        | Tecnologia                     |
| ------------- | ------------------------------ |
| Framework     | Next.js 16.2.7 (App Router)    |
| UI            | shadcn/ui (estilo Radix Maia)  |
| Estilização   | Tailwind CSS v4                |
| Auth          | Supabase Auth (e-mail + senha; Google opcional) |
| Banco         | Supabase (PostgreSQL)          |
| ORM           | Supabase JS client (sem Prisma)|
| Deploy        | Vercel                         |
| Ícones        | Remixicon (principal), Lucide  |
| Gráficos      | Recharts                       |
| Fonte         | DM Sans (next/font/google)     |

---

## Rotas

| Rota             | Propósito                                         | Status      |
| ---------------- | ------------------------------------------------- | ----------- |
| `/`              | Redireciona para `/dashboard`                     | Pronto      |
| `/login`         | Login (bloco login-02, espelhado)                 | Pronto      |
| `/register`      | Cadastro (bloco signup-01)                        | Pronto      |
| `/onboarding`    | Pós-cadastro: criar uma escola (virar principal)  | Pronto      |
| `/welcome`       | Aceitar um convite por e-mail (entrar numa escola)| Pronto      |
| `/auth/callback` | Troca de código OAuth (route handler)             | Pronto      |
| `/dashboard`     | Estatísticas, gráfico semanal, lista de próximos  | Pronto      |
| `/calendar`      | Big Calendar (mês/semana/dia/agenda) das reservas | Pronto      |
| `/collaborators` | Tabela de membros + convites pendentes, diálogo de convite | Pronto |
| `/settings`      | Perfil, Instituições, token de acesso, notificações | Pronto    |

---

## Especificações de tela

### Login (`/login`)
Layout desktop em 2 colunas. Esquerda: logo OpenCourt → LoginForm. Direita: imagem
hero + overlay em gradiente.

### Cadastro (`/register`)
Coluna única. Logo no topo, SignupForm abaixo (Card max-w-sm). Campos: Nome
completo, E-mail, Senha. A escola é escolhida depois, em `/onboarding`.

### Onboarding (`/onboarding`)
Acessado após qualquer novo cadastro. **Apenas criar uma escola** — sem aba de
entrada por token. Campos: Nome completo, Nome da escola. Quem cria torna-se
principal; um identificador de organização (`OC-XXXX-XXXX`) é gerado no servidor.
Saída de escape: encerrar sessão.

### Welcome (`/welcome`)
Acessado pelo link de convite (ou diretamente quando autenticado com um convite
pendente).
- Com convite: Card mostrando nome da organização + Badge de papel (somente
  leitura) + campo de Nome completo + senha opcional (oculta para usuários Google)
  → botão de entrar.
- Sem convite: estado neutro com "Criar uma organização" + Encerrar sessão.

### Dashboard (`/dashboard`)
Linha de estatísticas (Status da Quadra, Reservas de Hoje, Horários Disponíveis),
gráfico de barras semanal em Recharts, lista de próximos de hoje. Escopo da escola
ativa.

### Calendário (`/calendar`)
Visões Mês/Semana/Dia/Agenda via o Shadcn UI Big Calendar (`react-big-calendar`,
adicionado do registro `list-jonas/shadcn-ui-big-calendar`). Os eventos vêm de
`useBookings`; clicar em um abre o diálogo de edição; "Nova reserva" fica no
cabeçalho. Reservas próprias aparecem na cor primária; as demais, na secundária.

### Collaborators (`/collaborators`)
Tabela combinada de membros ativos (de `memberships`) e convites pendentes. Busca
no cliente por nome/e-mail. Diálogo "Convidar colaborador" (somente principal) —
campos: E-mail + Papel. Badges de status: Active / Pending. Ações: Remover (ativo
não-principal), Reenviar + Cancelar (pendente).

### Configurações (`/settings`)
- **Perfil**: campos de nome, e-mail, senha.
- **Instituições**: lista de todas as escolas das quais o usuário participa.
  Badge de papel + indicador de ativa. Botão "Trocar" para escolas não ativas
  (>1 escola).
- **Zona de perigo** (dentro de Instituições): o principal pode excluir
  definitivamente a escola ativa após digitar o nome dela para confirmar; membros
  não-principais podem sair da escola ativa. Ambos movem o usuário para outra
  escola quando ele pertence a uma, senão de volta para `/onboarding`.
- **Autorização**: somente principal. Identificador da organização (`access_token`)
  com botão Copiar. Não é usado para login.
- **Notificações**: chaves de alternância de e-mail.
- **Aparência**: seletor de tema.

---

## Regras de negócio

1. **Entrada somente por convite** — usuários não podem entrar numa escola sem um
   convite do principal dela. O autocadastro em `/register` só permite criar uma
   nova escola.
2. **Multi-escola** — um usuário pode ser membro de várias escolas com papéis
   diferentes em cada uma. `users.active_school_id` define o contexto atual; a
   troca acontece no seletor da barra lateral ou em Configurações → Instituições.
3. **O papel é por escola e definido por quem convida** — `role` fica em
   `memberships`, não no perfil do usuário. Convidados não escolhem o próprio papel.
4. **Escola ativa no JWT** — `raw_user_meta_data` carrega `active_school_id` +
   `role` (do papel na escola ativa). Atualizado após `create_school`,
   `accept_invitation` e `switch_school`.
5. **O token de acesso é apenas um identificador** — o token `OC-XXXX-XXXX` é o
   identificador da organização, reservado para uso futuro. Não é usado para
   login, entrada ou qualquer fluxo de autenticação.
6. **Principal protegido** — nenhuma ação destrutiva na linha de um principal;
   principais não podem ser removidos.
7. **Exclusão de escola é exclusiva do dono e em cascata** — só o principal da
   escola ativa pode excluí-la definitivamente, o que propaga para todas as
   memberships, convites, quadras e reservas. O principal que exclui perde o papel
   `principal` e a escola ativa; os membros afetados (incluindo quem excluiu) são
   realocados para outra escola se tiverem uma, senão enviados de volta para
   `/onboarding`.
8. **Sem sobreposição de reservas** — validada nas server actions `createBooking` /
   `updateBooking` (consulta de sobreposição limitada à mesma quadra + dia); os
   conflitos são rejeitados na interface. Sem constraint de exclusão no banco.
9. **Confirmação de e-mail** — desativada nas configurações de Auth do Supabase.

---

Versão em inglês: [`../en/oc-product.md`](../en/oc-product.md)
