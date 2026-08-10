/** Importação de cardápio via CSV ou XML. */

export interface ImportedProduct {
  name: string;
  category: string | null;
  description: string | null;
  emoji: string | null;
  price_cents: number;
  prep_minutes: number;
  stock: number | null;
  available: boolean;
}

export interface ParseResult {
  rows: ImportedProduct[];
  errors: string[];
}

export const CSV_TEMPLATE = [
  "nome,categoria,descricao,emoji,preco,preparo_min,estoque,disponivel",
  "Chopp Pilsen,Cervejas,Copo 300ml,🍺,14.90,0,,sim",
  "Batata rústica,Comidas,Porção com alecrim,🍟,32.00,15,20,sim",
].join("\n");

export const XML_TEMPLATE = `<cardapio>
  <produto>
    <nome>Chopp Pilsen</nome>
    <categoria>Cervejas</categoria>
    <descricao>Copo 300ml</descricao>
    <emoji>🍺</emoji>
    <preco>14.90</preco>
    <preparo_min>0</preparo_min>
    <estoque></estoque>
    <disponivel>sim</disponivel>
  </produto>
</cardapio>`;

const FIELD_ALIASES: Record<keyof ImportedProduct | "price" , string[]> = {
  name: ["nome", "name", "produto", "product", "titulo", "título"],
  category: ["categoria", "category", "grupo", "secao", "seção"],
  description: ["descricao", "descrição", "description", "detalhe"],
  emoji: ["emoji", "icone", "ícone", "icon"],
  price_cents: ["preco_centavos", "price_cents"],
  price: ["preco", "preço", "price", "valor", "valor_unitario"],
  prep_minutes: ["preparo_min", "preparo", "prep_minutes", "tempo", "tempo_preparo"],
  stock: ["estoque", "stock", "quantidade", "qtd"],
  available: ["disponivel", "disponível", "available", "ativo"],
};

function normalizeKey(key: string) {
  return key
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function pick(record: Record<string, string>, field: keyof typeof FIELD_ALIASES) {
  for (const alias of FIELD_ALIASES[field]) {
    const value = record[normalizeKey(alias)];
    if (value !== undefined && value !== "") return value;
  }
  return "";
}

function parsePriceToCents(raw: string) {
  const cleaned = raw.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return NaN;
  // "1.234,56" -> ponto é separador de milhar; "1234.56" -> ponto é decimal
  const normalized =
    cleaned.includes(",") && cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "");
  const value = Number(normalized);
  if (!Number.isFinite(value)) return NaN;
  return Math.round(value * 100);
}

function parseBool(raw: string, fallback = true) {
  const value = normalizeKey(raw);
  if (!value) return fallback;
  return !["nao", "no", "false", "0", "inativo", "off"].includes(value);
}

function toProduct(record: Record<string, string>, line: number, errors: string[]): ImportedProduct | null {
  const name = pick(record, "name").trim();
  if (!name) {
    errors.push(`Linha ${line}: nome do produto ausente`);
    return null;
  }
  const centsField = pick(record, "price_cents");
  const cents = centsField ? Math.round(Number(centsField)) : parsePriceToCents(pick(record, "price"));
  if (!Number.isFinite(cents) || cents <= 0) {
    errors.push(`Linha ${line} (${name}): preço inválido`);
    return null;
  }
  const prep = Number(pick(record, "prep_minutes").replace(/[^\d]/g, ""));
  const stockRaw = pick(record, "stock").replace(/[^\d]/g, "");

  return {
    name,
    category: pick(record, "category").trim() || null,
    description: pick(record, "description").trim() || null,
    emoji: pick(record, "emoji").trim() || null,
    price_cents: cents,
    prep_minutes: Number.isFinite(prep) ? prep : 0,
    stock: stockRaw === "" ? null : Number(stockRaw),
    available: parseBool(pick(record, "available")),
  };
}

/** Divide uma linha de CSV respeitando aspas e delimitador , ou ; */
function splitCsvLine(line: string, delimiter: string) {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      out.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  out.push(current);
  return out.map((value) => value.trim());
}

export function parseMenuCsv(text: string): ParseResult {
  const errors: string[] = [];
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");
  if (lines.length < 2) return { rows: [], errors: ["Arquivo vazio ou sem linhas de produto"] };

  const header = lines[0];
  const delimiter = (header?.match(/;/g)?.length ?? 0) > (header?.match(/,/g)?.length ?? 0) ? ";" : ",";
  const keys = splitCsvLine(header ?? "", delimiter).map(normalizeKey);

  const rows: ImportedProduct[] = [];
  lines.slice(1).forEach((line, index) => {
    const values = splitCsvLine(line, delimiter);
    const record: Record<string, string> = {};
    keys.forEach((key, position) => {
      record[key] = values[position] ?? "";
    });
    const product = toProduct(record, index + 2, errors);
    if (product) rows.push(product);
  });

  return { rows, errors };
}

export function parseMenuXml(text: string): ParseResult {
  const errors: string[] = [];
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) return { rows: [], errors: ["XML inválido"] };

  const candidates = ["produto", "product", "item", "prod"];
  let nodes: Element[] = [];
  for (const tag of candidates) {
    const found = Array.from(doc.getElementsByTagName(tag));
    if (found.length > nodes.length) nodes = found;
  }
  if (nodes.length === 0) {
    const root = doc.documentElement;
    nodes = Array.from(root?.children ?? []);
  }
  if (nodes.length === 0) return { rows: [], errors: ["Nenhum produto encontrado no XML"] };

  const rows: ImportedProduct[] = [];
  nodes.forEach((node, index) => {
    const record: Record<string, string> = {};
    Array.from(node.attributes).forEach((attribute) => {
      record[normalizeKey(attribute.name)] = attribute.value.trim();
    });
    Array.from(node.children).forEach((child) => {
      record[normalizeKey(child.tagName)] = (child.textContent ?? "").trim();
    });
    const product = toProduct(record, index + 1, errors);
    if (product) rows.push(product);
  });

  return { rows, errors };
}

export function parseMenuFile(fileName: string, text: string): ParseResult {
  const isXml = /\.xml$/i.test(fileName) || text.trim().startsWith("<");
  return isXml ? parseMenuXml(text) : parseMenuCsv(text);
}

export function downloadTemplate(kind: "csv" | "xml") {
  const content = kind === "csv" ? CSV_TEMPLATE : XML_TEMPLATE;
  const blob = new Blob([content], {
    type: kind === "csv" ? "text/csv;charset=utf-8" : "application/xml;charset=utf-8",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `modelo-cardapio.${kind}`;
  link.click();
  URL.revokeObjectURL(link.href);
}
