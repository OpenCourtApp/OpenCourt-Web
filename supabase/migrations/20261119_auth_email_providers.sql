-- Provedores de autenticação de um email, consultados direto em auth.users.
--
-- A Admin API do GoTrue (GET /auth/v1/admin/users) responde 500 neste projeto
-- ao serializar um dos registros de auth.users, então não é possível descobrir
-- o provedor de um email via `admin.listUsers()`. Esta função é SECURITY
-- DEFINER e lê auth.users/auth.identities direto, sem passar pelo GoTrue.
--
-- Retorna um array vazio quando o email não está cadastrado.

create or replace function public.auth_email_providers(p_email text)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct provider), '{}'::text[])
  from (
    select coalesce(u.raw_app_meta_data ->> 'provider', 'email') as provider
    from   auth.users u
    where  lower(u.email) = lower(p_email)

    union all

    select i.provider
    from   auth.users u
    join   auth.identities i on i.user_id = u.id
    where  lower(u.email) = lower(p_email)
  ) as providers
$$;

-- Só o service role precisa consultar provedores de terceiros.
revoke all on function public.auth_email_providers(text) from public, anon, authenticated;
grant  execute on function public.auth_email_providers(text) to service_role;
