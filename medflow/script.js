let baseImage = null;
let baseImageLoaded = false;
let contatos = [];
let valoresCalculados = [];

// --- ETAPA 1: CONTATOS ---
function adicionarLinhaTabela(telefone, nome, valor) {
  const valorNum = parseFloat(valor);
  if (!nome || !telefone || isNaN(valorNum)) return;
  contatos.push({ telefone, nome, valor: valorNum });
  atualizarTabelaContatos();
}

function atualizarTabelaContatos() {
  const tbody = document.querySelector("#tabela tbody");
  tbody.innerHTML = "";
  contatos.forEach((contato, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${contato.nome}</td>
      <td>${contato.telefone}</td>
      <td>R$ ${contato.valor.toFixed(2)}</td>
      <td><button type="button" class="removerContato" data-idx="${idx}">-</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function limparInputsNovoContato() {
  document.getElementById("novoTelefone").value = "";
  document.getElementById("novoNome").value = "";
  document.getElementById("novoValor").value = "";
}

// CSV
document.getElementById("csvFile").addEventListener("change", function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(event) {
    const linhas = event.target.result.split("\n").map(l => l.trim()).filter(l => l);
    contatos = [];
    linhas.forEach((linha, i) => {
      if (i === 0 && (linha.toLowerCase().includes("telefone") || linha.toLowerCase().includes("nome"))) return;
      const [nome, telefone, valorStr] = linha.split(",");
      adicionarLinhaTabela(telefone, nome, valorStr);
    });
    atualizarTabelaContatos();
  };
  reader.readAsText(file);
});

// Adicionar contato manualmente
document.getElementById("adicionarContato").addEventListener("click", function() {
  const telefone = document.getElementById("novoTelefone").value.trim();
  const nome = document.getElementById("novoNome").value.trim();
  const valor = document.getElementById("novoValor").value.trim();
  adicionarLinhaTabela(telefone, nome, valor);
  limparInputsNovoContato();
});

// Remover contato
document.querySelector("#tabela tbody").addEventListener("click", function(e) {
  if (e.target.classList.contains("removerContato")) {
    const idx = parseInt(e.target.dataset.idx);
    contatos.splice(idx, 1);
    atualizarTabelaContatos();
  }
});

// Avançar para etapa 2
document.getElementById("avancar1").addEventListener("click", function() {
  if (contatos.length === 0) {
    alert("Adicione pelo menos um contato.");
    return;
  }
  document.getElementById("etapa1").style.display = "none";
  document.getElementById("etapa2").style.display = "block";
});

// --- ETAPA 2: DADOS DO EMPRÉSTIMO ---
function calcularValorJuros(valor, juros) {
  return valor - (valor * juros);
}

document.getElementById("formEmprestimo").addEventListener("submit", function(e) {
  e.preventDefault();
  // Validar campos
  const juros = parseFloat(document.getElementById("juros").value) / 100;
  const dataDesembolso = document.getElementById("dataDesembolso").value;
  const dataPagamento = document.getElementById("dataPagamento").value;
  const empresa = document.getElementById("empresa").value.trim();
  if (isNaN(juros) || !dataDesembolso || !dataPagamento || !empresa) {
    alert("Preencha todos os campos do empréstimo.");
    return;
  }
  // Calcular valores
  valoresCalculados = contatos.map(c => {
    const valorDesembolso = calcularValorJuros(c.valor, juros);
    return {
      ...c,
      valorPlantao: c.valor,
      valorDesembolso: valorDesembolso,
      dataDesembolso,
      dataPagamento,
      empresa,
      juros: (juros * 100)
    };
  });
  atualizarTabelaValores();
  document.getElementById("etapa2").style.display = "none";
  document.getElementById("etapa3").style.display = "block";
  enableGerarBtn();
});

// --- ETAPA 3: CONFIRMAR/EDITAR VALORES ---
function atualizarTabelaValores() {
  const tbody = document.querySelector("#tabelaValores tbody");
  tbody.innerHTML = "";
  valoresCalculados.forEach((item, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="text" value="${item.nome}" class="editNome" data-idx="${idx}" style="width:120px"></td>
      <td><input type="text" value="${item.telefone}" class="editTelefone" data-idx="${idx}" style="width:110px"></td>
      <td><input type="number" value="${item.valorPlantao.toFixed(2)}" class="editValorPlantao" data-idx="${idx}" step="0.01" min="0" style="width:90px"></td>
      <td><input type="number" value="${item.valorDesembolso.toFixed(2)}" class="editValorDesembolso" data-idx="${idx}" step="0.01" min="0" style="width:90px"></td>
    `;
    tbody.appendChild(tr);
  });
}

// Editar valores na tabela
document.querySelector("#tabelaValores tbody").addEventListener("input", function(e) {
  const idx = parseInt(e.target.dataset.idx);
  if (e.target.classList.contains("editTelefone")) valoresCalculados[idx].telefone = e.target.value;
  if (e.target.classList.contains("editNome")) valoresCalculados[idx].nome = e.target.value;
  if (e.target.classList.contains("editValorPlantao")) valoresCalculados[idx].valorPlantao = parseFloat(e.target.value);
  if (e.target.classList.contains("editValorDesembolso")) valoresCalculados[idx].valorDesembolso = parseFloat(e.target.value);
});

// Remover linha na etapa 3
document.querySelector("#tabelaValores tbody").addEventListener("click", function(e) {
  if (e.target.classList.contains("removerValor")) {
    const idx = parseInt(e.target.dataset.idx);
    valoresCalculados.splice(idx, 1);
    atualizarTabelaValores();
    enableGerarBtn();
  }
});

// Habilitar botão de gerar imagens
function enableGerarBtn() {
  document.getElementById("gerar").disabled = !(baseImageLoaded && valoresCalculados.length > 0);
}

// Avançar da etapa 3 para etapa 4
document.getElementById("avancar3").addEventListener("click", function() {
  document.getElementById("etapa3").style.display = "none";
  document.getElementById("etapa4").style.display = "block";
});

// --- GERAR IMAGENS E AVANÇAR PARA ETAPA 5 ---
document.getElementById("gerar").addEventListener("click", function(e) {
  e.preventDefault();
  if (!baseImageLoaded) {
    alert("Por favor, aguarde o carregamento da imagem base.");
    return;
  }

  // Salvar imagens geradas para uso posterior na etapa 5
  window.imagensGeradas = [];
  valoresCalculados.forEach((item, idx) => {
    // Criar canvas
    const prazoDias = calcularPrazoDias(item.dataDesembolso, item.dataPagamento);
    const mes = obterMesExtenso(item.dataDesembolso);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = baseImage.width;
    canvas.height = baseImage.height;
    ctx.drawImage(baseImage, 0, 0);

    ctx.font = "1.2rem sans-serif";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // === Ajustar posições de acordo com a tabela no template ===
    ctx.fillText(formatarDinheiroBR(item.valorPlantao), canvas.width * 0.38, canvas.height * 0.45);      // Valor total dos serviços
    ctx.fillText(prazoDias, canvas.width * 0.88, canvas.height * 0.45);      // Prazo antecipado
    ctx.fillText(formatarDinheiroBR(item.valorDesembolso), canvas.width * 0.38, canvas.height * 0.58);    // Receber agora
    ctx.fillText(formatarDataBR(item.dataDesembolso), canvas.width * 0.88, canvas.height * 0.58);    // Data de antecipação
    ctx.fillText(mes, canvas.width * 0.38, canvas.height * 0.71);        // Mês do serviço
    ctx.fillText(formatarDataBR(item.dataPagamento), canvas.width * 0.88, canvas.height * 0.71);   // Data de quitação
    const imgURL = canvas.toDataURL("image/jpeg");
    // Salvar imagem e canvas para etapa 5
    window.imagensGeradas[idx] = { imgURL, canvas };
  });

  // Gerar mensagens personalizadas e mostrar etapa 5
  const template = document.getElementById("template-msg").value;
  const resultados = document.getElementById("resultados");
  resultados.innerHTML = "";
  valoresCalculados.forEach((item, idx) => {
    // Montar variáveis para template
    const prazoDias = calcularPrazoDias(item.dataDesembolso, item.dataPagamento);
    const mes = obterMesExtenso(item.dataDesembolso);
    const mensagem = template
      .replace(/{{\s*nome\s*}}/gi, item.nome)
      .replace(/{{\s*valor_plantao\s*}}/gi, formatarDinheiroBR(item.valorPlantao))
      .replace(/{{\s*valor_desembolso\s*}}/gi, formatarDinheiroBR(item.valorDesembolso))
      .replace(/{{\s*prazo_dias\s*}}/gi, prazoDias)
      .replace(/{{\s*data_desembolso\s*}}/gi, formatarDataBR(item.dataDesembolso))
      .replace(/{{\s*data_pagamento\s*}}/gi, formatarDataBR(item.dataPagamento))
      .replace(/{{\s*taxa_juros\s*}}/gi, `${item.juros}%`)
      .replace(/{{\s*empresa\s*}}/gi, item.empresa)
      .replace(/{{\s*mes\s*}}/gi, mes);
    // Codificar mensagem para URL do WhatsApp
    const mensagemEncoded = encodeURIComponent(mensagem);
    // Normalizar telefone (remover espaços, parênteses, traços)
    let telefoneLimpo = item.telefone.replace(/\D/g, "");
    if (!telefoneLimpo.startsWith("55")) telefoneLimpo = "55" + telefoneLimpo;
    const waLink = `https://wa.me/+${telefoneLimpo}?text=${mensagemEncoded}`;
    const waLinkOld = `https://api.whatsapp.com/send/?phone=${telefoneLimpo}&text=${mensagemEncoded}`;
    const div = document.createElement("div");
    div.style.marginBottom = "18px";
    div.innerHTML = `
      <b>${item.nome} (${item.telefone})</b>
      <textarea readonly style="width:0;height:0;padding:0;margin:0;border:none;opacity:0;position:absolute;">${mensagem}</textarea>
      <button onclick="copiarImagemEtapa5(${idx}, this)">Copiar imagem</button>
      <a href="${waLinkOld}" target="_blank">Enviar no WhatsApp</a>
    `;
    resultados.appendChild(div);
  });

// Função global para copiar imagem do canvas para o clipboard
window.copiarImagemEtapa5 = async function(idx, btn) {
  try {
    const canvas = window.imagensGeradas[idx].canvas;
    canvas.toBlob(async function(blob) {
      try {
        await navigator.clipboard.write([
          new window.ClipboardItem({ [blob.type]: blob })
        ]);
        btn.textContent = 'Imagem copiada!';
        setTimeout(() => { btn.textContent = 'Copiar imagem'; }, 2000);
      } catch (err) {
        alert('Não foi possível copiar a imagem. Seu navegador pode não suportar esta função.');
      }
    }, 'image/png');
  } catch (e) {
    alert('Erro ao copiar imagem.');
  }
}
  document.getElementById("etapa4").style.display = "none";
  document.getElementById("etapa5").style.display = "block";
});

// Função para calcular diferença de dias entre duas datas (YYYY-MM-DD)
function calcularPrazoDias(data1, data2) {
  try {
    const d1 = new Date(data1);
    const d2 = new Date(data2);
    const diff = Math.abs(d2 - d1);
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  } catch {
    return '';
  }
}

// Função para obter mês por extenso (em português)
function obterMesExtenso(data) {
  try {
    const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    const d = new Date(data);
    return meses[d.getMonth()];
  } catch {
    return '';
  }
}

function formatarDataBR(dataISO) {
  if (!dataISO) return "";
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarDinheiroBR(valor) {
  return "R$ " + valor.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ".").replace(".", ",");
}

// --- INICIALIZAÇÃO ---
onload = function() {
  document.getElementById("template-msg").value = `Como está, {{nome}}?

Seu fechamento de {{mes}} da {{empresa}} está disponível para recebimento.

Valor total: {{valor_plantao}}
Data original: {{data_pagamento}}
*Receber agora: {{valor_desembolso}}*

Caso deseje receber ainda hoje é só responder essa mensagem.
Agradecemos a atenção e estamos a disposição 🙏
`;

  baseImage = document.getElementById("baseImage");
  baseImage.onload = function() {
    baseImageLoaded = true;
    enableGerarBtn();
  };
  if (baseImage.complete) {
    baseImageLoaded = true;
    enableGerarBtn();
  }
  // Preencher datas padrão
  const hoje = new Date();
  document.getElementById("dataDesembolso").valueAsDate = hoje;
  document.getElementById("dataPagamento").valueAsDate = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 30);
}