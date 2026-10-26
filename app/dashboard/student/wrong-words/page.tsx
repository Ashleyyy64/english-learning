import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getEffectiveUser } from "@/lib/auth";
import WrongWords from "@/components/wrong-words";

export default async function WrongWordsPage() {
  const user = await getEffectiveUser();
  if (!user) redirect("/login");
  if (user.role !== "STUDENT") redirect("/dashboard/teacher/students");

  const wrongWords = await prisma.userWrongWord.findMany({
    where: { userId: user.id },
    orderBy: { lastWrongAt: "desc" },
    include: {
      word: { include: { notes: { where: { userId: user.id } } } },
    },
  });

  const items = wrongWords.map((w) => ({
    wordId: w.word.id,
    text: w.word.text,
    phoneticUk: w.word.phoneticUk,
    phoneticUs: w.word.phoneticUs,
    translation: w.word.translation,
    note: w.word.notes[0]?.content ?? null,
    wrongCount: w.wrongCount,
    lastWrongAt: w.lastWrongAt.toISOString(),
  }));

  return <WrongWords items={items} />;
}
