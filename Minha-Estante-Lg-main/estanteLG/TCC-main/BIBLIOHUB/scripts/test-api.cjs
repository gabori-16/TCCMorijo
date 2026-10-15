async function request(path, options={}) {
  const r=await fetch(`http://127.0.0.1:5173${path}`,options);
  const data=await r.json();
  if(!r.ok) throw new Error(`${r.status}: ${JSON.stringify(data)}`);
  return data;
}
(async()=>{
  console.log("1) Health:",await request("/api/health"));
  const login=await request("/api/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:"aluno@bibliohub.edu.br",password:"biblioteca123"})});
  console.log("2) Login aluno: OK -",login.user.name);
  const headers={authorization:`Bearer ${login.token}`};
  const books=await request("/api/books",{headers});
  console.log(`3) Catálogo: ${books.length} livros`);
  const admin=await request("/api/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:"admin@bibliohub.edu.br",password:"admin123"})});
  const stats=await request("/api/admin/stats",{headers:{authorization:`Bearer ${admin.token}`}});
  console.log("4) Painel admin:",stats);
  console.log("\nTODOS OS TESTES PASSARAM.");
})().catch(e=>{console.error("TESTE FALHOU:",e.message);process.exit(1)});
