import { prisma } from "./prisma";

export type BookSummary = {
  id: string;
  name: string;
  itemNum: number;
  author: string | null;
  publisher: string | null;
  version: string | null;
  comment: string | null;
};

export type BookGroup = {
  id: string;
  name: string;
  itemNum: number;
  books: BookSummary[];
  children?: BookGroup[];
};

export type BookCategory = {
  id: string;
  name: string;
  itemNum: number;
  books: BookSummary[];
  groups: BookGroup[];
};

type ChildBook = BookSummary & {
  parentId: string;
};

type ParentGroupSpec = {
  id: string;
  name: string;
  parentIds: string[];
};

const rawParentGroups: {
  id: string;
  name: string;
  parentIds: string[];
  gradeTokens?: string[];
  typeTokens?: string[];
  subGroups?: ParentGroupSpec[];
}[] = [
  {
    id: "primary",
    name: "小学",
    parentIds: ["45c48cce2e2d7fbdea1afc51"],
    gradeTokens: ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级"],
  },
  {
    id: "middle",
    name: "初中",
    parentIds: [
      "d3d9446802a44259755d38e6",
      "98f13708210194c475687be6",
    ],
    gradeTokens: ["七年级", "八年级", "九年级"],
    typeTokens: ["新概念"],
  },
  {
    id: "high",
    name: "高中",
    parentIds: ["6512bd43d9caa6e02c990b0a"],
    gradeTokens: ["高一", "高二", "高三"],
    typeTokens: ["必修", "选修", "高考"],
  },
  {
    id: "postgraduate",
    name: "考研",
    parentIds: [
      "2a38a4a9316c49e5a833517c",
      "c9f0f895fb98ab9159f51fd0",
      "c20ad4d76fe97759aa27a0c9",
      "1f0e3dad99908345f7439f8f",
      "6f4922f45568161a8cdf4ad2",
      "58b803ba9e9323e74aafe08c",
      "6c8349cc7260ae62e3b13968",
      "38af86134b65d0f10fe33d30",
    ],
    subGroups: [
      {
        id: "kaoyan",
        name: "考研英语",
        parentIds: ["2a38a4a9316c49e5a833517c"],
      },
      {
        id: "cet4",
        name: "四级词汇",
        parentIds: ["c9f0f895fb98ab9159f51fd0"],
      },
      {
        id: "cet6",
        name: "六级词汇",
        parentIds: ["c20ad4d76fe97759aa27a0c9"],
      },
      {
        id: "tem4",
        name: "专四词汇",
        parentIds: ["1f0e3dad99908345f7439f8f"],
      },
      {
        id: "tem8",
        name: "专八词汇",
        parentIds: ["6f4922f45568161a8cdf4ad2"],
      },
      {
        id: "level-exam",
        name: "等级考试",
        parentIds: ["58b803ba9e9323e74aafe08c"],
      },
      {
        id: "frequency",
        name: "分频词汇",
        parentIds: ["6c8349cc7260ae62e3b13968"],
      },
      {
        id: "legacy",
        name: "老版词书",
        parentIds: ["38af86134b65d0f10fe33d30"],
      },
    ],
  },
  {
    id: "doctoral",
    name: "考博",
    parentIds: ["58b8026d9e9323e74aafe089"],
    subGroups: [
      {
        id: "doctor",
        name: "考博英语",
        parentIds: ["58b8026d9e9323e74aafe089"],
      },
    ],
  },
  {
    id: "abroad",
    name: "出国",
    parentIds: [
      "aab3238922bcc25a6f606eb5",
      "9bf31c7ff062936a96d3c8bd",
      "c74d97b01eae257e44aa9d5b",
      "70efdf2ec9b086079795c442",
      "c51ce410c124a10e0db5e4b9",
      "9b04d152845ec0a378394003",
      "8d5e957f297893487bd98fa8",
      "28dd2c7955ce926456240b2f",
      "58b803e59e9323e74aafe08d",
      "3def184ad8f4755ff269862e",
      "6974ce5ac660610b44d9b9fe",
      "58b803879e9323e74aafe08b",
    ],
    subGroups: [
      {
        id: "toefl",
        name: "托福",
        parentIds: ["aab3238922bcc25a6f606eb5"],
      },
      {
        id: "ielts",
        name: "雅思",
        parentIds: ["9bf31c7ff062936a96d3c8bd"],
      },
      {
        id: "gre",
        name: "GRE",
        parentIds: ["c74d97b01eae257e44aa9d5b"],
      },
      {
        id: "gmat",
        name: "GMAT",
        parentIds: ["70efdf2ec9b086079795c442"],
      },
      {
        id: "sat",
        name: "SAT",
        parentIds: ["c51ce410c124a10e0db5e4b9"],
      },
      {
        id: "act",
        name: "ACT",
        parentIds: ["9b04d152845ec0a378394003"],
      },
      {
        id: "toeic",
        name: "托业",
        parentIds: ["8d5e957f297893487bd98fa8"],
      },
      {
        id: "bec",
        name: "BEC",
        parentIds: ["28dd2c7955ce926456240b2f"],
      },
      {
        id: "mba",
        name: "MBA",
        parentIds: ["58b803e59e9323e74aafe08d"],
      },
      {
        id: "college",
        name: "大学教材",
        parentIds: ["3def184ad8f4755ff269862e"],
      },
      {
        id: "other",
        name: "其他书籍",
        parentIds: [
          "6974ce5ac660610b44d9b9fe",
          "58b803879e9323e74aafe08b",
        ],
      },
    ],
  },
];

function toSummary(book: ChildBook): BookSummary {
  return {
    id: book.id,
    name: book.name,
    itemNum: book.itemNum,
    author: book.author,
    publisher: book.publisher,
    version: book.version,
    comment: book.comment,
  };
}

function uniqueBooks(books: ChildBook[]): BookSummary[] {
  return Array.from(new Map(books.map((book) => [book.id, book])).values()).map(toSummary);
}

function groupBooks(
  groupId: string,
  name: string,
  books: BookSummary[],
  children?: BookGroup[],
): BookGroup {
  const unique = Array.from(new Map(books.map((book) => [book.id, book])).values());
  return {
    id: groupId,
    name,
    itemNum: unique.reduce((sum, book) => sum + book.itemNum, 0),
    books: unique,
    ...(children && children.length > 0 ? { children } : {}),
  };
}

function containsAny(name: string, tokens: string[]): string | null {
  const matches = tokens.filter((token) => name.includes(token));
  return matches.at(-1) ?? null;
}

function publisherGroups(categoryId: string, books: BookSummary[]): BookGroup[] {
  const counts = new Map<string, number>();
  for (const book of books) {
    const publisher = book.publisher?.trim();
    if (!publisher) continue;
    counts.set(publisher, (counts.get(publisher) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([publisher]) =>
      groupBooks(
        `${categoryId}:publisher:${publisher}`,
        publisher,
        books.filter((book) => book.publisher?.trim() === publisher),
      ),
    )
    .filter((group) => group.books.length > 0);
}

function buildSchoolGroups(
  categoryId: string,
  books: BookSummary[],
  gradeTokens: string[],
  typeTokens: string[],
): BookGroup[] {
  const groups: BookGroup[] = [
    groupBooks(`${categoryId}:all`, "全部", books),
  ];

  for (const token of gradeTokens) {
    const filtered = books.filter((book) => containsAny(book.name, [token]) === token);
    if (filtered.length > 0) {
      groups.push(
        groupBooks(
          `${categoryId}:grade:${token}`,
          token,
          filtered,
          publisherGroups(`${categoryId}:grade:${token}`, filtered),
        ),
      );
    }
  }

  for (const token of typeTokens) {
    const filtered = books.filter((book) => book.name.includes(token));
    if (filtered.length > 0) {
      groups.push(
        groupBooks(
          `${categoryId}:type:${token}`,
          token,
          filtered,
          publisherGroups(`${categoryId}:type:${token}`, filtered),
        ),
      );
    }
  }

  return groups;
}

function buildParentGroups(
  categoryId: string,
  books: BookSummary[],
  childrenByParent: Map<string, ChildBook[]>,
  subGroups: ParentGroupSpec[],
): BookGroup[] {
  const groups: BookGroup[] = [
    groupBooks(`${categoryId}:all`, "全部", books),
  ];

  for (const spec of subGroups) {
    const groupBooksList = spec.parentIds.flatMap(
      (parentId) => childrenByParent.get(parentId) ?? [],
    );
    if (groupBooksList.length > 0) {
      groups.push(groupBooks(`${categoryId}:${spec.id}`, spec.name, uniqueBooks(groupBooksList)));
    }
  }

  return groups;
}

export async function getBookCategories(): Promise<BookCategory[]> {
  const books = await prisma.wordBook.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: {
      id: true,
      parentId: true,
      name: true,
      itemNum: true,
      author: true,
      publisher: true,
      version: true,
      comment: true,
    },
  });

  const childrenByParent = new Map<string, ChildBook[]>();

  for (const book of books) {
    if (!book.parentId) continue;
    const child: ChildBook = {
      id: book.id,
      parentId: book.parentId,
      name: book.name,
      itemNum: book.itemNum ?? 0,
      author: book.author,
      publisher: book.publisher,
      version: book.version,
      comment: book.comment,
    };
    const list = childrenByParent.get(book.parentId) ?? [];
    list.push(child);
    childrenByParent.set(book.parentId, list);
  }

  const mappedIds = new Set(rawParentGroups.flatMap((group) => group.parentIds));
  const fallbackBooks = Array.from(childrenByParent.entries())
    .filter(([parentId]) => !mappedIds.has(parentId))
    .flatMap(([, childBooks]) => childBooks);

  return rawParentGroups
    .map((definition) => {
      const childBooks = [
        ...definition.parentIds.flatMap(
          (parentId) => childrenByParent.get(parentId) ?? [],
        ),
        ...(definition.id === "abroad" ? fallbackBooks : []),
      ];
      const allBooks = uniqueBooks(childBooks);

      const groups = definition.subGroups
        ? buildParentGroups(
            definition.id,
            allBooks,
            childrenByParent,
            definition.subGroups,
          )
        : buildSchoolGroups(
            definition.id,
            allBooks,
            definition.gradeTokens ?? [],
            definition.typeTokens ?? [],
          );

      return {
        id: definition.id,
        name: definition.name,
        itemNum: allBooks.reduce((sum, book) => sum + book.itemNum, 0),
        books: allBooks,
        groups,
      };
    })
    .filter((category) => category.books.length > 0);
}
