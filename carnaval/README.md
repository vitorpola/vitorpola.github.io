# Carnaval de Marchinhas 2026 — São Luiz do Paraitinga

Website estático com a programação oficial do Carnaval de Marchinhas 2026 em São Luiz do Paraitinga, SP.

## Estrutura do projeto

```
carnaval/
├── index.html       # Página principal
├── css/
│   └── styles.css   # Estilos mobile-first
├── js/
│   └── app.js      # Carregamento, agrupamento e busca
├── data/
│   └── programacao.json  # Dados da programação
└── README.md
```

## Publicar no GitHub Pages

### Opção 1: Site na raiz do repositório

Se o repositório `vitorpola.github.io` já tiver outros projetos em subpastas:

1. Acesse **Settings** → **Pages** no GitHub.
2. Em **Source**, escolha **Deploy from a branch**.
3. Selecione a branch `main` (ou `master`).
4. Em **Folder**, escolha **/ (root)**.
5. Salve.

O site ficará em `https://vitorpola.github.io/`. Para acessar o Carnaval, use:

- `https://vitorpola.github.io/carnaval/`

### Opção 2: Site apenas na pasta carnaval

Se quiser que o GitHub Pages sirva somente a pasta `carnaval` como raiz:

1. Crie uma branch separada (ex.: `gh-pages`) com apenas o conteúdo de `carnaval`.
2. Ou use um repositório dedicado para o Carnaval e faça o deploy da pasta `carnaval` como raiz do site.

### Comandos para publicar

```bash
# Adicionar e commitar alterações
git add carnaval/
git commit -m "Atualiza site do Carnaval 2026"
git push origin main
```

Após o push, o GitHub Pages atualiza em alguns minutos. A URL será:

- `https://vitorpola.github.io/carnaval/`

### Paths relativos

Os links para `data/`, `css/` e `js/` usam caminhos relativos. Eles funcionam corretamente tanto em `file://` (abrir localmente) quanto em `https://vitorpola.github.io/carnaval/`.

## Rodar localmente

Abra o arquivo `index.html` no navegador ou use um servidor local:

```bash
# Servidor Node (simula GitHub Pages)
node server.js 3000
# Acesse: http://localhost:3000/carnaval/

# Python 3
python3 -m http.server 8000

# Node (npx)
npx serve carnaval
```

Depois acesse `http://localhost:3000/carnaval/` (ou a porta indicada).

## Tecnologias

- HTML5, CSS3, JavaScript puro
- Sem dependências externas
- Site 100% estático, compatível com GitHub Pages

## Funcionalidades

- Programação agrupada por dia
- Subdivisão visual entre blocos e shows
- Busca em tempo real por nome de bloco, show ou data
- Layout mobile-first, inspirado nas artes oficiais do evento
