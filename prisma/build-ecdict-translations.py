import csv
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, "dictionary-data", "ecdict.csv")
TARGET = os.path.join(ROOT, "dictionary-data", "ecdict.translations.tsv")


def main() -> None:
    if not os.path.exists(SOURCE):
        raise FileNotFoundError(SOURCE)

    with open(SOURCE, "r", encoding="utf-8", newline="") as source, open(
        TARGET, "w", encoding="utf-8", newline=""
    ) as target:
        reader = csv.DictReader(source)
        for row in reader:
            word = (row.get("word") or "").strip()
            translation = (row.get("translation") or "").strip()
            if not word or not translation:
                continue
            translation = "；".join(
                part.strip() for part in translation.replace("\r", "\n").split("\n")
                if part.strip()
            )
            target.write(f"{word}\t{translation}\n")


if __name__ == "__main__":
    main()
