import { NextRequest, NextResponse } from "next/server";

// One keyword = one short-lived serverless invocation: create task -> poll -> fetch.
export const maxDuration = 60; // seconds (Vercel Hobby allows up to 60)
export const dynamic = "force-dynamic";

const BASE = "https://api.metapi.io/v1/tasks";

async function mp(path: string, key: string, init?: RequestInit) {
  const r = await fetch(BASE + path, {
    ...init,
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  const text = await r.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { error: text }; }
  return { status: r.status, json };
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

export async function GET(req: NextRequest) {
  const key = process.env.METAPI_KEY;
  if (!key) return NextResponse.json({ error: "METAPI_KEY not configured on the server." }, { status: 500 });

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q");
  if (!q) return NextResponse.json({ error: "missing q" }, { status: 400 });
  const country = sp.get("country") || "IN";
  const count = Math.min(parseInt(sp.get("count") || "70", 10) || 70, 100);
  const startMin = sp.get("start") || "2025-08-01";

  // 1. create task
  const create = await mp("", key, {
    method: "POST",
    body: JSON.stringify({
      q, country, count, active_status: "active", ad_type: "all", media_type: "all",
      search_type: "keyword_unordered",
      sort_data: { mode: "total_impressions", direction: "desc" },
      start_date_min: startMin,
    }),
  });
  if (create.status >= 300 || !create.json?.task_id) {
    return NextResponse.json({ error: create.json?.error || "create failed", status: create.status }, { status: 502 });
  }
  const tid = create.json.task_id as string;

  // 2. poll (cap to stay within maxDuration)
  let state = "running";
  const deadline = Date.now() + 48_000;
  while (Date.now() < deadline) {
    await sleep(3000);
    const s = await mp(`/${tid}/status`, key);
    state = s.json?.status || "";
    if (["succeeded", "failed", "timed_out", "aborted"].includes(state)) break;
  }
  if (state !== "succeeded") {
    return NextResponse.json({ q, ads: [], note: `task ${state || "timeout"}` });
  }

  // 3. fetch results (paginate, capped)
  const ads: any[] = [];
  let offset = 0;
  while (offset <= 150) {
    const r = await mp(`/${tid}/results?offset=${offset}&limit=50`, key);
    const batch = r.json?.data || [];
    ads.push(...batch);
    if (!r.json?.pagination?.has_more) break;
    offset += 50;
  }

  // return only the fields the client pipeline needs (keeps payload small)
  const slim = ads.map((d) => ({
    provider_page_name: d.provider_page_name,
    original_image_url: d.original_image_url,
    page_categories: d.page_categories,
    bodies: d.bodies,
    creative_link_titles: d.creative_link_titles,
    creative_link_descriptions: d.creative_link_descriptions,
    captions: d.captions,
    delivery_start_time: d.delivery_start_time,
    page_like_count: d.page_like_count,
  }));
  return NextResponse.json({ q, ads: slim });
}
