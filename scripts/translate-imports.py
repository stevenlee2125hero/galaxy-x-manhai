"""Create free, offline Japanese-to-Chinese translation sidecars for imported pages."""
from __future__ import annotations

import json
from pathlib import Path

import argostranslate.package
import argostranslate.translate
from manga_ocr import MangaOcr

IMPORTS = Path("imports")
OUTPUT = Path("public/translations")
SUPPORTED = {".jpg", ".jpeg", ".png", ".webp"}


def ensure_translation_models() -> None:
    argostranslate.package.update_package_index()
    available = argostranslate.package.get_available_packages()
    installed = {(lang.code) for lang in argostranslate.translate.get_installed_languages()}
    for source, target in (("ja", "en"), ("en", "zh")):
        if source in installed and target in installed:
            continue
        package = next((item for item in available if item.from_code == source and item.to_code == target), None)
        if package:
            argostranslate.package.install_from_path(package.download())
            installed.update((source, target))


def translate(text: str) -> str:
    languages = {lang.code: lang for lang in argostranslate.translate.get_installed_languages()}
    if "ja" not in languages or "en" not in languages or "zh" not in languages:
        return text
    english = languages["ja"].get_translation(languages["en"]).translate(text)
    return languages["en"].get_translation(languages["zh"]).translate(english)


def main() -> None:
    pages = [path for path in IMPORTS.rglob("*") if path.suffix.lower() in SUPPORTED]
    if not pages:
        print("No imported manga pages; translation skipped.")
        return
    ensure_translation_models()
    ocr = MangaOcr()
    for page in pages:
        original = ocr(str(page))
        translated = translate(original)
        target = OUTPUT / page.relative_to(IMPORTS)
        target = target.with_suffix(target.suffix + ".json")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps({
            "source": str(page.relative_to(IMPORTS)),
            "original": original,
            "translated": translated,
            "engine": "manga-ocr + argos-translate",
        }, ensure_ascii=False, indent=2), encoding="utf-8")
        print("Translated", page)


if __name__ == "__main__":
    main()
