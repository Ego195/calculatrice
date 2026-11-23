import { useEffect, useState } from "react";
import { downloadCsv, fetchResults, fetchVotes, sendVote } from "./api.js";

const CHOICES = [
  { value: "Très bien", mark: "↗", note: "Au-dessus des attentes" },
  { value: "Bien", mark: "✳", note: "Une bonne expérience" },
  { value: "Moyen", mark: "◌", note: "Peut mieux faire" },
  { value: "À revoir", mark: "↻", note: "À retravailler ensemble" },
];
const EMPTY_RESULTS = CHOICES.map((item) => ({
  label: item.value,
  count: 0,
  percentage: 0,
}));

function Globe() {
  const technologies = ["python", "react", "supabase", "render"];

  return (
    <div
      className="globe-scene"
      role="img"
      aria-label="Sphère lumineuse entourée des technologies Python, React, Supabase et Render"
    >
      <div className="globe-aura" />
      <div className="globe-orbit globe-orbit-one" />
      <div className="globe-orbit globe-orbit-two" />
      <svg className="globe-slogan" viewBox="0 0 320 320" aria-hidden="true">
        <defs>
          <path
            id="globe-slogan-path"
            d="M160 160 m-140 0 a140 140 0 1 1 280 0 a140 140 0 1 1 -280 0"
          />
        </defs>
        <text>
          <textPath href="#globe-slogan-path" textLength="680" lengthAdjust="spacing">
            UNE VOIX · UN INSTANT · UNE CLASSE · UNE VOIX · UN INSTANT · UNE CLASSE ·
          </textPath>
        </text>
      </svg>
      <div className="wire-globe" aria-hidden="true">
        {Array.from({ length: 9 }, (_, index) => (
          <span
            className="globe-ring globe-ring-vertical"
            key={`vertical-${index}`}
            style={{ "--ring-rotation": `${index * 20}deg` }}
          />
        ))}
        {[0, 1, 2, 3, 4].map((index) => (
          <span
            className="globe-ring globe-ring-horizontal"
            key={`horizontal-${index}`}
            style={{
              "--ring-height": `${22 + index * 14}%`,
              "--ring-scale": `${0.35 + index * 0.16}`,
            }}
          />
        ))}
      </div>
      <span className="globe-core" />
      <div className="orbit-technologies" aria-hidden="true">
        {technologies.map((technology) => (
          <span className={`orbit-tech orbit-tech-${technology}`} key={technology}>
            <TechIcon technology={technology} />
            <span>{technology}</span>
          </span>
        ))}
      </div>
      <span className="globe-caption">SIGNAL / 01</span>
    </div>
  );
}

function TechIcon({ technology }) {
  if (technology === "react") {
    return (
      <svg className="orbit-tech-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <ellipse cx="12" cy="12" rx="10" ry="4" />
        <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
        <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" />
        <circle cx="12" cy="12" r="1.6" />
      </svg>
    );
  }
  if (technology === "python") {
    return (
      <svg className="orbit-tech-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path className="python-mark-blue" d="M12 2.5c-4.4 0-4.5 2-4.5 4.5v2.1h9v1.3H6.3C3.6 10.4 2.5 12.5 2.5 15s1.3 4.1 4 4.1h2.2v-2c0-2.4 1.8-4.2 4.1-4.2h4.5c2.6 0 4.2-1.7 4.2-4.2V6.4c0-2.5-2.2-3.9-4.7-3.9H12Z" />
        <path className="python-mark-yellow" d="M12 21.5c4.4 0 4.5-2 4.5-4.5v-2.1h-9v-1.3h10.2c2.7 0 3.8-2.1 3.8-4.6s-1.3-4.1-4-4.1h-2.2v2c0 2.4-1.8 4.2-4.1 4.2H6.7c-2.6 0-4.2 1.7-4.2 4.2v2.3c0 2.5 2.2 3.9 4.7 3.9H12Z" />
        <circle className="python-eye" cx="10" cy="5.4" r=".8" />
        <circle className="python-eye" cx="14" cy="18.6" r=".8" />
      </svg>
    );
  }
  if (technology === "supabase") {
    return (
      <svg className="orbit-tech-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M13.2 2.5 4.6 13h6.2l-.8 8.5L19.4 11h-6.2l.8-8.5Z" />
      </svg>
    );
  }
  return (
    <svg className="orbit-tech-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 20V4h7a4.5 4.5 0 0 1 0 9H5m7 0 7 7" />
    </svg>
  );
}

function Startup({ onSkip }) {
  return (
    <div className="startup-screen">
      <div className="startup-grid" />
      <div className="startup-sequence">
        <div className="startup-device">
          <div className="startup-device-top">
            <span className="startup-led" />
            <span>STUDIO / OPINION</span>
            <span>BOOT 01</span>
          </div>
          <div className="startup-display">
            <span>INITIALISATION DU SONDAGE</span>
            <span className="startup-display-mark">S.</span>
          </div>
          <div className="startup-keys">
            {Array.from({ length: 8 }, (_, index) => <i key={index} />)}
          </div>
        </div>
        <div className="startup-identity">
          <span className="startup-mini-sphere" />
          <span className="startup-name">SONDAGE</span>
        </div>
        <p className="startup-message">UNE VOIX, UN INSTANT</p>
        <div className="startup-progress"><span /></div>
      </div>
      <button className="startup-skip" onClick={onSkip} type="button">
        PASSER L’INTRO
      </button>
    </div>
  );
}

function App() {
  const [introVisible, setIntroVisible] = useState(true);
  const [nickname, setNickname] = useState("");
  const [choice, setChoice] = useState("");
  const [results, setResults] = useState(EMPTY_RESULTS);
  const [votes, setVotes] = useState([]);
  const [total, setTotal] = useState(0);
  const [connectionState, setConnectionState] = useState("Connexion à l’API…");
  const [formMessage, setFormMessage] = useState("");
  const [formError, setFormError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [adminKey, setAdminKey] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(
      () => setIntroVisible(false),
      reduced ? 500 : 7600,
    );
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("intro-running", introVisible);
    return () => document.body.classList.remove("intro-running");
  }, [introVisible]);

  useEffect(() => {
    const elements = document.querySelectorAll("[data-reveal]");
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    ) {
      elements.forEach((element) => element.classList.add("is-revealed"));
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        }
      }),
      { threshold: 0.14 },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  async function refreshData() {
    const [resultData, voteData] = await Promise.all([
      fetchResults(),
      fetchVotes(),
    ]);
    setResults(resultData.results);
    setTotal(resultData.total);
    setVotes(voteData.votes);
    setConnectionState("Base Supabase connectée");
  }

  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const [resultData, voteData] = await Promise.all([
          fetchResults(),
          fetchVotes(),
        ]);
        if (!active) return;
        setResults(resultData.results);
        setTotal(resultData.total);
        setVotes(voteData.votes);
        setConnectionState("Base Supabase connectée");
      } catch (error) {
        if (active) setConnectionState(error.message);
      }
    }
    refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  async function handleVote(event) {
    event.preventDefault();
    setFormMessage("");
    setFormError(false);
    setIsSubmitting(true);
    try {
      const saved = await sendVote({ nickname, choice });
      setNickname("");
      setChoice("");
      setFormMessage(saved.message);
      try {
        await refreshData();
      } catch (error) {
        setConnectionState(error.message);
      }
    } catch (error) {
      setFormMessage(error.message);
      setFormError(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleExport(event) {
    event.preventDefault();
    setExportMessage("");
    setIsExporting(true);
    try {
      const response = await downloadCsv(adminKey);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "sondage-classe.csv";
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setExportMessage("Export téléchargé.");
    } catch (error) {
      setExportMessage(error.message);
    } finally {
      setIsExporting(false);
    }
  }

  const sortedResults = [...results].sort(
    (first, second) =>
      second.count - first.count ||
      CHOICES.findIndex((item) => item.value === first.label) -
        CHOICES.findIndex((item) => item.value === second.label),
  );

  return (
    <>
      {introVisible && <Startup onSkip={() => setIntroVisible(false)} />}
      <svg className="sky-map" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
        <g className="sky-lines">
          <path d="M170 220 L270 185 L350 290 L500 485 L650 305 L760 205" />
          <path d="M270 185 L325 100 M760 205 L820 110 M350 290 L310 410 L470 495 L630 410 L650 305" />
          <path className="sky-violet" d="M500 485 Q455 610 380 760" />
        </g>
        <g className="sky-stars">
          <circle cx="170" cy="220" r="5" /><circle cx="270" cy="185" r="4" />
          <circle cx="350" cy="290" r="3" /><circle cx="500" cy="485" r="4" />
          <circle cx="650" cy="305" r="4" /><circle cx="760" cy="205" r="5" />
          <circle cx="310" cy="410" r="3" /><circle cx="630" cy="410" r="3" />
          <circle className="sky-star-violet" cx="380" cy="760" r="6" />
        </g>
      </svg>
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <main className="page-shell">
        <header className="topbar">
          <a className="brand" href="#accueil" aria-label="Sondage, accueil">
            <span className="brand-mark">S<span>.</span></span>
            <span className="brand-copy"><strong>SONDAGE</strong><small>CLASSROOM / 01</small></span>
          </a>
          <div className="topbar-meta">
            <a className="calculator-link" href="/calculatrice/index.html" target="_blank" rel="noreferrer">
              CALCULATRICE ↗
            </a>
            <span className="live-status"><i /> LIVE</span>
          </div>
        </header>

        <section className="hero" id="accueil">
          <div className="hero-copy" data-reveal>
            <p className="eyebrow"><span>01</span> / LE BAROMÈTRE DE LA CLASSE</p>
            <h1>Chaque avis<br /><em>fait avancer</em><br />le collectif.</h1>
            <p className="hero-description">
              Une question, quatre ressentis. Donne ton avis avec un pseudonyme
              fictif et découvre la tendance de la classe en direct.
            </p>
            <a className="scroll-link" href="#sondage">
              <span className="scroll-icon">↓</span><span>PARTICIPER AU SONDAGE</span>
            </a>
          </div>
          <div className="hero-art" data-reveal>
            <span className="hero-coordinate coordinate-top">SIGNAL / CLASSROOM</span>
            <Globe />
            <span className="hero-coordinate coordinate-bottom">OPINIONS EN MOUVEMENT</span>
          </div>
          <div className="hero-index">S / 01</div>
        </section>
        <section className="survey-layout" id="sondage">
          <article className="glass-card vote-card" data-reveal>
            <div className="card-heading">
              <div><p className="section-kicker">TA VOIX</p><h2>Comment as-tu vécu cette séance ?</h2></div>
              <span className="card-index">01 — 02</span>
            </div>
            <p className="card-intro">Choisis le ressenti qui te correspond le mieux.</p>
            <form onSubmit={handleVote}>
              <label className="field-label" htmlFor="nickname">TON PSEUDONYME <span>REQUIS</span></label>
              <input
                autoComplete="off"
                className="nickname-input"
                id="nickname"
                maxLength={30}
                onChange={(event) => setNickname(event.target.value)}
                placeholder="Ex. Nova-17"
                required
                value={nickname}
              />
              <span className="field-hint">Utilise un pseudonyme fictif, pas ton vrai nom.</span>
              <fieldset className="choice-fieldset">
                <legend className="field-label">TON RESSENTI</legend>
                <div className="choice-grid">
                  {CHOICES.map((item, index) => (
                    <label className={`choice-option ${choice === item.value ? "is-selected" : ""}`} key={item.value}>
                      <input
                        checked={choice === item.value}
                        name="choice"
                        onChange={() => setChoice(item.value)}
                        required={index === 0}
                        type="radio"
                        value={item.value}
                      />
                      <span className="choice-mark">{item.mark}</span>
                      <span className="choice-text"><strong>{item.value}</strong><small>{item.note}</small></span>
                      <span className="choice-check" aria-hidden="true">✓</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <button className="submit-button" disabled={isSubmitting || !choice} type="submit">
                <span>{isSubmitting ? "ENVOI EN COURS…" : "ENVOYER MA RÉPONSE"}</span><span className="submit-arrow">↗</span>
              </button>
              <p className={`form-message ${formError ? "is-error" : ""}`} role="status" aria-live="polite">
                {formMessage}
              </p>
            </form>
            <div className="card-footnote"><span className="lock-mark">⌑</span><span>Enregistré dans la base Supabase de la classe.</span></div>
          </article>

          <article className="glass-card results-card" data-reveal>
            <div className="card-heading">
              <div><p className="section-kicker">CLASSEMENT EN DIRECT</p><h2>La classe ressent</h2></div>
              <span className="result-spark" aria-hidden="true">✳</span>
            </div>
            <div className="total-votes">
              <strong>{total.toString().padStart(2, "0")}</strong><span>RÉPONSES<br />COLLECTÉES</span>
            </div>
            <div className="results-list" aria-live="polite">
              {sortedResults.map((item, index) => (
                <div className="result-row" key={item.label}>
                  <div className="result-label"><span>{index + 1}. {item.label}</span><span><b>{item.count}</b><i>{item.percentage}%</i></span></div>
                  <div className="result-track" role="progressbar" aria-label={`${item.label}: ${item.percentage}%`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={item.percentage}>
                    <span className={`result-fill result-fill-${CHOICES.findIndex((choiceItem) => choiceItem.value === item.label)}`} style={{ width: `${item.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="results-foot"><span className="connection-dot" /><span>{connectionState}</span><span className="refresh-note">MAJ / 15 S</span></div>
            <div className="response-feed">
              <div className="feed-heading"><span>DERNIÈRES RÉPONSES</span><span>{votes.length} / 100</span></div>
              {votes.length ? (
                <div
                  className="vote-list-scroller"
                  role="region"
                  aria-label="Réponses les plus récentes en premier"
                  tabIndex={0}
                >
                  <ul className="vote-list">
                    {votes.map((vote) => (
                      <li key={vote.id}>
                        <span className="vote-avatar">{vote.nickname.slice(0, 1).toUpperCase()}</span>
                        <span className="vote-nickname">{vote.nickname}</span>
                        <span className="vote-choice">{vote.choice}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : <p className="empty-votes">Les premières réponses apparaitront ici.</p>}
            </div>
          </article>
        </section>

        <section className="manifesto-section" data-reveal>
          <div className="manifesto-heading">
            <p className="section-kicker">UN ESPACE, TROIS PRINCIPES</p>
            <h2>Simple. Collectif. <em>Vivant.</em></h2>
          </div>
          <div className="principle-grid">
            <article className="principle-card" data-reveal><span className="principle-number">01</span><span className="principle-icon">◉</span><h3>Un pseudonyme suffit</h3><p>Participe sans inscrire ton vrai prénom ni d’information personnelle.</p></article>
            <article className="principle-card" data-reveal><span className="principle-number">02</span><span className="principle-icon">↗</span><h3>La tendance évolue</h3><p>Les résultats et le classement se mettent à jour toutes les 15 secondes.</p></article>
            <article className="principle-card" data-reveal><span className="principle-number">03</span><span className="principle-icon">⌘</span><h3>Une base dédiée</h3><p>FastAPI transmet les réponses à la base PostgreSQL Supabase.</p></article>
          </div>
        </section>

        <details className="admin-panel" data-reveal>
          <summary><span>ESPACE ADMINISTRATEUR</span><span className="admin-summary-note">EXPORT CSV PROTÉGÉ <b>＋</b></span></summary>
          <form className="admin-form" onSubmit={handleExport}>
            <label className="field-label" htmlFor="admin-key">CLÉ ADMINISTRATEUR</label>
            <div className="admin-controls">
              <input autoComplete="current-password" id="admin-key" onChange={(event) => setAdminKey(event.target.value)} placeholder="Saisir la clé configurée sur l’API" required type="password" value={adminKey} />
              <button className="admin-button" disabled={isExporting} type="submit">{isExporting ? "PRÉPARATION…" : "TÉLÉCHARGER LE CSV"}</button>
            </div>
            <p className="form-message" role="status">{exportMessage}</p>
          </form>
        </details>
        <footer className="page-footer">
          <a className="footer-brand" href="#accueil">S<span>.</span></a>
          <p>CONÇU PAR <strong>SOLLO TSALA</strong><span>PYTHON · CSS · JAVASCRIPT · REACT · FASTAPI</span></p>
          <a className="back-top" href="#accueil">RETOUR EN HAUT ↑</a>
        </footer>
      </main>
    </>
  );
}

export default App;
