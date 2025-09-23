import React, { useEffect, useMemo, useState } from "react";
import "../styles/MemoryCanvas.css";
import axios from "axios";
import CONFIG from "../config"; // Ensure this has BACKEND_URL

const TABS = {
  SUMMARIES: "summaries",
  SOURCES: "sources",
};

const VIEW = {
  LIST: "list",
  DETAIL: "detail",
};

const MemoryCanvas = ({
  onClose,
  userId,
  workflowId,
  workflow,
  externalOpenSource,
}) => {
  const [activeTab, setActiveTab] = useState(
    externalOpenSource ? TABS.SOURCES : TABS.SUMMARIES
  );
  // Caches
  const [summaries, setSummaries] = useState([]); // /api/show_all_memories
  const [sources, setSources] = useState([]); // /api/show_all_sources
  const [hasFetchedSources, setHasFetchedSources] = useState(false);

  // UI state
  const [search, setSearch] = useState("");
  const [loadingSummaries, setLoadingSummaries] = useState(false);
  const [loadingSources, setLoadingSources] = useState(false);
  const [error, setError] = useState("");

  // New: list/detail view + detail payload
  const [view, setView] = useState(VIEW.LIST);
  const [detailType, setDetailType] = useState(null); // 'summary' | 'source'
  const [detailItem, setDetailItem] = useState(null); // current item in detail
  const [detailVersions, setDetailVersions] = useState([]); // for summaries
  const [detailIndex, setDetailIndex] = useState(0); // which version we're viewing

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [saveAsNew, setSaveAsNew] = useState(true); // for summaries by default
  const [saving, setSaving] = useState(false);
  const [activeStepFilter, setActiveStepFilter] = useState(null);

  // -------- API calls (cached) --------
  const fetchSummaries = async () => {
    setError("");
    setLoadingSummaries(true);
    try {
      const response = await axios.get(
        `${CONFIG.BACKEND_URL}/api/show_all_memories`,
        { params: { user_id: userId, workflow_id: workflowId } }
      );
      setSummaries(response.data || []);
    } catch (e) {
      console.error("Error fetching summaries:", e);
      setError("Failed to load step summaries.");
    } finally {
      setLoadingSummaries(false);
    }
  };

  const fetchSources = async () => {
    // Only fetch once per mount
    if (hasFetchedSources) return;
    setError("");
    setLoadingSources(true);
    try {
      const response = await axios.get(
        `${CONFIG.BACKEND_URL}/api/show_all_sources`,
        { params: { user_id: userId, workflow_id: workflowId } }
      );
      const normalizedSources = response.data.map((src) => ({
        ...src,
        real_subtask_index: getRealSubtaskIndex(
          src.phase_index,
          src.subtask_index,
          workflow
        ),
      }));
      setSources(normalizedSources || []);
      setHasFetchedSources(true);
    } catch (e) {
      console.error("Error fetching sources:", e);
      setError("Failed to load sources.");
    } finally {
      setLoadingSources(false);
    }
  };

  // -------- lifecycle --------
  useEffect(() => {
    if (externalOpenSource) {
      fetchSources();
    } else {
      fetchSummaries();
    }
  }, [externalOpenSource, userId, workflowId]);

  useEffect(() => {
    if (externalOpenSource && sources.length > 0) {
      const normalizedSources = externalOpenSource.map((src) => ({
        ...src,
        real_subtask_index: getRealSubtaskIndex(
          src.phase_index,
          src.subtask_index,
          workflow
        ),
      }));

      // ✅ will only run after sources is updated
      openSourceGroupDetail(normalizedSources[0]);
    }
  }, [sources, externalOpenSource, workflow]);
  // -------- helpers --------
  const getSourceKey = (src) => src?.source?.toLowerCase?.() || "unknown";

  const getTagKey = (obj) => {
    // stable grouping key for a summary (aka the "tag")
    return `${obj?.subtask_index ?? -1}-${obj?.step_index ?? -1}`;
  };

  const toLocalTime = (ts) => {
    if (!ts) return "";
    try {
      return new Date(ts).toLocaleString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  /**
   * Compute the real subtask index given backend indices.
   *
   * @param {number} phaseIndex - current phase index from backend
   * @param {number} subtaskIndex - current subtask index within that phase
   * @param {object} workflow - the workflow structure that contains phases and their subtasks
   * @returns {number} real_subtask_index
   */
  const getRealSubtaskIndex = (phaseIndex, subtaskIndex, workflow) => {
    // if (!workflow || !Array.isArray(workflow)) return 10;

    // Count all subtasks that belong to earlier phases
    let count = 0;
    for (let i = 0; i < workflow.length; i++) {
      if (workflow[i].phase - 1 < phaseIndex) {
        count++;
      }
    }

    return count + subtaskIndex;
  };
  // -------- filtering --------
  const filteredSummaries = useMemo(() => {
    if (!search.trim()) return summaries;
    const q = search.toLowerCase();
    return summaries.filter((m) =>
      (m?.content || "").toLowerCase().includes(q)
    );
  }, [summaries, search]);

  const filteredSources = useMemo(() => {
    let arr = sources;
    if (activeStepFilter !== null) {
      arr = arr.filter(
        (s) => `${s?.real_subtask_index}-${s?.step_index}` === activeStepFilter
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter((s) => {
        const text =
          s?.title ||
          s?.url ||
          s?.excerpt ||
          s?.content ||
          s?.source ||
          JSON.stringify(s || {});
        return (text || "").toLowerCase().includes(q);
      });
    }
    return arr;
  }, [sources, search, activeStepFilter]);

  const sourceGroups = useMemo(() => {
    const map = new Map();
    for (const s of filteredSources) {
      const key = getSourceKey(s);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }
    for (const [, arr] of map.entries()) {
      arr.sort(
        (a, b) => new Date(b?.timestamp || 0) - new Date(a?.timestamp || 0)
      );
    }
    return map;
  }, [filteredSources]);

  const groupedSourceLatestList = useMemo(() => {
    const out = [];
    for (const [, arr] of sourceGroups.entries()) {
      if (arr.length) out.push(arr[0]);
    }
    return out;
  }, [sourceGroups]);

  const upsertSourceLocal = (oldContent, updatedObj) => {
    setSources((prev) =>
      prev.map((s) => (s.content === oldContent ? { ...s, ...updatedObj } : s))
    );
    if (detailType === "source" && detailItem?.content === oldContent) {
      setDetailItem((prev) => ({ ...prev, ...updatedObj }));
    }
  };

  // For summaries: either overwrite the version or add a new version in the same tag group
  const upsertSummaryLocal = (
    oldItem,
    updatedContent,
    { overwrite = false } = {}
  ) => {
    setSummaries((prev) => {
      if (overwrite) {
        // Modify the one item
        return prev.map((m) =>
          m === oldItem
            ? {
                ...m,
                content: updatedContent,
                timestamp: new Date().toISOString(),
              }
            : m
        );
      } else {
        // Add a new version in the same tag (subtask/step)
        const newVersion = {
          ...oldItem,
          content: updatedContent,
          timestamp: new Date().toISOString(),
          id: crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`, // temp id
        };
        return [newVersion, ...prev];
      }
    });

    // Also update the open detail view
    if (detailType === "summary") {
      if (overwrite) {
        const updated = {
          ...detailItem,
          content: updatedContent,
          timestamp: new Date().toISOString(),
        };
        setDetailItem(updated);

        // update versions list in-place
        const newVersions = [...detailVersions];
        newVersions[detailIndex] = updated;
        setDetailVersions(newVersions);
      } else {
        const newV = {
          ...detailItem,
          content: updatedContent,
          timestamp: new Date().toISOString(),
          id: crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        };
        const newVersions = [newV, ...detailVersions];
        setDetailVersions(newVersions);
        setDetailIndex(0);
        setDetailItem(newV);
      }
    }
  };

  const startEditing = () => {
    const initial = detailItem?.content || detailItem?.excerpt || "";
    setEditText(initial);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditText("");
    setSaving(false);
  };

  const saveEdit = async () => {
    if (!detailItem) return;
    const trimmed = (editText || "").trim();
    if (!trimmed) {
      setError("Content cannot be empty.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      if (detailType === "summary") {
        // --- SUMMARIES ---
        if (saveAsNew) {
          // Keep history: add a new version, do NOT delete the old one
          try {
            await axios.post(`${CONFIG.BACKEND_URL}/api/add_evidence`, {
              userid: userId,
              workflowid: workflowId,
              evidence: trimmed,
              subtask_index: detailItem?.subtask_index,
              step_index: detailItem?.step_index,
              query_name: "placeholder",
              isSynthesis: true,
            });
          } catch (e) {
            console.warn(
              "add_evidence failed (new version). Applying optimistic add:",
              e
            );
          }
          // Optimistic local update: add new version to the same tag group
          upsertSummaryLocal(detailItem, trimmed, { overwrite: false });
        } else {
          // OVERWRITE: add new record, then delete the old one
          let newRec = null;
          try {
            const addRes = await axios.post(
              `${CONFIG.BACKEND_URL}/api/add_evidence`,
              {
                userid: userId,
                workflowid: workflowId,
                evidence: trimmed,
                subtask_index: detailItem?.subtask_index,
                step_index: detailItem?.step_index,
                query_name: "placeholder",
                isSynthesis: true,
              }
            );

            newRec = {
              ...detailItem,
              content: trimmed,
              timestamp: new Date().toISOString(),
              id:
                addRes?.data?.id ??
                (typeof crypto !== "undefined" && crypto.randomUUID
                  ? crypto.randomUUID()
                  : `${Date.now()}-${Math.random()}`),
            };
          } catch (e) {
            console.error("Failed to add new evidence for overwrite:", e);
            setError("Failed to save changes.");
            setSaving(false);
            return;
          }

          // Optimistically replace the old version in the summaries cache
          setSummaries((prev) => {
            const withoutOld = prev.filter((m) => m !== detailItem);
            return [newRec, ...withoutOld];
          });

          // Update detail pane and versions list (keep other historical versions)
          const pruned = detailVersions.filter((v) => v !== detailItem);
          const newVersions = [newRec, ...pruned];
          setDetailVersions(newVersions);
          setDetailIndex(0);
          setDetailItem(newRec);

          // Now delete the old record on the server (best-effort)
          try {
            await axios.post(`${CONFIG.BACKEND_URL}/api/delete_evidence`, {
              evidence: detailItem?.content,
              userid: userId,
              workflowid: workflowId,
            });
          } catch (e) {
            console.warn("Failed to delete old evidence after overwrite:", e);
            setError(
              "Saved changes, but couldn't remove the old version on the server. You can delete it manually."
            );
          }
        }
      } else {
        // --- SOURCES ---
        // Overwrite by add+delete (since you don't have update_* API)
        let newRec = null;
        try {
          const addRes = await axios.post(
            `${CONFIG.BACKEND_URL}/api/add_evidence`,
            {
              userid: userId,
              workflowid: workflowId,
              evidence: trimmed,
              subtask_index: detailItem?.subtask_index,
              step_index: detailItem?.step_index,
              query_name: "placeholder",
              isSynthesis: false,
            }
          );

          newRec = {
            ...detailItem,
            content: trimmed,
            excerpt: undefined, // prefer full content once edited
            timestamp: new Date().toISOString(),
            id:
              addRes?.data?.id ??
              (typeof crypto !== "undefined" && crypto.randomUUID
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random()}`),
          };
        } catch (e) {
          console.error("Failed to add new source (overwrite):", e);
          setError("Failed to save changes.");
          setSaving(false);
          return;
        }

        // Replace locally in sources cache
        setSources((prev) => {
          const withoutOld = prev.filter((s) => s !== detailItem);
          return [newRec, ...withoutOld];
        });
        setDetailItem(newRec);

        // Delete old source on server (best-effort)
        try {
          await axios.post(`${CONFIG.BACKEND_URL}/api/delete_evidence`, {
            evidence: detailItem?.content,
            userid: userId,
            workflowid: workflowId,
          });
        } catch (e) {
          console.warn("Failed to delete old source after overwrite:", e);
          setError(
            "Saved changes, but couldn't remove the old item on the server. You can delete it manually."
          );
        }
      }

      // Exit edit mode on success
      setIsEditing(false);
      setEditText("");
    } catch (e) {
      console.error("Save failed:", e);
      setError("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  // -------- grouping for summaries --------
  // Map: tagKey -> [versions sorted desc by timestamp]
  const summaryGroups = useMemo(() => {
    const map = new Map();
    for (const m of filteredSummaries) {
      const key = getTagKey(m);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(m);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => {
        const ta = new Date(a?.timestamp || 0).getTime();
        const tb = new Date(b?.timestamp || 0).getTime();
        return tb - ta; // latest first
      });
    }
    return map;
  }, [filteredSummaries]);

  // For grid rendering in "summaries" tab, show only LATEST item per group
  const groupedSummaryLatestList = useMemo(() => {
    const out = [];
    for (const [, arr] of summaryGroups.entries()) {
      if (arr.length) out.push(arr[0]); // latest
    }
    return out;
  }, [summaryGroups]);

  // -------- handlers --------
  const handleTabClick = (tab) => {
    setActiveTab(tab);
    setView(VIEW.LIST);
    setDetailItem(null);
    setDetailType(null);
    setDetailVersions([]);
    setDetailIndex(0);
    if (tab === TABS.SOURCES) {
      fetchSources(); // cached after first run
    }
    if (tab === TABS.SUMMARIES) {
      fetchSummaries(); // cached after first run
    }
  };

  const deleteMemory = async (memoryContent) => {
    try {
      const response = await axios.post(
        `${CONFIG.BACKEND_URL}/api/delete_evidence`,
        {
          evidence: memoryContent,
          userid: userId,
          workflowid: workflowId,
        }
      );
      console.log(response.data);
      // Update local cache (no refetch needed)
      setSummaries((prev) => prev.filter((m) => m.content !== memoryContent));

      // If we're in detail view of a summary version you just deleted, adjust detail panel
      if (detailType === "summary" && detailItem?.content === memoryContent) {
        const remaining = detailVersions.filter(
          (v) => v.content !== memoryContent
        );
        if (remaining.length) {
          setDetailVersions(remaining);
          setDetailIndex(0);
          setDetailItem(remaining[0]);
        } else {
          setView(VIEW.LIST);
          setDetailType(null);
          setDetailItem(null);
          setDetailVersions([]);
        }
      }
    } catch (error) {
      console.error("Error deleting memory:", error);
      setError("Failed to delete the selected summary.");
    }
  };

  // Openers
  const openSourceGroupDetail = (src) => {
    const key = getSourceKey(src);
    const versions = sourceGroups.get(key) || [src];
    console.log(sources);
    setDetailType("source");
    setDetailVersions(versions);
    setDetailIndex(0);
    setDetailItem(versions[0]);
    console.log(versions);
    setView(VIEW.DETAIL);
  };

  const openSummaryGroupDetail = (summary) => {
    // Find all versions by this tag
    const key = getTagKey(summary);
    const versions = summaryGroups.get(key) || [summary];
    // Start at latest (index 0)
    setDetailType("summary");
    setDetailVersions(versions);
    setDetailIndex(0);
    setDetailItem(versions[0]);
    setView(VIEW.DETAIL);
  };

  const handleBack = () => {
    setView(VIEW.LIST);
    // keep search and tab context
  };

  // -------- render helpers --------
  const renderSummaryGroupCard = (latest) => {
    const title = (latest?.content?.split("\n")[0] || "Untitled Summary").slice(
      0,
      60
    );
    const body = latest?.content || "";
    const key = getTagKey(latest);
    const versions = summaryGroups.get(key) || [latest];

    return (
      <div
        key={latest.id ?? `${key}-${body.slice(0, 32)}`}
        className="memory-card clickable"
        onClick={() => openSummaryGroupDetail(latest)}
      >
        <div className="memory-card-content">
          <p>{body}</p>
        </div>
        <div className="memory-card-info">
          <h4>{title}</h4>
          <p>{toLocalTime(latest?.timestamp)}</p>
          <div className="memory-card-actions">
            <div className="stepTag">
              Subtask {(latest?.subtask_index ?? 0) + 1}-
              {(latest?.step_index ?? 0) + 1}
            </div>
            <img
              src="/icons/bin.png"
              alt="BIN"
              className="memory-card-delete-icon"
              onClick={(e) => {
                e.stopPropagation();
                deleteMemory(latest.content);
              }}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderSourceGroupCard = (src, idx) => {
    const key = getSourceKey(src);
    const versions = sourceGroups.get(key) || [src];
    const title = (src?.title || src?.url || key || "Untitled Source").slice(
      0,
      80
    );
    const snippet = src?.excerpt || src?.content || "";
    // console.log(src);
    return (
      <div
        key={src.id ?? `${key}-${idx}`}
        className="memory-card clickable"
        onClick={() => {
          openSourceGroupDetail(src);
          console.log(src);
        }}
      >
        <div className="memory-card-content">
          <p>{snippet}</p>
        </div>
        <div className="memory-card-info">
          <h4>{title}</h4>
          <p>{toLocalTime(src?.timestamp)}</p>
          <div className="memory-card-actions">
            <div className="stepTag">
              Subtask {(src?.phase_index ?? 0) + 1}-{(src?.step_index ?? 0) + 1}
            </div>
            <img
              src="/icons/bin.png"
              alt="BIN"
              className="memory-card-delete-icon"
              onClick={(e) => {
                e.stopPropagation();
                deleteMemory(src.content);
              }}
            />
          </div>
        </div>
      </div>
    );
  };

  // Detail view
  const renderDetail = () => {
    if (!detailItem) return null;

    const isSummary = detailType === "summary";
    const tag = `Subtask ${(detailItem?.subtask_index ?? 0) + 1}-${
      (detailItem?.step_index ?? 0) + 1
    }`;

    if (detailType === "source") {
      return (
        <div className="detail-wrapper">
          <h2 className="detail-title">
            {isSummary ? "Summary" : "Source"} • {tag} •{" "}
            {detailItem?.query_name.split(": ")[1]}
          </h2>
          <h2 className="detail-title">
            <a
              href={
                detailVersions[0]?.url || `${getSourceKey(detailVersions[0])}`
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              {getSourceKey(detailVersions[0])}
            </a>
          </h2>
          <p className="detail-meta">
            {detailVersions.length} pieces from this source
          </p>

          <div className="source-evidence-list">
            {detailVersions.map((v, i) => (
              <div key={v.id ?? i} className="source-evidence-block">
                <div key={v.id ?? i} className="source-evidence-summary">
                  {v?.summary}
                  <div className="evidence-summary-meta">Summary</div>
                </div>
                <pre className="detail-text">
                  {v.content || v.excerpt || ""}
                </pre>

                <div className="evidence-meta">
                  <span>{toLocalTime(v.timestamp)}</span>
                  <span>Raw Text</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="detail-wrapper">
        <h2 className="detail-title">
          {isSummary ? "Summary" : "Source"} • {tag} •{" "}
          {detailItem?.query_name.split(": ")[1]}
        </h2>

        <div className="detail-meta">
          <div>{toLocalTime(detailItem?.timestamp)}</div>

          {detailVersions.length > 1 && (
            <div className="detail-version-select">
              <label htmlFor="versionSel">Version:</label>
              <select
                id="versionSel"
                value={detailIndex}
                onChange={(e) => {
                  const i = Number(e.target.value);
                  setDetailIndex(i);
                  setDetailItem([i]);
                  setIsEditing(false); // leave edit mode when switching versions
                }}
              >
                {detailVersions.map((v, i) => (
                  <option key={v.id ?? i} value={i}>
                    {`#${detailVersions.length - i} • ${
                      toLocalTime(v?.timestamp) || "Unknown"
                    }`}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="detail-body">
          {isEditing ? (
            <textarea
              className="detail-textarea"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              placeholder="Edit content…"
            />
          ) : (
            <pre className="detail-text">
              {detailItem?.content || detailItem?.excerpt || ""}
            </pre>
          )}
        </div>

        <div className="detail-actions">
          {!isEditing ? (
            <>
              <button className="editDetails" onClick={startEditing}>
                Edit
              </button>
              <button
                className="danger"
                onClick={() => deleteMemory(detailItem?.content)}
              >
                Delete this {isSummary ? "version" : "item"}
              </button>
            </>
          ) : (
            <>
              {isSummary && (
                <label className="save-mode">
                  <input
                    type="checkbox"
                    checked={saveAsNew}
                    onChange={(e) => setSaveAsNew(e.target.checked)}
                  />
                  Save as new version (keep history)
                </label>
              )}
              <button disabled={saving || !editText.trim()} onClick={saveEdit}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button onClick={cancelEditing}>Cancel</button>
            </>
          )}
        </div>
      </div>
    );
  };

  const showSummaries = activeTab === TABS.SUMMARIES;

  const stepKeys = Array.from(
    new Set(sources.map((s) => `${s.real_subtask_index}-${s.step_index}`))
  ).sort((a, b) => {
    const [aSub, aStep] = a.split("-").map(Number);
    const [bSub, bStep] = b.split("-").map(Number);
    return aSub - bSub || aStep - bStep; // sort by subtask first, then step
  });

  return (
    <div className="memory-overlay">
      <div
        className={`memory-canvas ${
          view === VIEW.DETAIL ? "slide-right" : "slide-left"
        }`}
      >
        <div className="memory-header">
          {view === VIEW.DETAIL ? (
            <>
              {/* Back button duplicated in detail header for layout parity */}
              <button className="back-button" onClick={handleBack}>
                ←
              </button>
              <button className="close-button" onClick={onClose}>
                ✕
              </button>
              <h2>Memory Detail</h2>
            </>
          ) : (
            <>
              <button className="close-button" onClick={onClose}>
                ✕
              </button>
              <h2>Memory for this Project</h2>
            </>
          )}
        </div>

        {view === VIEW.LIST ? (
          <>
            <div className="memory-search-section">
              <input
                className="memory-search-input"
                type="text"
                placeholder={`Search ${
                  showSummaries ? "step summaries" : "sources"
                }...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <div className="memory-filters">
                <button
                  className={`memory-filter ${
                    activeTab === TABS.SUMMARIES ? "active" : ""
                  }`}
                  onClick={() => handleTabClick(TABS.SUMMARIES)}
                >
                  <img
                    src="/icons/stepSummary.png"
                    alt="Profile"
                    className="memory-filter-icon"
                  />
                  Workflow
                </button>
                <button
                  className={`memory-filter ${
                    activeTab === TABS.SOURCES ? "active" : ""
                  }`}
                  onClick={() => handleTabClick(TABS.SOURCES)}
                >
                  <img
                    src="/icons/sources.png"
                    alt="Profile"
                    className="memory-filter-icon"
                  />
                  Sources
                </button>
              </div>
            </div>

            {error && <div className="memory-error">{error}</div>}

            {/* Content */}
            {activeTab === TABS.SOURCES && (
              <div className="subtask-filter-row">
                <button
                  key="all"
                  className={`subtask-filter-button ${
                    activeStepFilter === null ? "active" : ""
                  }`}
                  onClick={() => setActiveStepFilter(null)}
                >
                  All
                </button>
                {stepKeys.map((key) => {
                  const [sub, step] = key.split("-");
                  return (
                    <button
                      key={key}
                      className={`subtask-filter-button ${
                        activeStepFilter === key ? "active" : ""
                      }`}
                      onClick={() =>
                        setActiveStepFilter(
                          activeStepFilter === key ? null : key
                        )
                      }
                    >
                      Subtask {Number(sub) + 1}-{Number(step) + 1}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="memory-cards-grid">
              {showSummaries ? (
                loadingSummaries ? (
                  <div className="memory-loading">Loading summaries…</div>
                ) : groupedSummaryLatestList.length ? (
                  groupedSummaryLatestList.map(renderSummaryGroupCard)
                ) : (
                  <div className="memory-empty">No summaries found.</div>
                )
              ) : loadingSources ? (
                <div className="memory-loading">Loading sources…</div>
              ) : groupedSourceLatestList.length ? (
                groupedSourceLatestList.map(renderSourceGroupCard)
              ) : hasFetchedSources ? (
                <div className="memory-empty">No sources found.</div>
              ) : (
                <div className="memory-empty">Preparing sources…</div>
              )}
            </div>

            {/* Keep New Memory button only for summaries */}
            {showSummaries && (
              <button className="new-memory-button">＋ New memory</button>
            )}
          </>
        ) : (
          renderDetail()
        )}
      </div>
    </div>
  );
};

export default MemoryCanvas;
