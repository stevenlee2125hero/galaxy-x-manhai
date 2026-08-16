import { mkdir, readFile, writeFile } from "node:fs/promises";

const sourceConfig = JSON.parse(await readFile("data/sources.json", "utf8"));
const sourceDirectory = JSON.parse(await readFile("public/official-sources.json", "utf8"));
const catalog = JSON.parse(await readFile("public/comic-catalog.json", "utf8"));
const previous = await readFile("public/source-status.json", "utf8").then(JSON.parse).catch(() => ({ titles: {} }));
const previousAccess = await readFile("public/source-access.json", "utf8").then(JSON.parse).catch(() => ({ policies: {} }));
const enabled = sourceConfig.sources.filter((source) => source.enabled && source.catalogUrl);
const trustedHosts = new Set(sourceDirectory.sources.map((source) => {
  try { return new URL(source.url).hostname.toLowerCase(); } catch { return ""; }
}).filter(Boolean));
// Kitsu is used only as a public metadata/cover catalog, never as a comic-page source.
trustedHosts.add("kitsu.app");
trustedHosts.add("kitsu.io");
trustedHosts.add("media.kitsu.app");
const titles = {};
const failures = [];
let addedChapters = 0;
await mkdir("public/covers", { recursive: true });

function hostIsTrusted(hostname) {
  const host = hostname.toLowerCase();
  return [...trustedHosts].some((trusted) => host === trusted || host.endsWith("." + trusted));
}

function fallbackPolicy(source) {
  const hostname = new URL(source.url).hostname.toLowerCase();
  if (hostname === "manga.bilibili.com") {
    return {
      tier: "mainland_member",
      mainland: true,
      requiresMember: true,
      note: "中国大陆正版平台；完整阅读可能需要会员、漫币或单章购买",
      evidence: "https://manga.bilibili.com/"
    };
  }
  return {
    tier: "overseas",
    mainland: false,
    requiresMember: source.access === "member",
    note: "未列入大陆直达白名单，保守归入域外来源",
    evidence: source.url
  };
}

async function urlhausListed(url) {
  try {
    const response = await fetch("https://urlhaus-api.abuse.ch/v1/url/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "GalaxyMangaSea/1.0 safety-check" },
      body: new URLSearchParams({ url }),
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) return { listed: false, scan: "unavailable" };
    const data = await response.json();
    return { listed: data.query_status === "ok", scan: data.query_status === "ok" ? "listed" : "clear" };
  } catch {
    return { listed: false, scan: "unavailable" };
  }
}

async function inspectPlatform(source) {
  const saved = previousAccess.policies?.[source.name] || {};
  const base = { ...fallbackPolicy(source), ...saved };
  const reasons = [];
  let health = "online";
  let finalUrl = source.url;
  let parsed;
  try { parsed = new URL(source.url); } catch { reasons.push("网址格式无效"); }
  if (parsed?.protocol !== "https:") reasons.push("不是 HTTPS 安全连接");
  if (parsed && !hostIsTrusted(parsed.hostname)) reasons.push("域名不在正版来源白名单");

  if (!reasons.length) {
    try {
      const response = await fetch(source.url, {
        method: "GET",
        redirect: "manual",
        headers: { Accept: "text/html,application/json", "User-Agent": "GalaxyMangaSea/1.0 availability-check" },
        signal: AbortSignal.timeout(20000)
      });
      await response.body?.cancel();
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (location) {
          const redirectUrl = new URL(location, source.url);
          finalUrl = redirectUrl.href;
          if (redirectUrl.protocol !== "https:") reasons.push("跳转到了非 HTTPS 地址");
          else if (!hostIsTrusted(redirectUrl.hostname)) health = "redirected";
        }
      } else if (response.status >= 500) health = "unreachable";
      else if (response.status >= 400) health = "restricted";
    } catch {
      health = "unreachable";
    }
  }

  const malware = await urlhausListed(source.url);
  if (malware.listed) reasons.push("公共恶意网址数据库已收录");
  const risk = reasons.length > 0;
  return {
    ...base,
    tier: risk ? "risk" : base.tier,
    risk,
    removed: risk,
    health,
    riskScan: malware.scan,
    riskReasons: reasons,
    finalUrl,
    checkedAt: new Date().toISOString()
  };
}

for (const source of enabled) {
  try {
    const response = await fetch(source.catalogUrl, {
      headers: { Accept: "text/html,application/json", "User-Agent": "GalaxyMangaSea/1.0 metadata-crawler" },
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const text = await response.text();
    const matches = [...text.matchAll(new RegExp(source.chapterPattern, "gi"))]
      .map((match) => Number(match[1])).filter(Number.isFinite);
    const latest = matches.length ? Math.max(...matches) : previous.titles?.[source.id]?.latest ?? null;
    const oldLatest = previous.titles?.[source.id]?.latest ?? latest;
    if (latest && oldLatest) addedChapters += Math.max(0, latest - oldLatest);
    titles[source.id] = { name: source.name, latest, checkedAt: new Date().toISOString(), sourceUrl: source.catalogUrl };

    if (source.coverUrl && source.coverFile) {
      const coverResponse = await fetch(source.coverUrl, { signal: AbortSignal.timeout(30000) });
      if (!coverResponse.ok) throw new Error("Cover HTTP " + coverResponse.status);
      const bytes = Buffer.from(await coverResponse.arrayBuffer());
      if (bytes.length < 1000 || bytes.length > 2000000) throw new Error("Unexpected cover size");
      await writeFile("public/covers/" + source.coverFile, bytes);
    }
  } catch (error) {
    failures.push({ source: source.name, reason: error instanceof Error ? error.message : "Unknown error" });
  }
}

const uniquePlatforms = [...new Map(catalog.comics.flatMap((comic) => comic.sources).map((source) => [source.name, source])).values()];
const inspectedPlatforms = await Promise.all(uniquePlatforms.map(async (platform) => [platform.name, await inspectPlatform(platform)]));
const accessPolicies = Object.fromEntries(inspectedPlatforms);
const removedRiskSources = Object.values(accessPolicies).filter((policy) => policy.removed).length;

await writeFile("public/source-status.json", JSON.stringify({ updatedAt: new Date().toISOString(), titles }, null, 2) + "\n");
await writeFile("public/source-access.json", JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), policies: accessPolicies }, null, 2) + "\n");
const status = {
  lastRun: new Date().toISOString(),
  status: failures.length ? "partial" : "success",
  addedChapters,
  sourceCount: sourceDirectory.sources.length,
  trackedTitleCount: enabled.length,
  checkedPlatformCount: uniquePlatforms.length,
  removedRiskSources,
  failures,
  message: "已检查 " + uniquePlatforms.length + " 个阅读平台；隔离 " + removedRiskSources + " 个风险来源"
};
await writeFile("public/sync-status.json", JSON.stringify(status, null, 2) + "\n");
console.log(status.message);
