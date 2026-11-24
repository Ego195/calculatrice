import { useEffect, useState } from "react";
import {
  createSurvey,
  deleteArchivedSurvey,
  downloadCsv,
  fetchActiveSurvey,
  fetchSurveys,
  updateActiveSurvey,
  verifyAdmin,
} from "./api.js";

const EMPTY_DRAFT = [
  { label: "", description: "", mark: "↗" },
  { label: "", description: "", mark: "✳" },
];
const CHOICE_MARKS = ["↗", "✳", "◌", "↻", "✦", "◇", "◎", "↟"];
const CONFIRMATION_WORD = "SUPPRIMER";

function AdminApp() {
  const [introVisible, setIntroVisible] = useState(true);
  const [adminKey, setAdminKey] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeSurvey, setActiveSurvey] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeTotal, setActiveTotal] = useState(0);
  const [currentView, setCurrentView] = useState("overview");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusIsError, setStatusIsError] = useState(false);
  const [editFields, setEditFields] = useState({
    title: "",
    question: "",
    instruction: "",
    choice_heading: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showCreator, setShowCreator] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    question: "",
    instruction: "",
    choice_heading: "VOTRE CHOIX",
    choices: EMPTY_DRAFT,
  });
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deletingId, setDeletingId] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setIntroVisible(false), 2600);
    return () => window.clearTimeout(timer);
  }, []);

  async function refreshDashboard() {
    const [activeData, historyData] = await Promise.all([
      fetchActiveSurvey(),
      fetchSurveys(),
    ]);
    setActiveSurvey(activeData.survey);
    setActiveTotal(activeData.total);
    setHistory(historyData.surveys);
    setEditFields({
      title: activeData.survey.title,
      question: activeData.survey.question,
      instruction: activeData.survey.instruction,
      choice_heading: activeData.survey.choice_heading,
    });
  }

  async function handleLogin(event) {
    event.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);
    try {
      await verifyAdmin(adminKey);
      await refreshDashboard();
      setIsAuthorized(true);
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setIsLoggingIn(false);
    }
  }

  function handleLogout() {
    setAdminKey("");
    setIsAuthorized(false);
    setActiveSurvey(null);
    setHistory([]);
    setStatusMessage("");
    setDeleteTarget(null);
  }

  function openDeleteSurvey(survey) {
    setDeleteTarget(survey);
    setDeleteConfirmation("");
    setDeleteError("");
  }

  function updateEditField(field, value) {
    setEditFields((current) => ({ ...current, [field]: value }));
  }

  async function handleSaveSurvey(event) {
    event.preventDefault();
    setStatusMessage("");
    setStatusIsError(false);
    setIsSaving(true);
    try {
      await updateActiveSurvey(adminKey, editFields);
      setStatusMessage("Les textes du sondage actif ont été mis à jour.");
      try {
        await refreshDashboard();
      } catch (error) {
        setStatusMessage(
          `Textes enregistrés, mais actualisation impossible : ${error.message}`,
        );
        setStatusIsError(true);
      }
    } catch (error) {
      setStatusMessage(error.message);
      setStatusIsError(true);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleExport() {
    setStatusMessage("");
    setStatusIsError(false);
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
      setStatusMessage("Export CSV téléchargé.");
    } catch (error) {
      setStatusMessage(error.message);
      setStatusIsError(true);
    } finally {
      setIsExporting(false);
    }
  }

  function updateDraftField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function updateDraftChoice(index, field, value) {
    setDraft((current) => ({
      ...current,
      choices: current.choices.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  }

  function addDraftChoice() {
    setDraft((current) => ({
      ...current,
      choices: [
        ...current.choices,
        {
          label: "",
          description: "",
          mark: CHOICE_MARKS[current.choices.length],
        },
      ],
    }));
  }

  function removeDraftChoice(index) {
    setDraft((current) => ({
      ...current,
      choices: current.choices.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  async function handleCreateSurvey(event) {
    event.preventDefault();
    setStatusMessage("");
    setStatusIsError(false);
    setIsCreating(true);
    try {
      await createSurvey({ ...draft, admin_key: adminKey });
      setShowCreator(false);
      setDraft({
        title: "",
        question: "",
        instruction: "",
        choice_heading: "VOTRE CHOIX",
        choices: EMPTY_DRAFT,
      });
      setStatusMessage("Nouveau sondage publié. Le précédent est archivé.");
      setCurrentView("overview");
      try {
        await refreshDashboard();
      } catch (error) {
        setStatusMessage(
          `Sondage publié, mais actualisation impossible : ${error.message}`,
        );
        setStatusIsError(true);
      }
    } catch (error) {
      setStatusMessage(error.message);
      setStatusIsError(true);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDeleteSurvey() {
    if (!deleteTarget || deleteConfirmation !== CONFIRMATION_WORD) return;
    setDeleteError("");
    setDeletingId(deleteTarget.id);
    try {
      await deleteArchivedSurvey(adminKey, deleteTarget.id);
      setDeleteTarget(null);
      setDeleteConfirmation("");
      setStatusMessage("Sondage archivé et réponses associées supprimés.");
      setStatusIsError(false);
      try {
        await refreshDashboard();
      } catch (error) {
        setStatusMessage(
          `Suppression terminée, mais actualisation impossible : ${error.message}`,
        );
        setStatusIsError(true);
      }
    } catch (error) {
      setDeleteError(error.message);
    } finally {
      setDeletingId("");
    }
  }

  async function handleRefresh() {
    setStatusMessage("");
    setStatusIsError(false);
    try {
      await refreshDashboard();
      setStatusMessage("Données actualisées depuis Supabase.");
    } catch (error) {
      setStatusMessage(error.message);
      setStatusIsError(true);
    }
  }

  const archivedSurveys = history.filter((survey) => !survey.is_active);

  return (
    <div className="admin-app">
      {introVisible && (
        <div className="admin-intro" aria-label="Initialisation de l’atelier">
          <div className="intro-grid" />
          <div className="intro-orbit intro-orbit-a" />
          <div className="intro-orbit intro-orbit-b" />
          <span className="intro-core" />
          <span className="intro-wordmark">ATELIER<span>.</span></span>
          <span className="intro-caption">SONDAGE / CONSOLE PRIVÉE</span>
          <div className="intro-meter"><i /></div>
        </div>
      )}

      {!isAuthorized ? (
        <main className="login-shell">
          <div className="login-backdrop-orbit" />
          <section className="login-card">
            <div className="brand-lockup">
              <span className="brand-glyph">S<span>.</span></span>
              <span><strong>SONDAGE</strong><small>ADMINISTRATOR / 01</small></span>
            </div>
            <p className="console-kicker">CONSOLE DE PILOTAGE</p>
            <h1>Votre espace.<br /><em>Vos sondages.</em></h1>
            <p className="login-description">
              Gérez le sondage public et son historique dans un atelier sécurisé.
            </p>
            <form className="login-form" onSubmit={handleLogin}>
              <label htmlFor="admin-password">CLÉ ADMINISTRATEUR</label>
              <input
                autoComplete="off"
                id="admin-password"
                onChange={(event) => setAdminKey(event.target.value)}
                placeholder="Clé définie dans Railway"
                required
                type="password"
                value={adminKey}
              />
              <button className="primary-button" disabled={isLoggingIn} type="submit">
                <span>{isLoggingIn ? "VÉRIFICATION…" : "OUVRIR L’ATELIER"}</span>
                <span>↗</span>
              </button>
              <p className="login-error" role="alert">{loginError}</p>
            </form>
            <p className="security-note"><span>⌑</span> Clé vérifiée par l’API et gardée en mémoire jusqu’à la fermeture de session.</p>
          </section>
          <footer className="login-footer"><span>SUPABASE / CONNECTÉ VIA FASTAPI</span><span>ÉDITION PRIVÉE</span></footer>
        </main>
      ) : (
        <div className="admin-layout">
          <aside className="admin-sidebar">
            <a className="admin-brand" href="#dashboard" aria-label="Atelier Sondage">
              <span className="brand-glyph">S<span>.</span></span>
              <span><strong>ATELIER</strong><small>SONDAGE / ADMIN</small></span>
            </a>
            <div className="sidebar-label">ESPACE DE TRAVAIL</div>
            <nav className="admin-nav" aria-label="Navigation administrateur">
              <button
                className={currentView === "overview" ? "nav-item is-active" : "nav-item"}
                onClick={() => setCurrentView("overview")}
                type="button"
              ><span>◈</span> Vue d’ensemble</button>
              <button
                className={currentView === "history" ? "nav-item is-active" : "nav-item"}
                onClick={() => setCurrentView("history")}
                type="button"
              ><span>◷</span> Historique</button>
            </nav>
            <div className="sidebar-spacer" />
            <div className="sidebar-connection"><i /> FASTAPI / SUPABASE</div>
            <button className="logout-button" onClick={handleLogout} type="button">↗&nbsp; Verrouiller la session</button>
          </aside>

          <main className="admin-main" id="dashboard">
            <header className="admin-topbar">
              <div>
                <p className="console-kicker">CENTRE DE CONTRÔLE / 01</p>
                <h1>{currentView === "overview" ? "Vue d’ensemble" : "Archives de sondage"}</h1>
              </div>
              <div className="topbar-actions">
                <span className="secure-pill"><i /> SESSION PRIVÉE</span>
                <a className="public-link" href="https://calculatrice-sondage.vercel.app/" rel="noreferrer" target="_blank">VOIR LE SITE ↗</a>
                <button className="icon-button" aria-label="Actualiser les données" onClick={handleRefresh} type="button">⟳</button>
              </div>
            </header>

            <section className="dashboard-content">
              <div className="welcome-strip">
                <div>
                  <span className="strip-overline">ÉDITION EN DIRECT</span>
                  <strong>{activeSurvey?.title || "Chargement du sondage…"}</strong>
                  <p>Les modifications sont publiées sur la page publique après validation.</p>
                </div>
                <div className="strip-actions">
                  <button className="outline-button" disabled={isExporting} onClick={handleExport} type="button">
                    {isExporting ? "EXPORT…" : "↓ EXPORTER CSV"}
                  </button>
                  <button className="primary-button compact-button" onClick={() => setShowCreator(true)} type="button">
                    + NOUVEAU SONDAGE
                  </button>
                </div>
              </div>

              {statusMessage && (
                <p className={statusIsError ? "status-banner is-error" : "status-banner"} role="status">
                  <span>{statusIsError ? "!" : "✓"}</span>{statusMessage}
                </p>
              )}

              {currentView === "overview" ? (
                <>
                  <section className="metric-grid" aria-label="Résumé">
                    <article className="metric-card"><span>SONDAGE ACTIF</span><strong>01</strong><small><i /> En ligne sur la vitrine</small></article>
                    <article className="metric-card"><span>RÉPONSES COLLECTÉES</span><strong>{activeTotal.toString().padStart(2, "0")}</strong><small>Pour le sondage actif</small></article>
                    <article className="metric-card"><span>SONDAGES ARCHIVÉS</span><strong>{archivedSurveys.length.toString().padStart(2, "0")}</strong><small>Conservés dans Supabase</small></article>
                  </section>

                  <section className="editor-panel">
                    <div className="panel-heading">
                      <div><p className="console-kicker">CONTENU PUBLIC</p><h2>Modifier le sondage actif</h2></div>
                      <span className="active-badge"><i /> ACTIF</span>
                    </div>
                    <p className="panel-description">
                      Modifiez les textes sans toucher aux choix ni aux réponses déjà enregistrées.
                    </p>
                    <form className="editor-form" onSubmit={handleSaveSurvey}>
                      <label>TITRE DU SONDAGE
                        <input maxLength={80} onChange={(event) => updateEditField("title", event.target.value)} required value={editFields.title} />
                      </label>
                      <label>QUESTION
                        <textarea maxLength={180} onChange={(event) => updateEditField("question", event.target.value)} required rows={2} value={editFields.question} />
                      </label>
                      <label>CONSIGNE
                        <input maxLength={120} onChange={(event) => updateEditField("instruction", event.target.value)} required value={editFields.instruction} />
                      </label>
                      <label>INTITULÉ DES CHOIX
                        <input maxLength={120} onChange={(event) => updateEditField("choice_heading", event.target.value)} required value={editFields.choice_heading} />
                      </label>
                      <div className="current-choices">
                        <span>CHOIX CONSERVÉS</span>
                        <div>{activeSurvey?.choices.map((item) => <span key={item.id}>{item.mark} {item.label}</span>)}</div>
                      </div>
                      <div className="form-footer">
                        <span>Les changements sont visibles sur le sondage public.</span>
                        <button className="primary-button" disabled={isSaving || !activeSurvey} type="submit">
                          {isSaving ? "PUBLICATION…" : "PUBLIER LES MODIFICATIONS"} <span>↗</span>
                        </button>
                      </div>
                    </form>
                  </section>

                  <section className="recent-panel">
                    <div className="panel-heading">
                      <div><p className="console-kicker">MÉMOIRE DE LA CLASSE</p><h2>Derniers sondages</h2></div>
                      <button className="text-button" onClick={() => setCurrentView("history")} type="button">TOUT L’HISTORIQUE ↗</button>
                    </div>
                    <SurveyList
                      onDelete={openDeleteSurvey}
                      surveys={history.slice(0, 4)}
                    />
                  </section>
                </>
              ) : (
                <section className="recent-panel history-panel">
                  <div className="panel-heading">
                    <div><p className="console-kicker">ARCHIVES / {history.length.toString().padStart(2, "0")}</p><h2>Historique des sondages</h2></div>
                    <span className="history-retention">TITRES, QUESTIONS ET CHOIX CONSERVÉS</span>
                  </div>
                  <SurveyList onDelete={openDeleteSurvey} surveys={history} showDelete />
                </section>
              )}
              <footer className="admin-footer"><span>SONDAGE / CONSOLE ADMINISTRATEUR</span><span>LA CLÉ EST EFFACÉE AU VERROUILLAGE DE SESSION</span></footer>
            </section>
          </main>
        </div>
      )}

      {showCreator && (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isCreating) setShowCreator(false);
        }}>
          <section aria-labelledby="create-title" aria-modal="true" className="admin-modal creator-modal" role="dialog">
            <div className="modal-heading">
              <div><p className="console-kicker">NOUVELLE ÉDITION</p><h2 id="create-title">Créer un sondage</h2></div>
              <button aria-label="Fermer" className="icon-button" onClick={() => setShowCreator(false)} type="button">×</button>
            </div>
            <p className="panel-description">La nouvelle édition devient active. L’actuelle est conservée dans l’historique.</p>
            <form className="editor-form" onSubmit={handleCreateSurvey}>
              <label>TITRE
                <input maxLength={80} onChange={(event) => updateDraftField("title", event.target.value)} required value={draft.title} />
              </label>
              <label>QUESTION
                <textarea maxLength={180} onChange={(event) => updateDraftField("question", event.target.value)} required rows={2} value={draft.question} />
              </label>
              <label>CONSIGNE
                <input maxLength={120} onChange={(event) => updateDraftField("instruction", event.target.value)} required value={draft.instruction} />
              </label>
              <label>INTITULÉ DES CHOIX
                <input maxLength={120} onChange={(event) => updateDraftField("choice_heading", event.target.value)} required value={draft.choice_heading} />
              </label>
              <div className="draft-editor">
                <div className="draft-editor-heading"><span>CHOIX / {draft.choices.length} SUR 8</span>
                  <button className="text-button" disabled={draft.choices.length >= 8} onClick={addDraftChoice} type="button">+ AJOUTER</button>
                </div>
                {draft.choices.map((item, index) => (
                  <div className="draft-choice" key={index}>
                    <span className="draft-mark">{item.mark}</span>
                    <input
                      aria-label={`Nom du choix ${index + 1}`}
                      maxLength={80}
                      onChange={(event) => updateDraftChoice(index, "label", event.target.value)}
                      placeholder={`Choix ${index + 1}`}
                      required
                      value={item.label}
                    />
                    <input
                      aria-label={`Description du choix ${index + 1}`}
                      maxLength={120}
                      onChange={(event) => updateDraftChoice(index, "description", event.target.value)}
                      placeholder="Description facultative"
                      value={item.description}
                    />
                    <button
                      aria-label={`Retirer le choix ${index + 1}`}
                      className="remove-draft"
                      disabled={draft.choices.length <= 2}
                      onClick={() => removeDraftChoice(index)}
                      type="button"
                    >−</button>
                  </div>
                ))}
              </div>
              <div className="modal-actions">
                <button className="outline-button" onClick={() => setShowCreator(false)} type="button">ANNULER</button>
                <button className="primary-button" disabled={isCreating} type="submit">{isCreating ? "CRÉATION…" : "PUBLIER LE SONDAGE"} <span>↗</span></button>
              </div>
              {statusIsError && statusMessage && <p className="modal-error" role="alert">{statusMessage}</p>}
            </form>
          </section>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !deletingId) {
            setDeleteTarget(null);
            setDeleteConfirmation("");
          }
        }}>
          <section aria-labelledby="delete-title" aria-modal="true" className="admin-modal delete-modal" role="alertdialog">
            <div className="danger-symbol">!</div>
            <p className="console-kicker danger-kicker">SUPPRESSION DÉFINITIVE</p>
            <h2 id="delete-title">Effacer cette édition ?</h2>
            <p className="delete-summary"><strong>{deleteTarget.title}</strong><br />{deleteTarget.question}</p>
            <p className="delete-warning">Cette action supprimera le sondage, ses choix et toutes ses réponses associées dans Supabase. Elle est irréversible.</p>
            <label className="confirm-label" htmlFor="delete-confirm">Tapez <strong>{CONFIRMATION_WORD}</strong> pour confirmer</label>
            <input
              autoComplete="off"
              className="confirm-input"
              id="delete-confirm"
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              value={deleteConfirmation}
            />
            {deleteError && <p className="modal-error" role="alert">{deleteError}</p>}
            <div className="modal-actions">
              <button className="outline-button" disabled={Boolean(deletingId)} onClick={() => {
                setDeleteTarget(null);
                setDeleteConfirmation("");
              }} type="button">ANNULER</button>
              <button
                className="danger-button"
                disabled={deleteConfirmation !== CONFIRMATION_WORD || Boolean(deletingId)}
                onClick={handleDeleteSurvey}
                type="button"
              >{deletingId ? "SUPPRESSION…" : "SUPPRIMER SONDAGE + RÉPONSES"}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function SurveyList({ surveys, onDelete, showDelete = false }) {
  if (!surveys.length) {
    return <p className="empty-history">Aucun sondage à afficher pour le moment.</p>;
  }

  return (
    <div className="survey-list">
      {surveys.map((survey) => (
        <article className="survey-list-item" key={survey.id}>
          <div className="survey-row-main">
            <span className={survey.is_active ? "survey-status is-active" : "survey-status"}>
              <i /> {survey.is_active ? "ACTIF" : "ARCHIVÉ"}
            </span>
            <h3>{survey.title}</h3>
            <p>{survey.question}</p>
            <div className="survey-choice-chips">
              {survey.choices.map((choice) => <span key={choice.id}>{choice.mark} {choice.label}</span>)}
            </div>
            <time dateTime={survey.created_at}>
              {new Date(survey.created_at).toLocaleDateString("fr-FR", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          </div>
          {!survey.is_active && showDelete && (
            <button className="delete-link" onClick={() => onDelete(survey)} type="button">SUPPRIMER ↗</button>
          )}
        </article>
      ))}
    </div>
  );
}

export default AdminApp;
