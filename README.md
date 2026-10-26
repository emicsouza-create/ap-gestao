# AP Gestão

App interno da AP Fisioterapia Domiciliar: agenda da equipe, pacientes, evoluções (texto, áudio e foto), entrada de pacientes novos e cobrança com Pix.

Funciona no navegador e pode ser instalado na tela do celular (Android e iPhone).

## Como está montado

- **Telas:** `index.html`, `styles.css`, `app.js`. Publicadas pelo GitHub Pages.
- **Dados e login:** Supabase (banco Postgres + login por e-mail e senha + pasta privada para fotos e áudios).
- **Regras de acesso:** ficam no banco, em `supabase/schema.sql`. Quem tem só a agenda vê e altera apenas os próprios atendimentos; valores e cobranças só a gestão vê.
- **Nenhum dado de paciente fica neste repositório.** O código é público; os dados ficam no Supabase, protegidos pelas regras.

## Ligar o app ao banco

1. Crie um projeto no [Supabase](https://supabase.com) (região São Paulo, se disponível).
2. Em **SQL Editor**, cole `supabase/schema.sql`, troque `SEU_EMAIL_AQUI` pelo e-mail da gestão e rode.
3. Em **Project Settings → API**, copie a **Project URL** e a chave **anon public** para `config.js`.
4. Em **Authentication → URL Configuration**, coloque o endereço do GitHub Pages em **Site URL**.

## Acesso da equipe

1. A pessoa abre o app, toca em **Criar minha conta**, confirma o e-mail e entra.
2. Escolhe o próprio nome e toca em **Pedir acesso**.
3. A gestão libera em **Equipe → Acesso ao app**: "só a agenda" ou "tudo".

## Cópia de segurança

Em **Equipe → Cópia de segurança**: baixar todos os dados em `.json` ou importar um arquivo.
