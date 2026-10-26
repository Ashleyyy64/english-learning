// 增量导入：北师大版初中英语 5 册词书
// 数据来源：fanyi.kkabc.com（九年级全一册旧版）+ yyld.51jiaoxi.com（七/八年级新版）
// 用法：先运行 scripts/parse 生成 _tmp/final_books.json，再 npx tsx prisma/import-beishida.ts
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { createHash } from "crypto";
import path from "path";

const prisma = new PrismaClient();

const DATA_PATH = path.join(process.cwd(), "_tmp", "final_books.json");

// 生成 24 位 hex 的稳定 id（与现有 DictionaryData 的 Mongo ObjectId 风格一致，幂等）
function stableId(text: string): string {
  return createHash("md5").update(text).digest("hex").slice(0, 24);
}

// 音标清洗：统一为带 [] 的格式（与现有数据一致）
function normalizePhonetic(p: string | null | undefined): string | null {
  if (!p) return null;
  let s = p.trim();
  if (!s) return null;
  if (!s.startsWith("[")) s = "[" + s;
  if (!s.endsWith("]")) s = s + "]";
  return s;
}

type WordEntry = {
  word: string;
  phonetic: string;
  phonetic_us: string;
  cn: string;
  unit: string;
};

type BookDef = {
  version: string;
  parentId: string;
  words: WordEntry[];
};

async function main() {
  const data = JSON.parse(readFileSync(DATA_PATH, "utf-8")) as Record<string, BookDef>;

  const bookNames = Object.keys(data);
  console.log(`准备导入 ${bookNames.length} 本词书：${bookNames.join("、")}`);

  // 1. 收集所有唯一单词文本
  const allWords = new Map<string, WordEntry>(); // word -> entry（合并各书同词）
  for (const name of bookNames) {
    for (const w of data[name].words) {
      if (!allWords.has(w.word)) allWords.set(w.word, w);
    }
  }
  const wordTexts = [...allWords.keys()];
  console.log(`唯一单词 ${wordTexts.length} 个`);

  // 2. 查出现有单词（按 text 精确匹配）
  const existing = await prisma.word.findMany({
    where: { text: { in: wordTexts } },
    select: { id: true, text: true },
  });
  const existingMap = new Map(existing.map((w) => [w.text, w.id]));
  console.log(`已有单词 ${existingMap.size} 个，需新建 ${wordTexts.length - existingMap.size} 个`);

  // 3. 新建缺失单词
  const newWords = wordTexts.filter((t) => !existingMap.has(t));
  for (const text of newWords) {
    const entry = allWords.get(text)!;
    const id = stableId(text);
    existingMap.set(text, id);
    await prisma.word.upsert({
      where: { id },
      update: {
        text,
        phoneticUk: normalizePhonetic(entry.phonetic) ?? undefined,
        phoneticUs: normalizePhonetic(entry.phonetic_us) ?? normalizePhonetic(entry.phonetic) ?? undefined,
        translation: entry.cn || undefined,
      },
      create: {
        id,
        text,
        phoneticUk: normalizePhonetic(entry.phonetic),
        phoneticUs: normalizePhonetic(entry.phonetic_us) ?? normalizePhonetic(entry.phonetic),
        translation: entry.cn || null,
      },
    });
  }
  if (newWords.length > 0) {
    console.log(`新建单词完成 ${newWords.length} 个`);
  }

  // 4. 创建/更新词书 + 关系
  let order = 20.6;
  for (const name of bookNames) {
    const def = data[name];
    const bookId = stableId("book:" + name);

    // upsert 词书
    await prisma.wordBook.upsert({
      where: { id: bookId },
      update: {
        name,
        parentId: def.parentId,
        level: 2,
        order,
        itemNum: def.words.length,
        publisher: "北京师范大学出版社",
        version: def.version === "new" ? "2024年新版" : "2004年旧版",
      },
      create: {
        id: bookId,
        name,
        parentId: def.parentId,
        level: 2,
        order,
        itemNum: def.words.length,
        publisher: "北京师范大学出版社",
        version: def.version === "new" ? "2024年新版" : "2004年旧版",
      },
    });

    // 构建 BookWord 关系（upsert，幂等）
    const rels = def.words.map((w) => ({
      id: stableId(`rel:${name}:${w.word}`),
      bookId,
      wordId: existingMap.get(w.word)!,
      unit: w.unit,
    }));

    // 逐条 upsert BookWord（利用 bookId+wordId 唯一约束）
    for (const r of rels) {
      await prisma.bookWord.upsert({
        where: { bookId_wordId: { bookId: r.bookId, wordId: r.wordId } },
        update: { unit: r.unit },
        create: r,
      });
    }

    console.log(`✅ ${name}：${def.words.length} 词（version=${def.version}）`);
    order += 0.02;
  }

  // 5. 校验
  const [bookCount, relCount] = await Promise.all([
    prisma.wordBook.count({ where: { name: { startsWith: "北师大版初中英语" } } }),
    prisma.bookWord.count({
      where: { bookId: { in: bookNames.map((n) => stableId("book:" + n)) } },
    }),
  ]);
  console.log(`\n导入完成：北师大初中词书 ${bookCount} 本，关系 ${relCount} 条`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
