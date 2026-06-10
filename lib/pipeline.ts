// Isomorphic pipeline: classification + exclusion + spam/non-prospect filtering.
// Mirrors the Python discover.py logic so the dashboard produces the same results.

export interface RawAd {
  provider_page_name?: string;
  original_image_url?: string[] | string | null;
  page_categories?: string[] | null;
  bodies?: string[] | null;
  creative_link_titles?: string[] | null;
  creative_link_descriptions?: string[] | null;
  captions?: string[] | null;
  delivery_start_time?: string | null;
  page_like_count?: number | null;
}

export interface Brand {
  brand: string;
  category: string;
  image: string;
  start: string;
  likes: number;
}

export interface ProcessOpts {
  excludeText: string;
  startMin: string; // YYYY-MM-DD
  likesMin: number;
  likesMax: number;
  target: number;
}

const CATEGORY_RULES: [string, string[]][] = [
  ["Watches", ["watch", "watches", "timepiece", "wristwatch", "chronograph"]],
  ["Shoes", ["shoe", "shoes", "footwear", "sneaker", "sandal", "boot", "slipper", "loafer"]],
  ["Jewellery", ["jewellery", "jewelry", "jewel", "necklace", "earring", "pendant", "bracelet", "bangle", "diamond", "ornament"]],
  ["Bags, Wallets & Luggage", ["bag", "bags", "wallet", "luggage", "backpack", "handbag", "suitcase", "trolley", "duffel", "purse", "briefcase"]],
  ["Beauty", ["beauty", "cosmetic", "makeup", "lipstick", "serum", "moisturizer", "skincare", "skin", "fragrance", "perfume", "kajal", "mascara", "cleanser", "toner", "facewash", "foundation", "sunscreen", "lipbalm", "sheetmask"]],
  ["Musical Instruments", ["guitar", "piano", "violin", "drum", "ukulele", "flute", "tabla"]],
  ["Pet Supplies", ["petfood", "pet food", "dog", "cat", "puppy", "kitten", "aquarium", "kibble", "dogtreat"]],
  ["Toys & Games", ["toy", "toys", "puzzle", "lego", "plush", "boardgame"]],
  ["Computers & Accessories", ["laptop", "computer", "mouse", "ssd", "harddrive", "webcam", "router"]],
  ["Car & Motorbike", ["motorbike", "motorcycle", "automotive", "tyre", "helmet", "scooter"]],
  ["Office Products", ["stationery", "stationary", "printer", "notebook", "pen"]],
  ["Home Medical Supplies & Equipment", ["thermometer", "oximeter", "wheelchair", "nebulizer", "glucometer", "orthopedic"]],
  ["Outdoor Living", ["gardening", "patio", "planter"]],
  ["Home Improvement", ["hardware", "renovation", "plumbing", "powertool", "paint"]],
  ["Sports, Fitness & Outdoors", ["sport", "sports", "fitness", "gym", "workout", "yoga", "running", "cycling", "dumbbell", "athletic", "activewear", "sportswear", "treadmill", "yogamat"]],
  ["Grocery & Gourmet Foods", ["tea", "coffee", "snack", "snacks", "chocolate", "biscuit", "gourmet", "spice", "masala", "honey", "beverage", "juice", "ghee", "granola", "peanut", "makhana", "cereal", "nuts", "millet", "sweets", "cookies", "dryfruit"]],
  ["Health & Personal Care", ["health", "wellness", "supplement", "vitamin", "nutrition", "ayurveda", "ayurvedic", "immunity", "hygiene", "toothpaste", "sanitary", "deodorant", "protein", "grooming", "hairoil"]],
  ["Clothing & Accessories", ["clothing", "apparel", "fashion", "shirt", "tshirt", "dress", "jeans", "kurta", "saree", "ethnic", "garment", "polo", "innerwear", "lingerie", "sock", "denim", "outfit", "leggings"]],
  ["Home & Kitchen", ["kitchen", "cookware", "utensil", "appliance", "decor", "furniture", "bedsheet", "mattress", "dinnerware", "bedding", "curtain", "candle", "wallart"]],
  ["Electronics", ["electronics", "camera", "headphone", "earbud", "earphone", "speaker", "charger", "powerbank", "smartwatch", "drone", "gadget", "projector"]],
];

const fold = (s: string) =>
  (s || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const norm = (s: string) => fold(s).replace(/[^a-z0-9]/g, "");

export function classify(blob: string): string {
  const s = " " + fold(blob).replace(/[^a-z0-9]+/g, " ") + " ";
  let best = "", sc = 0;
  for (const [cat, kws] of CATEGORY_RULES) {
    let n = 0;
    for (const kw of kws) if (s.includes(" " + kw)) n++;
    if (n > sc) { sc = n; best = cat; }
  }
  return best;
}

const SPAM = /(community|relief|cure|clinic|\bloan\b|crypto|casino|\bbet\b|lottery|earnmoney|weightloss|wholesale|dropship|reseller|freegift|wincash|giveaway|officialstore)/;
const NONPROSPECT = /(facebook|instagram|whatsapp|googleplay|^google$|chatgpt|openai|cgtn|shopee|^canva|sumup|mobikwik|^paytm|phonepe|razorpay|moma|museum|university|college|restaurant|^cvs|gopuff|depop|whatnot|getir|instacart|zepto|blinkit|dollargeneral|^aldi|snapdeal|^meesho|storytv|kukutv|quicktv|bingeworthy|shortdrama|shortfilm|webseries|pocketfm|audiobook|sevenknights|masterchef|mastersoftheuniverse|100mviews|tourism|travels|airlines|airways|\bbank\b|insurance|mutualfund|\bnews\b|\btv\b|\bfm\b|mediaworks|studios?|gaming|\bgames\b|reliancedigital|smartbus|fintech|walletapp|conqueror|challenges|knights|\bott\b|drama|telecom)/;
const GEO = /(usa|uae|arabic|newyork|london|singapore|malaysia|indonesia|vietnam|philippines|pakistan|bangladesh|nepal|srilanka|vermont|\.ae|au)$/;
const EXTRA = /(tomford|sunglasshut|shoecarnival|scooter|^orgain|chamelo|backpackflags|javahouse|abadhotels|\bhotels?\b|idahoclothing|crumble|loreal|mojreel|^moj$|shopsy)/;
const JUNK = /\b(hospital|hospitals|institute|academy|foundation|humanity|charity|resort|chemical|vlog|vlogs|poker|pokerrrr|coaching|cochlear|sharechat|vistaprint|tumi|othoba|apukka|keystone|celsius|wanhua|castrol|nonstop|blockbuster|stories|reel|reels|shorts|status|ias|ngo|hiims|manipal|neuro|vivo|matchmasters|predator|prashantadvait|spotlight|dnn24|dnn|atoz|matw)\b/;
const JUNK2 = /(matchmasters|flowerknows|conorharris|kashif|tamilhealth|flyingcarts|corrugated|chinaonline|suppliers|stationers|thailand|pakistan|snapmint|pinelabs|jarapp|popclub|100m|views|meesho|messycorner|groclub|hundred|livsol|amviews)/;

const GENERIC = new Set(["the", "dr", "mr", "mrs", "new", "india", "indian", "official", "store", "shop", "co", "ltd", "pvt", "and", "of", "by", "for"]);
const EXTRA_BASES = ["loreal", "ajio", "nykaa", "amazon", "flipkart", "garnier", "maybelline", "crocs", "decathlon", "khadim", "tetley"];

export interface Excluder { excluded: (pn: string) => boolean; size: number; }

export function buildExcluder(excludeText: string): Excluder {
  const EXACT = new Set<string>();
  const SUB: string[] = [];
  const BASES = new Set<string>(EXTRA_BASES);
  for (const line of (excludeText || "").split(/\r?\n/)) {
    const n = norm(line);
    if (!n) continue;
    EXACT.add(n);
    if (n.length >= 5) SUB.push(n);
    for (const t of fold(line).split(/[^a-z0-9]+/).filter(Boolean)) {
      if (!GENERIC.has(t) && t.length >= 4) { BASES.add(t); break; }
    }
  }
  const basesArr = Array.from(BASES);
  const excluded = (pn: string) => {
    if (EXACT.has(pn)) return true;
    if (pn.length >= 5) for (const e of SUB) if (pn.includes(e) || e.includes(pn)) return true;
    for (const b of basesArr) if (pn.startsWith(b) && pn.length - b.length <= 10) return true;
    return false;
  };
  return { excluded, size: EXACT.size };
}

function firstImage(d: RawAd): string {
  const a = d.original_image_url;
  if (Array.isArray(a)) return a[0] || "";
  return (a as string) || "";
}

export interface ProcessResult { brands: Brand[]; rawCount: number; drops: Record<string, number>; }

export function processAds(ads: RawAd[], opts: ProcessOpts): ProcessResult {
  const { excluded } = buildExcluder(opts.excludeText);
  const seen = new Set<string>();
  const kept: Brand[] = [];
  const drops = { excl: 0, spam: 0, nonpro: 0, likes: 0, date: 0 };
  for (const d of ads) {
    const page = d.provider_page_name || "";
    const pn = norm(page);
    if (!pn || seen.has(pn)) continue;
    const fn = fold(page).replace(/[^a-z0-9]/g, "");
    const fs = " " + fold(page).replace(/[^a-z0-9]+/g, " ").trim() + " ";
    if (NONPROSPECT.test(fs) || GEO.test(fn) || EXTRA.test(fs) || JUNK.test(fs) || JUNK2.test(fn)) { drops.nonpro++; continue; }
    if (SPAM.test(fs)) { drops.spam++; continue; }
    if (excluded(pn)) { drops.excl++; continue; }
    const st = (d.delivery_start_time || "").slice(0, 10);
    if (st && st < opts.startMin) { drops.date++; continue; }
    const likes = d.page_like_count || 0;
    if (likes < opts.likesMin || likes > opts.likesMax) { drops.likes++; continue; }
    seen.add(pn);
    const blob = [page,
      ...(d.bodies || []), ...(d.creative_link_titles || []),
      ...(d.creative_link_descriptions || []), ...(d.captions || []),
      ...(d.page_categories || [])].join(" ");
    kept.push({ brand: page, category: classify(blob), image: firstImage(d), start: st, likes });
  }
  kept.sort((a, b) => b.likes - a.likes);
  return { brands: kept.slice(0, opts.target), rawCount: ads.length, drops };
}

export function toCSV(brands: Brand[], runDate: string): string {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const head = ["Date", "Brand", "Category", "Image URL", "Ad Start Date", "Page Likes"];
  const lines = [head.join(",")];
  for (const b of brands) lines.push([runDate, b.brand, b.category, b.image, b.start, b.likes].map(esc).join(","));
  return lines.join("\n") + "\n";
}
