import { readFile, writeFile } from "node:fs/promises";

const TARGET_COUNT = 5000;
const PAGE_SIZE = 20;
const MAX_PAGES = 340;
const CONCURRENCY = 5;
const API = "https://kitsu.io/api/edge/manga";

const catalogText = await readFile("public/comic-catalog.json", "utf8");
let current;
try {
  current = JSON.parse(catalogText);
} catch (error) {
  const firstNetworkComic = catalogText.indexOf(',{"id":"kitsu-');
  if (firstNetworkComic < 0) throw error;
  current = JSON.parse(catalogText.slice(0, firstNetworkComic) + "]}");
  console.warn(`目录文件损坏，已保留 ${current.comics.length} 部人工精选作品并重建网络目录`);
}
const curated = (current.comics || []).filter((comic) => !String(comic.id).startsWith("kitsu-"));
const previousNetwork = (current.comics || []).filter((comic) => String(comic.id).startsWith("kitsu-"));

function normalized(value = "") {
  return value.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, "");
}

function regionFor(subtype) {
  if (subtype === "manhwa") return "韩漫";
  if (subtype === "manhua") return "国漫";
  if (subtype === "oel") return "美漫";
  return "日漫";
}

function languageFor(subtype) {
  if (subtype === "manhwa") return "韩文";
  if (subtype === "manhua") return "中文";
  if (subtype === "oel") return "英文";
  return "日文";
}

function subtypeLabel(subtype) {
  return ({ manga:"漫画", manhwa:"韩漫", manhua:"国漫", one_shot:"短篇", doujin:"同人", oel:"欧美漫画" })[subtype] || "漫画";
}

async function fetchPage(page, attempt = 0) {
  const params = new URLSearchParams({
    sort: "popularityRank",
    "page[limit]": String(PAGE_SIZE),
    "page[offset]": String(page * PAGE_SIZE),
  });
  try {
    const response = await fetch(`${API}?${params}`, {
      headers: { Accept:"application/vnd.api+json", "User-Agent":"GalaxyMangaSea/2.0 catalog-metadata" },
      signal: AbortSignal.timeout(25000),
    });
    if (response.status === 429 && attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
      return fetchPage(page, attempt + 1);
    }
    if (!response.ok) throw new Error(`Kitsu HTTP ${response.status}`);
    const body = await response.json();
    return Array.isArray(body.data) ? body.data : [];
  } catch (error) {
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
      return fetchPage(page, attempt + 1);
    }
    throw error;
  }
}

function toComic(item) {
  const attributes = item.attributes || {};
  const subtype = attributes.subtype || "manga";
  const titles = attributes.titles || {};
  const title = titles.zh_cn || titles.zh_tw || titles.ja_jp || titles.ko_kr || titles.en_us || attributes.canonicalTitle;
  const subtitle = attributes.canonicalTitle || titles.en_jp || title;
  const cover = attributes.posterImage?.large || attributes.posterImage?.medium || attributes.posterImage?.small;
  const slug = attributes.slug;
  if (!title || !cover || !slug || attributes.ageRating === "R18" || subtype === "novel") return null;
  return {
    id: `kitsu-${item.id}`,
    title,
    subtitle,
    author: "作者资料见作品页",
    cover,
    genre: [subtypeLabel(subtype), attributes.status === "current" ? "连载中" : "已完结"],
    latest: Number.isFinite(attributes.chapterCount) ? attributes.chapterCount : null,
    color: "unknown",
    language: languageFor(subtype),
    region: regionFor(subtype),
    sources: [{ name:"Kitsu 作品资料", url:`https://kitsu.app/manga/${slug}`, access:"free", kind:"catalog" }],
    verifiedCover: true,
    catalogOnly: true,
    popularityRank: attributes.popularityRank || null,
  };
}

const wanted = TARGET_COUNT - curated.length;
const seen = new Set(curated.flatMap((comic) => [normalized(comic.title), normalized(comic.subtitle)]).filter(Boolean));
const network = [];

try {
  for (let start = 0; start < MAX_PAGES && network.length < wanted; start += CONCURRENCY) {
    const pages = Array.from({ length:Math.min(CONCURRENCY, MAX_PAGES - start) }, (_, index) => start + index);
    const batches = await Promise.all(pages.map((page) => fetchPage(page)));
    for (const item of batches.flat()) {
      const comic = toComic(item);
      if (!comic) continue;
      const keys = [normalized(comic.title), normalized(comic.subtitle)].filter(Boolean);
      if (keys.some((key) => seen.has(key))) continue;
      keys.forEach((key) => seen.add(key));
      network.push(comic);
      if (network.length >= wanted) break;
    }
    if ((start + CONCURRENCY) % 25 === 0) console.log(`已整理 ${curated.length + network.length}/${TARGET_COUNT} 部`);
  }
} catch (error) {
  console.error("网络目录更新失败，保留上次成功结果：", error instanceof Error ? error.message : error);
}

const selectedNetwork = network.length >= wanted ? network.slice(0, wanted) : previousNetwork.slice(0, wanted);
if (curated.length + selectedNetwork.length < TARGET_COUNT) {
  throw new Error(`真实目录不足：${curated.length + selectedNetwork.length}/${TARGET_COUNT}`);
}

const catalog = [...curated, ...selectedNetwork];
await writeFile("public/comic-catalog.json", JSON.stringify({
  updatedAt: new Date().toISOString(),
  count: catalog.length,
  curatedCount: curated.length,
  networkCount: selectedNetwork.length,
  source: "人工核验精选 + Kitsu 公开漫画元数据",
  comics: catalog,
}) + "\n");

console.log(`真实漫画目录已生成：${catalog.length} 部（精选 ${curated.length}，网络目录 ${selectedNetwork.length}）`);
