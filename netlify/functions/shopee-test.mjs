<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">

<title>Shopee Video Downloader</title>

<style>
*{
  box-sizing:border-box;
}

body{
  margin:0;
  min-height:100vh;
  background:#0d0d0f;
  color:#fff;
  font-family:Arial,Helvetica,sans-serif;
  padding:20px;
}

.container{
  width:100%;
  max-width:520px;
  margin:30px auto;
}

.card{
  background:#17171b;
  border:1px solid #29292f;
  border-radius:22px;
  padding:22px;
}

.logo{
  font-size:28px;
  font-weight:800;
  margin-bottom:8px;
}

.sub{
  color:#aaa;
  line-height:1.5;
  margin-bottom:22px;
}

input{
  width:100%;
  padding:16px;
  border-radius:13px;
  border:1px solid #36363d;
  background:#0d0d0f;
  color:white;
  font-size:15px;
  outline:none;
}

button{
  width:100%;
  margin-top:12px;
  padding:16px;
  border:0;
  border-radius:13px;
  background:#ee4d2d;
  color:#fff;
  font-size:16px;
  font-weight:800;
  cursor:pointer;
}

button:disabled{
  opacity:.55;
}

#loading{
  display:none;
  margin-top:20px;
  text-align:center;
  color:#bbb;
}

#resultado{
  display:none;
  margin-top:22px;
}

.sucesso{
  padding:12px;
  background:#11251b;
  border:1px solid #245d3c;
  color:#6ee7a2;
  border-radius:12px;
  margin-bottom:15px;
  font-weight:bold;
}

.erro{
  padding:12px;
  background:#2a1215;
  border:1px solid #6b2930;
  color:#ff7a85;
  border-radius:12px;
  margin-bottom:15px;
}

video{
  width:100%;
  max-height:600px;
  border-radius:16px;
  background:#000;
  margin-top:5px;
}

.download{
  display:block;
  width:100%;
  padding:16px;
  margin-top:14px;
  text-align:center;
  text-decoration:none;
  border-radius:13px;
  background:#ee4d2d;
  color:#fff;
  font-size:16px;
  font-weight:800;
}

.novo{
  background:#29292f;
}

.info{
  margin-top:16px;
  font-size:12px;
  color:#777;
  text-align:center;
  line-height:1.5;
}

.debug{
  margin-top:18px;
  padding:13px;
  border-radius:12px;
  background:#09090b;
  color:#aaa;
  font-size:11px;
  word-break:break-all;
  display:none;
}
</style>
</head>

<body>

<div class="container">

  <div class="card">

    <div class="logo">
      🛍️ Shopee Video
    </div>

    <div class="sub">
      Cole o link compartilhado do Shopee Video para localizar o vídeo.
    </div>

    <input
      id="url"
      type="url"
      placeholder="https://br.shp.ee/..."
    >

    <button
      id="buscar"
      onclick="buscarVideo()"
    >
      LOCALIZAR VÍDEO
    </button>

    <div id="loading">
      🔎 Procurando vídeo...
    </div>

    <div id="resultado"></div>

  </div>

</div>

<script>

const input =
  document.getElementById("url");

const botao =
  document.getElementById("buscar");

const loading =
  document.getElementById("loading");

const resultado =
  document.getElementById("resultado");


async function buscarVideo(){

  const url =
    input.value.trim();

  if(!url){
    alert("Cole o link do Shopee Video.");
    return;
  }

  botao.disabled = true;

  loading.style.display =
    "block";

  resultado.style.display =
    "none";

  resultado.innerHTML =
    "";

  try{

    const response =
      await fetch(
        "/.netlify/functions/shopee-test",
        {
          method:"POST",

          headers:{
            "Content-Type":
              "application/json"
          },

          body:JSON.stringify({
            url
          })
        }
      );

    const data =
      await response.json();


    if(
      !data.ok ||
      !data.media ||
      !data.media.length
    ){

      resultado.innerHTML = `
        <div class="erro">
          ❌ Não consegui localizar o arquivo de vídeo.
        </div>

        <button
          class="novo"
          onclick="novoTeste()"
        >
          TESTAR OUTRO LINK
        </button>

        <div class="debug">
          ${escapeHtml(
            JSON.stringify(
              data,
              null,
              2
            )
          )}
        </div>
      `;

      return;
    }


    const mp4 =
      data.mp4?.[0] ||
      data.media.find(
        item =>
          item.includes(".mp4")
      ) ||
      data.media[0];


    resultado.innerHTML = `
      <div class="sucesso">
        ✅ Vídeo encontrado!
      </div>

      <video
        controls
        playsinline
        preload="metadata"
        src="${escapeAttr(mp4)}"
      ></video>

      <a
        class="download"
        href="${escapeAttr(mp4)}"
        target="_blank"
        rel="noopener"
      >
        ⬇️ BAIXAR MP4
      </a>

      <button
        class="novo"
        onclick="novoTeste()"
      >
        TESTAR OUTRO LINK
      </button>

      <div class="info">
        Arquivo localizado diretamente a partir
        do link compartilhado.
      </div>
    `;

  }

  catch(error){

    resultado.innerHTML = `
      <div class="erro">
        ❌ Ocorreu um erro durante o teste.
      </div>

      <div class="debug">
        ${escapeHtml(
          String(error)
        )}
      </div>
    `;
  }

  finally{

    loading.style.display =
      "none";

    resultado.style.display =
      "block";

    botao.disabled =
      false;
  }
}


function novoTeste(){

  input.value = "";

  resultado.style.display =
    "none";

  resultado.innerHTML =
    "";

  input.focus();
}


function escapeHtml(value){

  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}


function escapeAttr(value){

  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll('"',"&quot;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

</script>

</body>
</html>
