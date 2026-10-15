const fs = require("fs");
const path = require("path");
const base = path.resolve(__dirname, "../backend/data/bibliohub.db");
for (const suffix of ["", "-shm", "-wal"]) {
  const file = base + suffix;
  if (fs.existsSync(file)) fs.rmSync(file, { force: true });
}
console.log("Banco apagado. Execute npm start para recriar os dados de demonstração.");
