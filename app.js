// ======================================================
// SHOPEE RADAR — APP.JS
// VERSÃO COMPLETA
// NICHO CORRIGIDO + COMISSÃO SOMENTE VISUAL
// DOWNLOAD ORIGINAL/HD + LIMPEZA LOCAL DE METADADOS
// NETLIFY SAME-ORIGIN
// ======================================================

// APIS
const MOMENTUM_API = "https://vepoqxpnvlzzhmajcqzo.supabase.co/functions/v1/shopee-radar-momentum";
const ZERO_API = "https://vepoqxpnvlzzhmajcqzo.supabase.co/functions/v1/shopee-radar-zero";
const RANKING_API = "https://vepoqxpnvlzzhmajcqzo.supabase.co/functions/v1/shopee-radar-ranking";
const PACKS_API = "https://vepoqxpnvlzzhmajcqzo.supabase.co/functions/v1/shopee-radar-videos";

// V6.1 NO MESMO DOMÍNIO DO RADAR
const SHOPEE_VIDEO_API =
  "/.netlify/functions/shopee-test";

const MEDIABUNNY_MODULE =
  "https://cdn.jsdelivr.net/npm/mediabunny/+esm";

const LIMITE_POR_PAGINA = 20;

// ======================================================
// ESTADO
// ======================================================

let produtos = [];
let paginaAtual = 1;
let temProximaPagina = true;
let carregando = false;
let filtroAtual = "radar";
let ordenacaoAtual = "relevance";
let modoFavoritos = false;
let buscaDigitada = "";
let nichoAtual = "all";
let totalServidor = 0;
let resumoServidor = {};

// DOWNLOAD
let modoDownload = false;
let videoOriginalUrl = "";
let videoLimpoBlob = null;
let videoLimpoObjectUrl = "";
let limpandoVideo = false;
let buscandoVideo = false;
let mediabunnyPromise = null;

// ======================================================
// TOKEN
// ======================================================

function obterTokenRadar() {
  return localStorage.getItem("shopeeRadarAccessToken") || "";
}

function limparSessaoRadarApp() {
  localStorage.removeItem("shopeeRadarAccessToken");
  localStorage.removeItem("shopeeRadarRefreshToken");
  localStorage.removeItem("shopeeRadarUser");
}

function redirecionarLogin() {
  limparSessaoRadarApp();
  window.location.replace("login.html");
}

function criarHeadersAPI() {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${obterTokenRadar()}`
  };
}

// ======================================================
// ELEMENTOS
// ======================================================

const productsGrid = document.getElementById("productsGrid");
const emptyState = document.getElementById("emptyState");
const totalProdutos = document.getElementById("totalProdutos");
const totalOportunidades = document.getElementById("totalOportunidades");
const totalVideos = document.getElementById("totalVideos");

const totalProdutosLabel =
  document.getElementById("totalProdutosLabel");

const totalOportunidadesLabel =
  document.getElementById("totalOportunidadesLabel");

const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const resultsTitle = document.getElementById("resultsTitle");
const heroDescription = document.getElementById("heroDescription");
const zeroStrategyBox = document.getElementById("zeroStrategyBox");
const infiniteLoader = document.getElementById("infiniteLoader");
const productModal = document.getElementById("productModal");
const modalBody = document.getElementById("modalBody");
const closeModal = document.getElementById("closeModal");

// DOWNLOAD
const radarMainContent =
  document.getElementById("radarMainContent");

const videoDownloaderPage =
  document.getElementById("videoDownloaderPage");

const videoDownloaderNav =
  document.getElementById("videoDownloaderNav");

const shopeeVideoLink =
  document.getElementById("shopeeVideoLink");

const findShopeeVideo =
  document.getElementById("findShopeeVideo");

const videoDownloadStatus =
  document.getElementById("videoDownloadStatus");

const videoDownloadResult =
  document.getElementById("videoDownloadResult");

const shopeeVideoPreview =
  document.getElementById("shopeeVideoPreview");

const cleanVideoMetadata =
  document.getElementById("cleanVideoMetadata");

const metadataCleanProgress =
  document.getElementById("metadataCleanProgress");

const metadataCleanSuccess =
  document.getElementById("metadataCleanSuccess");

const downloadCleanVideo =
  document.getElementById("downloadCleanVideo");

// ======================================================
// UTILIDADES
// ======================================================

function numeroSeguro(valor) {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function escapar(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dinheiro(valor) {
  return numeroSeguro(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatarNumero(valor) {
  const n = numeroSeguro(valor);

  if (n >= 1000000) {
    return (n / 1000000)
      .toFixed(1)
      .replace(".", ",") + " mi";
  }

  if (n >= 1000) {
    return (n / 1000)
      .toFixed(n >= 10000 ? 0 : 1)
      .replace(".", ",") + " mil";
  }

  return n.toLocaleString("pt-BR");
}

function formatarData(valor) {
  if (!valor) return "";

  try {
    return new Date(valor).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

// ======================================================
// NICHOS
// CLASSIFICAÇÃO EXCLUSIVA
// ======================================================

const MAPA_NICHOS = {
  celulares: [
    "celular", "smartphone", "iphone", "galaxy", "redmi",
    "poco", "motorola", "xiaomi", "realme", "infinix",
    "capinha celular", "capa iphone", "pelicula celular",
    "pelicula iphone", "suporte celular", "carregador celular"
  ],

  informatica: [
    "notebook", "laptop", "computador", "pc gamer", "monitor",
    "teclado", "mouse", "mousepad", "ssd", "nvme", "hd externo",
    "pendrive", "memoria ram", "placa de video", "gpu",
    "processador", "placa mae", "gabinete", "fonte pc", "cooler",
    "roteador", "adaptador wifi", "hub usb"
  ],

  games: [
    "videogame", "video game", "playstation", "ps4", "ps5",
    "xbox", "nintendo", "switch", "controle gamer", "joystick",
    "gamepad", "console", "jogo ps5", "jogo ps4", "jogo xbox",
    "cadeira gamer", "volante gamer"
  ],

  cozinha: [
    "panela", "frigideira", "talher", "prato", "copo", "caneca",
    "garrafa termica", "jarra", "marmita", "escorredor", "ralador",
    "cortador legumes", "batedor", "mixer", "air fryer", "airfryer",
    "cafeteira", "chaleira", "tabua de corte", "peneira",
    "liquidificador", "sanduicheira", "torradeira", "forma bolo",
    "assadeira", "panela pressao"
  ],

  ferramentas: [
    "furadeira", "parafusadeira", "serra circular", "martelo",
    "alicate", "chave philips", "chave fenda", "chave catraca",
    "soquete", "broca", "trena", "ferro de solda", "compressor",
    "esmerilhadeira", "lixadeira", "multimetro",
    "caixa ferramentas", "kit ferramentas"
  ],

  automotivo: [
    "automotivo", "automotiva", "acessorio carro", "acessorio moto",
    "pneu", "volante", "retrovisor", "capacete", "farol",
    "limpa para brisa", "tapete carro", "capa banco carro",
    "carregador veicular", "lavagem automotiva", "polimento",
    "suporte celular carro", "camera veicular"
  ],

  bebe: [
    "bebe", "mamadeira", "chupeta", "fralda", "berco",
    "carrinho bebe", "banheira bebe", "body bebe", "roupa bebe",
    "kit maternidade", "maternidade", "babador",
    "cadeirinha bebe", "copo infantil"
  ],

  pet: [
    "pet", "cachorro", "gato", "racao", "petisco", "coleira",
    "peitoral pet", "comedouro", "bebedouro pet", "areia gato",
    "areia sanitaria", "casinha pet", "cama pet", "arranhador",
    "brinquedo cachorro", "brinquedo gato"
  ],

  beleza: [
    "maquiagem", "batom", "rimel", "mascara cilios", "base facial",
    "corretivo", "blush", "sombra maquiagem", "delineador",
    "skincare", "hidratante facial", "creme corporal", "serum",
    "shampoo", "condicionador", "mascara capilar", "perfume",
    "body splash", "protetor solar", "esmalte", "depilador",
    "secador cabelo", "chapinha", "modelador cabelo"
  ],

  fitness: [
    "fitness", "academia", "musculacao", "halter", "peso academia",
    "elastico exercicio", "tapete yoga", "luva academia",
    "corda pular", "bicicleta ergometrica", "esteira academia",
    "faixa elastica", "kit treino"
  ],

  papelaria: [
    "papelaria", "caderno", "caneta", "lapis", "lapiseira",
    "marca texto", "estojo", "agenda", "planner", "papel a4",
    "post it", "adesivo escolar", "mochila escolar", "fichario",
    "borracha escolar", "apontador", "canetinha", "material escolar"
  ],

  moda: [
    "vestido", "blusa", "camisa feminina", "camisa masculina",
    "camiseta", "regata", "cropped", "calca feminina",
    "calca masculina", "jeans", "legging", "short feminino",
    "short masculino", "bermuda", "saia", "macacao",
    "conjunto feminino", "conjunto masculino", "roupa feminina",
    "roupa masculina", "tenis feminino", "tenis masculino",
    "sapato feminino", "sapato masculino", "sandalia",
    "chinelo feminino", "chinelo masculino", "bolsa feminina",
    "calcinha", "sutia", "pijama"
  ],

  eletronicos: [
    "smartwatch", "relogio inteligente", "fone bluetooth",
    "headphone", "earbuds", "caixa de som", "speaker bluetooth",
    "power bank", "camera digital", "webcam", "microfone",
    "projetor", "lampada inteligente", "adaptador bluetooth",
    "tv box", "controle remoto universal"
  ],

  casa: [
    "organizador", "prateleira", "toalha", "lencol", "fronha",
    "cama", "sofa", "manta", "tapete", "cortina", "almofada",
    "travesseiro", "banheiro", "cabide", "cesto roupa", "mop",
    "vassoura", "rodo", "limpeza casa", "decoracao",
    "vaso decorativo", "luminaria"
  ]
};

const PRIORIDADE_NICHOS = [
  "celulares",
  "informatica",
  "games",
  "cozinha",
  "ferramentas",
  "automotivo",
  "bebe",
  "pet",
  "beleza",
  "fitness",
  "papelaria",
  "moda",
  "eletronicos",
  "casa"
];

function pontuarNicho(texto, nicho) {
  const palavras = MAPA_NICHOS[nicho] || [];
  let pontos = 0;

  for (const palavra of palavras) {
    const termo = normalizarTexto(palavra);

    if (!termo) continue;

    if (texto.includes(termo)) {
      pontos += termo.includes(" ") ? 3 : 1;
    }
  }

  return pontos;
}

function detectarNichoProduto(produto) {
  const texto = normalizarTexto([
    produto.name || "",
    produto.shop_name || ""
  ].join(" "));

  if (!texto) return null;

  let melhorNicho = null;
  let melhorPontuacao = 0;

  for (const nicho of PRIORIDADE_NICHOS) {
    const pontos = pontuarNicho(texto, nicho);

    if (pontos > melhorPontuacao) {
      melhorPontuacao = pontos;
      melhorNicho = nicho;
    }
  }

  return melhorNicho;
}

function produtoPertenceNicho(produto, nicho) {
  if (!nicho || nicho === "all") return true;
  return detectarNichoProduto(produto) === nicho;
}

// ======================================================
// NORMALIZAÇÃO
// ======================================================

function normalizarMomentum(p) {
  return {
    id: String(p.product_id ?? p.id ?? ""),
    tipo: "momentum",
    name: p.product_name ?? "Produto Shopee",
    image_url: p.image_url ?? "",
    product_url: p.product_url ?? "",
    affiliate_url: p.affiliate_url ?? p.product_url ?? "",
    shop_name: p.shop_name ?? "Shopee",
    price: numeroSeguro(p.price),
    sold_count: numeroSeguro(p.sold_count),
    rating: numeroSeguro(p.rating),

    // SOMENTE INFORMATIVO
    commission_value: numeroSeguro(p.commission_value),
    commission_rate: numeroSeguro(p.commission_rate),

    momentum_score: numeroSeguro(p.momentum_score),
    momentum_posicao: numeroSeguro(p.momentum_posicao),
    momentum_nivel: p.momentum_nivel ?? "observar",
    momentum_rotulo: p.momentum_rotulo ?? "👀 OBSERVAR",
    trend_score: numeroSeguro(p.trend_score),
    trend_nivel: p.trend_nivel ?? "⚪ Presença baixa",
    capturas_24h: numeroSeguro(p.capturas_24h),
    vendas_confirmadas_24h:
      numeroSeguro(p.vendas_confirmadas_24h),
    rank_atual: numeroSeguro(p.rank_atual),
    rank_anterior: numeroSeguro(p.rank_anterior),
    rank_change: numeroSeguro(p.rank_change),
    ultima_captura: p.ultima_captura ?? p.captured_at ?? null,
    sinais_reais: numeroSeguro(p.sinais_reais)
  };
}

function normalizarZero(p) {
  return {
    id: String(p.product_id ?? p.id ?? ""),
    tipo: "zero",
    name: p.product_name ?? "Produto Shopee",
    image_url: p.image_url ?? "",
    product_url: p.product_url ?? "",
    affiliate_url: p.affiliate_url ?? p.product_url ?? "",
    shop_name: p.shop_name ?? "Shopee",
    price: numeroSeguro(p.price),
    sold_count: 0,
    rating: numeroSeguro(p.rating),
    times_seen: numeroSeguro(p.times_seen),
    rank_atual: numeroSeguro(p.current_rank),
    rank_change: numeroSeguro(p.rank_change),
    ultima_captura: p.last_seen_at ?? null,
    estrategia_rotulo:
      p.estrategia_rotulo ?? "🎯 Ranquear seus vídeos",
    motivo:
      p.motivo ?? "Produto com 0 vendas totais registradas."
  };
}

function normalizarRanking(p) {
  return {
    id: String(p.product_id ?? p.id ?? ""),
    tipo: "ranking",
    name: p.product_name ?? p.name ?? "Produto Shopee",
    image_url: p.image_url ?? "",
    product_url: p.product_url ?? "",
    affiliate_url: p.affiliate_url ?? p.product_url ?? "",
    shop_name: p.shop_name ?? "Shopee",
    price: numeroSeguro(p.price),
    sold_count: numeroSeguro(p.sold_count),
    rating: numeroSeguro(p.rating),
    ultima_captura:
      p.captured_at ?? p.last_seen_at ?? null
  };
}

function normalizarPack(v) {
  const partes = String(v.shopee_video_id || "").split(":");

  const canal = String(
    v.source_channel ||
    partes[1] ||
    ""
  ).replace(/^@/, "");

  const post = String(
    v.source_post_id ||
    partes[2] ||
    ""
  );

  const sourceUrl =
    v.source_url ||
    (
      v.source_platform === "telegram" &&
      canal &&
      post
        ? `https://t.me/${canal}/${post}`
        : ""
    );

  return {
    id: String(v.id ?? v.shopee_video_id ?? ""),
    tipo: "pack",
    name:
      v.description?.trim() ||
      "Pack de vídeos para afiliados",
    description: v.description ?? "",
    image_url: v.thumbnail_url ?? "",
    thumbnail_url: v.thumbnail_url ?? "",
    source_url: sourceUrl,
    watch_url: sourceUrl || v.watch_url || "",
    shop_name: canal ? `@${canal}` : "Pack encontrado",
    source_channel: canal,
    source_platform: v.source_platform ?? "",
    ultima_captura:
      v.published_at ?? v.created_at ?? null
  };
}

function removerDuplicados(lista) {
  const mapa = new Map();

  for (const p of lista) {
    if (p && p.id && !mapa.has(String(p.id))) {
      mapa.set(String(p.id), p);
    }
  }

  return [...mapa.values()];
}

// ======================================================
// URL
// ======================================================

function montarURL(pagina) {
  if (filtroAtual === "packs") {
    const url = new URL(PACKS_API);

    url.searchParams.set("page", String(pagina));
    url.searchParams.set("limit", String(LIMITE_POR_PAGINA));

    return {
      url: url.toString(),
      tipo: "pack"
    };
  }

  if (filtroAtual === "zero") {
    const url = new URL(ZERO_API);

    url.searchParams.set("page", String(pagina));
    url.searchParams.set("limit", String(LIMITE_POR_PAGINA));

    if (buscaDigitada) {
      url.searchParams.set("q", buscaDigitada);
    }

    let sort = "recent";

    if (ordenacaoAtual === "rating") sort = "rating";
    if (ordenacaoAtual === "trend") sort = "seen";

    url.searchParams.set("sort", sort);

    return {
      url: url.toString(),
      tipo: "zero"
    };
  }

  if (
    filtroAtual === "hot" ||
    filtroAtual === "rating"
  ) {
    const url = new URL(RANKING_API);

    url.searchParams.set("page", String(pagina));
    url.searchParams.set("limit", String(LIMITE_POR_PAGINA));

    url.searchParams.set(
      "mode",
      filtroAtual === "hot"
        ? "sales"
        : "rating"
    );

    return {
      url: url.toString(),
      tipo: "ranking"
    };
  }

  const url = new URL(MOMENTUM_API);

  url.searchParams.set("page", String(pagina));
  url.searchParams.set("limit", String(LIMITE_POR_PAGINA));

  return {
    url: url.toString(),
    tipo: "momentum"
  };
}

// ======================================================
// CARREGAMENTO
// ======================================================

async function carregarProdutos(
  pagina = 1,
  adicionar = false
) {
  if (modoDownload) return;

  if (
    carregando ||
    (
      adicionar &&
      !temProximaPagina
    )
  ) {
    return;
  }

  if (!obterTokenRadar()) {
    redirecionarLogin();
    return;
  }

  carregando = true;

  if (adicionar) {
    if (infiniteLoader) {
      infiniteLoader.hidden = false;
    }
  } else {
    mostrarLoading();
  }

  try {
    const config = montarURL(pagina);

    const resposta = await fetch(
      config.url,
      {
        method: "GET",
        headers: criarHeadersAPI(),
        cache: "no-store"
      }
    );

    if (
      resposta.status === 401 ||
      resposta.status === 403
    ) {
      redirecionarLogin();
      return;
    }

    let dados;

    try {
      dados = await resposta.json();
    } catch {
      throw new Error("Resposta inválida da API.");
    }

    if (
      !resposta.ok ||
      dados.ok === false
    ) {
      throw new Error(
        dados.erro ||
        dados.message ||
        "Não foi possível carregar os produtos."
      );
    }

    let novos;

    if (config.tipo === "pack") {
      novos =
        Array.isArray(dados.videos)
          ? dados.videos.map(normalizarPack)
          : [];
    } else {
      const lista =
        Array.isArray(dados.produtos)
          ? dados.produtos
          : [];

      if (config.tipo === "momentum") {
        novos = lista.map(normalizarMomentum);
      } else if (config.tipo === "zero") {
        novos = lista.map(normalizarZero);
      } else {
        novos = lista.map(normalizarRanking);
      }
    }

    novos = removerDuplicados(novos);

    produtos =
      adicionar
        ? removerDuplicados([
            ...produtos,
            ...novos
          ])
        : novos;

    paginaAtual = numeroSeguro(
      dados.paginaAtual ??
      dados.page ??
      pagina
    );

    if (typeof dados.has_more === "boolean") {
      temProximaPagina = dados.has_more;
    } else {
      temProximaPagina =
        Boolean(dados.temProximaPagina);
    }

    totalServidor = numeroSeguro(dados.total);
    resumoServidor = dados.resumo || {};

    atualizarInterfaceModo();
    aplicarOrdenacao();

  } catch (erro) {
    console.error("Erro Shopee Radar:", erro);

    if (!adicionar) {
      mostrarErro(
        erro instanceof Error
          ? erro.message
          : String(erro)
      );
    }
  } finally {
    carregando = false;

    if (infiniteLoader) {
      infiniteLoader.hidden = true;
    }
  }
}

// ======================================================
// FILTRO
// ======================================================

function obterListaFiltrada() {
  let lista = removerDuplicados([...produtos]);

  const busca = normalizarTexto(buscaDigitada);

  if (
    busca &&
    filtroAtual !== "zero"
  ) {
    lista = lista.filter(p =>
      normalizarTexto([
        p.name,
        p.shop_name,
        p.source_channel
      ].join(" ")).includes(busca)
    );
  }

  if (
    nichoAtual !== "all" &&
    filtroAtual !== "packs"
  ) {
    lista = lista.filter(p =>
      produtoPertenceNicho(p, nichoAtual)
    );
  }

  return lista;
}

// ======================================================
// CONTADORES
// ======================================================

function atualizarContadores(listaVisivel = null) {
  const lista =
    Array.isArray(listaVisivel)
      ? listaVisivel
      : obterListaFiltrada();

  const filtrando =
    nichoAtual !== "all" ||
    Boolean(buscaDigitada);

  if (totalProdutos) {
    totalProdutos.textContent =
      filtrando
        ? lista.length
        : (
            totalServidor ||
            produtos.length
          );
  }

  if (totalVideos) {
    totalVideos.textContent = produtos.length;
  }

  if (!totalOportunidades) return;

  if (filtroAtual === "packs") {
    totalOportunidades.textContent =
      new Set(
        lista
          .map(p => p.source_channel)
          .filter(Boolean)
      ).size;

    return;
  }

  if (filtroAtual === "zero") {
    totalOportunidades.textContent =
      lista.filter(
        p => numeroSeguro(p.times_seen) >= 2
      ).length;

    return;
  }

  if (filtroAtual === "radar") {
    totalOportunidades.textContent =
      filtrando
        ? lista.filter(
            p =>
              p.momentum_nivel === "em_alta" ||
              p.momentum_nivel === "ganhando_forca"
          ).length
        : (
            numeroSeguro(
              resumoServidor.postar_agora
            ) +
            numeroSeguro(
              resumoServidor.forte_candidato
            )
          );

    return;
  }

  totalOportunidades.textContent = lista.length;
}

// ======================================================
// INTERFACE
// ======================================================

function atualizarInterfaceModo() {
  const zero = filtroAtual === "zero";

  const totalVideosLabel =
    document.getElementById("totalVideosLabel");

  if (totalVideosLabel) {
    totalVideosLabel.textContent = "CARREGADOS";
  }

  if (zeroStrategyBox) {
    zeroStrategyBox.classList.toggle("active", zero);
  }

  if (totalProdutosLabel) {
    totalProdutosLabel.textContent =
      zero
        ? "PRODUTOS 0 VENDAS"
        : "NO RADAR";
  }

  if (totalOportunidadesLabel) {
    totalOportunidadesLabel.textContent =
      zero
        ? "RECORRENTES"
        : "DESTAQUES";
  }

  if (heroDescription) {
    heroDescription.textContent =
      zero
        ? "Encontre produtos ainda sem nenhuma venda e tente posicionar seu vídeo antes da concorrência."
        : "Acompanhe a força, tendência, posição e movimento dos produtos em um único Radar.";
  }

  if (resultsTitle) {
    if (filtroAtual === "packs") {
      resultsTitle.textContent = "📦 Packs para Afiliados";
    } else if (filtroAtual === "zero") {
      resultsTitle.textContent = "🎯 Ranquear seus vídeos";
    } else if (filtroAtual === "hot") {
      resultsTitle.textContent = "🔥 Mais vendidos";
    } else if (filtroAtual === "rating") {
      resultsTitle.textContent = "⭐ Melhor avaliação";
    } else {
      resultsTitle.textContent = "🔥 O que está ganhando força";
    }
  }

  if (filtroAtual === "packs") {
    if (heroDescription) {
      heroDescription.textContent =
        "Encontre vídeos prontos para divulgar produtos da Shopee. Abra o pack diretamente na publicação original.";
    }

    if (totalProdutosLabel) {
      totalProdutosLabel.textContent = "PACKS";
    }

    if (totalOportunidadesLabel) {
      totalOportunidadesLabel.textContent = "CANAIS";
    }
  }
}

// ======================================================
// ORDENAÇÃO
// ======================================================

function aplicarOrdenacao() {
  if (modoDownload) return;

  let lista = obterListaFiltrada();

  if (filtroAtual === "packs") {
    lista.sort(
      (a, b) =>
        new Date(b.ultima_captura || 0) -
        new Date(a.ultima_captura || 0)
    );
  } else if (ordenacaoAtual === "relevance") {
    lista.sort(
      (a, b) =>
        numeroSeguro(b.momentum_score) -
        numeroSeguro(a.momentum_score)
    );
  } else if (ordenacaoAtual === "trend") {
    lista.sort(
      (a, b) =>
        numeroSeguro(b.trend_score) -
        numeroSeguro(a.trend_score)
    );
  } else if (ordenacaoAtual === "sales") {
    lista.sort(
      (a, b) =>
        numeroSeguro(b.sold_count) -
        numeroSeguro(a.sold_count)
    );
  } else if (ordenacaoAtual === "rating") {
    lista.sort(
      (a, b) =>
        numeroSeguro(b.rating) -
        numeroSeguro(a.rating)
    );
  } else if (ordenacaoAtual === "recent") {
    lista.sort(
      (a, b) =>
        new Date(b.ultima_captura || 0) -
        new Date(a.ultima_captura || 0)
    );
  }

  renderizarProdutos(lista);
  atualizarContadores(lista);
}

// ======================================================
// CARD MOMENTUM
// ======================================================

function criarCardMomentum(p) {
  const topNumerico =
    p.momentum_posicao > 0
      ? Math.round(p.momentum_posicao)
      : null;

  const vendasAgora =
    numeroSeguro(p.vendas_confirmadas_24h);

  return `
    <article class="product-card" data-id="${escapar(p.id)}">

      <div class="product-image-wrap">

        ${
          p.image_url
            ? `
              <img
                class="product-image"
                src="${escapar(p.image_url)}"
                alt="${escapar(p.name)}"
                loading="lazy"
              >
            `
            : `
              <div
                class="product-image"
                style="
                  display:flex;
                  align-items:center;
                  justify-content:center;
                  font-size:40px;
                "
              >
                🛍️
              </div>
            `
        }

        <span class="opportunity-badge">
          ${escapar(p.momentum_rotulo)}
        </span>

        ${
          topNumerico
            ? `
              <span class="score-badge">
                #${topNumerico}
              </span>
            `
            : ""
        }

      </div>

      <div class="product-info">

        <h3 class="product-name">
          ${escapar(p.name)}
        </h3>

        <div class="product-shop">
          ${escapar(p.shop_name)}
        </div>

        <div class="product-stats">

          <div class="product-stat">
            <span>VENDIDOS</span>
            <strong>
              ${formatarNumero(p.sold_count)}
            </strong>
          </div>

          <div class="product-stat">
            <span>VENDAS AGORA</span>
            <strong>
              ${vendasAgora > 0 ? "+" : ""}${formatarNumero(vendasAgora)}
            </strong>
          </div>

          <div class="product-stat">
            <span>VISTO NO RADAR</span>
            <strong>
              ${formatarNumero(p.capturas_24h)}x
            </strong>
          </div>

          <div class="product-stat">
            <span>RANKING ATUAL</span>
            <strong>
              ${
                p.rank_atual > 0
                  ? "#" + Math.round(p.rank_atual)
                  : "—"
              }
            </strong>
          </div>

        </div>

        <div class="radar-mini-grid">

          <div class="radar-mini-box">
            <small>POSIÇÃO RADAR</small>
            <strong>
              ${topNumerico ? "#" + topNumerico : "—"}
            </strong>
          </div>

          <div class="radar-mini-box">
            <small>FORÇA AGORA</small>
            <strong>
              ${Math.round(p.momentum_score)}/100
            </strong>
          </div>

          <div class="radar-mini-box">
            <small>💰 COMISSÃO</small>
            <strong>
              ${
                p.commission_value > 0
                  ? dinheiro(p.commission_value)
                  : "—"
              }
            </strong>
          </div>

        </div>

        <div class="product-footer">

          <div>
            <small>TENDÊNCIA</small>
            <strong>
              ${Math.round(p.trend_score)}/100
            </strong>
          </div>

          <div class="product-price">
            <small>PREÇO</small>
            <strong>
              ${dinheiro(p.price)}
            </strong>
          </div>

        </div>

      </div>

    </article>
  `;
}

// ======================================================
// CARD ZERO
// ======================================================

function criarCardZero(p) {
  return `
    <article class="product-card" data-id="${escapar(p.id)}">

      <div class="product-image-wrap">

        ${
          p.image_url
            ? `
              <img
                class="product-image"
                src="${escapar(p.image_url)}"
                alt="${escapar(p.name)}"
                loading="lazy"
              >
            `
            : ""
        }

        <span class="opportunity-badge">
          🎯 RANQUEAR
        </span>

      </div>

      <div class="product-info">

        <h3 class="product-name">
          ${escapar(p.name)}
        </h3>

        <div class="product-shop">
          ${escapar(p.shop_name)}
        </div>

        <div class="product-stats">

          <div class="product-stat">
            <span>VENDIDOS</span>
            <strong>0</strong>
          </div>

          <div class="product-stat">
            <span>VISTO NO RADAR</span>
            <strong>
              ${formatarNumero(p.times_seen)}x
            </strong>
          </div>

          <div class="product-stat">
            <span>RANKING</span>
            <strong>
              ${p.rank_atual > 0 ? "#" + p.rank_atual : "—"}
            </strong>
          </div>

          <div class="product-stat">
            <span>AVALIAÇÃO</span>
            <strong>
              ${p.rating > 0 ? p.rating.toFixed(1) : "—"}
            </strong>
          </div>

        </div>

        <div class="product-footer">

          <div>
            <small>ESTRATÉGIA</small>
            <strong>ENTRAR CEDO</strong>
          </div>

          <div class="product-price">
            <small>PREÇO</small>
            <strong>${dinheiro(p.price)}</strong>
          </div>

        </div>

      </div>

    </article>
  `;
}

// ======================================================
// CARD RANKING
// ======================================================

function criarCardRanking(p) {
  return `
    <article class="product-card" data-id="${escapar(p.id)}">

      <div class="product-image-wrap">

        ${
          p.image_url
            ? `
              <img
                class="product-image"
                src="${escapar(p.image_url)}"
                alt="${escapar(p.name)}"
                loading="lazy"
              >
            `
            : ""
        }

        <span class="opportunity-badge">
          ${
            filtroAtual === "rating"
              ? "⭐ AVALIAÇÃO"
              : "🔥 VENDIDOS"
          }
        </span>

      </div>

      <div class="product-info">

        <h3 class="product-name">
          ${escapar(p.name)}
        </h3>

        <div class="product-shop">
          ${escapar(p.shop_name)}
        </div>

        <div class="product-stats">

          <div class="product-stat">
            <span>VENDIDOS</span>
            <strong>
              ${formatarNumero(p.sold_count)}
            </strong>
          </div>

          <div class="product-stat">
            <span>AVALIAÇÃO</span>
            <strong>
              ${p.rating > 0 ? p.rating.toFixed(1) : "—"}
            </strong>
          </div>

        </div>

        <div class="product-footer">

          <div>
            <small>PRODUTO</small>
            <strong>SHOPEE</strong>
          </div>

          <div class="product-price">
            <small>PREÇO</small>
            <strong>${dinheiro(p.price)}</strong>
          </div>

        </div>

      </div>

    </article>
  `;
}

// ======================================================
// CARD PACK
// ======================================================

function criarCardPack(p) {
  const canal =
    p.source_channel
      ? `@${p.source_channel}`
      : "Fonte pública";

  return `
    <article class="pack-card" data-id="${escapar(p.id)}">

      <div class="pack-media">

        ${
          p.thumbnail_url
            ? `
              <img
                src="${escapar(p.thumbnail_url)}"
                alt="Pack para afiliados"
                loading="lazy"
                referrerpolicy="no-referrer"
              >
            `
            : `
              <div class="pack-placeholder">

                <span class="pack-placeholder-icon">
                  📦
                </span>

                <span>
                  PACK PARA AFILIADOS
                </span>

              </div>
            `
        }

        <span class="pack-badge">
          📦 PACK ENCONTRADO
        </span>

      </div>

      <div class="pack-content">

        <div class="pack-label">
          MATERIAL PARA AFILIADOS
        </div>

        <h3 class="pack-title">
          ${escapar(p.name)}
        </h3>

        <div class="pack-channel">
          ${escapar(canal)}
        </div>

        <div class="pack-actions">

          ${
            p.source_url
              ? `
                <a
                  class="pack-button pack-button-primary"
                  href="${escapar(p.source_url)}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  📦 ABRIR PACK
                </a>
              `
              : `
                <span class="pack-button pack-button-disabled">
                  PACK INDISPONÍVEL
                </span>
              `
          }

        </div>

      </div>

    </article>
  `;
}

// ======================================================
// RENDER
// ======================================================

function renderizarProdutos(lista) {
  if (!productsGrid || modoDownload) return;

  const listaUnica = removerDuplicados(lista);

  if (!listaUnica.length) {
    productsGrid.innerHTML = "";

    if (emptyState) {
      emptyState.hidden = false;

      const titulo = emptyState.querySelector("h3");
      const texto = emptyState.querySelector("p");

      if (titulo) {
        titulo.textContent =
          filtroAtual === "packs"
            ? "Nenhum pack encontrado"
            : "Nenhum produto encontrado";
      }

      if (texto) {
        texto.textContent =
          nichoAtual !== "all"
            ? "Role a página para carregar mais produtos ou escolha outro nicho."
            : "Tente mudar sua pesquisa.";
      }
    }

    return;
  }

  if (emptyState) {
    emptyState.hidden = true;
  }

  productsGrid.innerHTML =
    listaUnica
      .map(p => {
        if (p.tipo === "pack") {
          return criarCardPack(p);
        }

        if (p.tipo === "zero") {
          return criarCardZero(p);
        }

        if (p.tipo === "momentum") {
          return criarCardMomentum(p);
        }

        return criarCardRanking(p);
      })
      .join("");

  ativarEventosCards();
}

// ======================================================
// EVENTOS DOS CARDS
// ======================================================

function ativarEventosCards() {
  document
    .querySelectorAll(".product-card, .pack-card")
    .forEach(card => {
      card.addEventListener("click", e => {
        if (e.target.closest("a,button,iframe")) {
          return;
        }

        const p = encontrarProduto(card.dataset.id);

        if (p) {
          abrirModal(p);
        }
      });
    });
}

function encontrarProduto(id) {
  return produtos.find(
    p => String(p.id) === String(id)
  );
}

// ======================================================
// MODAL
// ======================================================

function abrirModal(p) {
  if (!productModal || !modalBody) return;

  if (p.tipo === "pack") {
    const canal =
      p.source_channel
        ? `@${p.source_channel}`
        : "Fonte pública";

    modalBody.innerHTML = `
      <h2>📦 Pack para Afiliados</h2>

      <p
        style="
          margin:8px 0;
          color:#9299a8;
        "
      >
        ${escapar(canal)}
      </p>

      <div
        style="
          margin-top:12px;
          padding:14px;
          background:#11151f;
          border-radius:12px;
        "
      >

        <strong>📦 Material encontrado</strong>

        <p
          style="
            margin-top:8px;
            color:#b5bac5;
            line-height:1.5;
          "
        >
          Abra a publicação original
          para visualizar o conteúdo
          completo do pack.
        </p>

      </div>

      ${
        p.source_url
          ? `
            <a
              href="${escapar(p.source_url)}"
              target="_blank"
              rel="noopener noreferrer"
              style="
                display:block;
                margin-top:12px;
                padding:15px;
                text-align:center;
                background:#ff5a1f;
                color:#fff;
                border-radius:12px;
                text-decoration:none;
                font-weight:900;
              "
            >
              📦 ABRIR PACK
            </a>
          `
          : ""
      }
    `;

    productModal.hidden = false;
    return;
  }

  const link =
    p.affiliate_url ||
    p.product_url ||
    "";

  let extra = "";

  if (p.tipo === "momentum") {
    const topNumerico =
      p.momentum_posicao > 0
        ? Math.round(p.momentum_posicao)
        : null;

    extra = `
      <div
        style="
          margin-top:16px;
          padding:14px;
          background:#11151f;
          border-radius:12px;
        "
      >

        <strong>📊 Inteligência do Radar</strong>

        <p>
          🔥 Força agora:
          <strong>${Math.round(p.momentum_score)}/100</strong>
        </p>

        <p>
          📈 Tendência:
          <strong>${escapar(p.trend_nivel)}</strong>
        </p>

        <p>
          📈 Força da tendência:
          <strong>${Math.round(p.trend_score)}/100</strong>
        </p>

        <p>
          🛒 Vendas detectadas:
          <strong>
            ${
              numeroSeguro(p.vendas_confirmadas_24h) > 0
                ? "+"
                : ""
            }${formatarNumero(p.vendas_confirmadas_24h)}
          </strong>
        </p>

        <p>
          👀 Visto pelo Radar:
          <strong>
            ${formatarNumero(p.capturas_24h)} vezes
          </strong>
        </p>

        <p>
          📊 Posição encontrada:
          <strong>
            ${
              p.rank_atual > 0
                ? "#" + p.rank_atual
                : "Sem posição"
            }
          </strong>
        </p>

        <p>
          📍 Posição no Radar:
          <strong>
            ${
              topNumerico
                ? "#" + topNumerico
                : "Sem posição"
            }
          </strong>
        </p>

        <p>
          🏆 Destaque:
          <strong>
            ${
              topNumerico
                ? "TOP " + topNumerico
                : "Sem posição"
            }
          </strong>
        </p>

      </div>
    `;
  }

  if (p.tipo === "zero") {
    extra = `
      <div
        style="
          margin-top:16px;
          padding:14px;
          background:rgba(192,132,252,.07);
          border:1px solid rgba(192,132,252,.18);
          border-radius:12px;
        "
      >

        <strong>
          🎯 Estratégia de ranqueamento
        </strong>

        <p
          style="
            margin-top:8px;
            color:#b5bac5;
            line-height:1.5;
          "
        >
          Este produto está com 0 vendas
          totais registradas. A estratégia
          é publicar conteúdo cedo para
          tentar posicionar o vídeo antes
          de outros afiliados.
        </p>

        <p>
          Detectado pelo Radar:
          ${formatarNumero(p.times_seen)} vezes.
        </p>

      </div>
    `;
  }

  modalBody.innerHTML = `

    ${
      p.image_url
        ? `
          <img
            src="${escapar(p.image_url)}"
            alt="${escapar(p.name)}"
            style="
              width:100%;
              max-height:300px;
              object-fit:contain;
              border-radius:14px;
              margin-bottom:16px;
            "
          >
        `
        : ""
    }

    <h2>${escapar(p.name)}</h2>

    <p style="margin-top:8px">
      🏪 ${escapar(p.shop_name)}
    </p>

    <p style="margin-top:15px">
      <strong>Preço:</strong>
      ${dinheiro(p.price)}
    </p>

    <p>
      <strong>Vendidos:</strong>
      ${formatarNumero(p.sold_count)}
    </p>

    <p>
      <strong>Avaliação:</strong>
      ⭐ ${numeroSeguro(p.rating).toFixed(1)}
    </p>

    ${
      p.tipo === "momentum" &&
      p.commission_value > 0
        ? `
          <p>
            <strong>💰 Comissão:</strong>

            ${dinheiro(p.commission_value)}

            ${
              p.commission_rate > 0
                ? ` (${numeroSeguro(
                    p.commission_rate
                  ).toFixed(1)}%)`
                : ""
            }
          </p>
        `
        : ""
    }

    ${extra}

    ${
      link
        ? `
          <a
            href="${escapar(link)}"
            target="_blank"
            rel="noopener noreferrer"
            style="
              display:block;
              margin-top:12px;
              padding:15px;
              text-align:center;
              background:#ff5a1f;
              color:#fff;
              border-radius:12px;
              text-decoration:none;
              font-weight:800;
            "
          >
            🛒 Abrir na Shopee
          </a>
        `
        : ""
    }
  `;

  productModal.hidden = false;
}

function fecharModal() {
  if (productModal) {
    productModal.hidden = true;
  }
}

// ======================================================
// LOADING
// ======================================================

function mostrarLoading() {
  if (modoDownload) return;

  if (emptyState) {
    emptyState.hidden = true;
  }

  if (!productsGrid) return;

  productsGrid.innerHTML = `
    <div
      class="loading"
      style="grid-column:1/-1"
    >

      <div class="loader"></div>

      <p>
        ${
          filtroAtual === "packs"
            ? "Buscando packs..."
            : "Consultando Radar..."
        }
      </p>

    </div>
  `;
}

// ======================================================
// ERRO
// ======================================================

function mostrarErro(mensagem) {
  if (!productsGrid || modoDownload) return;

  productsGrid.innerHTML = `
    <div
      class="empty-state"
      style="
        display:block;
        grid-column:1/-1;
      "
    >

      <div>⚠️</div>

      <h3>Não foi possível carregar</h3>

      <p>${escapar(mensagem)}</p>

      <button
        id="retryRadarButton"
        type="button"
        style="
          margin-top:14px;
          padding:12px 16px;
          border:0;
          border-radius:10px;
          background:#ff5a1f;
          color:#fff;
          font-weight:800;
        "
      >
        Tentar novamente
      </button>

    </div>
  `;

  document
    .getElementById("retryRadarButton")
    ?.addEventListener(
      "click",
      reiniciarRadar
    );
}

// ======================================================
// REINICIAR
// ======================================================

function reiniciarRadar() {
  if (modoDownload) return;

  produtos = [];
  paginaAtual = 1;
  totalServidor = 0;
  resumoServidor = {};
  temProximaPagina = true;
  carregando = false;

  atualizarInterfaceModo();
  atualizarContadores([]);

  carregarProdutos(1, false);
}

// ======================================================
// DOWNLOAD — UTILIDADES
// ======================================================

function mostrarStatusVideo(
  mensagem,
  tipo = ""
) {
  if (!videoDownloadStatus) return;

  videoDownloadStatus.hidden = false;
  videoDownloadStatus.textContent = mensagem;

  videoDownloadStatus.classList.remove(
    "success",
    "error"
  );

  if (tipo) {
    videoDownloadStatus.classList.add(tipo);
  }
}

function esconderStatusVideo() {
  if (!videoDownloadStatus) return;

  videoDownloadStatus.hidden = true;
  videoDownloadStatus.textContent = "";

  videoDownloadStatus.classList.remove(
    "success",
    "error"
  );
}

function liberarObjectUrlAnterior() {
  if (videoLimpoObjectUrl) {
    try {
      URL.revokeObjectURL(
        videoLimpoObjectUrl
      );
    } catch {}

    videoLimpoObjectUrl = "";
  }
}

function limparResultadoVideo() {
  liberarObjectUrlAnterior();

  videoOriginalUrl = "";
  videoLimpoBlob = null;
  limpandoVideo = false;

  if (shopeeVideoPreview) {
    shopeeVideoPreview.pause();
    shopeeVideoPreview.removeAttribute("src");
    shopeeVideoPreview.load();
  }

  if (videoDownloadResult) {
    videoDownloadResult.hidden = true;
  }

  if (metadataCleanProgress) {
    metadataCleanProgress.hidden = true;
  }

  if (metadataCleanSuccess) {
    metadataCleanSuccess.hidden = true;
  }

  if (downloadCleanVideo) {
    downloadCleanVideo.hidden = true;
    downloadCleanVideo.removeAttribute("href");
    downloadCleanVideo.removeAttribute("download");
  }

  if (cleanVideoMetadata) {
    cleanVideoMetadata.disabled = false;
    delete cleanVideoMetadata.dataset.cleaned;
  }
}

function gerarNomeVideo() {
  let codigo = "";

  try {
    const bytes =
      new Uint8Array(5);

    crypto.getRandomValues(bytes);

    codigo =
      Array.from(bytes)
        .map(
          n =>
            n
              .toString(16)
              .padStart(2, "0")
        )
        .join("");
  } catch {
    codigo =
      Math.random()
        .toString(36)
        .slice(2, 12);
  }

  return `radar-video-${codigo}.mp4`;
}

async function carregarMediabunny() {
  if (!mediabunnyPromise) {
    mediabunnyPromise =
      import(MEDIABUNNY_MODULE)
        .catch(erro => {
          mediabunnyPromise = null;
          throw erro;
        });
  }

  return mediabunnyPromise;
}

// ======================================================
// DOWNLOAD — ABRIR / FECHAR ÁREA
// ======================================================

function abrirDownloader() {
  modoDownload = true;

  fecharModal();

  if (radarMainContent) {
    radarMainContent.hidden = true;
  }

  if (videoDownloaderPage) {
    videoDownloaderPage.hidden = false;
  }

  document
    .querySelectorAll(".bottom-item")
    .forEach(item => {
      item.classList.remove("active");
    });

  if (videoDownloaderNav) {
    videoDownloaderNav.classList.add("active");
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  setTimeout(() => {
    shopeeVideoLink?.focus();
  }, 250);
}

function sairDownloader() {
  modoDownload = false;

  if (videoDownloaderPage) {
    videoDownloaderPage.hidden = true;
  }

  if (radarMainContent) {
    radarMainContent.hidden = false;
  }
}

// ======================================================
// DOWNLOAD — BUSCAR ORIGINAL / HD
// ======================================================

async function buscarVideoShopee() {
  if (buscandoVideo) return;

  const link =
    shopeeVideoLink?.value
      ?.trim() || "";

  if (!link) {
    mostrarStatusVideo(
      "Cole primeiro o link do vídeo da Shopee.",
      "error"
    );

    shopeeVideoLink?.focus();
    return;
  }

  limparResultadoVideo();

  buscandoVideo = true;

  if (findShopeeVideo) {
    findShopeeVideo.disabled = true;
  }

  mostrarStatusVideo(
    "🔎 Procurando o vídeo Original / HD..."
  );

  try {
    const resposta =
      await fetch(
        SHOPEE_VIDEO_API,
        {
          method: "POST",

          headers: {
            Accept: "application/json",
            "Content-Type": "application/json"
          },

          body: JSON.stringify({
            url: link
          }),

          cache: "no-store"
        }
      );

    let dados;

    try {
      dados = await resposta.json();
    } catch {
      throw new Error(
        "A Netlify respondeu em um formato inválido."
      );
    }

    if (
      !resposta.ok ||
      dados.ok !== true ||
      dados.original_found !== true
    ) {
      throw new Error(
        dados.error ||
        "Vídeo Original/HD não encontrado."
      );
    }

    const url =
      dados.original_url ||
      dados.mp4 ||
      dados.media ||
      dados.variants?.[0]?.url ||
      "";

    if (!url) {
      throw new Error(
        "A V6.1 encontrou o vídeo, mas não devolveu a URL do MP4."
      );
    }

    videoOriginalUrl = url;

    if (shopeeVideoPreview) {
      shopeeVideoPreview.src =
        videoOriginalUrl;

      shopeeVideoPreview.load();
    }

    if (videoDownloadResult) {
      videoDownloadResult.hidden = false;
    }

    if (metadataCleanProgress) {
      metadataCleanProgress.hidden = true;
    }

    if (metadataCleanSuccess) {
      metadataCleanSuccess.hidden = true;
    }

    if (downloadCleanVideo) {
      downloadCleanVideo.hidden = true;
    }

    if (cleanVideoMetadata) {
      cleanVideoMetadata.disabled = false;
    }

    mostrarStatusVideo(
      "✅ Original / HD encontrado.",
      "success"
    );

    setTimeout(() => {
      videoDownloadResult
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
    }, 150);

  } catch (erro) {
    console.error(
      "Erro ao buscar vídeo:",
      erro
    );

    limparResultadoVideo();

    mostrarStatusVideo(
      erro instanceof Error
        ? erro.message
        : "Não foi possível encontrar o vídeo.",
      "error"
    );
  } finally {
    buscandoVideo = false;

    if (findShopeeVideo) {
      findShopeeVideo.disabled = false;
    }
  }
}

// ======================================================
// DOWNLOAD — LIMPEZA REAL DE METADADOS
// ======================================================

async function limparMetadadosVideo() {
  if (
    limpandoVideo ||
    !videoOriginalUrl
  ) {
    return;
  }

  limpandoVideo = true;

  liberarObjectUrlAnterior();
  videoLimpoBlob = null;

  if (cleanVideoMetadata) {
    cleanVideoMetadata.disabled = true;
  }

  if (downloadCleanVideo) {
    downloadCleanVideo.hidden = true;
    downloadCleanVideo.removeAttribute("href");
  }

  if (metadataCleanSuccess) {
    metadataCleanSuccess.hidden = true;
  }

  if (metadataCleanProgress) {
    metadataCleanProgress.hidden = false;
  }

  mostrarStatusVideo(
    "🧹 Preparando a limpeza local do vídeo..."
  );

  try {
    const respostaVideo =
      await fetch(
        videoOriginalUrl,
        {
          method: "GET",
          cache: "no-store"
        }
      );

    if (!respostaVideo.ok) {
      throw new Error(
        `Não foi possível ler o MP4 Original/HD. HTTP ${respostaVideo.status}.`
      );
    }

    const blobOriginal =
      await respostaVideo.blob();

    if (
      !blobOriginal ||
      blobOriginal.size <= 0
    ) {
      throw new Error(
        "O vídeo recebido está vazio."
      );
    }

    mostrarStatusVideo(
      "🧹 Limpando metadados no seu aparelho..."
    );

    const Mediabunny =
      await carregarMediabunny();

    const {
      Input,
      Output,
      Conversion,
      ALL_FORMATS,
      BlobSource,
      Mp4OutputFormat,
      BufferTarget
    } = Mediabunny;

    if (
      !Input ||
      !Output ||
      !Conversion ||
      !ALL_FORMATS ||
      !BlobSource ||
      !Mp4OutputFormat ||
      !BufferTarget
    ) {
      throw new Error(
        "Não foi possível carregar o limpador de metadados."
      );
    }

    const input =
      new Input({
        formats: ALL_FORMATS,
        source: new BlobSource(
          blobOriginal
        )
      });

    const target =
      new BufferTarget();

    const output =
      new Output({
        format:
          new Mp4OutputFormat(),

        target
      });

    const conversion =
      await Conversion.init({
        input,
        output,

        tracks: "all",

        tags: {}
      });

    if (!conversion.isValid) {
      console.error(
        "Faixas descartadas:",
        conversion.discardedTracks
      );

      throw new Error(
        "Este vídeo não pôde ser remontado mantendo suas faixas."
      );
    }

    conversion.onProgress =
      progress => {
        const porcentagem =
          Math.max(
            0,
            Math.min(
              100,
              Math.round(
                numeroSeguro(progress) *
                100
              )
            )
          );

        mostrarStatusVideo(
          `🧹 Limpando metadados... ${porcentagem}%`
        );
      };

    await conversion.execute();

    const buffer =
      target.buffer;

    if (
      !buffer ||
      buffer.byteLength <= 0
    ) {
      throw new Error(
        "A limpeza terminou, mas o novo MP4 ficou vazio."
      );
    }

    videoLimpoBlob =
      new Blob(
        [buffer],
        {
          type: "video/mp4"
        }
      );

    videoLimpoObjectUrl =
      URL.createObjectURL(
        videoLimpoBlob
      );

    const nomeArquivo =
      gerarNomeVideo();

    if (downloadCleanVideo) {
      downloadCleanVideo.href =
        videoLimpoObjectUrl;

      downloadCleanVideo.download =
        nomeArquivo;

      downloadCleanVideo.hidden =
        false;
    }

    if (metadataCleanProgress) {
      metadataCleanProgress.hidden =
        true;
    }

    if (metadataCleanSuccess) {
      metadataCleanSuccess.hidden =
        false;
    }

    if (cleanVideoMetadata) {
      cleanVideoMetadata.disabled =
        true;

      cleanVideoMetadata.dataset.cleaned =
        "true";
    }

    mostrarStatusVideo(
      "✅ Metadados limpos. O vídeo está pronto para baixar.",
      "success"
    );

    setTimeout(() => {
      downloadCleanVideo
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
    }, 150);

  } catch (erro) {
    console.error(
      "Erro ao limpar metadados:",
      erro
    );

    if (metadataCleanProgress) {
      metadataCleanProgress.hidden =
        true;
    }

    if (metadataCleanSuccess) {
      metadataCleanSuccess.hidden =
        true;
    }

    if (downloadCleanVideo) {
      downloadCleanVideo.hidden =
        true;
    }

    if (cleanVideoMetadata) {
      cleanVideoMetadata.disabled =
        false;

      delete cleanVideoMetadata
        .dataset.cleaned;
    }

    const mensagem =
      erro instanceof Error
        ? erro.message
        : String(erro);

    if (
      /failed to fetch|networkerror|load failed|cors/i
        .test(mensagem)
    ) {
      mostrarStatusVideo(
        "⚠️ O Original/HD foi encontrado, mas o navegador bloqueou a leitura direta do MP4. Será necessário ativar o proxy de transmissão da Netlify.",
        "error"
      );
    } else {
      mostrarStatusVideo(
        `⚠️ Não foi possível limpar o vídeo: ${mensagem}`,
        "error"
      );
    }

  } finally {
    limpandoVideo = false;
  }
}

// ======================================================
// DOWNLOAD — BAIXAR
// ======================================================

function prepararDownloadLimpo(event) {
  if (
    !videoLimpoBlob ||
    !videoLimpoObjectUrl
  ) {
    event?.preventDefault();

    mostrarStatusVideo(
      "Primeiro limpe os metadados do vídeo.",
      "error"
    );

    return;
  }
}

// ======================================================
// TROCAR FILTRO
// ======================================================

function trocarFiltro(filtro) {
  sairDownloader();

  if (filtro === "all") {
    filtro = "radar";
  }

  if (filtro === "videos") {
    filtro = "packs";
  }

  if (filtro === "favorites") {
    filtro = "packs";
  }

  filtroAtual = filtro;

  if (filtroAtual === "packs") {
    ordenacaoAtual = "recent";
  } else if (filtroAtual === "hot") {
    ordenacaoAtual = "sales";
  } else if (filtroAtual === "rating") {
    ordenacaoAtual = "rating";
  } else if (filtroAtual === "zero") {
    ordenacaoAtual = "recent";
  } else {
    ordenacaoAtual = "relevance";
  }

  document
    .querySelectorAll(
      "[data-filter]:not(.bottom-item)"
    )
    .forEach(b => {
      b.classList.toggle(
        "active",
        b.dataset.filter === filtroAtual
      );
    });

  document
    .querySelectorAll(".bottom-item")
    .forEach(b => {
      const valor = b.dataset.filter;

      b.classList.toggle(
        "active",
        (
          filtroAtual === "radar" &&
          (
            valor === "all" ||
            valor === "radar"
          )
        ) ||
        valor === filtroAtual
      );
    });

  document
    .querySelectorAll("[data-sort]")
    .forEach(b => {
      b.classList.toggle(
        "active",
        b.dataset.sort === ordenacaoAtual
      );
    });

  reiniciarRadar();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

// ======================================================
// ABAS
// ======================================================

document
  .querySelectorAll("[data-filter]")
  .forEach(botao => {
    botao.addEventListener(
      "click",
      () => {
        trocarFiltro(
          botao.dataset.filter
        );
      }
    );
  });

// ======================================================
// BOTÃO BAIXAR VÍDEO
// ======================================================

if (videoDownloaderNav) {
  videoDownloaderNav.addEventListener(
    "click",
    abrirDownloader
  );
}

// ======================================================
// BUSCAR VÍDEO SHOPEE
// ======================================================

if (findShopeeVideo) {
  findShopeeVideo.addEventListener(
    "click",
    buscarVideoShopee
  );
}

if (shopeeVideoLink) {
  shopeeVideoLink.addEventListener(
    "keydown",
    event => {
      if (event.key === "Enter") {
        event.preventDefault();
        buscarVideoShopee();
      }
    }
  );
}

// ======================================================
// LIMPAR METADADOS
// ======================================================

if (cleanVideoMetadata) {
  cleanVideoMetadata.addEventListener(
    "click",
    limparMetadadosVideo
  );
}

// ======================================================
// DOWNLOAD FINAL
// ======================================================

if (downloadCleanVideo) {
  downloadCleanVideo.addEventListener(
    "click",
    prepararDownloadLimpo
  );
}

// ======================================================
// ORDENAÇÃO
// ======================================================

document
  .querySelectorAll("[data-sort]")
  .forEach(botao => {
    botao.addEventListener(
      "click",
      () => {
        if (modoDownload) return;

        ordenacaoAtual =
          botao.dataset.sort ||
          "relevance";

        document
          .querySelectorAll("[data-sort]")
          .forEach(i => {
            i.classList.toggle(
              "active",
              i === botao
            );
          });

        if (filtroAtual === "zero") {
          reiniciarRadar();
        } else {
          aplicarOrdenacao();
        }
      }
    );
  });

// ======================================================
// BUSCA
// ======================================================

if (searchInput) {
  searchInput.addEventListener(
    "keydown",
    event => {
      if (modoDownload) return;

      if (event.key === "Enter") {
        buscaDigitada =
          searchInput.value.trim();

        if (filtroAtual === "zero") {
          reiniciarRadar();
        } else {
          aplicarOrdenacao();
        }
      }
    }
  );

  searchInput.addEventListener(
    "search",
    () => {
      if (modoDownload) return;

      if (!searchInput.value) {
        buscaDigitada = "";

        if (filtroAtual === "zero") {
          reiniciarRadar();
        } else {
          aplicarOrdenacao();
        }
      }
    }
  );
}

// ======================================================
// NICHO
// ======================================================

if (categoryFilter) {
  categoryFilter.addEventListener(
    "change",
    () => {
      if (modoDownload) return;

      nichoAtual =
        categoryFilter.value;

      aplicarOrdenacao();
    }
  );
}

// ======================================================
// SCROLL INFINITO
// ======================================================

async function carregarProximaPagina() {
  if (
    modoDownload ||
    carregando ||
    !temProximaPagina
  ) {
    return;
  }

  await carregarProdutos(
    paginaAtual + 1,
    true
  );
}

window.addEventListener(
  "scroll",
  () => {
    if (
      modoDownload ||
      carregando ||
      !temProximaPagina
    ) {
      return;
    }

    const chegouPertoDoFim =
      window.innerHeight +
      window.scrollY >=
      document.documentElement
        .scrollHeight -
      900;

    if (chegouPertoDoFim) {
      carregarProximaPagina();
    }
  },
  {
    passive: true
  }
);

// ======================================================
// ATUALIZAÇÃO SILENCIOSA
// ======================================================

setInterval(
  () => {
    if (
      !modoDownload &&
      document.visibilityState === "visible" &&
      paginaAtual === 1 &&
      !carregando
    ) {
      carregarProdutos(
        1,
        false
      );
    }
  },
  2 * 60 * 1000
);

// ======================================================
// MODAL
// ======================================================

if (closeModal) {
  closeModal.addEventListener(
    "click",
    fecharModal
  );
}

if (productModal) {
  productModal
    .querySelector(".modal-overlay")
    ?.addEventListener(
      "click",
      fecharModal
    );
}

document.addEventListener(
  "keydown",
  e => {
    if (
      e.key === "Escape" &&
      productModal &&
      !productModal.hidden
    ) {
      fecharModal();
    }
  }
);

// ======================================================
// LIMPEZA DE MEMÓRIA AO SAIR DA PÁGINA
// ======================================================

window.addEventListener(
  "pagehide",
  () => {
    liberarObjectUrlAnterior();

    videoLimpoBlob = null;
    videoOriginalUrl = "";
  }
);

window.addEventListener(
  "beforeunload",
  () => {
    liberarObjectUrlAnterior();

    videoLimpoBlob = null;
    videoOriginalUrl = "";
  }
);

// ======================================================
// INICIALIZAÇÃO
// ======================================================

filtroAtual = "radar";
ordenacaoAtual = "relevance";
modoDownload = false;

if (videoDownloaderPage) {
  videoDownloaderPage.hidden = true;
}

if (radarMainContent) {
  radarMainContent.hidden = false;
}

reiniciarRadar();
