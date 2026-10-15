# BiblioHub — versão simples e estável para Codespaces

Esta versão foi preparada para **reduzir ao máximo os erros na hora de testar**.

## Principal diferença

O projeto usa somente recursos que já existem no **Node.js 22** do GitHub Codespaces:

- servidor HTTP do Node;
- SQLite nativo (`node:sqlite`);
- criptografia de senha com `crypto.scrypt`;
- HTML, CSS e JavaScript no front-end.

**Não há bibliotecas externas para instalar.**

Portanto, o aluno não precisa configurar Vite, Express, proxy ou duas portas.

---

## O que funciona

- login;
- criação de conta de leitor;
- senhas protegidas com hash;
- catálogo de livros;
- estoque de exemplares;
- empréstimo por 14 dias;
- devolução;
- reserva de livro indisponível;
- histórico de empréstimos;
- perfil de administrador/bibliotecário;
- painel com estatísticas;
- cadastro de novos livros;
- lista de leitores;
- lista de empréstimos e reservas;
- SQLite criado automaticamente.

---

# Como executar no Codespaces

## 1. Os arquivos precisam estar na raiz do repositório

Na página principal do GitHub devem aparecer diretamente:

```text
.devcontainer/
backend/
public/
scripts/
package.json
README.md
```

O `package.json` precisa estar na raiz.

## 2. Crie o Codespace

No repositório:

**Code → Codespaces → Create codespace on main**

## 3. Confira a pasta

No terminal:

```bash
pwd
ls
```

O comando `ls` deve mostrar `package.json`.

## 4. Execute

```bash
npm start
```

**Não é necessário executar `npm install`.**

## 5. Abra no navegador

No Codespaces:

**PORTAS / PORTS → 5173 → Open in Browser**

Existe somente uma porta para a aplicação e a API: **5173**.

---

# Credenciais de demonstração

## Leitor

```text
E-mail: aluno@bibliohub.edu.br
Senha: biblioteca123
```

## Bibliotecário / administrador

```text
E-mail: admin@bibliohub.edu.br
Senha: admin123
```

Também é possível criar uma conta de leitor pela tela inicial.

---

# Testar automaticamente

Com `npm start` em execução, abra outro terminal e execute:

```bash
npm run test-api
```

O teste verifica:

- banco de dados;
- login do leitor;
- catálogo;
- login administrativo;
- painel da biblioteca.

---

# Banco de dados

O banco é criado automaticamente em:

```text
backend/data/bibliohub.db
```

Ele contém as tabelas:

```text
users
sessions
books
loans
reservations
```

O arquivo `.db` está no `.gitignore`, portanto não será enviado ao GitHub.

## Zerar o banco

Pare o sistema com `Ctrl + C` e execute:

```bash
npm run reset-db
npm start
```

Os dados de demonstração serão recriados automaticamente.

---

# Comandos

```bash
npm start        # inicia o BiblioHub
npm run check    # verifica a sintaxe do código
npm run test-api # testa a API e o banco
npm run reset-db # apaga o banco local
```

---

# Para a feira

1. Abra o Codespace da equipe.
2. Execute `npm start`.
3. Abra a porta 5173.
4. Faça login como aluno.
5. Demonstre um empréstimo e uma devolução.
6. Faça login como administrador e mostre o painel.

Como o SQLite é local do Codespace, use preferencialmente **um Codespace principal da equipe** durante a apresentação.
