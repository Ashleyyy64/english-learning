import { PrismaClient } from "@prisma/client";
import { execFileSync } from "child_process";
import { createReadStream, existsSync, mkdirSync } from "fs";
import { createInterface } from "readline";
import path from "path";

const prisma = new PrismaClient();

// 词书数据目录：默认 ./dictionary-data，可用环境变量 DICTIONARY_DATA_DIR 覆盖
const DATA_DIR = process.env.DICTIONARY_DATA_DIR || path.join(process.cwd(), "dictionary-data");

const MANUAL_TRANSLATIONS: Record<string, string> = {
  "figure": "n.数字；人物；身材；图形 / v.计算；认为",
  "mistake": "n.错误；误会 / v.弄错；误解",
  "law": "n.法律；规律；法则",
  "Christ": "n.基督；耶稣",
  "judge": "n.法官；裁判 / v.判断；审判",
  "gas": "n.气体；汽油；煤气",
  "bite": "v.咬；叮 / n.咬；一口",
  "cat": "n.猫",
  "Christmas": "n.圣诞节",
  "Saturday": "n.星期六",
  "Friday": "n.星期五",
  "heat": "n.热；热量 / v.加热",
  "indeed": "adv.确实；真正地",
  "Sunday": "n.星期日",
  "appointment": "n.约会；预约；任命",
  "Monday": "n.星期一",
  "post": "n.邮政；岗位；帖子 / v.邮寄；发布",
  "rat": "n.老鼠",
  "defense": "n.防御；辩护",
  "storm": "n.暴风雨 / v.猛攻",
  "lake": "n.湖",
  "Thursday": "n.星期四",
  "Tuesday": "n.星期二",
  "soup": "n.汤",
  "hug": "v.拥抱 / n.拥抱",
  "describe": "v.描述；形容",
  "basic": "adj.基本的；基础的",
  "Wednesday": "n.星期三",
  "toy": "n.玩具",
  "expression": "n.表达；表情；短语",
  "mud": "n.泥",
  "June": "n.六月",
  "tub": "n.浴盆；桶",
  "April": "n.四月",
  "July": "n.七月",
  "Christian": "n.基督徒 / adj.基督教的",
  "collar": "n.衣领；项圈",
  "misery": "n.痛苦；悲惨",
  "ink": "n.墨水",
  "Thanksgiving": "n.感恩节",
  "conscious": "adj.有意识的；意识到的",
  "mug": "n.马克杯 / v.抢劫",
  "December": "n.十二月",
  "flu": "n.流感",
  "January": "n.一月",
  "bee": "n.蜜蜂",
  "deer": "n.鹿",
  "August": "n.八月",
  "Latin": "n.拉丁语 / adj.拉丁的",
  "September": "n.九月",
  "Catholic": "adj.天主教的 / n.天主教徒",
  "October": "n.十月",
  "dip": "v.浸；蘸 / n.下降",
  "November": "n.十一月",
  "February": "n.二月",
  "chap": "n.家伙；小伙子",
  "Easter": "n.复活节",
  "sip": "v.小口喝 / n.一小口",
  "ape": "n.猿",
  "activate": "v.激活；使活动",
  "rib": "n.肋骨",
  "hay": "n.干草",
  "tailor": "n.裁缝 / v.定制",
  "marvellous": "adj.极好的；非凡的",
  "Negro": "n.黑人（旧称）",
  "tumor": "n.肿瘤",
  "pea": "n.豌豆",
  "paw": "n.爪子",
  "adequate": "adj.足够的；适当的",
  "ant": "n.蚂蚁",
  "freelance": "adj.自由职业的 / v.做自由职业",
  "enquire": "v.询问；打听",
  "so-called": "adj.所谓的",
  "Marxist": "adj.马克思主义的 / n.马克思主义者",
  "up-to-date": "adj.最新的；现代的",
  "well-known": "adj.著名的",
  "X-ray": "n.X射线 / v.用X射线检查",
  "kilo": "n.千克；公斤",
  "accommodations": "n.住宿；膳宿",
  "blog": "n.博客 / v.写博客",
  "pave": "v.铺路；铺设",
  "intrinsic": "adj.内在的；固有的",
  "inclusive": "adj.包括的；包容的",
  "minimise": "v.使最小化；减少",
  "emphasise": "v.强调",
  "van": "n.厢式货车",
  "ice-cream": "n.冰淇淋",
  "Internet": "n.互联网",
  "May": "n.五月",
  "OK": "adj.好的；可以",
  "O.K.": "adj.好的；可以",
  "TV": "n.电视",
  "March": "n.三月",
  "e-mail": "n.电子邮件 / v.发电子邮件",
  "according to": "prep.根据；按照",
  "café": "n.咖啡馆",
  "per cent": "n.百分之…",
  "axis": "n.轴；轴线",
  "instal": "v.安装",
  "air-conditioning": "n.空调",
  "pope": "n.教皇",
  "living-room": "n.客厅",
  "watt": "n.瓦特",
  "by-pass": "n.旁路；绕道 / v.绕过",
  "grown-up": "n.成年人 / adj.成年的",
  "statical": "adj.静态的",
  "normalisation": "n.正常化；标准化",
  "indexes": "n.索引（复数）",
  "o'clock": "adv.…点钟",
  "could": "aux.能够；可能；可以",
  "fell": "v.击倒；砍伐 / n.兽皮",
  "hysterical": "adj.歇斯底里的；情绪失控的",
  "laptop": "n.笔记本电脑",
  "theoretical": "adj.理论的；理论上的",
  "stationary": "adj.静止的；固定的",
  "antenna": "n.天线；触角",
  "inhibit": "v.抑制；阻止",
  "retention": "n.保留；保持；记忆",
  "waggon": "n.四轮运货马车；货车车厢",
  "formulae": "n.公式（formula的复数）",
  "geese": "n.鹅（goose的复数）",
};

// ---------- 流式 CSV 解析（支持引号包裹、逗号转义 "" 、CRLF） ----------
// 逐行读取、逐行产出，避免一次性把整个文件读进内存（100 万行关系表会导致 OOM）。
function detectDelimiter(firstLine: string): string {
  const candidates = [">", "\t", ","];
  let best = ",";
  let bestCount = -1;
  for (const candidate of candidates) {
    const count = firstLine.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

// 将一行 CSV 文本按分隔符解析为字段数组（支持双引号包裹与 "" 转义）
function parseCsvLine(line: string, sep: string): string[] {
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === sep) {
      fields.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

// 流式遍历 CSV：对每一行（非空）调用 handler，传入由 header 映射成的对象。
// 首行自动识别分隔符并作为表头。
async function forEachCsvRow(
  filePath: string,
  handler: (row: Record<string, string>) => void | Promise<void>,
): Promise<void> {
  if (!existsSync(filePath)) {
    throw new Error(`缺少文件：${filePath}`);
  }

  const reader = createInterface({
    input: createReadStream(filePath, "utf-8"),
    crlfDelay: Infinity,
  });

  let header: string[] | null = null;
  let sep = ",";
  let first = true;

  for await (const rawLine of reader) {
    const line = rawLine.replace(/\r$/, "");
    if (!line.trim()) continue;

    if (first) {
      // 去 BOM
      const cleanLine = line.charCodeAt(0) === 0xfeff ? line.slice(1) : line;
      sep = detectDelimiter(cleanLine);
      header = parseCsvLine(cleanLine, sep).map((h) => h.trim());
      first = false;
      continue;
    }

    if (!header) continue;
    const fields = parseCsvLine(line, sep);
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => {
      obj[h] = fields[idx] ?? "";
    });
    await handler(obj);
  }
}

function dataFilePath(name: string): string {
  return path.join(DATA_DIR, name);
}

function readRelationCsvPath(): string {
  const direct = path.join(DATA_DIR, "relation_book_word.csv");
  if (existsSync(direct)) return direct;

  const extracted = path.join(DATA_DIR, "relation_extract", "relation_book_word.csv");
  if (existsSync(extracted)) return extracted;

  const zip = path.join(DATA_DIR, "relation_book_word.zip");
  if (existsSync(zip)) {
    const destDir = path.join(DATA_DIR, "relation_extract");
    mkdirSync(destDir, { recursive: true });

    if (process.platform === "win32") {
      execFileSync("powershell.exe", [
        "-NoProfile",
        "-Command",
        `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${destDir}' -Force`,
      ]);
    } else {
      execFileSync("unzip", ["-o", zip, "-d", destDir]);
    }

    if (existsSync(extracted)) return extracted;
  }

  throw new Error(
    `缺少 relation_book_word.csv，请先解压 relation_book_word.zip 或将 CSV 放到 ${DATA_DIR} 目录。`,
  );
}

const POS_PATTERN = /^(?:vt|vi|adj|adv|prep|conj|pron|num|art|int|aux|v|n)\./i;

function cleanTranslation(raw: string): string | null {
  const segments = raw
    .split(/[；;\r\n]/)
    .flatMap((part) => part.split(/\\n/))
    .flatMap((part) => part.split(/\s*\/\s*/))
    .map((part) => part.trim())
    .filter((part) => POS_PATTERN.test(part));

  const cleaned = segments
    .map((part) =>
      part
        .replace(/^([A-Za-z]+)\.\s*/, (_match, pos: string) => `${pos}.`)
        .replace(/\[[^\]]*\]/g, "")
        .replace(/\(=[^)]*\)/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);

  const unique = Array.from(new Set(cleaned));
  return unique.join("；") || null;
}

async function readEcdictTranslations(
  neededWords: Set<string>,
): Promise<Map<string, string[]>> {
  const sourcePath = path.join(DATA_DIR, "ecdict.translations.tsv");
  if (!existsSync(sourcePath)) {
    throw new Error(
      `缺少 ECDICT 释义文件：${sourcePath}\n请先运行 python prisma/build-ecdict-translations.py。`,
    );
  }

  const translations = new Map<string, string[]>();
  const reader = createInterface({
    input: createReadStream(sourcePath, "utf-8"),
    crlfDelay: Infinity,
  });

  for await (const line of reader) {
    if (!line.trim()) continue;
    const separator = line.indexOf("\t");
    if (separator <= 0) continue;

    const word = line.slice(0, separator).trim();
    if (!neededWords.has(word)) continue;

    const cleaned = cleanTranslation(line.slice(separator + 1));
    if (!cleaned) continue;

    const list = translations.get(word) ?? [];
    if (!list.includes(cleaned)) list.push(cleaned);
    translations.set(word, list);
  }

  return translations;
}

function get(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== "") return v;
  }
  return "";
}
function toInt(s: string): number | null {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}
function toFloat(s: string): number | null {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

type DbValue = string | number | null;

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

// 将值序列化为 SQL 字面量（值来自本地词典 CSV，可信；字符串做单引号转义）
function sqlLiteral(value: DbValue): string {
  if (value === null) return "NULL";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "NULL";
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function batchUpsert(
  table: string,
  columns: string[],
  rows: Record<string, unknown>[],
  conflictColumns: string[],
  updateColumns: string[],
  batchSize: number,
) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const columnList = columns.map(quoteIdentifier).join(",");
    // 值直接内联为 SQL 字面量，绕开 Prisma raw 参数绑定（避免占位符序列化踩坑）
    const tupleValues = chunk
      .map((row) => {
        const vals = columns.map((column) => sqlLiteral((row[column] ?? null) as DbValue));
        return `(${vals.join(",")})`;
      })
      .join(",");
    const conflict = conflictColumns.map(quoteIdentifier).join(",");
    const updates = updateColumns
      .map((column) => `${quoteIdentifier(column)}=excluded.${quoteIdentifier(column)}`)
      .join(",");

    const sql = `INSERT INTO ${quoteIdentifier(table)} (${columnList}) VALUES ${tupleValues} ON CONFLICT(${conflict}) DO UPDATE SET ${updates};`;
    await prisma.$executeRawUnsafe(sql);
  }
}

async function main() {
  console.log("读取 CSV 数据源：" + DATA_DIR);

  // 1. 流式读 word.csv：收集单词 + 需要翻译的单词集合（neededWords）。
  //    wordData 必须整存（供批量 upsert），但 7 万条对象体积可控；不再产生整文件字符串。
  const neededWords = new Set<string>();
  const wordData: Record<string, unknown>[] = [];
  const bookData: Record<string, unknown>[] = [];
  let relTotal = 0;

  // 2. 先读 ECDICT 主词典（依赖 neededWords，故先收集 neededWords）。
  await forEachCsvRow(dataFilePath("word.csv"), (r) => {
    const id = get(r, "vc_id", "id").trim();
    const text = get(r, "vc_vocabulary", "word").trim();
    if (!id || !text) return;
    neededWords.add(text);
    wordData.push({
      id,
      text,
      phoneticUk: get(r, "vc_phonetic_uk", "phonetic_uk") || null,
      phoneticUs: get(r, "vc_phonetic_us", "phonetic_us") || null,
      frequency: toFloat(get(r, "vc_frequency", "frequency")),
      difficulty: toInt(get(r, "vc_difficulty", "difficulty")),
      acknowledgeRate: toFloat(get(r, "vc_acknowledge_rate", "acknowledge_rate")),
      translation: null, // 稍后回填
    });
  });

  const ecdictMap = await readEcdictTranslations(neededWords);

  // 3. 流式读 word_translation.csv：word -> translation[]（回退释义来源）。
  const transMap = new Map<string, string[]>();
  await forEachCsvRow(dataFilePath("word_translation.csv"), (r) => {
    const w = get(r, "word", "vc_vocabulary").trim();
    const t = cleanTranslation(get(r, "translation", "meaning"));
    if (!w || !t) return;
    const arr = transMap.get(w) ?? [];
    if (!arr.includes(t)) arr.push(t);
    transMap.set(w, arr);
  });

  // 4. 回填单词释义（优先 ECDICT，回退 word_translation，再回退手动兜底表）。
  for (const row of wordData) {
    const text = String(row.text);
    row.translation =
      MANUAL_TRANSLATIONS[text] ??
      ((ecdictMap.get(text) ?? transMap.get(text) ?? []).join("；") || null);
  }

  // 5. 流式读 book.csv：词书（含分类层级）。
  await forEachCsvRow(dataFilePath("book.csv"), (r) => {
    const id = get(r, "bk_id", "id").trim();
    const name = get(r, "bk_name", "name").trim();
    if (!id || !name) return;
    const parentRaw = get(r, "bk_parent_id", "parent_id").trim();
    bookData.push({
      id,
      name,
      parentId: parentRaw && parentRaw !== "0" ? parentRaw : null,
      level: toInt(get(r, "bk_level", "level")),
      order: toFloat(get(r, "bk_order", "order")),
      itemNum: toInt(get(r, "bk_item_num", "item_num")),
      author: get(r, "bk_author", "author") || null,
      book: get(r, "bk_book", "book") || null,
      comment: get(r, "bk_comment", "comment") || null,
      publisher: get(r, "bk_publisher", "publisher") || null,
      version: get(r, "bk_version", "version") || null,
      flag: get(r, "bk_flag", "flag") || null,
    });
  });

  // 6. 流式读 relation_book_word.csv：边读边按 (bookId, wordId) 去重，
  //    不再先把 100 万行存进数组（这是原 OOM 主因）。
  const relMap = new Map<string, Record<string, unknown>>();
  await forEachCsvRow(readRelationCsvPath(), (r) => {
    const bookId = get(r, "bv_book_id", "book_id").trim();
    const wordId = get(r, "bv_voc_id", "voc_id", "word_id").trim();
    if (!bookId || !wordId) return;
    relTotal++;
    const key = `${bookId}__${wordId}`;
    if (!relMap.has(key)) {
      relMap.set(key, {
        id: key,
        bookId,
        wordId,
        unit: get(r, "bv_tag", "tag", "unit") || null,
        flag: get(r, "bv_flag", "flag") || null,
      });
    }
  });
  const uniqueRelData = [...relMap.values()];

  const bookIdSet = new Set(bookData.map((row) => String(row.id)));
  const wordIdSet = new Set(wordData.map((row) => String(row.id)));
  const validRelData = uniqueRelData.filter(
    (row) =>
      bookIdSet.has(String(row.bookId)) && wordIdSet.has(String(row.wordId)),
  );
  const skippedRelCount = uniqueRelData.length - validRelData.length;

  console.log(`解析完成：词书 ${bookData.length}、单词 ${wordData.length}、关系 ${relTotal}（去重后 ${uniqueRelData.length}，有效 ${validRelData.length}）`);
  if (skippedRelCount > 0) {
    console.warn(`跳过 ${skippedRelCount} 条引用了缺失词书或单词的关系记录。`);
  }
  console.log("开始写入数据库（可能需要几十秒，请耐心等待）…");

  await batchUpsert(
    "WordBook",
    ["id", "parentId", "name", "level", "order", "itemNum", "author", "book", "comment", "publisher", "version", "flag"],
    bookData,
    ["id"],
    ["parentId", "name", "level", "order", "itemNum", "author", "book", "comment", "publisher", "version", "flag"],
    60,
  );

  await batchUpsert(
    "Word",
    ["id", "text", "phoneticUk", "phoneticUs", "frequency", "difficulty", "acknowledgeRate", "translation"],
    wordData,
    ["id"],
    ["text", "phoneticUk", "phoneticUs", "frequency", "difficulty", "acknowledgeRate", "translation"],
    100,
  );
  console.log(`  单词已写入 ${wordData.length} 条`);

  await prisma.bookWord.deleteMany({});
  await batchUpsert(
    "BookWord",
    ["id", "bookId", "wordId", "unit", "flag"],
    validRelData,
    ["bookId", "wordId"],
    ["id", "unit", "flag"],
    150,
  );

  const [bookCount, wordCount, relCount] = await Promise.all([
    prisma.wordBook.count(),
    prisma.word.count(),
    prisma.bookWord.count(),
  ]);
  console.log(`✅ 导入完成：词书 ${bookCount}、单词 ${wordCount}、关系 ${relCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
