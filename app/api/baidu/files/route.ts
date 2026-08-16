import { NextRequest, NextResponse } from "next/server";
import { getValidToken, setTokenCookie } from "../_lib";

const PAGE_SIZE = 1000;
const SCAN_CONCURRENCY = 4;
const MAX_FILES = 5000;
const MAX_FOLDERS = 800;
const MAX_REQUESTS = 1200;
const allowed = /\.(pdf|cbz|zip|rar|7z|jpg|jpeg|png|webp|gif)$/i;

type RawItem = {
  fs_id: number;
  path: string;
  server_filename: string;
  size: number;
  isdir: number;
  server_mtime: number;
};

type BaiduItem = {
  fs_id: string;
  path: string;
  name: string;
  size: number;
  isdir: boolean;
  mtime: number;
};

function mapItem(item: RawItem): BaiduItem {
  return {
    fs_id: String(item.fs_id),
    path: item.path,
    name: item.server_filename,
    size: item.size,
    isdir: item.isdir === 1,
    mtime: item.server_mtime,
  };
}

export async function GET(request: NextRequest) {
  const session = await getValidToken(request);
  if (!session.token) return NextResponse.json({ error: "百度网盘未连接" }, { status: 401 });

  const directory = request.nextUrl.searchParams.get("dir") || "/";
  if (!directory.startsWith("/") || directory.includes("..") || directory.length > 1000) {
    return NextResponse.json({ error: "目录格式不正确" }, { status: 400 });
  }

  const queue = [directory];
  const rootFolders: BaiduItem[] = [];
  const files: BaiduItem[] = [];
  let cursor = 0;
  let requests = 0;
  let folders = 0;
  let skippedFolders = 0;
  let truncated = false;

  const listDirectory = async (dir: string) => {
    const entries: RawItem[] = [];
    let start = 0;

    while (requests < MAX_REQUESTS) {
      requests += 1;
      const params = new URLSearchParams({
        method: "list",
        access_token: session.token.access_token,
        dir,
        start: String(start),
        limit: String(PAGE_SIZE),
        order: "time",
        desc: "1",
        web: "1",
      });
      const cloudResponse = await fetch(`https://pan.baidu.com/rest/2.0/xpan/file?${params}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(25000),
      });
      const data = await cloudResponse.json().catch(() => ({}));
      if (!cloudResponse.ok || Number(data.errno || 0) !== 0) {
        throw new Error(data.errmsg || "读取目录失败");
      }

      const page = Array.isArray(data.list) ? (data.list as RawItem[]) : [];
      entries.push(...page);
      if (page.length < PAGE_SIZE || data.has_more === 0) break;
      start += page.length;
    }

    if (requests >= MAX_REQUESTS) truncated = true;
    return entries;
  };

  while (cursor < queue.length && files.length < MAX_FILES && requests < MAX_REQUESTS) {
    const batch = queue.slice(cursor, cursor + SCAN_CONCURRENCY);
    cursor += batch.length;
    const results = await Promise.all(batch.map(async (dir) => {
      try {
        return { dir, entries: await listDirectory(dir) };
      } catch (error) {
        return { dir, entries: null, error };
      }
    }));

    for (const result of results) {
      if (!result.entries) {
        if (result.dir === directory) {
          const message = result.error instanceof Error ? result.error.message : "读取目录失败";
          return NextResponse.json({ error: message }, { status: 400 });
        }
        skippedFolders += 1;
        continue;
      }

      for (const item of result.entries) {
        if (item.isdir === 1) {
          if (result.dir === directory) rootFolders.push(mapItem(item));
          if (folders < MAX_FOLDERS) {
            queue.push(item.path);
            folders += 1;
          } else {
            truncated = true;
          }
        } else if (allowed.test(item.server_filename)) {
          if (files.length < MAX_FILES) files.push(mapItem(item));
          else truncated = true;
        }
      }
    }
  }

  if (cursor < queue.length || files.length >= MAX_FILES || requests >= MAX_REQUESTS) truncated = true;
  const response = NextResponse.json({
    dir: directory,
    items: [...rootFolders, ...files],
    stats: { files: files.length, folders, requests, skippedFolders, truncated },
  });
  if (session.refreshed) await setTokenCookie(response, session.token, session.appSecret);
  return response;
}
