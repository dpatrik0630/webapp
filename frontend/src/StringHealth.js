import React from "react";

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 16,
  },
  modal: {
    background: "#fff",
    width: "100%",
    maxWidth: 980,
    borderRadius: 12,
    boxShadow: "0 18px 60px rgba(0,0,0,.2)",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    borderBottom: "1px solid #eee",
  },
  title: { fontSize: 18, fontWeight: 700 },
  close: {
    border: "none",
    background: "transparent",
    fontSize: 18,
    cursor: "pointer",
    padding: 6,
    lineHeight: 1,
  },
  body: { padding: 16, maxHeight: "70vh", overflow: "auto" },
  tableWrap: { width: "100%", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: { textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #eee", background: "#fafafa" },
  td: { padding: "8px 10px", borderBottom: "1px solid #f3f4f6" },
  err: { color: "#dc2626", padding: "8px 0" },
};

const StringHealth = ({ open, onClose, loading, error, rows }) => {
  if (!open) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div style={styles.title}>Utolsó futás hibás stringjei</div>
          <button style={styles.close} onClick={onClose} aria-label="Bezár">×</button>
        </div>

        <div style={styles.body}>
          {loading && <div>Betöltés…</div>}
          {error && <div style={styles.err}>{error}</div>}

          {!loading && !error && (
            rows?.length ? (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Erőmű</th>
                      <th style={styles.th}>Inverter</th>
                      <th style={styles.th}>Slave&nbsp;ID</th>
                      <th style={styles.th}>String&nbsp;#</th>
                      <th style={{...styles.th, textAlign:"right"}}>V [V]</th>
                      <th style={{...styles.th, textAlign:"right"}}>A [A]</th>
                      <th style={styles.th}>Check hour</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <td style={styles.td}>{r.plant_name}</td>
                        <td style={styles.td}>{r.inverter_name}</td>
                        <td style={styles.td}>{r.slave_id}</td>
                        <td style={styles.td}>{r.string_index}</td>
                        <td style={{...styles.td, textAlign:"right"}}>{r.v == null ? "–" : Number(r.v).toFixed(1)}</td>
                        <td style={{...styles.td, textAlign:"right"}}>{r.a == null ? "–" : Number(r.a).toFixed(2)}</td>
                        <td style={styles.td}>{new Date(r.check_hour).toLocaleString("hu-HU")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div>Nincs hibás string az utolsó futásban.</div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default StringHealth;
