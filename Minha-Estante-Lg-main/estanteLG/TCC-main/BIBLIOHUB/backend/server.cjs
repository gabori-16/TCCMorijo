const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");

const PORT = 5173;
const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "bibliohub.db");
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_FILE);
db.exec("PRAGMA foreign_keys = ON;");
db.exec("PRAGMA journal_mode = WAL;");
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'reader' CHECK(role IN ('reader','admin')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  category TEXT NOT NULL,
  isbn TEXT,
  description TEXT DEFAULT '',
  total_copies INTEGER NOT NULL DEFAULT 1 CHECK(total_copies >= 0),
  available_copies INTEGER NOT NULL DEFAULT 1 CHECK(available_copies >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  book_id INTEGER NOT NULL,
  loan_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  returned_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (book_id) REFERENCES books(id)
);
CREATE TABLE IF NOT EXISTS reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  book_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','cancelled','fulfilled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (book_id) REFERENCES books(id)
);
CREATE INDEX IF NOT EXISTS idx_loans_user ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_book ON loans(book_id);
CREATE INDEX IF NOT EXISTS idx_reservations_user ON reservations(user_id);
`);

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  return { salt, hash: crypto.scryptSync(String(password), salt, 64).toString("hex") };
}
function verifyPassword(password, salt, expectedHash) {
  const actual = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
function publicUser(row) { return { id: row.id, name: row.name, email: row.email, role: row.role }; }
function dateOnly(date = new Date()) { return date.toISOString().slice(0, 10); }
function plusDays(days) { const d = new Date(); d.setUTCDate(d.getUTCDate() + days); return dateOnly(d); }
function normalizeEmail(value) { return String(value || "").trim().toLowerCase(); }

function ensureUser(name, email, password, role) {
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) return;
  const { salt, hash } = hashPassword(password);
  db.prepare("INSERT INTO users (name,email,password_hash,password_salt,role) VALUES (?,?,?,?,?)")
    .run(name, email, hash, salt, role);
}
function ensureBook(title, author, category, isbn, copies, description) {
  if (db.prepare("SELECT id FROM books WHERE title=? AND author=?").get(title, author)) return;
  db.prepare(`INSERT INTO books (title,author,category,isbn,description,total_copies,available_copies)
              VALUES (?,?,?,?,?,?,?)`)
    .run(title, author, category, isbn, description, copies, copies);
}

ensureUser("Aluno Demonstração", "aluno@bibliohub.edu.br", "biblioteca123", "reader");
ensureUser("Bibliotecária BiblioHub", "admin@bibliohub.edu.br", "admin123", "admin");
[
  ["1984","George Orwell","Ficção","9780451524935",3,"Distopia clássica sobre vigilância, poder e liberdade."],
  ["Sapiens","Yuval Noah Harari","História","9788535923920",2,"Uma breve história da humanidade."],
  ["O Senhor dos Anéis","J.R.R. Tolkien","Fantasia","9788595084759",1,"A jornada épica pela Terra-média."],
  ["A Origem das Espécies","Charles Darwin","Ciência","9788572329859",2,"Obra fundamental sobre evolução."],
  ["Dom Casmurro","Machado de Assis","Literatura Brasileira","9788572326971",4,"Romance clássico brasileiro."],
  ["O Hobbit","J.R.R. Tolkien","Fantasia","9788595084742",2,"A aventura de Bilbo Bolseiro."],
  ["Cosmos","Carl Sagan","Ciência","9788535929881",2,"Ciência, humanidade e universo."],
  ["Clean Code","Robert C. Martin","Tecnologia","9780132350884",2,"Princípios para escrever código limpo."],
  ["Orgulho e Preconceito","Jane Austen","Romance","9788544001820",2,"Clássico da literatura inglesa."],
  ["Breve História do Tempo","Stephen Hawking","Ciência","9788580576467",1,"Introdução aos grandes temas da cosmologia."]
].forEach(args => ensureBook(...args));

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(body);
}
function text(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": contentType, "Cache-Control": "no-cache" });
  res.end(body);
}
async function readJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 200_000) throw new Error("Corpo da requisição muito grande.");
  }
  if (!body) return {};
  try { return JSON.parse(body); } catch { throw new Error("JSON inválido."); }
}
function authUser(req) {
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const row = db.prepare(`SELECT u.id,u.name,u.email,u.role,s.token
                          FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?`).get(token);
  return row ? { ...publicUser(row), token } : null;
}
function requireAuth(req, res) {
  const user = authUser(req);
  if (!user) { json(res, 401, { message: "Faça login para continuar." }); return null; }
  return user;
}
function requireAdmin(req, res) {
  const user = requireAuth(req, res);
  if (!user) return null;
  if (user.role !== "admin") { json(res, 403, { message: "Acesso restrito ao bibliotecário." }); return null; }
  return user;
}
function createSession(userId) {
  const token = crypto.randomUUID() + crypto.randomBytes(10).toString("hex");
  db.prepare("INSERT INTO sessions (token,user_id) VALUES (?,?)").run(token, userId);
  return token;
}
function returnLoan(loan) {
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("UPDATE loans SET returned_at=? WHERE id=?").run(dateOnly(), loan.id);
    db.prepare("UPDATE books SET available_copies=MIN(total_copies,available_copies+1) WHERE id=?").run(loan.book_id);
    db.exec("COMMIT");
  } catch (e) { db.exec("ROLLBACK"); throw e; }
}

async function handleApi(req, res, url) {
  const method = req.method || "GET";
  const pathname = url.pathname;

  if (method === "GET" && pathname === "/api/health") {
    return json(res, 200, { ok: true, app: "BiblioHub", database: "SQLite", node: process.version });
  }

  if (method === "POST" && pathname === "/api/auth/login") {
    const body = await readJson(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const user = db.prepare("SELECT * FROM users WHERE email=?").get(email);
    if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) return json(res, 401, { message: "E-mail ou senha incorretos." });
    return json(res, 200, { token: createSession(user.id), user: publicUser(user) });
  }

  if (method === "POST" && pathname === "/api/auth/register") {
    const body = await readJson(req);
    const name = String(body.name || "").trim();
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    if (name.length < 3) return json(res, 400, { message: "Informe o nome completo." });
    if (!email.includes("@")) return json(res, 400, { message: "Informe um e-mail válido." });
    if (password.length < 6) return json(res, 400, { message: "A senha deve ter pelo menos 6 caracteres." });
    if (db.prepare("SELECT id FROM users WHERE email=?").get(email)) return json(res, 409, { message: "E-mail já cadastrado." });
    const { salt, hash } = hashPassword(password);
    const result = db.prepare("INSERT INTO users (name,email,password_hash,password_salt,role) VALUES (?,?,?,?,'reader')").run(name,email,hash,salt);
    const user = db.prepare("SELECT id,name,email,role FROM users WHERE id=?").get(Number(result.lastInsertRowid));
    return json(res, 201, { token: createSession(user.id), user });
  }

  if (method === "GET" && pathname === "/api/me") {
    const user = requireAuth(req,res); if (!user) return;
    return json(res, 200, publicUser(user));
  }
  if (method === "POST" && pathname === "/api/auth/logout") {
    const user = requireAuth(req,res); if (!user) return;
    db.prepare("DELETE FROM sessions WHERE token=?").run(user.token);
    return json(res, 200, { ok: true });
  }

  if (method === "GET" && pathname === "/api/books") {
    const user = requireAuth(req,res); if (!user) return;
    const search = String(url.searchParams.get("search") || "").trim();
    const category = String(url.searchParams.get("category") || "").trim();
    let sql = "SELECT * FROM books WHERE 1=1"; const params=[];
    if (search) { sql += " AND (title LIKE ? OR author LIKE ? OR isbn LIKE ?)"; const q=`%${search}%`; params.push(q,q,q); }
    if (category) { sql += " AND category=?"; params.push(category); }
    sql += " ORDER BY title COLLATE NOCASE";
    return json(res, 200, db.prepare(sql).all(...params));
  }
  if (method === "GET" && pathname === "/api/categories") {
    const user = requireAuth(req,res); if (!user) return;
    return json(res, 200, db.prepare("SELECT category,COUNT(*) count FROM books GROUP BY category ORDER BY category").all());
  }

  if (method === "GET" && pathname === "/api/loans/me") {
    const user = requireAuth(req,res); if (!user) return;
    return json(res, 200, db.prepare(`SELECT l.*,b.title,b.author,b.category,
      CASE WHEN l.returned_at IS NULL AND l.due_date<date('now') THEN 1 ELSE 0 END late
      FROM loans l JOIN books b ON b.id=l.book_id WHERE l.user_id=?
      ORDER BY l.returned_at IS NULL DESC,l.loan_date DESC`).all(user.id));
  }
  if (method === "POST" && pathname === "/api/loans") {
    const user = requireAuth(req,res); if (!user) return;
    const body = await readJson(req); const bookId=Number(body.bookId);
    if (!Number.isInteger(bookId)) return json(res,400,{message:"Livro inválido."});
    if (db.prepare("SELECT id FROM loans WHERE user_id=? AND book_id=? AND returned_at IS NULL").get(user.id,bookId)) return json(res,409,{message:"Você já possui este livro emprestado."});
    const book=db.prepare("SELECT * FROM books WHERE id=?").get(bookId);
    if (!book) return json(res,404,{message:"Livro não encontrado."});
    if (book.available_copies<=0) return json(res,409,{message:"Sem exemplares disponíveis. Faça uma reserva."});
    db.exec("BEGIN IMMEDIATE");
    try {
      const changed=db.prepare("UPDATE books SET available_copies=available_copies-1 WHERE id=? AND available_copies>0").run(bookId);
      if (Number(changed.changes)!==1) throw new Error("Sem exemplares disponíveis.");
      const due=plusDays(14);
      const result=db.prepare("INSERT INTO loans (user_id,book_id,loan_date,due_date) VALUES (?,?,?,?)").run(user.id,bookId,dateOnly(),due);
      db.exec("COMMIT");
      return json(res,201,{id:Number(result.lastInsertRowid),dueDate:due,message:"Empréstimo realizado por 14 dias."});
    } catch(e) { db.exec("ROLLBACK"); return json(res,409,{message:e.message}); }
  }
  let match = pathname.match(/^\/api\/loans\/(\d+)\/return$/);
  if (method === "POST" && match) {
    const user=requireAuth(req,res); if(!user)return;
    const loan=db.prepare("SELECT * FROM loans WHERE id=?").get(Number(match[1]));
    if(!loan)return json(res,404,{message:"Empréstimo não encontrado."});
    if(loan.returned_at)return json(res,409,{message:"Empréstimo já devolvido."});
    if(user.role!=="admin"&&loan.user_id!==user.id)return json(res,403,{message:"Empréstimo de outro usuário."});
    try{returnLoan(loan);return json(res,200,{message:"Devolução registrada com sucesso."});}catch{return json(res,500,{message:"Erro ao registrar devolução."});}
  }

  if (method === "GET" && pathname === "/api/reservations/me") {
    const user=requireAuth(req,res); if(!user)return;
    return json(res,200,db.prepare(`SELECT r.*,b.title,b.author FROM reservations r JOIN books b ON b.id=r.book_id
      WHERE r.user_id=? AND r.status='active' ORDER BY r.created_at DESC`).all(user.id));
  }
  if (method === "POST" && pathname === "/api/reservations") {
    const user=requireAuth(req,res); if(!user)return;
    const body=await readJson(req); const bookId=Number(body.bookId);
    const book=db.prepare("SELECT * FROM books WHERE id=?").get(bookId);
    if(!book)return json(res,404,{message:"Livro não encontrado."});
    if(book.available_copies>0)return json(res,409,{message:"Há exemplar disponível. Faça o empréstimo."});
    if(db.prepare("SELECT id FROM reservations WHERE user_id=? AND book_id=? AND status='active'").get(user.id,bookId))return json(res,409,{message:"Você já reservou este livro."});
    const result=db.prepare("INSERT INTO reservations (user_id,book_id) VALUES (?,?)").run(user.id,bookId);
    return json(res,201,{id:Number(result.lastInsertRowid),message:"Reserva realizada."});
  }
  match=pathname.match(/^\/api\/reservations\/(\d+)$/);
  if(method==="DELETE"&&match){
    const user=requireAuth(req,res);if(!user)return;
    const r=db.prepare("SELECT * FROM reservations WHERE id=? AND status='active'").get(Number(match[1]));
    if(!r)return json(res,404,{message:"Reserva não encontrada."});
    if(user.role!=="admin"&&r.user_id!==user.id)return json(res,403,{message:"Reserva de outro usuário."});
    db.prepare("UPDATE reservations SET status='cancelled' WHERE id=?").run(r.id);
    return json(res,200,{message:"Reserva cancelada."});
  }

  if (method === "GET" && pathname === "/api/admin/stats") {
    const user=requireAdmin(req,res);if(!user)return;
    const val=q=>db.prepare(q).get().n;
    return json(res,200,{books:val("SELECT COUNT(*) n FROM books"),copies:val("SELECT COALESCE(SUM(total_copies),0) n FROM books"),available:val("SELECT COALESCE(SUM(available_copies),0) n FROM books"),activeLoans:val("SELECT COUNT(*) n FROM loans WHERE returned_at IS NULL"),lateLoans:val("SELECT COUNT(*) n FROM loans WHERE returned_at IS NULL AND due_date<date('now')"),reservations:val("SELECT COUNT(*) n FROM reservations WHERE status='active'"),readers:val("SELECT COUNT(*) n FROM users WHERE role='reader'")});
  }
  if(method==="GET"&&pathname==="/api/admin/loans"){
    const user=requireAdmin(req,res);if(!user)return;
    return json(res,200,db.prepare(`SELECT l.*,b.title,b.author,u.name user_name,u.email user_email,
      CASE WHEN l.returned_at IS NULL AND l.due_date<date('now') THEN 1 ELSE 0 END late
      FROM loans l JOIN books b ON b.id=l.book_id JOIN users u ON u.id=l.user_id
      ORDER BY l.returned_at IS NULL DESC,l.due_date ASC`).all());
  }
  if(method==="GET"&&pathname==="/api/admin/reservations"){
    const user=requireAdmin(req,res);if(!user)return;
    return json(res,200,db.prepare(`SELECT r.*,b.title,b.author,u.name user_name,u.email user_email FROM reservations r
      JOIN books b ON b.id=r.book_id JOIN users u ON u.id=r.user_id WHERE r.status='active' ORDER BY r.created_at`).all());
  }
  if(method==="GET"&&pathname==="/api/admin/users"){
    const user=requireAdmin(req,res);if(!user)return;
    return json(res,200,db.prepare(`SELECT id,name,email,role,created_at,
      (SELECT COUNT(*) FROM loans l WHERE l.user_id=users.id AND l.returned_at IS NULL) active_loans
      FROM users ORDER BY name COLLATE NOCASE`).all());
  }
  if(method==="POST"&&pathname==="/api/admin/books"){
    const user=requireAdmin(req,res);if(!user)return;
    const body=await readJson(req); const title=String(body.title||"").trim(),author=String(body.author||"").trim(),category=String(body.category||"").trim();
    const isbn=String(body.isbn||"").trim(),description=String(body.description||"").trim(); const copies=Math.max(1,Number(body.copies||1));
    if(!title||!author||!category)return json(res,400,{message:"Título, autor e categoria são obrigatórios."});
    const result=db.prepare("INSERT INTO books (title,author,category,isbn,description,total_copies,available_copies) VALUES (?,?,?,?,?,?,?)").run(title,author,category,isbn||null,description,copies,copies);
    return json(res,201,{id:Number(result.lastInsertRowid),message:"Livro cadastrado no acervo."});
  }

  return json(res,404,{message:"Rota não encontrada."});
}

const MIME = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8", ".svg":"image/svg+xml", ".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg" };
function serveStatic(res, pathname) {
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  let file = path.resolve(PUBLIC_DIR, relative);
  if (!file.startsWith(PUBLIC_DIR)) return text(res,403,"Acesso negado");
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC_DIR,"index.html");
  if (!fs.existsSync(file)) return text(res,404,"Arquivo não encontrado");
  const content = fs.readFileSync(file);
  res.writeHead(200,{"Content-Type":MIME[path.extname(file).toLowerCase()]||"application/octet-stream","Cache-Control":"no-cache"});
  res.end(content);
}

const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,`http://${req.headers.host||"localhost"}`);
  try{
    if(url.pathname.startsWith("/api/"))return await handleApi(req,res,url);
    return serveStatic(res,url.pathname);
  }catch(error){console.error(error);return json(res,500,{message:error.message||"Erro interno."});}
});
server.listen(PORT,"0.0.0.0",()=>{
  console.log("\nBiblioHub iniciado com sucesso!");
  console.log(`Aplicação + API: http://localhost:${PORT}`);
  console.log(`Banco SQLite: ${DB_FILE}`);
  console.log("Login aluno: aluno@bibliohub.edu.br / biblioteca123");
  console.log("Login admin: admin@bibliohub.edu.br / admin123\n");
});
