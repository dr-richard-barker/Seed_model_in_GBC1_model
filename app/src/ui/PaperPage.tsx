import { useMemo, useState } from "react";
import { LEDGER, REFERENCES } from "../model/params";

const BIBTEX_CITATION = `@misc{barker2026leafgbc1,
  author  = {Barker, Richard and Porterfield, D. Marshall},
  title   = {Multiscale 3D cellular digital twin of a 164-seed plant community in the Artemis III LEAF growth chamber: microclimate CFD, foliar crowding, and substrate boundary-layer dynamics},
  year    = {2026},
  note    = {Manuscript prepared for submission to npj Microgravity},
  url     = {https://dr-richard-barker.github.io/Seed_model_in_GBC1_model/}
}`;

export function PaperPage() {
  const [docTab, setDocTab] = useState<"main" | "supp" | "ledger">("main");
  const [copiedBib, setCopiedBib] = useState(false);
  const [search, setSearch] = useState("");

  const filteredLedger = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return LEDGER;
    return LEDGER.filter(
      (entry) =>
        entry.id.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q) ||
        entry.group.toLowerCase().includes(q) ||
        entry.source.toLowerCase().includes(q),
    );
  }, [search]);

  const activePdf =
    docTab === "supp" ? "./supplementary_information.pdf" : "./leaf_gbc1_community_npj_microgravity.pdf";

  const copyBibtex = () => {
    navigator.clipboard?.writeText(BIBTEX_CITATION);
    setCopiedBib(true);
    window.setTimeout(() => setCopiedBib(false), 2000);
  };

  return (
    <div className="portal-page">
      <section className="portal-section" style={{ marginTop: 0 }}>
        <div className="paper-toolbar">
          <div className="btn-group">
            <button
              className={`btn ${docTab === "main" ? "active" : ""}`}
              onClick={() => setDocTab("main")}
            >
              📄 Main Manuscript (npj Microgravity, 9 pp.)
            </button>
            <button
              className={`btn ${docTab === "supp" ? "active" : ""}`}
              onClick={() => setDocTab("supp")}
            >
              📑 Supplementary Information (Figs. S1–S5, 5 pp.)
            </button>
            <button
              className={`btn ${docTab === "ledger" ? "active" : ""}`}
              onClick={() => setDocTab("ledger")}
            >
              📊 Parameter Provenance Ledger ({LEDGER.length} entries)
            </button>
          </div>

          <div className="btn-group">
            {docTab !== "ledger" && (
              <>
                <a className="btn" href={activePdf} target="_blank" rel="noreferrer">
                  ↗ Open PDF in New Tab
                </a>
                <a className="btn active" href={activePdf} download>
                  ⬇ Download PDF
                </a>
              </>
            )}
            <button className="btn" onClick={copyBibtex}>
              {copiedBib ? "✓ Copied BibTeX" : "📋 Copy BibTeX"}
            </button>
          </div>
        </div>

        {docTab !== "ledger" ? (
          <div className="pdf-reader-shell">
            <iframe
              key={activePdf}
              src={`${activePdf}#view=FitH`}
              title={docTab === "main" ? "Main Manuscript PDF" : "Supplementary Information PDF"}
              className="pdf-iframe"
            />
          </div>
        ) : (
          <div className="ledger-shell">
            <div className="ledger-search-bar">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search parameter ID, group, description, or literature source..."
              />
              <span className="section-sub">
                Showing {filteredLedger.length} of {LEDGER.length} parameters
              </span>
            </div>
            <div className="ledger-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Parameter ID</th>
                    <th>Value</th>
                    <th>Unit</th>
                    <th>Tier</th>
                    <th>Group</th>
                    <th>Description &amp; Primary Source</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLedger.map((entry) => {
                    const ref = REFERENCES.find((r) => r.key === entry.source);
                    return (
                      <tr key={entry.id}>
                        <td className="mono">{entry.id}</td>
                        <td className="mono">{String(entry.value)}</td>
                        <td>{entry.unit}</td>
                        <td>
                          <span className="tier-badge">{entry.tier}</span>
                        </td>
                        <td>{entry.group}</td>
                        <td>
                          <div>{entry.description}</div>
                          {ref ? (
                            <div className="ref-sub">
                              [{entry.source}] {ref.authors} ({ref.year}). <em>{ref.journal}</em>.{" "}
                              {ref.doi && (
                                <a href={`https://doi.org/${ref.doi}`} target="_blank" rel="noreferrer">
                                  doi:{ref.doi}
                                </a>
                              )}
                            </div>
                          ) : (
                            <div className="ref-sub">Source: {entry.source}</div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
