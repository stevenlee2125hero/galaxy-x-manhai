import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";

const BILI = "https://manga.bilibili.com/";
const MANGA_PLUS = "https://mangaplus.shueisha.co.jp/";
const VIZ = "https://www.viz.com/shonenjump";
const WEBTOON = "https://www.webtoons.com/";
const GLOBAL_COMIX = "https://globalcomix.com/";

const seeds = [
  ["one-piece","航海王","ONE PIECE","Eiichiro Oda",["热血","冒险","经典"],1190,"blackwhite",[["MANGA Plus",MANGA_PLUS,"free"],["哔哩哔哩漫画",BILI,"member"],["VIZ Shonen Jump",VIZ,"member"]]],
  ["naruto","火影忍者","NARUTO","Masashi Kishimoto",["热血","忍者","经典"],702,"blackwhite",[["哔哩哔哩漫画",BILI,"member"],["VIZ Shonen Jump",VIZ,"member"]]],
  ["dragon-ball","龙珠","DRAGON BALL","Akira Toriyama",["热血","战斗","经典"],543,"blackwhite",[["哔哩哔哩漫画",BILI,"member"],["VIZ Shonen Jump",VIZ,"member"]]],
  ["chainsaw-man","电锯人","CHAINSAW MAN","Tatsuki Fujimoto",["热血","奇幻","青年"],232,"blackwhite",[["MANGA Plus",MANGA_PLUS,"free"],["哔哩哔哩漫画",BILI,"member"]]],
  ["jujutsu-kaisen","咒术回战","JUJUTSU KAISEN","Gege Akutami",["热血","奇幻","战斗"],301,"blackwhite",[["哔哩哔哩漫画",BILI,"member"],["VIZ Shonen Jump",VIZ,"member"]]],
  ["my-hero-academia","我的英雄学院","MY HERO ACADEMIA","Kohei Horikoshi",["热血","校园","英雄"],null,"blackwhite",[["哔哩哔哩漫画",BILI,"member"],["VIZ Shonen Jump",VIZ,"member"]]],
  ["bleach","境·界","BLEACH","Tite Kubo",["热血","战斗","经典"],null,"blackwhite",[["哔哩哔哩漫画",BILI,"member"],["VIZ Shonen Jump",VIZ,"member"]]],
  ["demon-slayer","鬼灭之刃","DEMON SLAYER","Koyoharu Gotouge",["热血","奇幻","战斗"],null,"blackwhite",[["哔哩哔哩漫画",BILI,"member"],["VIZ Shonen Jump",VIZ,"member"]]],
  ["spy-family","间谍过家家","SPY × FAMILY","Tatsuya Endo",["喜剧","家庭","动作"],null,"blackwhite",[["MANGA Plus",MANGA_PLUS,"free"],["哔哩哔哩漫画",BILI,"member"]]],
  ["kaiju-no-8","怪兽8号","KAIJU NO. 8","Naoya Matsumoto",["热血","科幻","战斗"],null,"blackwhite",[["MANGA Plus",MANGA_PLUS,"free"],["VIZ Shonen Jump",VIZ,"member"]]],
  ["dandadan","胆大党","DANDADAN","Yukinobu Tatsu",["热血","奇幻","喜剧"],null,"blackwhite",[["MANGA Plus",MANGA_PLUS,"free"],["哔哩哔哩漫画",BILI,"member"]]],
  ["sakamoto-days","坂本日常","SAKAMOTO DAYS","Yuto Suzuki",["热血","动作","喜剧"],null,"blackwhite",[["MANGA Plus",MANGA_PLUS,"free"],["VIZ Shonen Jump",VIZ,"member"]]],
  ["blue-box","青之箱","BLUE BOX","Kouji Miura",["青春","运动","恋爱"],null,"blackwhite",[["MANGA Plus",MANGA_PLUS,"free"],["VIZ Shonen Jump",VIZ,"member"]]],
  ["kagurabachi","神乐钵","KAGURABACHI","Takeru Hokazono",["热血","奇幻","战斗"],null,"blackwhite",[["MANGA Plus",MANGA_PLUS,"free"],["VIZ Shonen Jump",VIZ,"member"]]],
  ["boruto","博人传","BORUTO","Masashi Kishimoto",["热血","忍者","冒险"],null,"blackwhite",[["MANGA Plus",MANGA_PLUS,"free"],["VIZ Shonen Jump",VIZ,"member"]]],
  ["dragon-ball-super","龙珠超","DRAGON BALL SUPER","Toyotarou",["热血","战斗","经典"],null,"blackwhite",[["MANGA Plus",MANGA_PLUS,"free"],["哔哩哔哩漫画",BILI,"member"]]],
  ["hunter-x-hunter","全职猎人","HUNTER × HUNTER","Yoshihiro Togashi",["热血","冒险","经典"],null,"blackwhite",[["MANGA Plus",MANGA_PLUS,"free"],["哔哩哔哩漫画",BILI,"member"]]],
  ["jojo","JOJO的奇妙冒险","JOJO'S BIZARRE ADVENTURE","Hirohiko Araki",["热血","奇幻","经典"],null,"color",[["哔哩哔哩漫画",BILI,"member"],["VIZ Manga",VIZ,"member"]]],
  ["death-note","死亡笔记","DEATH NOTE","Tsugumi Ohba",["悬疑","推理","经典"],null,"blackwhite",[["哔哩哔哩漫画",BILI,"member"],["VIZ Manga",VIZ,"member"]]],
  ["slam-dunk","灌篮高手","SLAM DUNK","Takehiko Inoue",["热血","运动","经典"],null,"blackwhite",[["哔哩哔哩漫画",BILI,"member"]]],
  ["haikyu","排球少年","HAIKYU!!","Haruichi Furudate",["热血","运动","校园"],null,"blackwhite",[["哔哩哔哩漫画",BILI,"member"],["VIZ Shonen Jump",VIZ,"member"]]],
  ["dr-stone","石纪元","DR. STONE","Riichiro Inagaki",["热血","科幻","冒险"],null,"blackwhite",[["哔哩哔哩漫画",BILI,"member"],["VIZ Shonen Jump",VIZ,"member"]]],
  ["black-clover","黑色五叶草","BLACK CLOVER","Yuki Tabata",["热血","奇幻","冒险"],null,"blackwhite",[["MANGA Plus",MANGA_PLUS,"free"],["VIZ Shonen Jump",VIZ,"member"]]],
  ["mashle","物理魔法使马修","MASHLE","Hajime Komoto",["热血","奇幻","喜剧"],null,"blackwhite",[["哔哩哔哩漫画",BILI,"member"],["VIZ Shonen Jump",VIZ,"member"]]],
  ["blue-lock","蓝色监狱","BLUE LOCK","Muneyuki Kaneshiro",["热血","运动","竞技"],null,"blackwhite",[["哔哩哔哩漫画",BILI,"member"]]],
  ["attack-on-titan","进击的巨人","ATTACK ON TITAN","Hajime Isayama",["热血","奇幻","经典"],null,"blackwhite",[["哔哩哔哩漫画",BILI,"member"]]],
  ["tokyo-ghoul","东京喰种","TOKYO GHOUL","Sui Ishida",["奇幻","悬疑","青年"],null,"blackwhite",[["哔哩哔哩漫画",BILI,"member"],["VIZ Manga",VIZ,"member"]]],
  ["frieren","葬送的芙莉莲","FRIEREN","Kanehito Yamada",["奇幻","冒险","治愈"],null,"blackwhite",[["哔哩哔哩漫画",BILI,"member"]]],
  ["apothecary-diaries","药屋少女的呢喃","THE APOTHECARY DIARIES","Natsu Hyuuga",["悬疑","古风","日常"],null,"blackwhite",[["哔哩哔哩漫画",BILI,"member"]]],
  ["oshi-no-ko","【我推的孩子】","OSHI NO KO","Aka Akasaka",["悬疑","偶像","青年"],null,"blackwhite",[["MANGA Plus",MANGA_PLUS,"free"],["哔哩哔哩漫画",BILI,"member"]]],
  ["one-punch-man","一拳超人","ONE-PUNCH MAN","ONE",["热血","英雄","喜剧"],null,"blackwhite",[["哔哩哔哩漫画",BILI,"member"],["VIZ Manga",VIZ,"member"]]],
  ["mob-psycho-100","灵能百分百","MOB PSYCHO 100","ONE",["热血","奇幻","喜剧"],null,"blackwhite",[["哔哩哔哩漫画",BILI,"member"]]],
  ["berserk","剑风传奇","BERSERK","Kentaro Miura",["奇幻","冒险","经典"],null,"blackwhite",[["哔哩哔哩漫画",BILI,"member"]]],
  ["vinland-saga","冰海战记","VINLAND SAGA","Makoto Yukimura",["历史","冒险","青年"],null,"blackwhite",[["哔哩哔哩漫画",BILI,"member"]]],
  ["vagabond","浪客行","VAGABOND","Takehiko Inoue",["历史","剑道","经典"],null,"blackwhite",[["哔哩哔哩漫画",BILI,"member"],["VIZ Manga",VIZ,"member"]]],
  ["fullmetal-alchemist","钢之炼金术师","FULLMETAL ALCHEMIST","Hiromu Arakawa",["热血","奇幻","经典"],null,"blackwhite",[["哔哩哔哩漫画",BILI,"member"]]],
  ["soul-eater","噬魂师","SOUL EATER","Atsushi Ohkubo",["热血","奇幻","校园"],null,"blackwhite",[["哔哩哔哩漫画",BILI,"member"]]],
  ["fairy-tail","妖精的尾巴","FAIRY TAIL","Hiro Mashima",["热血","奇幻","冒险"],null,"blackwhite",[["哔哩哔哩漫画",BILI,"member"]]],
  ["edens-zero","伊甸星原","EDENS ZERO","Hiro Mashima",["热血","科幻","冒险"],null,"blackwhite",[["MANGA Plus",MANGA_PLUS,"free"],["哔哩哔哩漫画",BILI,"member"]]],
  ["fire-force","炎炎消防队","FIRE FORCE","Atsushi Ohkubo",["热血","奇幻","战斗"],null,"blackwhite",[["哔哩哔哩漫画",BILI,"member"]]],
  ["tokyo-revengers","东京复仇者","TOKYO REVENGERS","Ken Wakui",["热血","青春","悬疑"],null,"blackwhite",[["哔哩哔哩漫画",BILI,"member"]]],
  ["initial-d","头文字D","INITIAL D","Shuichi Shigeno",["热血","赛车","经典"],null,"blackwhite",[["哔哩哔哩漫画",BILI,"member"]]],
  ["detective-conan","名侦探柯南","DETECTIVE CONAN","Gosho Aoyama",["悬疑","推理","经典"],null,"blackwhite",[["哔哩哔哩漫画",BILI,"member"]]],
  ["doraemon","哆啦A梦","DORAEMON","Fujiko F. Fujio",["科幻","日常","经典"],null,"blackwhite",[["哔哩哔哩漫画",BILI,"member"]]],
  ["sailor-moon","美少女战士","SAILOR MOON","Naoko Takeuchi",["奇幻","少女","经典"],null,"blackwhite",[["哔哩哔哩漫画",BILI,"member"]]],
  ["cardcaptor-sakura","魔卡少女樱","CARDCAPTOR SAKURA","CLAMP",["奇幻","少女","经典"],null,"blackwhite",[["哔哩哔哩漫画",BILI,"member"]]],
  ["fruits-basket","水果篮子","FRUITS BASKET","Natsuki Takaya",["治愈","少女","经典"],null,"blackwhite",[["哔哩哔哩漫画",BILI,"member"]]],
  ["nana","NANA","NANA","Ai Yazawa",["青春","音乐","经典"],null,"blackwhite",[["哔哩哔哩漫画",BILI,"member"],["VIZ Manga",VIZ,"member"]]],
  ["monster","怪物","MONSTER","Naoki Urasawa",["悬疑","推理","经典"],null,"blackwhite",[["哔哩哔哩漫画",BILI,"member"],["VIZ Manga",VIZ,"member"]]],
  ["pluto","PLUTO 冥王","PLUTO","Naoki Urasawa",["科幻","悬疑","经典"],null,"blackwhite",[["哔哩哔哩漫画",BILI,"member"],["VIZ Manga",VIZ,"member"]]],
  ["20th-century-boys","20世纪少年","20TH CENTURY BOYS","Naoki Urasawa",["悬疑","科幻","经典"],null,"blackwhite",[["哔哩哔哩漫画",BILI,"member"],["VIZ Manga",VIZ,"member"]]],
  ["solo-leveling","我独自升级","SOLO LEVELING","Chugong",["热血","奇幻","韩漫"],null,"color",[["Tappytoon","https://www.tappytoon.com/","member"],["哔哩哔哩漫画",BILI,"member"]]],
  ["omniscient-reader","全知读者视角","OMNISCIENT READER","singNsong",["热血","奇幻","韩漫"],null,"color",[["WEBTOON",WEBTOON,"free"],["哔哩哔哩漫画",BILI,"member"]]],
  ["tower-of-god","神之塔","TOWER OF GOD","SIU",["热血","奇幻","韩漫"],null,"color",[["WEBTOON",WEBTOON,"free"]]],
  ["lore-olympus","奥林匹斯传说","LORE OLYMPUS","Rachel Smythe",["奇幻","爱情","欧美"],null,"color",[["WEBTOON",WEBTOON,"free"]]],
  ["invincible","无敌少侠","INVINCIBLE","Robert Kirkman",["英雄","动作","欧美"],null,"color",[["GlobalComix",GLOBAL_COMIX,"member"]]],
  ["watchmen","守望者","WATCHMEN","Alan Moore",["英雄","悬疑","经典"],12,"color",[["DC Universe Infinite","https://www.dcuniverseinfinite.com/","member"]]],
  ["batman-year-one","蝙蝠侠：元年","BATMAN: YEAR ONE","Frank Miller",["英雄","犯罪","经典"],4,"color",[["DC Universe Infinite","https://www.dcuniverseinfinite.com/","member"]]],
  ["spider-man","蜘蛛侠","THE AMAZING SPIDER-MAN","Stan Lee",["英雄","动作","经典"],null,"color",[["Marvel Unlimited","https://www.marvel.com/unlimited","member"]]],
  ["saga","星际迷航：传奇","SAGA","Brian K. Vaughan",["科幻","冒险","欧美"],null,"color",[["GlobalComix",GLOBAL_COMIX,"member"]]]
];

const catalogDir = "public/covers/catalog";
await mkdir(catalogDir, { recursive: true });

const previousCatalog = JSON.parse(await readFile("public/comic-catalog.json", "utf8").catch(() => "{\"comics\":[]}"));
const previousById = new Map((previousCatalog.comics || []).map((comic) => [comic.id, comic]));
const trustedLocalCovers = new Set(["jujutsu-kaisen", "watchmen", "batman-year-one"]);
const excludedAmbiguousMatches = new Set(["invincible", "saga", "spider-man"]);
const koreanTitles = new Set(["solo-leveling", "omniscient-reader", "tower-of-god"]);
const westernTitles = new Set(["lore-olympus", "watchmen", "batman-year-one"]);

async function fetchCover(title) {
  const params = new URLSearchParams({ "filter[text]":title, "page[limit]":"1" });
  const response = await fetch(`https://kitsu.io/api/edge/manga?${params}`, { headers: { "User-Agent": "GalaxyMangaSea/1.0 cover-metadata" }, signal:AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`search ${response.status}`);
  const data = await response.json();
  const poster = data.data?.[0]?.attributes?.posterImage;
  return poster?.original || poster?.large || null;
}

async function build(seed) {
  const [id,title,subtitle,author,genre,latest,color,sources] = seed;
  const region = koreanTitles.has(id)?"韩漫":westernTitles.has(id)?"美漫":"日漫";
  const base = { id,title,subtitle,author,cover:`/covers/catalog/${id}.jpg`,genre,latest,color,language:"中文",region,sources:sources.map(([name,url,access])=>({name,url,access})),verifiedCover:true };
  if (excludedAmbiguousMatches.has(id)) return null;
  if (trustedLocalCovers.has(id)) {
    await copyFile(`public/covers/${id}.jpg`, `${catalogDir}/${id}.jpg`);
    return base;
  }
  if (previousById.has(id)) return { ...previousById.get(id), ...base };
  try {
    const coverUrl = await fetchCover(subtitle) ?? await fetchCover(title);
    if (!coverUrl) return null;
    const coverResponse = await fetch(coverUrl, { signal:AbortSignal.timeout(15000) });
    if (!coverResponse.ok) return null;
    const bytes = Buffer.from(await coverResponse.arrayBuffer());
    if (bytes.length < 5000 || bytes.length > 2500000) return null;
    await writeFile(`${catalogDir}/${id}.jpg`, bytes);
    return base;
  } catch (error) {
    console.error(id, error instanceof Error ? error.message : error);
    return null;
  }
}

const results = [];
for (let offset = 0; offset < seeds.length; offset += 6) {
  const batch = await Promise.all(seeds.slice(offset, offset + 6).map((seed) => build(seed)));
  results.push(...batch.filter(Boolean));
}

await writeFile("public/comic-catalog.json", JSON.stringify({ updatedAt:new Date().toISOString(), count:results.length, comics:results }, null, 2) + "\n");
console.log(`真实封面目录：${results.length}/${seeds.length}`);
