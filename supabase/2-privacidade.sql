-- AP Gestão · privacidade e segurança (nov/2026, revisado depois da auditoria)
-- Rodar uma vez no SQL Editor do Supabase, depois do schema.sql. Pode rodar de novo sem estragar nada.

-- 0. Cópia de segurança completa antes de mexer nas regras
--    (fica guardada só no banco, ninguém lê pelo app; combinar com a Ana uma data para apagar, sugestão: fev/2027)
create table if not exists public.docs_backup_20261123 as select * from public.docs;
alter table public.docs_backup_20261123 enable row level security;

-- 0.1 Código de registro só com letras, números e - _ . : @
--     (impede esconder código de página dentro do "nome interno" de um registro). Vale para o que for criado daqui em diante.
do $$ begin
  alter table public.docs add constraint docs_id_seguro check (id ~ '^[A-Za-z0-9_.:@-]{1,200}$') not valid;
exception when duplicate_object then null; end $$;

-- 0.2 Um registro não pode mudar de lugar (de "evoluções" para outra coleção, por exemplo) nem trocar de código
create or replace function public.travar_lugar() returns trigger language plpgsql as $$
begin
  if new.col <> old.col or new.id <> old.id then raise exception 'não é permitido mudar um registro de lugar'; end if;
  return new;
end $$;
drop trigger if exists docs_travar_lugar on public.docs;
create trigger docs_travar_lugar before update on public.docs for each row execute function public.travar_lugar();

-- 0.3 A fisio atende este paciente? (usado nas regras abaixo)
create or replace function public.atende(p_pid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from docs where col = 'pacientes' and id = p_pid
    and (data ->> 'fisio' = public.minha_fisio() or coalesce(data -> 'fisios', '[]'::jsonb) ? public.minha_fisio()));
$$;

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
          left(coalesce(r.data ->> 'nome', r.data ->> 'pnome', r.data ->> 'pid', ''), 120));
  return null;
end $$;
drop trigger if exists docs_registro on public.docs;
create trigger docs_registro after insert or update or delete on public.docs for each row execute function public.registrar_mudanca();

-- o app avisa quando alguém abre uma ficha (leitura não dispara gatilho).
-- Só registra ficha que existe e que a pessoa pode ver (não dá para encher o registro com coisa inventada).
create or replace function public.registrar_acesso(p_col text, p_id text, p_resumo text default '') returns void
language sql security definer set search_path = public as $$
  insert into registro (email, acao, col, doc_id, resumo)
  select coalesce(auth.jwt() ->> 'email', ''), 'abriu', d.col, d.id, left(coalesce(p_resumo, ''), 120)
  from docs d
  where d.col = p_col and d.id = p_id and p_col in ('pacientes', 'evolucoes')
    and (public.is_admin()
         or (public.is_member() and p_col = 'evolucoes' and d.data ->> 'fisio' = public.minha_fisio())
         or (public.is_member() and p_col = 'pacientes' and public.atende(d.id)));
$$;

-- 2. Nunca apagar, sempre sumir: "excluir" guarda uma cópia na lixeira e depois tira da lista.
--    Só esta função escreve na lixeira (ninguém consegue colocar coisa inventada lá).
--    Confere a permissão de quem pediu: acesso total exclui tudo; a fisio só o que é dela.
create or replace function public.mover_para_lixeira(p_col text, p_id text) returns void
language plpgsql security definer set search_path = public as $$
declare r record; pode boolean;
begin
  if p_col in ('lixeira', 'pedidos') then raise exception 'sem permissão para excluir'; end if;
  select * into r from docs where col = p_col and id = p_id;
  if not found then return; end if;
  pode := public.is_admin()
       or (public.is_member() and p_col in ('agenda', 'evolucoes', 'midias') and r.data ->> 'fisio' = public.minha_fisio())
       or (public.is_member() and p_col = 'equipamentos');
  if not pode then raise exception 'sem permissão para excluir'; end if;
  insert into docs (col, id, data) values ('lixeira', p_col || '__' || p_id || '__' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
    jsonb_build_object('col', p_col, 'id', p_id, 'data', r.data, 'em', now(), 'por', coalesce(auth.jwt() ->> 'email', '')));
  delete from docs where col = p_col and id = p_id;
end $$;

-- restaurar da lixeira (só acesso total). Se já existir outro registro no mesmo lugar, nada é apagado:
-- o item continua na lixeira e o app avisa.
create or replace function public.restaurar_da_lixeira(p_lid text) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not public.is_admin() then raise exception 'sem permissão'; end if;
  select * into r from docs where col = 'lixeira' and id = p_lid;
  if not found then return; end if;
  if (r.data ->> 'col') not in ('pacientes', 'planos', 'agenda', 'evolucoes', 'midias', 'cobrancas', 'funil', 'equipe',
                                'equipamentos', 'datas', 'grade', 'recados', 'liberados') then
    raise exception 'este tipo de item não pode ser restaurado';
  end if;
  if exists (select 1 from docs where col = r.data ->> 'col' and id = r.data ->> 'id') then
    raise exception 'ja_existe: já existe outro registro no lugar deste';
  end if;
  insert into docs (col, id, data) values (r.data ->> 'col', r.data ->> 'id', r.data -> 'data');
  delete from docs where col = 'lixeira' and id = p_lid;
end $$;

-- 3. Regras de acesso
--    Acesso total (Ana e Emi): tudo.
--    Fisio: só a agenda dela, as evoluções e anexos dela e os pacientes que ela atende.
--    Conta nova ainda não aprovada: só o próprio pedido de acesso.
drop policy if exists docs_ler on public.docs;
create policy docs_ler on public.docs for select to authenticated using (
  case
    when col in ('planos', 'cobrancas', 'funil', 'config', 'lixeira', 'recados') then public.is_admin()
    when col = 'pedidos' then public.is_admin() or id = auth.uid()::text
    when col = 'liberados' then public.is_admin() or id = auth.uid()::text
    when col = 'equipe' then public.is_member()
    when col in ('agenda', 'evolucoes', 'midias', 'grade') then public.is_admin() or (public.is_member() and data ->> 'fisio' = public.minha_fisio())
    when col = 'pacientes' then public.is_admin() or (public.is_member() and (data ->> 'fisio' = public.minha_fisio() or coalesce(data -> 'fisios', '[]'::jsonb) ? public.minha_fisio()))
    else public.is_member()
  end
);

-- pedido de acesso: o e-mail gravado tem que ser o do login (não dá para se passar por outra pessoa)
drop policy if exists docs_criar on public.docs;
create policy docs_criar on public.docs for insert to authenticated with check (
  case
    when col = 'pedidos' then id = auth.uid()::text and lower(coalesce(data ->> 'email', '')) = lower(coalesce(auth.jwt() ->> 'email', '-'))
    when col = 'lixeira' then false
    when col = 'agenda' then public.is_admin() or (public.is_member() and data ->> 'fisio' = public.minha_fisio() and (coalesce(data ->> 'pid', '') = '' or public.atende(data ->> 'pid')))
    when col in ('evolucoes', 'midias') then public.is_admin() or (public.is_member() and data ->> 'fisio' = public.minha_fisio())
    when col = 'equipamentos' then public.is_member()
    else public.is_admin()
  end
);

drop policy if exists docs_alterar on public.docs;
create policy docs_alterar on public.docs for update to authenticated using (
  case
    when col = 'pedidos' then id = auth.uid()::text or public.is_admin()
    when col = 'lixeira' then false
    when col in ('agenda', 'evolucoes', 'midias') then public.is_admin() or (public.is_member() and data ->> 'fisio' = public.minha_fisio())
    when col = 'equipamentos' then public.is_member()
    else public.is_admin()
  end
) with check (
  case
    when col = 'pedidos' then public.is_admin() or (id = auth.uid()::text and lower(coalesce(data ->> 'email', '')) = lower(coalesce(auth.jwt() ->> 'email', '-')))
    when col = 'lixeira' then false
    when col in ('agenda', 'evolucoes', 'midias') then public.is_admin() or (public.is_member() and data ->> 'fisio' = public.minha_fisio())
    when col = 'equipamentos' then public.is_member()
    else public.is_admin()
  end
);

-- apagar direto: só o pedido de acesso. Todo o resto passa pela lixeira (função mover_para_lixeira).
drop policy if exists docs_apagar on public.docs;
create policy docs_apagar on public.docs for delete to authenticated using (
  col = 'pedidos' and (id = auth.uid()::text or public.is_admin())
);

-- 4. Fotos e áudios: a fisio abre os anexos dos atendimentos dela e os que ela mesma gravou; ninguém apaga arquivo pelo app.
drop policy if exists midias_ler on storage.objects;
create policy midias_ler on storage.objects for select to authenticated using (
  bucket_id = 'midias' and (public.is_admin()
    or exists (select 1 from public.docs d where d.col = 'agenda' and d.id = split_part(name, '/', 1) and d.data ->> 'fisio' = public.minha_fisio())
    or exists (select 1 from public.docs m where m.col = 'midias' and m.data ->> 'path' = name and m.data ->> 'fisio' = public.minha_fisio())));
drop policy if exists midias_enviar on storage.objects;
create policy midias_enviar on storage.objects for insert to authenticated with check (
  bucket_id = 'midias' and (public.is_admin() or exists (
    select 1 from public.docs d where d.col = 'agenda' and d.id = split_part(name, '/', 1) and d.data ->> 'fisio' = public.minha_fisio())));
drop policy if exists midias_apagar on storage.objects;
create policy midias_apagar on storage.objects for delete to authenticated using (bucket_id = 'midias' and public.is_admin());

-- conferência: tudo tem que aparecer com valor
select 'backup (registros)' as item, count(*)::text as valor from public.docs_backup_20261123
union all select 'docs (registros)', count(*)::text from public.docs
union all select 'regras na tabela docs', count(*)::text from pg_policies where tablename = 'docs'
union all select 'gatilhos (registro e trava)', count(*)::text from pg_trigger where tgname in ('docs_registro', 'docs_travar_lugar')
union all select 'funções novas', count(*)::text from pg_proc where proname in ('mover_para_lixeira', 'restaurar_da_lixeira', 'registrar_acesso', 'atende', 'travar_lugar')
union all select 'trava de código', count(*)::text from pg_constraint where conname = 'docs_id_seguro';
