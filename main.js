import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-analytics.js";
import {
  getDatabase,
  ref,
  push,
  set,
  update,
  remove,
  onValue,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-database.js";

// Firebase 연결 설정 — API 키는 localStorage 또는 아래 기본값 사용
const FIREBASE_APIKEY_STORAGE = "todoapp-firebase-apikey";
const defaultApiKey = "AIzaSyA7ly9MsxfFAA2B2oovur3e61leUMUq1qc";
const firebaseConfig = {
  apiKey: localStorage.getItem(FIREBASE_APIKEY_STORAGE) || defaultApiKey,
  authDomain: "todoapp-400bd.firebaseapp.com",
  projectId: "todoapp-400bd",
  storageBucket: "todoapp-400bd.firebasestorage.app",
  messagingSenderId: "58046131647",
  appId: "1:58046131647:web:6d77386ca9fd9ddb3c450a",
  measurementId: "G-J5FPE8H2K3",
  databaseURL: "https://todoapp-400bd-default-rtdb.firebaseio.com",
};

// Firebase 초기화 (Realtime Database 사용)
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);

// DOM
const form = document.getElementById("todo-form");
const input = document.getElementById("todo-input");
const list = document.getElementById("todo-list");
const emptyMsg = document.getElementById("empty-message");
const countEl = document.getElementById("count");

const TODOS_PATH = "todos";
const todosRef = ref(db, TODOS_PATH);

let todos = [];
let editingId = null;

function updateCount() {
  const total = todos.length;
  countEl.textContent = "총 " + total + "개";
  emptyMsg.classList.toggle("hidden", total > 0);
}

function createTodoItem(id, text, done) {
  const li = document.createElement("li");
  li.className = "todo-item" + (done ? " done" : "");
  li.dataset.id = id;

  const textSpan = document.createElement("span");
  textSpan.className = "todo-text";
  textSpan.textContent = text;

  const editInput = document.createElement("input");
  editInput.type = "text";
  editInput.className = "edit-input";
  editInput.value = text;
  editInput.style.display = "none";

  const actions = document.createElement("div");
  actions.className = "todo-actions";

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "btn-edit";
  editBtn.textContent = "수정";
  editBtn.addEventListener("click", function () {
    startEdit(id);
  });

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "btn-save";
  saveBtn.textContent = "저장";
  saveBtn.style.display = "none";
  saveBtn.addEventListener("click", function () {
    saveEdit(id, editInput.value.trim());
  });

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "btn-cancel";
  cancelBtn.textContent = "취소";
  cancelBtn.style.display = "none";
  cancelBtn.addEventListener("click", function () {
    cancelEdit();
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "btn-delete";
  deleteBtn.textContent = "삭제";
  deleteBtn.addEventListener("click", function () {
    removeTodo(id);
  });

  actions.append(editBtn, saveBtn, cancelBtn, deleteBtn);
  li.append(textSpan, editInput, actions);
  return li;
}

function startEdit(id) {
  if (editingId !== null) cancelEdit();
  editingId = id;
  const li = list.querySelector('[data-id="' + id + '"]');
  if (!li) return;
  const textSpan = li.querySelector(".todo-text");
  const editInput = li.querySelector(".edit-input");
  const editBtn = li.querySelector(".btn-edit");
  const saveBtn = li.querySelector(".btn-save");
  const cancelBtn = li.querySelector(".btn-cancel");
  textSpan.style.display = "none";
  editInput.style.display = "block";
  editInput.value = textSpan.textContent;
  editInput.focus();
  editBtn.style.display = "none";
  saveBtn.style.display = "inline-block";
  cancelBtn.style.display = "inline-block";
}

async function saveEdit(id, newText) {
  if (editingId !== id) return;
  const todo = todos.find(function (t) {
    return t.id === id;
  });
  if (!todo) return cancelEdit();
  if (newText === "") {
    await removeTodo(id);
    cancelEdit();
    return;
  }
  try {
    await update(ref(db, TODOS_PATH + "/" + id), { text: newText });
  } catch (err) {
    console.error("수정 실패:", err);
  }
  cancelEdit();
}

function cancelEdit() {
  if (editingId === null) return;
  const li = list.querySelector('[data-id="' + editingId + '"]');
  if (li) {
    const textSpan = li.querySelector(".todo-text");
    const editInput = li.querySelector(".edit-input");
    const editBtn = li.querySelector(".btn-edit");
    const saveBtn = li.querySelector(".btn-save");
    const cancelBtn = li.querySelector(".btn-cancel");
    textSpan.style.display = "";
    editInput.style.display = "none";
    editBtn.style.display = "inline-block";
    saveBtn.style.display = "none";
    cancelBtn.style.display = "none";
  }
  editingId = null;
}

/**
 * 할일 추가 - Firebase Realtime Database에 저장
 * push()로 todos 아래에 새 키 생성 후 set()으로 데이터 저장
 */
async function addTodo(text) {
  const trimmed = text.trim();
  if (!trimmed) return;

  const addBtn = document.getElementById("add-btn");
  const btnText = addBtn.querySelector(".btn-text");
  addBtn.disabled = true;
  if (btnText) btnText.textContent = "추가 중...";

  try {
    const newRef = push(todosRef);
    await set(newRef, {
      text: trimmed,
      done: false,
      createdAt: serverTimestamp(),
    });
    input.value = "";
    input.focus();
  } catch (err) {
    console.error("Firebase Realtime Database 할일 추가 실패:", err);
    alert("할일 추가에 실패했습니다. 네트워크와 Realtime Database 규칙을 확인해주세요.");
  } finally {
    addBtn.disabled = false;
    if (btnText) btnText.textContent = "추가";
  }
}

async function removeTodo(id) {
  if (editingId === id) editingId = null;
  try {
    await remove(ref(db, TODOS_PATH + "/" + id));
  } catch (err) {
    console.error("삭제 실패:", err);
  }
}

function render() {
  list.innerHTML = "";
  todos.forEach(function (todo) {
    list.appendChild(createTodoItem(todo.id, todo.text, todo.done));
  });
  updateCount();
}

// Realtime Database 실시간 구독: 데이터 변경 시 자동 반영 + 새로고침 시에도 목록 복원
onValue(todosRef, (snapshot) => {
  const data = snapshot.val();
  todos = [];

  if (data && typeof data === "object") {
    todos = Object.entries(data).map(([id, item]) => ({
      id,
      text: item.text || "",
      done: item.done === true,
      createdAt: item.createdAt != null ? item.createdAt : 0,
    }));
    // createdAt 순 정렬 (서버 타임스탬프는 밀리초)
    todos.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }

  render();
});

form.addEventListener("submit", function (e) {
  e.preventDefault();
  addTodo(input.value);
});

// ---- Firebase API 키 설정 모달 ----
const modal = document.getElementById("firebase-modal");
const settingsBtn = document.getElementById("settings-btn");
const modalBackdrop = document.getElementById("modal-backdrop");
const modalClose = document.getElementById("modal-close");
const firebaseForm = document.getElementById("firebase-form");
const firebaseApikeyInput = document.getElementById("firebase-apikey");

function openFirebaseModal() {
  firebaseApikeyInput.value = localStorage.getItem(FIREBASE_APIKEY_STORAGE) || "";
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  firebaseApikeyInput.focus();
}

function closeFirebaseModal() {
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
}

if (settingsBtn) {
  settingsBtn.addEventListener("click", openFirebaseModal);
}
if (modalBackdrop) {
  modalBackdrop.addEventListener("click", closeFirebaseModal);
}
if (modalClose) {
  modalClose.addEventListener("click", closeFirebaseModal);
}
if (firebaseForm) {
  firebaseForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const key = firebaseApikeyInput.value.trim();
    if (key) {
      localStorage.setItem(FIREBASE_APIKEY_STORAGE, key);
      closeFirebaseModal();
      alert("Firebase API 키가 저장되었습니다. 새로고침하면 적용됩니다.");
    } else {
      localStorage.removeItem(FIREBASE_APIKEY_STORAGE);
      closeFirebaseModal();
      alert("저장된 API 키를 삭제했습니다. 기본값이 사용됩니다. 새로고침하면 적용됩니다.");
    }
  });
}
