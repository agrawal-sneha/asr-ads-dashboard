"use client";

import { useEffect, useMemo, useState } from "react";
import { processAds, toCSV, type RawAd, type Brand } from "@/lib/pipeline";

const DEFAULT_KEYWORDS = [
  "beauty", "sale", "electronics", "skincare", "serum", "perfume", "shampoo", "haircare",
  "makeup", "sunscreen", "protein", "supplements", "ayurvedic", "coffee", "tea", "snacks",
  "chocolate", "dry fruits", "sneakers", "sandals", "watches", "sunglasses", "handbag",
  "backpack", "kurta", "saree", "activewear", "lingerie", "cookware", "home decor",
  "bedsheet", "candles", "toys", "stationery", "pet food", "earbuds", "smartwatch",
  "water bottle", "baby care", "jewellery",
].join("\n");

const CONCURRENCY = 4;

export default function Page() {
  const [keywords, setKeywords] = useState(DEFAULT_KEYWORDS);
  const [country, setCountry] = useState("IN");
  const [startMin, setStartMin] = useState("2025-08-01");
  const [count, setCount] = useState(70);
  const [likesMin, setLikesMin] = useState(1000);
  const [likesMax, setLikesMax] = useState(3000000);
  const [target, setTarget] = useState(110);
  const [exclude, setExclude] = useState("");

  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [totalKw, setTotalKw] = useState(0);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [rawCount, setRawCount] = useState(0);
  const [err, setErr] = useState("");

  // persist the exclusion list locally so you don't re-paste it each run
  useEffect(() => { setExclude(localStorage.getItem("asr_exclude") || ""); }, []);
  useEffect(() => { localStorage.setItem("asr_exclude", exclude); }, [exclude]);

  const kwList = useMemo(
    () => keywords.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
    [keywords]
  );

  async function run() {
    setErr(""); setRunning(true); setBrands([]); setDone(0); setRawCount(0);
    const list = kwList;
    setTotalKw(list.length);
    const allAds: RawAd[] = [];
    let firstError = "";

    let i = 0;
    async function worker() {
      while (i < list.length) {
        const idx = i++;
        const kw = list[idx];
        try {
          const u = `/api/scrape?q=${encodeURIComponent(kw)}&country=${encodeURIComponent(country)}&count=${count}&start=${startMin}`;
          const r = await fetch(u);
          const j = await r.json();
          if (j.error && !firstError) firstError = j.error;
          if (Array.isArray(j.ads)) allAds.push(...j.ads);
        } catch (e: any) {
          if (!firstError) firstError = String(e?.message || e);
        } finally {
          setDone((d) => d + 1);
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, worker));

    const res = processAds(allAds, { excludeText: exclude, startMin, likesMin, likesMax, target });
    setBrands(res.brands);
    setRawCount(res.rawCount);
    if (firstError && res.brands.length === 0) setErr(firstError);
    else if (firstError) setErr("Some keywords failed: " + firstError);
    setRunning(false);
  }

  function downloadCSV() {
    const runDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).replace(/ /g, "-");
    const blob = new Blob([toCSV(brands, runDate)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `asr_brands_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function copyImages() {
    navigator.clipboard.writeText(brands.map((b) => b.image).join("\n"));
  }

  const pct = totalKw ? Math.round((done / totalKw) * 100) : 0;

  return (
    <div className="wrap">
      <h1>ASR Ad-Library Brand Finder</h1>
      <p className="sub">Discover net-new D2C brands from the Meta Ad Library (via metapi.io), filtered against your exclusion list, classified, with ad creatives.</p>

      <div className="panel">
        <div className="grid">
          <div><label>Country</label><input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} /></div>
          <div><label>Ad start date ≥</label><input type="date" value={startMin} onChange={(e) => setStartMin(e.target.value)} /></div>
          <div><label>Ads per keyword</label><input type="number" value={count} onChange={(e) => setCount(+e.target.value)} /></div>
          <div><label>Min page likes</label><input type="number" value={likesMin} onChange={(e) => setLikesMin(+e.target.value)} /></div>
          <div><label>Max page likes</label><input type="number" value={likesMax} onChange={(e) => setLikesMax(+e.target.value)} /></div>
          <div><label>Target (max brands)</label><input type="number" value={target} onChange={(e) => setTarget(+e.target.value)} /></div>
        </div>
        <div className="row" style={{ alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <label>Keywords (one per line) — {kwList.length}</label>
            <textarea rows={6} value={keywords} onChange={(e) => setKeywords(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: 280 }}>
            <label>Exclusion list — brands to never include (one per line, saved in your browser)</label>
            <textarea rows={6} value={exclude} onChange={(e) => setExclude(e.target.value)} placeholder="Paste your full brand universe here…" />
          </div>
        </div>
        <div className="row">
          <button onClick={run} disabled={running || kwList.length === 0}>{running ? "Running…" : "Run discovery"}</button>
          <button className="secondary" onClick={downloadCSV} disabled={!brands.length}>Download CSV</button>
          <button className="secondary" onClick={copyImages} disabled={!brands.length}>Copy image URLs</button>
          {running && (
            <div style={{ flex: 1, minWidth: 200 }}>
              <div className="bar"><i style={{ width: pct + "%" }} /></div>
              <div className="stat">{done}/{totalKw} keywords</div>
            </div>
          )}
        </div>
        {err && <p className="err">{err}</p>}
      </div>

      {brands.length > 0 && (
        <div className="panel">
          <div className="row" style={{ marginTop: 0, justifyContent: "space-between" }}>
            <strong>{brands.length} net-new brands</strong>
            <span className="stat">{rawCount.toLocaleString()} ads scanned · excluded list applied · deduped</span>
          </div>
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table>
              <thead>
                <tr><th>#</th><th>Image</th><th>Brand</th><th>Category</th><th>Page likes</th><th>Ad start</th></tr>
              </thead>
              <tbody>
                {brands.map((b, i) => (
                  <tr key={b.brand + i}>
                    <td className="muted">{i + 1}</td>
                    <td>
                      <div className="imgcell">
                        {b.image
                          ? <a href={b.image} target="_blank" rel="noreferrer"><img className="thumb" src={b.image} alt={b.brand} loading="lazy" /></a>
                          : <span className="muted" style={{ fontSize: 11 }}>video / none</span>}
                      </div>
                    </td>
                    <td className="brand">{b.brand}</td>
                    <td>{b.category ? <span className="pill">{b.category}</span> : <span className="muted">—</span>}</td>
                    <td>{b.likes.toLocaleString()}</td>
                    <td className="muted">{b.start}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
