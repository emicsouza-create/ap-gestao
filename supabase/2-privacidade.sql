-- AP Gestão · privacidade e segurança (nov/2026)
-- Rodar uma vez no SQL Editor do Supabase, depois do schema.sql.

-- 0. Cópia de segurança completa antes de mexer nas regras
create table if not exists public.docs_backup_20261123 as select * from public.docs;
alter table public.docs_backup_20261123 enable row level security; -- ninguém lê pelo app

-- 1. Registro de atividades: quem criou, mudou, mandou para a lixeira ou abriu cada ficha.
--    Fica numa tabela própria, que ninguém consegue alterar pelo app.
create table if not exists public.registro (
  id bigserial primary key,
  em timestamptz not null default now(),
  email text,
  acao text not null,
  col text,
  doc_id text,
  resumo text
);
alter table public.registro enable row level security;
drop policy if exists registro_ler on public.registro;
create policy registro_ler on public.registro for select to authenticated using (public.is_admin());

create or replace function public.registrar_mudanca() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record; acao text;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  if r.col in ('lixeira') then return null; end if;
  acao := case tg_op when 'INSERT' then 'criou' when 'UPDATE' then 'alterou' else 'tirou' end;
  insert into registro (email, acao, col, doc_id, resumo)
  values (coalesce(auth.jwt() ->> 'email', 'sistema'), acao, r.col, r.id,
          coalesce(r.data ->> 'nome', r.data ->> 'pnome', r.data ->> 'pid', ''));
  return null;
end $$;
drop trigger if exists docs_registro on public.docs;
create trigger docs_registro after insert or update or delete on public.docs for each row execute function public.registrar_mudanca();

-- o app avisa quando alguém abre uma ficha (leitura não dispara gatilho)
create or replace function public.registrar_acesso(p_col text, p_id text, p_resumo text default '') returns void
language sql security definer set search_path = public as $$
  insert into registro (email, acao, col, doc_id, resumo)
  select coalesce(auth.jwt() ->> 'email', ''), 'abriu', p_col, p_id, left(coalesce(p_resumo, ''), 120)
  where public.is_member();
$$;

-- 2. Nunca apagar, sempre sumir: "excluir" guarda uma cópia na lixeira e depois tira da lista.
--    Roda com a permissão de quem pediu: se a pessoa não pode excluir, nada acontece.
create or replace function public.mover_para_lixeira(p_col text, p_id text) returns void
language plpgsql set search_path = public as $$
declare r record;
begin
  select * into r from docs where col = p_col and id = p_id;
  if not found then return; end if;
  insert into docs (col, id, data) values ('lixeira', p_col || '__' || p_id || '__' || to_char(now(), 'YYYYMMDDHH24MISSMS'),
    jsonb_build_object('col', p_col, 'id', p_id, 'data', r.data, 'em', now(), 'por', coalesce(auth.jwt() ->> 'email', '')));
  delete from docs where col = p_col and id = p_id;
  if not found then raise exception 'sem permissão para excluir'; end if;
end $$;

-- restaurar da lixeira (só acesso total)
create or replace function public.restaurar_da_lixeira(p_lid text) returns void
language plpgsql set search_path = public as $$
declare r record;
begin
  if not public.is_admin() then raise exception 'sem permissão'; end if;
  select * into r from docs where col = 'lixeira' and id = p_lid;
  if not found then return; end if;
  insert into docs (col, id, data) values (r.data ->> 'col', r.data ->> 'id', r.data -> 'data')
    on conflict (col, id) do nothing;
  delete from docs where col = 'lixeira' and id = p_lid;
end $$;

-- 3. Regras de acesso atualizadas
--    Acesso total (Ana e Emi): tudo.
--    Fisio: só a agenda dela, as evoluções e anexos dela e os pacientes que ela atende.
drop policy if exists docs_ler on public.docs;
create policy docs_ler on public.docs for select to authenticated using (
  case
    when col in ('planos', 'cobrancas', 'funil', 'config', 'lixeira', 'recados') then public.is_admin()
    when col = 'pedidos' then public.is_admin() or id = auth.uid()::text
    when col = 'liberados' then public.is_admin() or id = auth.uid()::text
    when col = 'equipe' then true
    when col in ('agenda', 'evolucoes', 'midias', 'grade') then public.is_admin() or (public.is_member() and data ->> 'fisio' = public.minha_fisio())
    when col = 'pacientes' then public.is_admin() or (public.is_member() and (data ->> 'fisio' = public.minha_fisio() or coalesce(data -> 'fisios', '[]'::jsonb) ? public.minha_fisio()))
    else public.is_member()
  end
);

drop policy if exists docs_criar on public.docs;
create policy docs_criar on public.docs for insert to authenticated with check (
  case
    when col = 'pedidos' then id = auth.uid()::text
    when col in ('agenda', 'evolucoes', 'midias') then public.is_admin() or (public.is_member() and data ->> 'fisio' = public.minha_fisio())
    when col = 'equipamentos' then public.is_member()
    when col = 'lixeira' then public.is_admin() or (public.is_member() and data ->> 'por' = coalesce(auth.jwt() ->> 'email', ''))
    else public.is_admin()
  end
);

-- 4. Fotos e áudios: a fisio só abre e envia os anexos dos atendimentos dela; ninguém apaga arquivo pelo app.
drop policy if exists midias_ler on storage.objects;
create policy midias_ler on storage.objects for select to authenticated using (
  bucket_id = 'midias' and (public.is_admin() or exists (
    select 1 from public.docs d where d.col = 'agenda' and d.id = split_part(name, '/', 1) and d.data ->> 'fisio' = public.minha_fisio())));
drop policy if exists midias_enviar on storage.objects;
create policy midias_enviar on storage.objects for insert to authenticated with check (
  bucket_id = 'midias' and (public.is_admin() or exists (
    select 1 from public.docs d where d.col = 'agenda' and d.id = split_part(name, '/', 1) and d.data ->> 'fisio' = public.minha_fisio())));
drop policy if exists midias_apagar on storage.objects;
create policy midias_apagar on storage.objects for delete to authenticated using (bucket_id = 'midias' and public.is_admin());

-- conferência
select 'backup' as item, count(*)::text as valor from public.docs_backup_20261123
union all select 'docs', count(*)::text from public.docs
union all select 'politicas docs', count(*)::text from pg_policies where tablename = 'docs'
union all select 'gatilho registro', count(*)::text from pg_trigger where tgname = 'docs_registro';
