-- AP Gestão · estrutura do banco no Supabase
-- Como usar: no painel do Supabase, abra "SQL Editor", cole este arquivo inteiro e clique em "Run".
-- Antes, troque SEU_EMAIL_AQUI pelo e-mail que vai ter acesso completo (o mesmo que você usa para entrar no app).

-- 1. Tabela única de registros (cada linha é um documento JSON de uma coleção)
create table if not exists public.docs (
  col text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (col, id)
);
create index if not exists docs_col_idx on public.docs (col);

create or replace function public.tocar_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists docs_updated_at on public.docs;
create trigger docs_updated_at before update on public.docs for each row execute function public.tocar_updated_at();

-- 2. Quem tem acesso completo desde o início
create table if not exists public.admins (email text primary key);
alter table public.admins enable row level security; -- ninguém lê pelo app; só as funções abaixo
insert into public.admins (email) values (lower('SEU_EMAIL_AQUI')) on conflict do nothing;

-- 3. Funções de acesso (rodam com permissão do banco para evitar laço nas regras)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where email = lower(coalesce(auth.jwt() ->> 'email', '')))
      or exists (select 1 from docs where col = 'liberados' and id = auth.uid()::text and data ->> 'nivel' = 'total');
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (select 1 from docs where col = 'liberados' and id = auth.uid()::text);
$$;

create or replace function public.minha_fisio() returns text
language sql stable security definer set search_path = public as $$
  select data ->> 'fisio' from docs where col = 'liberados' and id = auth.uid()::text limit 1;
$$;

create or replace function public.meu_acesso() returns jsonb
language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from admins where email = lower(coalesce(auth.jwt() ->> 'email', ''))) then jsonb_build_object('nivel', 'total', 'admin', true)
    else coalesce((select jsonb_build_object('nivel', data ->> 'nivel', 'fisio', data ->> 'fisio', 'admin', false)
                   from docs where col = 'liberados' and id = auth.uid()::text), jsonb_build_object('nivel', null, 'admin', false))
  end;
$$;

-- 4. Regras de acesso
--    Gestão (acesso completo): vê e altera tudo.
--    Fisio com "só a agenda": vê e altera apenas atendimentos, evoluções e anexos com o nome dela; lê pacientes, equipe e feriados.
--    Valores, cobranças, entrada de pacientes e configurações: só gestão.
alter table public.docs enable row level security;

drop policy if exists docs_ler on public.docs;
create policy docs_ler on public.docs for select to authenticated using (
  case
    when col in ('planos', 'cobrancas', 'funil', 'config') then public.is_admin()
    when col = 'pedidos' then public.is_admin() or id = auth.uid()::text
    when col = 'liberados' then public.is_admin() or id = auth.uid()::text
    when col = 'equipe' then true
    when col in ('agenda', 'evolucoes', 'midias') then public.is_admin() or (public.is_member() and data ->> 'fisio' = public.minha_fisio())
    else public.is_member()
  end
);

drop policy if exists docs_criar on public.docs;
create policy docs_criar on public.docs for insert to authenticated with check (
  case
    when col = 'pedidos' then id = auth.uid()::text
    when col in ('agenda', 'evolucoes', 'midias') then public.is_admin() or (public.is_member() and data ->> 'fisio' = public.minha_fisio())
    when col = 'equipamentos' then public.is_member()
    else public.is_admin()
  end
);

drop policy if exists docs_alterar on public.docs;
create policy docs_alterar on public.docs for update to authenticated using (
  case
    when col = 'pedidos' then id = auth.uid()::text or public.is_admin()
    when col in ('agenda', 'evolucoes', 'midias') then public.is_admin() or (public.is_member() and data ->> 'fisio' = public.minha_fisio())
    when col = 'equipamentos' then public.is_member()
    else public.is_admin()
  end
) with check (
  case
    when col = 'pedidos' then id = auth.uid()::text or public.is_admin()
    when col in ('agenda', 'evolucoes', 'midias') then public.is_admin() or (public.is_member() and data ->> 'fisio' = public.minha_fisio())
    when col = 'equipamentos' then public.is_member()
    else public.is_admin()
  end
);

drop policy if exists docs_apagar on public.docs;
create policy docs_apagar on public.docs for delete to authenticated using (
  case
    when col = 'pedidos' then id = auth.uid()::text or public.is_admin()
    when col in ('agenda', 'evolucoes', 'midias') then public.is_admin() or (public.is_member() and data ->> 'fisio' = public.minha_fisio())
    when col = 'equipamentos' then public.is_member()
    else public.is_admin()
  end
);

-- 5. Atualização em tempo real (a tela muda sozinha quando alguém altera algo)
alter table public.docs replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- 6. Pasta privada para fotos e áudios das evoluções
insert into storage.buckets (id, name, public) values ('midias', 'midias', false) on conflict (id) do nothing;

drop policy if exists midias_ler on storage.objects;
create policy midias_ler on storage.objects for select to authenticated using (bucket_id = 'midias' and public.is_member());
drop policy if exists midias_enviar on storage.objects;
create policy midias_enviar on storage.objects for insert to authenticated with check (bucket_id = 'midias' and public.is_member());
drop policy if exists midias_apagar on storage.objects;
create policy midias_apagar on storage.objects for delete to authenticated using (bucket_id = 'midias' and public.is_member());
