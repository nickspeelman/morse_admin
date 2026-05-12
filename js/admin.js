const BACKEND_URL = "https://script.google.com/macros/s/AKfycbxY8uJQ5r1TDt7nMpqDUGOL-LtXyUo4g3bCPbXaa4otbknZdXcAuHuxfZMRnjtay9Ms/exec";

let currentSettings = null;

const els = {
  statusText: document.getElementById("statusText"),
  targetPhraseInput: document.getElementById("targetPhraseInput"),
  dotMaxMs: document.getElementById("dotMaxMs"),
  dashMaxMs: document.getElementById("dashMaxMs"),
  letterGapMs: document.getElementById("letterGapMs"),
  wordGapMs: document.getElementById("wordGapMs"),
  errorFlashMs: document.getElementById("errorFlashMs"),
  saveSettingsBtn: document.getElementById("saveSettingsBtn"),
  teamsList: document.getElementById("teamsList"),
  resetAllBtn: document.getElementById("resetAllBtn"),
  modalBackdrop: document.getElementById("modalBackdrop"),
  modalTitle: document.getElementById("modalTitle"),
  modalBody: document.getElementById("modalBody"),
  modalActions: document.getElementById("modalActions")
};

async function apiGet(action, params = {}) {
  const url = new URL(BACKEND_URL);
  url.searchParams.set("action", action);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString());
  return response.json();
}

async function apiPost(body) {
  const response = await fetch(BACKEND_URL, {
    method: "POST",
    body: JSON.stringify(body)
  });

  return response.json();
}

async function loadSettings() {
  setStatus("Loading settings...");

  const data = await apiGet("getSettings");

  if (!data.ok) {
    setStatus(`Error: ${data.error}`);
    return;
  }

  currentSettings = data.settings;
  renderSettings();
  setStatus("Settings loaded.");
}

function renderSettings() {
  els.targetPhraseInput.value = currentSettings.targetPhrase || "";

  els.dotMaxMs.value = currentSettings.timing.dotMaxMs;
  els.dashMaxMs.value = currentSettings.timing.dashMaxMs;
  els.letterGapMs.value = currentSettings.timing.letterGapMs;
  els.wordGapMs.value = currentSettings.timing.wordGapMs;
  els.errorFlashMs.value = currentSettings.timing.errorFlashMs;

  els.teamsList.innerHTML = currentSettings.teams
    .map(renderTeamAdminCard)
    .join("");
}

function renderTeamAdminCard(team) {
  const label = team.displayName || team.label || `Key ${team.keyNumber}`;

  return `
    <div class="team-admin-card">
      <div class="team-key">Key ${team.keyNumber}</div>
      <div class="team-label">Current label: ${escapeHtml(label)}</div>
      <div class="team-buttons">
        <button data-action="update-label" data-team-id="${escapeHtml(team.id)}">
          Update Key ${team.keyNumber} Label
        </button>
        <button data-action="reset-team" data-team-id="${escapeHtml(team.id)}">
          Reset ${escapeHtml(label)}
        </button>
      </div>
    </div>
  `;
}

function collectSettingsFromForm() {
  return {
    ...currentSettings,
    targetPhrase: els.targetPhraseInput.value.trim().toUpperCase(),
    timing: {
      ...currentSettings.timing,
      dotMaxMs: Number(els.dotMaxMs.value),
      dashMaxMs: Number(els.dashMaxMs.value),
      letterGapMs: Number(els.letterGapMs.value),
      wordGapMs: Number(els.wordGapMs.value),
      errorFlashMs: Number(els.errorFlashMs.value)
    }
  };
}

function openConfirmModal({ title, bodyHtml, confirmText, onConfirm }) {
  els.modalTitle.textContent = title;
  els.modalBody.innerHTML = bodyHtml;
  els.modalActions.innerHTML = `
    <button id="modalCancelBtn">Cancel</button>
    <button id="modalConfirmBtn">${escapeHtml(confirmText)}</button>
  `;

  els.modalBackdrop.classList.remove("hidden");

  document.getElementById("modalCancelBtn").onclick = closeModal;
  document.getElementById("modalConfirmBtn").onclick = () => {
    openYesModal(onConfirm);
  };
}

function openYesModal(onConfirm) {
  els.modalTitle.textContent = "Type YES to continue.";
  els.modalBody.innerHTML = `<input id="yesInput" type="text" autocomplete="off" />`;
  els.modalActions.innerHTML = `
    <button id="modalCancelBtn">Cancel</button>
    <button id="yesConfirmBtn" disabled>Confirm</button>
  `;

  const input = document.getElementById("yesInput");
  const confirmBtn = document.getElementById("yesConfirmBtn");

  document.getElementById("modalCancelBtn").onclick = closeModal;

  input.addEventListener("input", () => {
    confirmBtn.disabled = input.value !== "YES";
  });

  confirmBtn.onclick = async () => {
    closeModal();
    await onConfirm();
  };

  setTimeout(() => input.focus(), 50);
}

function openLabelModal(teamId) {
  const team = currentSettings.teams.find(t => t.id === teamId);
  const currentLabel = team.displayName || team.label || `Key ${team.keyNumber}`;

  els.modalTitle.textContent = `Update Key ${team.keyNumber} Label`;
  els.modalBody.innerHTML = `
    <p>Current label: <strong>${escapeHtml(currentLabel)}</strong></p>
    <input id="labelInput" type="text" value="${escapeHtml(currentLabel)}" />
  `;
  els.modalActions.innerHTML = `
    <button id="modalCancelBtn">Cancel</button>
    <button id="labelSaveBtn">Save Label</button>
  `;

  els.modalBackdrop.classList.remove("hidden");

  const input = document.getElementById("labelInput");
  document.getElementById("modalCancelBtn").onclick = closeModal;
  document.getElementById("labelSaveBtn").onclick = async () => {
    const newLabel = input.value.trim();

    if (!newLabel) {
      return;
    }

    team.displayName = newLabel;
    await saveSettingsDirect();
    closeModal();
  };

  setTimeout(() => input.focus(), 50);
}

function closeModal() {
  els.modalBackdrop.classList.add("hidden");
}

async function saveSettingsDirect() {
  setStatus("Saving settings...");

  const data = await apiPost({
    action: "saveSettings",
    settings: currentSettings
  });

  if (!data.ok) {
    setStatus(`Error: ${data.error}`);
    return;
  }

  currentSettings = data.settings;
  renderSettings();
  setStatus("Settings saved. App reset sent.");
}

function setStatus(message) {
  els.statusText.textContent = message;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

els.saveSettingsBtn.addEventListener("click", () => {
  const proposedSettings = collectSettingsFromForm();

  openConfirmModal({
    title: "Confirm Settings Change",
    bodyHtml: `
      <p>This will:</p>
      <ul>
        <li>Update timing thresholds</li>
        <li>Update target phrase</li>
        <li>Reset all team progress</li>
      </ul>
    `,
    confirmText: "Save & Reset",
    onConfirm: async () => {
      currentSettings = proposedSettings;
      await saveSettingsDirect();
    }
  });
});

els.resetAllBtn.addEventListener("click", () => {
  openConfirmModal({
    title: "Reset Entire App?",
    bodyHtml: "<p>This will clear progress for all teams.</p>",
    confirmText: "Reset Everything",
    onConfirm: async () => {
      setStatus("Resetting entire app...");
      const data = await apiGet("resetAll");

      if (!data.ok) {
        setStatus(`Error: ${data.error}`);
        return;
      }

      setStatus("Global reset sent.");
    }
  });
});

els.teamsList.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;

  const action = button.dataset.action;
  const teamId = button.dataset.teamId;

  if (action === "update-label") {
    openLabelModal(teamId);
  }

  if (action === "reset-team") {
    const team = currentSettings.teams.find(t => t.id === teamId);
    const label = team.displayName || team.label || `Key ${team.keyNumber}`;

    openConfirmModal({
      title: `Reset ${label}?`,
      bodyHtml: "<p>This will clear progress for this team only.</p>",
      confirmText: "Reset Team",
      onConfirm: async () => {
        setStatus(`Resetting ${label}...`);
        const data = await apiGet("resetTeam", { teamId });

        if (!data.ok) {
          setStatus(`Error: ${data.error}`);
          return;
        }

        setStatus(`${label} reset sent.`);
      }
    });
  }
});

loadSettings();