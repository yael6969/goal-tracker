// app.js — Goal Tracker
// Semua logika app: Firebase init, render, modals, events

import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";

import {
  getDatabase,
  ref,
  push,
  onValue,
  update,
  remove
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";

import { firebaseConfig, DB_PREFIX } from "./firebase-config.js";

// ─── App state ────────────────────────────────────────────────────────
let db, goalsRef;
let goals = {};
let pendingUpdate = null;

// ─── Init ─────────────────────────────────────────────────────────────
function initFirebase() {
  try {
    const app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    goalsRef = ref(db, DB_PREFIX);

    onValue(goalsRef, (snapshot) => {
      goals = snapshot.val() || {};
      renderGoals();
      setLoading(false);
    }, (error) => {
      console.error("Firebase read error:", error);
      setLoading(false);
      showError(error);
    });
  } catch (e) {
    console.error("Firebase init error:", e);
    setLoading(false);
    showError(e);
  }
}

// ─── Formatters ───────────────────────────────────────────────────────
const rupiah = (n) => "Rp " + Number(n).toLocaleString("id-ID");

function pct(achieved, total) {
  if (!total) return 0;
  return Math.min(100, Math.round((achieved / total) * 100));
}

// ─── Render ───────────────────────────────────────────────────────────
function renderGoals() {
  const container = document.getElementById("goals-container");
  const emptyState = document.getElementById("empty-state");
  const gridHeader = document.getElementById("grid-header");

  const keys = Object.keys(goals);

  if (keys.length === 0) {
    emptyState.hidden = false;
    gridHeader.hidden = true;
    container.innerHTML = "";
    return;
  }

  emptyState.hidden = true;
  gridHeader.hidden = false;

  const total = keys.length;
  const completed = keys.filter(
    k => goals[k].achieved >= goals[k].total
  ).length;

  document.getElementById("goal-count").textContent =
    `${total} goal${total !== 1 ? "s" : ""}`;

  document.getElementById("goal-done").textContent =
    `${completed} selesai`;

  container.innerHTML = keys
    .map(id => cardHTML(id, goals[id]))
    .join("");

  // Event listeners per card
  container.querySelectorAll("[data-action]").forEach(el => {
    el.addEventListener("click", handleCardAction);
  });

  container.querySelectorAll("input[data-input-id]").forEach(el => {
    el.addEventListener("keydown", (e) => {
      if (
        e.key === "Enter" &&
        el.dataset.inputType === "manual"
      ) {
        handleManualUpdate(el.dataset.inputId);
      }

      blockNonNumeric(e);
    });
  });
}

function cardHTML(id, g) {
  const achieved = g.achieved || 0;
  const total = g.total || 0;
  const pricePerItem = g.pricePerItem || 0;
  const totalPrice = pricePerItem * total;
  const achievedPrice = pricePerItem * achieved;
  const p = pct(achieved, total);
  const done = achieved >= total;

  return `
  <div class="goal-card${done ? " completed" : ""}" data-id="${id}">
    <div class="card-top">
      <div class="card-title-wrap">
        <div class="card-label">Goal</div>
        <div class="card-title">${esc(g.name)}</div>
      </div>

      <button
        class="card-delete"
        data-action="delete"
        data-id="${id}"
        title="Hapus goal"
        aria-label="Hapus goal ${esc(g.name)}"
      >
        <svg viewBox="0 0 24 24">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
          <path d="M10 11v6M14 11v6"/>
          <path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>

    <div class="progress-section">
      <div class="progress-meta">
        <div class="progress-count">
          ${achieved}<span> / ${total} item</span>
        </div>
        <div class="progress-pct">${p}%</div>
      </div>

      <div class="progress-bar-track">
        <div
          class="progress-bar-fill"
          style="width:${p}%"
        ></div>
      </div>
    </div>

    <div class="card-money">
      <div class="money-col">
        <div class="money-label">Harga/item</div>
        <div class="money-value">${rupiah(pricePerItem)}</div>
      </div>

      <div class="money-divider"></div>

      <div class="money-col">
        <div class="money-label">Total goal</div>
        <div class="money-value">${rupiah(totalPrice)}</div>
      </div>

      <div class="money-divider"></div>

      <div class="money-col">
        <div class="money-label">Terkumpul</div>
        <div
          class="money-value"
          style="color:var(--accent)"
        >${rupiah(achievedPrice)}</div>
      </div>
    </div>

    ${done ? `
    <div class="completed-badge">
      <svg
        viewBox="0 0 24 24"
        width="13"
        height="13"
        stroke="currentColor"
        fill="none"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      Goal Tercapai!
    </div>
    ` : `
    <div class="card-controls">
      <div class="quick-btns">
        <button
          class="btn-quick"
          data-action="quick"
          data-id="${id}"
          data-delta="1"
        >+1</button>

        <button
          class="btn-quick"
          data-action="quick"
          data-id="${id}"
          data-delta="5"
        >+5</button>

        <button
          class="btn-quick"
          data-action="quick"
          data-id="${id}"
          data-delta="10"
        >+10</button>
      </div>

      <div class="manual-row">
        <input
          class="input-manual"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          placeholder="Jumlah item dicapai..."
          data-input-id="${id}"
          data-input-type="manual"
          id="manual-${id}"
          autocomplete="off"
        >

        <button
          class="btn-update"
          data-action="manual"
          data-id="${id}"
        >Update</button>
      </div>
    </div>
    `}
  </div>`;
}

// ─── Card actions ──────────────────────────────────────────────────────
function handleCardAction(e) {
  const btn = e.currentTarget;
  const action = btn.dataset.action;
  const id = btn.dataset.id;

  if (action === "delete") {
    openDeleteConfirm(id);
  } else if (action === "quick") {
    openUpdateModal(
      id,
      parseInt(btn.dataset.delta, 10),
      null
    );
  } else if (action === "manual") {
    handleManualUpdate(id);
  }
}

function handleManualUpdate(id) {
  const inp = document.getElementById(`manual-${id}`);

  if (!inp) return;

  const val = parseInt(inp.value.trim(), 10);

  if (isNaN(val) || val < 0) {
    toast("Masukkan angka yang valid", "error");
    return;
  }

  openUpdateModal(id, null, val);
}

// ─── Update modal ─────────────────────────────────────────────────────
function openUpdateModal(id, delta, manualValue) {
  const g = goals[id];

  if (!g) return;

  const achieved = g.achieved || 0;
  const total = g.total || 0;

  const newAchieved =
    (delta !== null && delta !== undefined)
      ? Math.min(total, achieved + delta)
      : Math.min(total, manualValue);

  pendingUpdate = { id, newAchieved };

  document.getElementById("upd-goal-name").textContent = g.name;

  document.getElementById("upd-goal-meta").textContent =
    `${achieved} → ${newAchieved} dari ${total} item`;

  const priceInp = document.getElementById("upd-price-input");

  priceInp.value = g.pricePerItem || "";

  document.getElementById("upd-preview").textContent =
    rupiah((g.pricePerItem || 0) * newAchieved);

  priceInp.oninput = () => {
    const p = parseInt(priceInp.value, 10) || 0;

    document.getElementById("upd-preview").textContent =
      rupiah(p * newAchieved);
  };

  document.getElementById("update-modal").hidden = false;

  priceInp.focus();
  priceInp.select();
}

function confirmUpdate() {
  if (!pendingUpdate) return;

  const priceInp = document.getElementById("upd-price-input");
  const price = parseInt(priceInp.value.trim(), 10);

  if (isNaN(price) || price <= 0) {
    toast("Harga peritem harus lebih dari 0", "error");
    priceInp.focus();
    return;
  }

  const { id, newAchieved } = pendingUpdate;

  update(
    ref(db, `${DB_PREFIX}/${id}`),
    {
      achieved: newAchieved,
      pricePerItem: price
    }
  )
    .then(() => {
      const inp = document.getElementById(`manual-${id}`);

      if (inp) inp.value = "";

      toast("Progress diperbarui!", "success");
      closeUpdateModal();
    })
    .catch(e => {
      toast("Gagal menyimpan: " + e.message, "error");
    });
}

function closeUpdateModal() {
  document.getElementById("update-modal").hidden = true;
  pendingUpdate = null;
}

// ─── Delete modal ──────────────────────────────────────────────────────
function openDeleteConfirm(id) {
  const g = goals[id];

  if (!g) return;

  document.getElementById("del-goal-name").textContent = g.name;

  document.getElementById("delete-modal").hidden = false;

  document.getElementById("del-confirm-btn").onclick = () => {
    confirmDelete(id);
  };
}

function confirmDelete(id) {
  remove(ref(db, `${DB_PREFIX}/${id}`))
    .then(() => {
      toast("Goal dihapus", "success");

      document.getElementById("delete-modal").hidden = true;
    })
    .catch(e => {
      toast("Gagal menghapus: " + e.message, "error");
    });
}

// ─── Add goal modal ───────────────────────────────────────────────────
function openAddModal() {
  document.getElementById("add-form").reset();

  document.getElementById("add-summary-val").textContent = "Rp 0";

  document.getElementById("add-modal").hidden = false;

  document.getElementById("add-name").focus();
}

function closeAddModal() {
  document.getElementById("add-modal").hidden = true;
}

function handleAddGoal(e) {
  e.preventDefault();

  const name = document.getElementById("add-name").value.trim();

  const total = parseInt(
    document.getElementById("add-total").value,
    10
  );

  const price = parseInt(
    document.getElementById("add-price").value,
    10
  );

  if (!name) {
    toast("Nama goal wajib diisi", "error");
    return;
  }

  if (!total || total < 1) {
    toast("Jumlah item harus minimal 1", "error");
    return;
  }

  if (!price || price < 1) {
    toast("Harga peritem harus lebih dari 0", "error");
    return;
  }

  push(goalsRef, {
    name,
    total,
    pricePerItem: price,
    achieved: 0,
    createdAt: Date.now()
  })
    .then(() => {
      toast("Goal berhasil ditambahkan!", "success");
      closeAddModal();
    })
    .catch(e => {
      toast("Gagal menyimpan: " + e.message, "error");
    });
}

// ─── Utilities ─────────────────────────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toast(msg, type = "success") {
  const c = document.getElementById("toast-container");
  const el = document.createElement("div");

  el.className = `toast ${type}`;
  el.textContent = msg;

  c.appendChild(el);

  setTimeout(() => el.remove(), 3000);
}

function setLoading(show) {
  document.getElementById("loading").hidden = !show;
  document.getElementById("app-content").hidden = show;
}

function showError(err) {
  const el = document.getElementById("firebase-error");

  el.hidden = false;

  const msg = err?.message || String(err);

  el.querySelector(".err-msg").textContent =
    (msg.includes("YOUR_") || msg.includes("firebaseConfig"))
      ? "Firebase belum dikonfigurasi. Buka firebase-config.js dan isi dengan data dari Firebase Console kamu."
      : msg;
}

function blockNonNumeric(e) {
  const allowed = [
    "Backspace",
    "Delete",
    "ArrowLeft",
    "ArrowRight",
    "Tab",
    "Enter"
  ];

  if (!/^\d$/.test(e.key) && !allowed.includes(e.key)) {
    e.preventDefault();
  }
}

// ─── Boot ──────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initFirebase();

  // Add buttons
  [
    "btn-add-header",
    "btn-add-empty",
    "btn-add-grid"
  ].forEach(id => {
    document.getElementById(id).addEventListener(
      "click",
      openAddModal
    );
  });

  // Add modal
  document.getElementById("add-modal-close")
    .addEventListener("click", closeAddModal);

  document.getElementById("add-cancel")
    .addEventListener("click", closeAddModal);

  document.getElementById("add-form")
    .addEventListener("submit", handleAddGoal);

  ["add-total", "add-price"].forEach(id => {
    document.getElementById(id).addEventListener("input", () => {
      const t =
        parseInt(document.getElementById("add-total").value, 10) || 0;

      const p =
        parseInt(document.getElementById("add-price").value, 10) || 0;

      document.getElementById("add-summary-val").textContent =
        rupiah(t * p);
    });

    document.getElementById(id).addEventListener(
      "keydown",
      blockNonNumeric
    );
  });

  // Update modal
  document.getElementById("upd-modal-close")
    .addEventListener("click", closeUpdateModal);

  document.getElementById("upd-cancel")
    .addEventListener("click", closeUpdateModal);

  document.getElementById("upd-confirm")
    .addEventListener("click", confirmUpdate);

  document.getElementById("upd-price-input")
    .addEventListener("keydown", (e) => {
      if (e.key === "Enter") confirmUpdate();

      blockNonNumeric(e);
    });

  // Delete modal
  document.getElementById("del-modal-close")
    .addEventListener("click", () => {
      document.getElementById("delete-modal").hidden = true;
    });

  document.getElementById("del-cancel")
    .addEventListener("click", () => {
      document.getElementById("delete-modal").hidden = true;
    });

  // Close modals on backdrop click / Escape
  document.querySelectorAll(".modal-backdrop").forEach(bd => {
    bd.addEventListener("click", (e) => {
      if (e.target === bd) {
        document.querySelectorAll(".modal-backdrop").forEach(m => {
          m.hidden = true;
        });

        pendingUpdate = null;
      }
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-backdrop").forEach(m => {
        m.hidden = true;
      });

      pendingUpdate = null;
    }
  });
});
