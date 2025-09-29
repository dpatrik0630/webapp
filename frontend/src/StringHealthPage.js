import React, { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import api from "./axiosConfig.js";
import LogoutButton from "./LogoutButton.js";

const fmtUTC = (iso) =>
  new Date(iso).toLocaleString("hu-HU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
  });

const styles = {
  page: { padding: 16, maxWidth: 1280, margin: "0 auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  left: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  title: { fontSize: 28, fontWeight: 800 },
  backBtn: {
    marginLeft: 8, padding: "8px 12px", borderRadius: 8,
    border: "1px solid #2563eb", color: "#2563eb", background: "#fff", cursor: "pointer"
  },
  toolbar: { display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" },
  select: { padding: 8, borderRadius: 8, border: "1px solid #ddd" },
  input: { padding: 8, borderRadius: 8, border: "1px solid #ddd", minWidth: 220 },
  card: { background: "#fff", borderRadius: 12, boxShadow: "0 6px 24px rgba(0,0,0,.06)" },
  cardBody: { padding: 12, overflow: "auto" },
  info: { padding: "8px 0", color: "#374151" },
  error: { padding: "8px 0", color: "#dc2626" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: { textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #eee", background: "#fafafa", cursor: "pointer", whiteSpace: "nowrap" },
  td: { padding: "8px 10px", borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap" },
  badge: {
    display: "inline-block", padding: "2px 8px", borderRadius: 999,
    background: "#eef2ff", color: "#3730a3", fontSize: 12, marginLeft: 8
  }
};

const StringHealthPage = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [plantFilter, setPlantFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("plant_name");
  const [sortDir, setSortDir] = useState("asc"); // 'asc' | 'desc'

  useEffect(() => {
    (async () => {
      setLoading(true); setErr("");
      try {
        const { data } = await api.get("/api/string-health/latest");
        setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        setErr("Nem sikerült lekérni a String Health adatokat.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

    const lastCheck = useMemo(
    () => (rows.length ? fmtUTC(rows[0]?.check_hour) : null),
    [rows]
    );

  const plants = useMemo(() => {
    const s = new Set(rows.map(r => r.plant_name).filter(Boolean));
    return ["ALL", ...Array.from(s).sort((a, b) => a.localeCompare(b, "hu"))];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows.filter(r =>
      (plantFilter === "ALL" || r.plant_name === plantFilter) &&
      (
        !q ||
        r.plant_name?.toLowerCase().includes(q) ||
        r.inverter_name?.toLowerCase().includes(q) ||
        String(r.slave_id ?? "").includes(q) ||
        String(r.string_index ?? "").includes(q)
      )
    );
    list.sort((a, b) => {
      const A = a[sortKey]; const B = b[sortKey];
      let cmp;
      if (typeof A === "number" && typeof B === "number") cmp = A - B;
      else cmp = String(A ?? "").localeCompare(String(B ?? ""), "hu", { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [rows, plantFilter, search, sortKey, sortDir]);

  const setSort = (key) => {
    if (key === sortKey) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  return (
    <div style={styles.page}>
      {/* Fejléc */}
      <div style={styles.header}>
        <div style={styles.left}>
          <div style={styles.title}>
            String Health
            
          </div>
          <NavLink to="/" style={styles.backBtn}>⟵ Erőművek</NavLink>
          {lastCheck && <span style={styles.badge}>{lastCheck}</span>}
        </div>
        <LogoutButton />
      </div>

      {/* Szűrők */}
      <div style={styles.toolbar}>
        <select
          value={plantFilter}
          onChange={e => setPlantFilter(e.target.value)}
          style={styles.select}
          title="Erőmű szűrő"
        >
          {plants.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <input
          type="text"
          placeholder="Keresés (erőmű / inverter / slave / string)"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={styles.input}
        />
      </div>

      {/* Tábla */}
      <div style={styles.card}>
        <div style={styles.cardBody}>
          {loading && <div style={styles.info}>Betöltés…</div>}
          {err && <div style={styles.error}>{err}</div>}

          {!loading && !err && (
            filtered.length === 0 ? (
              <div style={styles.info}>Nincs hibás string az utolsó futásban.</div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th} onClick={() => setSort("plant_name")}>Erőmű</th>
                    <th style={styles.th} onClick={() => setSort("inverter_name")}>Inverter</th>
                    <th style={styles.th} onClick={() => setSort("slave_id")}>Slave ID</th>
                    <th style={styles.th} onClick={() => setSort("string_index")}>String #</th>
                    <th style={{ ...styles.th, textAlign: "right" }} onClick={() => setSort("v")}>V [V]</th>
                    <th style={{ ...styles.th, textAlign: "right" }} onClick={() => setSort("a")}>A [A]</th>
                    <th style={styles.th} onClick={() => setSort("check_hour")}>Check hour</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={i}>
                      <td style={styles.td}>{r.plant_name}</td>
                      <td style={styles.td}>{r.inverter_name}</td>
                      <td style={styles.td}>{r.slave_id}</td>
                      <td style={styles.td}>{r.string_index}</td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        {r.v == null ? "–" : Number(r.v).toFixed(1)}
                      </td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        {r.a == null ? "–" : Number(r.a).toFixed(2)}
                      </td>
                      <td style={styles.td}>
                        {r.check_hour ? fmtUTC(r.check_hour) : "–"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default StringHealthPage;
