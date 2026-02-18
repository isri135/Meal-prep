"use client";

import { useMemo, useState } from "react";

type ParsedIngredient = {
  name: string;
  quantity?: string;
  notes?: string;
};

type DemoResult = {
  title: string;
  ingredients: ParsedIngredient[];
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0b0f19",
    color: "#e5e7eb",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji"',
  },
  container: {
    maxWidth: 980,
    margin: "0 auto",
    padding: "32px 16px 64px",
  },
  nav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "8px 0 24px",
  },
  brand: { display: "flex", alignItems: "center", gap: 10, fontWeight: 700 },
  pill: {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
  },
  hero: {
    borderRadius: 20,
    padding: "28px 22px",
    border: "1px solid rgba(255,255,255,0.12)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
  },
  h1: {
    fontSize: 34,
    lineHeight: 1.15,
    margin: 0,
    letterSpacing: -0.6,
  },
  sub: { marginTop: 10, color: "rgba(229,231,235,0.8)", maxWidth: 760 },
  grid: {
    display: "grid",
    gap: 14,
    gridTemplateColumns: "1fr",
    marginTop: 18,
  },
  row: { display: "flex", gap: 10, flexWrap: "wrap" },
  input: {
    flex: 1,
    minWidth: 260,
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.25)",
    color: "#e5e7eb",
    outline: "none",
  },
  textarea: {
    width: "100%",
    minHeight: 110,
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.25)",
    color: "#e5e7eb",
    outline: "none",
    resize: "vertical",
  },
  btn: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.10)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  },
  btnPrimary: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(99,102,241,0.95)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
  },
  hint: { fontSize: 12, color: "rgba(229,231,235,0.65)", marginTop: 8 },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(12, 1fr)",
    gap: 14,
    marginTop: 18,
  },
  card: {
    gridColumn: "span 12",
    borderRadius: 16,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
  },
  cardTitle: { fontWeight: 700, marginBottom: 6 },
  cardBody: { color: "rgba(229,231,235,0.78)", fontSize: 14, lineHeight: 1.5 },
  sectionTitle: { marginTop: 26, fontSize: 18, fontWeight: 800 },
  chips: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 },
  chip: {
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    cursor: "pointer",
    fontSize: 13,
  },
  resultWrap: {
    marginTop: 18,
    borderRadius: 16,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.22)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: 10,
    fontSize: 14,
  },
  th: {
    textAlign: "left",
    fontSize: 12,
    color: "rgba(229,231,235,0.65)",
    padding: "10px 8px",
    borderBottom: "1px solid rgba(255,255,255,0.10)",
  },
  td: {
    padding: "10px 8px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    verticalAlign: "top",
  },
  footer: {
    marginTop: 40,
    paddingTop: 20,
    borderTop: "1px solid rgba(255,255,255,0.10)",
    color: "rgba(229,231,235,0.65)",
    fontSize: 12,
  },
};

const demoSuggestions = [
  {
    label: "Chicken Alfredo",
    value:
      "Chicken Alfredo\n\nIngredients:\n- 2 chicken breasts\n- 250g fettuccine\n- 1 cup heavy cream\n- 1/2 cup parmesan\n- 2 cloves garlic\n- Salt, pepper",
  },
  {
    label: "Taco Night",
    value:
      "Taco Night\n\nIngredients:\n- 1 lb ground beef\n- Taco seasoning\n- Tortillas\n- Lettuce\n- Cheddar cheese\n- Salsa\n- Sour cream",
  },
  {
    label: "Greek Salad",
    value:
      "Greek Salad\n\nIngredients:\n- Cucumber\n- Tomato\n- Red onion\n- Feta cheese\n- Kalamata olives\n- Olive oil\n- Lemon",
  },
];

function naiveParse(text: string): DemoResult {
  // Placeholder parser: splits lines starting with "-" into ingredients.
  // Replace later with LLM / structured recipe parsing.
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const title = lines[0] || "Recipe";
  const ingredients: ParsedIngredient[] = [];

  for (const line of lines) {
    if (line.startsWith("-")) {
      const raw = line.replace(/^-+/, "").trim();
      // very basic "quantity + name" split
      const m = raw.match(/^([\d/.\s]+(?:cup|cups|tbsp|tsp|g|kg|lb|oz)?\s*)?(.*)$/i);
      const quantity = (m?.[1] || "").trim() || undefined;
      const name = (m?.[2] || raw).trim();
      ingredients.push({ name, quantity });
    }
  }

  return { title, ingredients };
}

export default function HomePage() {
  const [mode, setMode] = useState<"recipe" | "url">("recipe");
  const [recipeText, setRecipeText] = useState(demoSuggestions[0].value);
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<DemoResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const canRun = useMemo(() => {
    if (mode === "recipe") return recipeText.trim().length > 0;
    return url.trim().length > 0;
  }, [mode, recipeText, url]);

  async function handleGenerate() {
    setIsLoading(true);
    try {
      // TODO: Replace with API call:
      // - if mode=url => fetch transcript/recipe from URL
      // - parse ingredients with LLM or structured parser
      // - match to retailer catalog
      // For now: demo parsing from recipe text.
      const textToParse = mode === "recipe" ? recipeText : `Recipe from URL: ${url}\n- (placeholder ingredient)`;
      const parsed = naiveParse(textToParse);
      setResult(parsed);
    } finally {
      setIsLoading(false);
    }
  }

  function loadSuggestion(val: string) {
    setMode("recipe");
    setRecipeText(val);
    setResult(null);
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.nav}>
          <div style={styles.brand}>
            <span style={{ fontSize: 18 }}>🛒</span>
            <span>Grocer</span>
            <span style={styles.pill}>MVP</span>
          </div>
          <div style={styles.row}>
            <span style={styles.pill}>Recipe → Grocery List</span>
            <span style={styles.pill}>Retailer-ready</span>
          </div>
        </header>

        <section style={styles.hero}>
          <h1 style={styles.h1}>Turn any recipe into a shoppable grocery list.</h1>
          <p style={styles.sub}>
            Paste a recipe or a TikTok/URL. We’ll extract ingredients, normalize quantities,
            and prep a list you can map to Walmart / Instacart / DoorDash later.
          </p>

          <div style={styles.grid}>
            <div style={styles.row}>
              <button
                style={mode === "recipe" ? styles.btnPrimary : styles.btn}
                onClick={() => setMode("recipe")}
                type="button"
              >
                Paste recipe
              </button>
              <button
                style={mode === "url" ? styles.btnPrimary : styles.btn}
                onClick={() => setMode("url")}
                type="button"
              >
                Paste URL
              </button>
            </div>

            {mode === "url" ? (
              <>
                <div style={styles.row}>
                  <input
                    style={styles.input}
                    placeholder="Paste TikTok / YouTube / blog URL..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                  <button
                    style={{ ...styles.btnPrimary, opacity: canRun ? 1 : 0.6 }}
                    onClick={handleGenerate}
                    disabled={!canRun || isLoading}
                    type="button"
                  >
                    {isLoading ? "Working..." : "Generate list"}
                  </button>
                </div>
                <div style={styles.hint}>
                  Later: fetch transcript → parse ingredients → match items → open retailer cart.
                </div>
              </>
            ) : (
              <>
                <textarea
                  style={styles.textarea}
                  value={recipeText}
                  onChange={(e) => setRecipeText(e.target.value)}
                  placeholder="Paste recipe text here..."
                />
                <div style={styles.row}>
                  <button
                    style={{ ...styles.btnPrimary, opacity: canRun ? 1 : 0.6 }}
                    onClick={handleGenerate}
                    disabled={!canRun || isLoading}
                    type="button"
                  >
                    {isLoading ? "Parsing..." : "Generate list"}
                  </button>
                  <button
                    style={styles.btn}
                    onClick={() => {
                      setRecipeText("");
                      setResult(null);
                    }}
                    type="button"
                  >
                    Clear
                  </button>
                </div>
                <div style={styles.hint}>
                  Tip: start with simple bullet lists. You can swap in an LLM parser later.
                </div>

                <div style={styles.sectionTitle}>Quick examples</div>
                <div style={styles.chips}>
                  {demoSuggestions.map((s) => (
                    <button
                      key={s.label}
                      style={styles.chip}
                      onClick={() => loadSuggestion(s.value)}
                      type="button"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        <section style={styles.cardGrid}>
          <div style={{ ...styles.card, gridColumn: "span 12" }}>
            <div style={styles.cardTitle}>How this will work (later)</div>
            <div style={styles.cardBody}>
              1) Extract ingredients → 2) Normalize units → 3) Match to store SKUs → 4) Create a
              shoppable list / cart handoff.
            </div>
          </div>

          <div style={{ ...styles.card, gridColumn: "span 12" }}>
            <div style={styles.cardTitle}>Retailer connectors (placeholder)</div>
            <div style={styles.cardBody}>
              Start with one: Instacart recipe page, Walmart catalog matching, etc. This homepage is
              ready for wiring up your API routes.
            </div>
          </div>
        </section>

        <section>
          <div style={styles.sectionTitle}>Parsed ingredients (demo)</div>

          <div style={styles.resultWrap}>
            {!result ? (
              <div style={{ color: "rgba(229,231,235,0.7)" }}>
                Run “Generate list” to see a placeholder output here.
              </div>
            ) : result.ingredients.length === 0 ? (
              <div style={{ color: "rgba(229,231,235,0.7)" }}>
                No ingredients detected yet. (This is expected with the placeholder parser.)
              </div>
            ) : (
              <>
                <div style={{ fontWeight: 800 }}>{result.title}</div>

                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Ingredient</th>
                      <th style={styles.th}>Qty</th>
                      <th style={styles.th}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.ingredients.map((ing, i) => (
                      <tr key={i}>
                        <td style={styles.td}>{ing.name}</td>
                        <td style={styles.td}>{ing.quantity || "—"}</td>
                        <td style={styles.td}>{ing.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={styles.hint}>(Next step: map each ingredient → retailer product SKU.)</div>
              </>
            )}
          </div>
        </section>

        <footer style={styles.footer}>
          Built with Next.js App Router. Next: add <code>/api/parse</code> and <code>/api/match</code>.
        </footer>
      </div>
    </main>
  );
}
