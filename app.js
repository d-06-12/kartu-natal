// Christmas card app with email-based accounts and automatic share-link creation.
// Comments mark important parts for developer.

// === LocalStorage keys ===
const LS_KEY_MSG = "xmas_messages_v1";
const LS_KEY_USERS = "xmas_users_v1";
const LS_KEY_CURRENT = "xmas_current";

// === DOM refs ===
const $ = (id) => document.getElementById(id);

const authName = $("authName"),
  authEmail = $("authEmail"),
  authPass = $("authPass");
const btnRegister = $("btnRegister"),
  btnLogin = $("btnLogin"),
  btnLogout = $("btnLogout"),
  userInfo = $("userInfo");

const fromName = $("fromName"),
  messageText = $("messageText");
const audioUrl = $("audioUrl"),
  btnLoadAudio = $("btnLoadAudio"),
  previewAudio = $("previewAudio");
const youtubeUrl = $("youtubeUrl"),
  btnLoadYouTube = $("btnLoadYouTube"),
  youtubePreview = $("youtubePreview");
const btnRecord = $("btnRecord"),
  recStatus = $("recStatus"),
  recordedPlay = $("recordedPlay");
const photoInput = $("photoInput"),
  photoPreview = $("photoPreview");
const btnSend = $("btnSend"),
  btnClear = $("btnClear");
const messagesList = $("messagesList"),
  emptyHint = $("emptyHint"),
  linkBox = $("linkBox");

const tpl = document.getElementById("messageTemplate");

// === State ===
let messages = [];
let mediaRecorder = null;
let recordedBlobDataUrl = null;
let recordingChunks = [];

// === Users utilities ===
function readUsers() {
  return JSON.parse(localStorage.getItem(LS_KEY_USERS) || "{}");
}
function writeUsers(u) {
  localStorage.setItem(LS_KEY_USERS, JSON.stringify(u));
}
function setCurrentUser(email) {
  localStorage.setItem(LS_KEY_CURRENT, email);
  updateAuthUI();
}
function getCurrentUserEmail() {
  return localStorage.getItem(LS_KEY_CURRENT);
}
function logoutUser() {
  localStorage.removeItem(LS_KEY_CURRENT);
  updateAuthUI();
}

function getCurrentUser() {
  const email = getCurrentUserEmail();
  if (!email) return null;
  const users = readUsers();
  return users[email] ? { email, name: users[email].name } : null;
}

// === Messages persistence ===
function loadMessages() {
  messages = JSON.parse(localStorage.getItem(LS_KEY_MSG) || "[]");
}
function saveMessages() {
  localStorage.setItem(LS_KEY_MSG, JSON.stringify(messages));
}

// === Helpers ===
function timeNow() {
  return new Date().toLocaleString();
}
function fileToDataURL(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}
function getQueryParam(name) {
  return new URLSearchParams(location.search).get(name);
}

// === AUTH HANDLERS ===
// Register user with email/password
btnRegister.addEventListener("click", () => {
  const email = (authEmail.value || "").trim().toLowerCase();
  const pass = authPass.value || "";
  const name = (authName.value || "").trim() || null;
  if (!email || !pass) {
    alert("Masukkan email dan password");
    return;
  }
  const users = readUsers();
  if (users[email]) {
    alert("Email sudah terdaftar");
    return;
  }
  users[email] = { pass, name };
  writeUsers(users);
  setCurrentUser(email);
  alert("Akun dibuat dan Anda telah login.");
});

// Login
btnLogin.addEventListener("click", () => {
  const email = (authEmail.value || "").trim().toLowerCase();
  const pass = authPass.value || "";
  if (!email || !pass) {
    alert("Masukkan email dan password");
    return;
  }
  const users = readUsers();
  if (!users[email] || users[email].pass !== pass) {
    alert("Email atau password salah");
    return;
  }
  setCurrentUser(email);
  alert("Login berhasil");
});

// Logout
btnLogout.addEventListener("click", () => {
  logoutUser();
});

// Update auth UI based on current user
function updateAuthUI() {
  const cur = getCurrentUser();
  if (cur) {
    userInfo.textContent = `Login sebagai: ${cur.name || cur.email}`;
    btnLogout.classList.remove("hidden");
    // auto-fill fromName when logged in
    fromName.value = cur.name || cur.email;
    authEmail.value = cur.email;
  } else {
    userInfo.textContent = "Belum login";
    btnLogout.classList.add("hidden");
    // don't clear fromName to let anonymous sender
  }
}

// === Audio & YouTube preview ===
btnLoadAudio.addEventListener("click", () => {
  const url = audioUrl.value.trim();
  if (!url) {
    alert("Masukkan link audio (direct mp3/ogg).");
    return;
  }
  previewAudio.src = url;
  previewAudio.classList.remove("hidden");
  previewAudio.play().catch(() => {});
});

function parseYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m && m[1]) return m[1];
  }
  try {
    const u = new URL(url);
    const v = u.searchParams.get("v");
    if (v && v.length === 11) return v;
  } catch (e) {}
  return null;
}

btnLoadYouTube.addEventListener("click", () => {
  const url = youtubeUrl.value.trim();
  const id = parseYouTubeId(url);
  if (!id) {
    alert("URL YouTube tidak valid");
    return;
  }
  youtubePreview.innerHTML = "";
  const iframe = document.createElement("iframe");
  iframe.src = `https://www.youtube.com/embed/${id}?rel=0`;
  iframe.allow =
    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
  iframe.allowFullscreen = true;
  youtubePreview.appendChild(iframe);
  youtubePreview.classList.remove("hidden");
});

// === Recording audio ===
btnRecord.addEventListener("click", async () => {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    btnRecord.textContent = "Mulai Rekam";
    recStatus.textContent = "Processing...";
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("Browser tidak mendukung perekaman audio.");
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordingChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size) recordingChunks.push(e.data);
    };
    mediaRecorder.onstop = async () => {
      const blob = new Blob(recordingChunks, { type: "audio/webm" });
      recordedBlobDataUrl = await fileToDataURL(blob);
      recordedPlay.src = recordedBlobDataUrl;
      recordedPlay.classList.remove("hidden");
      recStatus.textContent = "Selesai merekam";
      stream.getTracks().forEach((t) => t.stop());
    };
    mediaRecorder.start();
    btnRecord.textContent = "Berhenti Rekam";
    recStatus.textContent = "Merekam...";
  } catch (err) {
    console.error(err);
    alert("Gagal akses mikrofon.");
  }
});

// Photo preview
photoInput.addEventListener("change", async (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  const data = await fileToDataURL(f);
  photoPreview.src = data;
  photoPreview.classList.remove("hidden");
});

// === Send message with auto-generated link ===
btnSend.addEventListener("click", async () => {
  const curUser = getCurrentUser();
  const name =
    (curUser && (curUser.name || curUser.email)) ||
    fromName.value.trim() ||
    "Anonim";
  const text = messageText.value.trim();
  if (!text) {
    alert("Tulis pesan terlebih dahulu.");
    return;
  }

  let photoData = null;
  if (photoInput.files && photoInput.files[0])
    photoData = await fileToDataURL(photoInput.files[0]);

  const extAudio =
    previewAudio.src && !previewAudio.classList.contains("hidden")
      ? previewAudio.src
      : null;
  const recorded = recordedBlobDataUrl || null;
  const ytId =
    youtubePreview && youtubePreview.querySelector("iframe")
      ? parseYouTubeId(youtubeUrl.value.trim())
      : null;

  const msg = {
    id: Date.now().toString(),
    from: name,
    fromEmail: curUser ? curUser.email : null,
    text,
    time: timeNow(),
    photo: photoData,
    extAudio,
    recordedAudio: recorded,
    youtubeId: ytId,
    replies: [],
  };

  messages.unshift(msg);
  saveMessages();
  renderMessages();

  // Generate shareable link and copy to clipboard automatically
  const shareLink = `${location.origin}${location.pathname}?msg=${msg.id}`;
  try {
    await navigator.clipboard.writeText(shareLink);
    linkBox.textContent = `Link ucapan dibuat & disalin ke clipboard: ${shareLink}`;
  } catch (e) {
    linkBox.textContent = `Link ucapan: ${shareLink} (salin manual jika perlu)`;
  }
  linkBox.classList.remove("hidden");

  // clear composer
  messageText.value = "";
  photoInput.value = "";
  photoPreview.classList.add("hidden");
  recordedBlobDataUrl = null;
  recordedPlay.src = "";
  recordedPlay.classList.add("hidden");
  previewAudio.src = "";
  previewAudio.classList.add("hidden");
  audioUrl.value = "";
  youtubeUrl.value = "";
  youtubePreview.innerHTML = "";
  youtubePreview.classList.add("hidden");
  recStatus.textContent = "Belum merekam";
});

// clear composer
btnClear.addEventListener("click", () => {
  fromName.value = "";
  messageText.value = "";
  audioUrl.value = "";
  previewAudio.src = "";
  previewAudio.classList.add("hidden");
  youtubeUrl.value = "";
  youtubePreview.innerHTML = "";
  youtubePreview.classList.add("hidden");
  recordedBlobDataUrl = null;
  recordedPlay.src = "";
  recordedPlay.classList.add("hidden");
  photoInput.value = "";
  photoPreview.classList.add("hidden");
  recStatus.textContent = "Belum merekam";
  linkBox.classList.add("hidden");
});

// === Render messages; support share button, and linking to single message via ?msg=ID ===
function renderMessages(scrollToId) {
  messagesList.innerHTML = "";
  if (messages.length === 0) {
    emptyHint.style.display = "block";
    return;
  }
  emptyHint.style.display = "none";

  for (const m of messages) {
    const el = tpl.content.cloneNode(true);
    el.querySelector(".sender").textContent = m.from;
    el.querySelector(".time").textContent = m.time;
    el.querySelector(".text").textContent = m.text;

    const thumb = el.querySelector(".thumb");
    if (m.photo) {
      thumb.src = m.photo;
      thumb.classList.remove("hidden");
    }

    const audioEl = el.querySelector(".audio");
    if (m.recordedAudio) {
      audioEl.src = m.recordedAudio;
      audioEl.classList.remove("hidden");
    } else if (m.extAudio) {
      audioEl.src = m.extAudio;
      audioEl.classList.remove("hidden");
    }

    const ytContainer = el.querySelector(".yt-container");
    if (m.youtubeId) {
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.youtube.com/embed/${m.youtubeId}?rel=0`;
      iframe.allow =
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      iframe.allowFullscreen = true;
      ytContainer.appendChild(iframe);
      ytContainer.classList.remove("hidden");
    }

    const repliesContainer = el.querySelector(".replies");
    for (const r of m.replies || []) {
      const rEl = document.createElement("div");
      rEl.className = "reply";
      rEl.style.padding = "8px";
      rEl.style.marginTop = "8px";
      rEl.style.borderLeft = "3px solid #e6eef7";
      rEl.innerHTML = `<strong style="font-size:0.95rem">${r.from}</strong> <span class="muted" style="font-size:0.75rem;margin-left:8px">${r.time}</span><div style="margin-top:6px">${r.text}</div>`;
      repliesContainer.appendChild(rEl);
    }

    const replyBtn = el.querySelector(".btnReply");
    const replyBox = el.querySelector(".reply-box");
    const btnSendReply = el.querySelector(".btnSendReply");
    const btnCancelReply = el.querySelector(".btnCancelReply");
    const replyText = el.querySelector(".replyText");
    const shareBtn = el.querySelector(".btnShare");

    replyBtn.addEventListener("click", () =>
      replyBox.classList.toggle("hidden")
    );
    btnCancelReply.addEventListener("click", () =>
      replyBox.classList.add("hidden")
    );
    btnSendReply.addEventListener("click", () => {
      const v = replyText.value.trim();
      if (!v) return alert("Tulis balasan terlebih dahulu.");
      const replyObj = {
        from: getCurrentUser()
          ? getCurrentUser().name || getCurrentUser().email
          : "Anda",
        text: v,
        time: timeNow(),
      };
      const idx = messages.findIndex((mm) => mm.id === m.id);
      if (idx !== -1) {
        messages[idx].replies.push(replyObj);
        saveMessages();
        renderMessages();
      }
    });

    // Share button: copy link to clipboard
    shareBtn.addEventListener("click", async () => {
      const shareLink = `${location.origin}${location.pathname}?msg=${m.id}`;
      try {
        await navigator.clipboard.writeText(shareLink);
        alert("Link disalin ke clipboard");
      } catch (e) {
        prompt("Salin link berikut:", shareLink);
      }
    });

    const wrapper = document.createElement("div");
    wrapper.appendChild(el);
    messagesList.appendChild(wrapper);
  }

  // If asked to scroll to a specific message id
  if (scrollToId) {
    // find the child whose .time matches message id time or use index search
    const idx = messages.findIndex((mm) => mm.id === scrollToId);
    if (idx !== -1) {
      // messagesList children correspond to messages order (unshift used) -> child at same index
      const child = messagesList.children[idx];
      if (child) {
        child.scrollIntoView({ behavior: "smooth", block: "center" });
        child.style.outline = "3px solid rgba(255,107,107,0.25)";
      }
    }
  }
}

// === Init: load data, auth UI, and check query param for single-message link ===
function init() {
  loadMessages();
  updateAuthUI();

  const msgId = getQueryParam("msg");
  renderMessages(msgId || null);

  // if msgId present and found, optionally open it (handled in renderMessages)
}
init();

/* Developer notes:
 - Accounts stored in localStorage (email => {pass, name}). No server/email verification in this demo.
 - When a message is sent the app creates a shareable link ?msg=ID, tries to copy it to clipboard and shows it in linkBox.
 - Visiting the page with ?msg=ID will scroll/highlight that message.
 - For production: move auth and user data to a backend, validate inputs, and store media on server/cloud.
 */
