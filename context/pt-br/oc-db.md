# OpenCourt — Contexto de Banco de Dados

## Configuração

`supabase/seed.sql` é a instalação canônica de uso único: um único script
idempotente que produz o estado final completo e seguro — schema, RLS, triggers e
todas as RPCs. Aplique via `supabase db reset` (dev local) ou cole no SQL Editor
do Supabase. Também desligue "Confirm email" nas configurações de Auth. Os
arquivos datados em `migrations/*.sql` são o histórico incremental (aplique-os em
ordem num banco em execução).

## Schema (estado final)

### Enums

```sql
CREATE TYPE user_role AS ENUM ('principal', 'teacher', 'student_rep');
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');
```

### Tabela: `schools`

| Coluna       | Tipo        | Restrições                               |
| ------------ | ----------- | ---------------------------------------- |
| id           | uuid        | PK, DEFAULT gen_random_uuid()            |
| name         | text        | NOT NULL                                 |
| access_token | text        | UNIQUE NOT NULL (formato `OC-XXXX-XXXX`) |
| created_at   | timestamptz | DEFAULT now()                            |

`access_token` é o **identificador da organização** — mantido para uso futuro,
não usado para login nem controle de acesso.

### Tabela: `users` (perfil)

| Coluna           | Tipo        | Restrições                                        |
| ---------------- | ----------- | ------------------------------------------------- |
| id               | uuid        | PK, FK → auth.users(id) ON DELETE CASCADE         |
| full_name        | text        | NOT NULL                                          |
| email            | text        | UNIQUE NOT NULL                                   |
| active_school_id | uuid        | FK → schools(id) ON DELETE SET NULL (anulável)    |
| created_at       | timestamptz | DEFAULT now()                                     |

Avatares **não** são uma coluna do perfil: a URL da foto fica nos metadados de
auth (`raw_user_meta_data.avatar_url`) — a foto da identidade Google, ou a URL de
um arquivo enviado ao **bucket de storage `avatars`** (abaixo). Ler dos metadados
significa que a exibição do avatar nunca depende de uma migração de schema.

### Tabela: `memberships`

| Coluna     | Tipo        | Restrições                                |
| ---------- | ----------- | ----------------------------------------- |
| id         | uuid        | PK, DEFAULT gen_random_uuid()             |
| user_id    | uuid        | NOT NULL, FK → users(id) ON DELETE CASCADE |
| school_id  | uuid        | NOT NULL, FK → schools(id) ON DELETE CASCADE |
| role       | user_role   | NOT NULL                                  |
| created_at | timestamptz | DEFAULT now()                             |

`UNIQUE (user_id, school_id)` — um usuário tem no máximo uma membership por escola.

### Tabela: `invitations`

| Coluna     | Tipo               | Restrições                                |
| ---------- | ------------------ | ----------------------------------------- |
| id         | uuid               | PK, DEFAULT gen_random_uuid()             |
| school_id  | uuid               | NOT NULL, FK → schools(id) ON DELETE CASCADE |
| email      | text               | NOT NULL (armazenado como `lower(trim(email))`) |
| role       | user_role          | NOT NULL                                  |
| invited_by | uuid               | FK → users(id)                            |
| status     | invitation_status  | NOT NULL DEFAULT 'pending'                |
| expires_at | timestamptz        | DEFAULT now() + interval '7 days'         |
| created_at | timestamptz        | DEFAULT now()                             |

`UNIQUE (school_id, email) WHERE (status = 'pending')` — um convite pendente por
e-mail por escola.

### Tabela: `courts`

| Coluna     | Tipo        | Restrições                                   |
| ---------- | ----------- | -------------------------------------------- |
| id         | uuid        | PK, DEFAULT gen_random_uuid()                |
| school_id  | uuid        | NOT NULL, FK → schools(id) ON DELETE CASCADE |
| name       | text        | NOT NULL                                     |
| created_at | timestamptz | DEFAULT now()                                |

`UNIQUE (school_id, name)`. Escolas novas começam com **zero** quadras — o
principal cadastra a primeira quadra no app (o `FirstCourtGate` bloqueia o app até
então). RLS: membros da escola ativa podem SELECT; apenas o principal pode
INSERT/UPDATE/DELETE.

### Tabela: `bookings`

| Coluna     | Tipo        | Restrições                                   |
| ---------- | ----------- | -------------------------------------------- |
| id         | uuid        | PK, DEFAULT gen_random_uuid()                |
| title      | text        | NOT NULL                                     |
| school_id  | uuid        | NOT NULL, FK → schools(id) ON DELETE CASCADE |
| court_id   | uuid        | NOT NULL, FK → courts(id) ON DELETE RESTRICT |
| booked_by  | uuid        | NOT NULL, FK → users(id) ON DELETE CASCADE   |
| date       | date        | NOT NULL                                     |
| start_time | time        | NOT NULL                                     |
| end_time   | time        | NOT NULL                                     |
| notes      | text        | anulável                                     |
| created_at | timestamptz | DEFAULT now()                                |

RLS: membros da escola ativa podem SELECT; INSERT exige `booked_by = auth.uid()`
e a escola ativa; UPDATE/DELETE permitidos ao dono ou ao principal. A prevenção
de sobreposição é feita nas server actions `createBooking` / `updateBooking`
(`lib/bookings/actions.ts`), não por uma constraint do banco.

---

## Storage

### Bucket `avatars` (público)
Fotos de perfil para usuários de e-mail+senha. **Leitura pública** (para que
`<img src>` funcione sem URLs assinadas); as escritas são controladas por RLS em
`storage.objects`: um usuário só pode INSERT/UPDATE/DELETE em objetos cujo primeiro
segmento do caminho seja o próprio id
(`(storage.foldername(name))[1] = auth.uid()::text`). Convenção de caminho de
upload: `avatars/<user_id>/avatar-<timestamp>.<ext>`. Definido em `seed.sql` e
`migrations/20260616_avatars.sql`.

---

## Políticas de RLS

Todas as políticas usam as claims de `auth.jwt() → 'user_metadata'` (nunca fazem
join com `users`) para evitar recursão. As políticas de `memberships` nunca
referenciam a tabela `users`.

### `schools`
- **Members can view their schools** — SELECT para linhas onde `EXISTS (memberships where school_id = schools.id AND user_id = auth.uid())`

### `memberships`
- **View active school members** — SELECT onde `school_id = active_school_id` (claim do JWT)
- **View own memberships** — SELECT onde `user_id = auth.uid()`
- **Principal can add/remove members** — INSERT/DELETE protegidos por `role = 'principal'` AND `school_id = active_school_id` (ambos das claims do JWT)

### `users`
- **Users can view own profile** — SELECT onde `id = auth.uid()`
- **Users can view same active school** — SELECT onde `EXISTS (memberships where user_id = users.id AND school_id = active_school_id_claim)`
- **Users can update their own profile** — UPDATE onde `id = auth.uid()`

### `invitations`
- **Principal can manage invitations** — ALL onde `role = 'principal' AND school_id = active_school_id` (claims do JWT)
- **Invitees can view their own invitations** — SELECT onde `email = auth.user().email`

---

## Triggers

**`handle_new_user()`** (AFTER INSERT ON auth.users) — cria o perfil `public.users`
com `id`, `email`, `full_name` (dos metadados), `active_school_id = NULL`. Usa
`ON CONFLICT (id) DO NOTHING` — qualquer INSERT em `auth.users` (cadastro por
e-mail ou Google OAuth) dispara este trigger.

**`sync_user_email()`** (AFTER UPDATE OF email ON auth.users) — mantém
`public.users.email` sincronizado quando o usuário muda o e-mail.

---

## RPCs (todas `SECURITY DEFINER`, concedidas a `authenticated`)

### `create_school(p_school_name, p_full_name)`
Gera um token único `OC-XXXX-XXXX` → insere em `schools` → insere
`memberships(role='principal')` → atualiza `users.active_school_id` + `full_name` →
mescla as claims do JWT (`active_school_id`, `role='principal'`).

### `accept_invitation(p_full_name)`
Busca o convite `pending` e não expirado por `auth.email()` → lança `no_invitation`
se não houver → guarda `already_member` → insere membership com o papel do convite
→ atualiza `users.active_school_id` → marca o convite como `accepted` → mescla as
claims do JWT.

### `switch_school(p_school_id)`
Valida se a membership existe → lança `not_a_member` → atualiza
`users.active_school_id` → mescla as claims do JWT (`active_school_id` + papel da
membership).

### `invite_member(p_email, p_role)`
Somente principal (checagem no JWT) → normaliza o e-mail → guarda
`member_already_exists` → insere em `invitations` (ON CONFLICT DO NOTHING) →
retorna o `id` do convite.

### `revoke_invitation(p_invitation_id)`
Somente principal → define status `revoked` no convite pendente correspondente.

### `remove_member(p_user_id)`
Somente principal → recusa remover outro principal ou a si mesmo → apaga a
membership na escola ativa → limpa o `active_school_id` e as claims do JWT do
usuário removido, se apontavam para esta escola.

### `delete_school(p_school_id)`
Somente principal (JWT) → exige que `p_school_id` seja a escola ativa do chamador
(`not_active_school`) → realoca todos os membros cuja escola ativa está sendo
excluída (move `users.active_school_id` + claims do JWT para a próxima membership
por `created_at`, ou limpa ambos quando não há) → `DELETE FROM schools` (propaga
em cascata memberships, convites, quadras e reservas). Exclusão definitiva,
irreversível.

### `leave_school()`
Membro não-principal da escola ativa → lança `no_active_school` / `not_a_member` /
`principal_cannot_leave` → apaga a própria membership na escola ativa → troca
`users.active_school_id` + claims do JWT para a próxima membership (ou limpa ambos
quando não há).

---

## Claims do JWT

`auth.users.raw_user_meta_data` carrega `active_school_id` e `role` (papel na
escola ativa). Atualizado por `create_school`, `accept_invitation`, `switch_school`,
`delete_school` e `leave_school`. O app chama `supabase.auth.refreshSession()`
depois de cada um, para que as novas claims cheguem ao cookie e ao proxy.

---

## Tipos TypeScript (`types/index.ts`)

```typescript
export type Role = 'principal' | 'teacher' | 'student_rep'

export interface User {
  id: string; full_name: string; email: string
  active_school_id: string | null; created_at: string
}
export interface Membership {
  id: string; user_id: string; school_id: string
  role: Role; created_at: string
}
export interface Invitation {
  id: string; school_id: string; email: string; role: Role
  invited_by: string | null
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
  expires_at: string; created_at: string
}
export type UserSchool = { school_id: string; school_name: string; role: Role }
```

---

Versão em inglês: [`../en/oc-db.md`](../en/oc-db.md)
