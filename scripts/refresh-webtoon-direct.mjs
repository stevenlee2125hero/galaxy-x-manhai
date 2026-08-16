import { mkdir, readFile, writeFile } from "node:fs/promises";

const CATALOG_URL = "https://www.webtoons.com/zh-hant/originals";
const response = await fetch(CATALOG_URL, {
  headers: { "User-Agent":"GalaxyMangaSea/2.1 official-catalog", Accept:"text/html" },
  signal: AbortSignal.timeout(25000),
});
if (!response.ok) throw new Error(`WEBTOON HTTP ${response.status}`);
const html = await response.text();
const coverDirectory = "public/covers/webtoon";
await mkdir(coverDirectory, { recursive:true });

async function cacheOfficialCover(titleNo, url) {
  const coverResponse = await fetch(url, {
    headers: {
      "User-Agent":"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
      Referer:"https://www.webtoons.com/",
      Accept:"image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    },
    signal:AbortSignal.timeout(25000),
  });
  if (!coverResponse.ok) throw new Error(`WEBTOON cover ${titleNo} HTTP ${coverResponse.status}`);
  const contentType = coverResponse.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) throw new Error(`WEBTOON cover ${titleNo} is not an image`);
  const bytes = Buffer.from(await coverResponse.arrayBuffer());
  if (bytes.length < 5000 || bytes.length > 3000000) throw new Error(`WEBTOON cover ${titleNo} has invalid size`);
  const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  await writeFile(`${coverDirectory}/${titleNo}.${extension}`, bytes);
  return `/covers/webtoon/${titleNo}.${extension}`;
}

function clean(value = "") {
  return value.replaceAll("&amp;", "&").replaceAll("&#39;", "'").replaceAll("&quot;", '"').replace(/<[^>]+>/g, "").trim();
}

const cardPattern = /<a href="(https:\/\/www\.webtoons\.com\/zh-hant\/[^\"]+\/list\?title_no=(\d+))"[^>]*>[\s\S]*?<div class="image_wrap" data-title-unsuitable-for-children="false"[\s\S]*?<img[^>]+src="([^\"]+)"[^>]*>[\s\S]*?<div class="genre">([^<]*)<\/div>[\s\S]*?<strong class="title">([^<]*)<\/strong>/g;
const found = [];
const seen = new Set();
for (const match of html.matchAll(cardPattern)) {
  const [, url, titleNo, cover, rawGenre, rawTitle] = match;
  const title = clean(rawTitle);
  const genre = clean(rawGenre);
  if (!title || seen.has(titleNo) || /大人系/.test(genre)) continue;
  let localCover;
  try {
    localCover = await cacheOfficialCover(titleNo, clean(cover));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    continue;
  }
  seen.add(titleNo);
  found.push({
    id: `webtoon-${titleNo}`,
    title,
    subtitle: title,
    author: "LINE WEBTOON 官方连载",
    cover: localCover,
    coverSource: clean(cover),
    genre: [genre || "彩漫", "彩漫"],
    latest: null,
    color: "color",
    language: "中文",
    region: "韩漫",
    sources: [{ name:"WEBTOON 繁體中文", url:clean(url), access:"free" }],
    verifiedCover: true,
  });
  if (found.length >= 24) break;
}

if (found.length < 20) throw new Error(`WEBTOON 可核验作品不足：${found.length}`);
const current = JSON.parse(await readFile("public/comic-catalog.json", "utf8"));
const rest = (current.comics || []).filter((comic) => !String(comic.id).startsWith("webtoon-"));
const comics = [...rest.filter((comic) => !String(comic.id).startsWith("kitsu-")), ...found, ...rest.filter((comic) => String(comic.id).startsWith("kitsu-"))];
const curatedCount = comics.filter((comic) => !String(comic.id).startsWith("kitsu-")).length;
const networkCount = comics.length - curatedCount;
await writeFile("public/comic-catalog.json", JSON.stringify({
  ...current,
  updatedAt: new Date().toISOString(),
  count: comics.length,
  curatedCount,
  networkCount,
  comics,
}) + "\n");
console.log(`已核验并加入 ${found.length} 部 WEBTOON 繁体中文直达作品`);
