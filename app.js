// Christmas card app (client-side). Messages stored in localStorage for demo.
// Main features: create message, preview external audio link, record audio, upload photo, reply to messages.

// === Helpers & state ===
const LS_KEY = "xmas_messages_v1";

const $ = (id) => document.getElementById(id);

// DOM refs
const fromName = $("fromName");
const messageText = $("messageText");
const audioUrl = $("audioUrl");
const btnLoadAudio = $("btnLoadAudio");
const previewAudio = $("previewAudio");
const btnRecord = $("btnRecord");
const recStatus = $("recStatus");
const recordedPlay = $("recordedPlay");
const photoInput = $("photoInput");
const photoPreview = $("photoPreview");
const btnSend = $("btnSend");
const btnClear = $("btnClear");
const messagesList = $("messagesList");
const emptyHint = $("emptyHint");

// new DOM refs for YouTube
const youtubeUrl = $("youtubeUrl");
const btnLoadYouTube = $("btnLoadYouTube");
const youtubePreview = $("youtubePreview");

let messages = []; // array of message objects
let mediaRecorder = null;
let recordedBlobDataUrl = null; // base64 dataURL of recorded audio
let recordingChunks = [];

// === LocalStorage persistence ===
function loadMessages() {
  const raw = localStorage.getItem(LS_KEY);
  messages = raw ? JSON.parse(raw) : [];
}
function saveMessages() {
  localStorage.setItem(LS_KEY, JSON.stringify(messages));
}

// === Utilities ===
function timeNow() {
  return new Date().toLocaleString();
}

// convert File to dataURL (for images / recorded blobs)
function fileToDataURL(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

// Helper: parse YouTube video ID from common URL formats
function parseYouTubeId(url) {
  if (!url) return null;
  // common patterns
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /youtube\.com\/v\/([A-Za-z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m && m[1]) return m[1];
  }
  // attempt to read v= param
  try {
    const u = new URL(url);
    const v = u.searchParams.get("v");
    if (v && v.length === 11) return v;
  } catch (e) {}
  return null;
}

// === Audio URL preview handler ===
btnLoadAudio.addEventListener("click", () => {
  const url = audioUrl.value.trim();
  if (!url) {
    alert("Masukkan link audio (direct mp3/ogg).");
    return;
  }
  // set preview src; note: remote servers might block cross-origin streaming
  previewAudio.src = url;
  previewAudio.classList.remove("hidden");
  previewAudio.play().catch(() => {}); // ignore autoplay errors
});

// === Photo input preview ===
photoInput.addEventListener("change", async (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  // preview image
  const data = await fileToDataURL(f);
  photoPreview.src = data;
  photoPreview.classList.remove("hidden");
});

// === Recording audio via MediaRecorder ===
btnRecord.addEventListener("click", async () => {
  // Toggle record start/stop
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    btnRecord.textContent = "Mulai Rekam";
    recStatus.textContent = "Processing...";
    return;
  }

  // Request microphone
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
      // convert to dataURL to store in localStorage
      recordedBlobDataUrl = await fileToDataURL(blob);
      recordedPlay.src = recordedBlobDataUrl;
      recordedPlay.classList.remove("hidden");
      recStatus.textContent = "Selesai merekam";
      // stop tracks to free mic
      stream.getTracks().forEach((t) => t.stop());
    };
    mediaRecorder.start();
    btnRecord.textContent = "Berhenti Rekam";
    recStatus.textContent = "Merekam...";
  } catch (err) {
    console.error(err);
    alert("Gagal mengakses mikrofon. Periksa izin browser.");
  }
});

// === Send message ===
btnSend.addEventListener("click", async () => {
  const name = fromName.value.trim() || "Anonim";
  const text = messageText.value.trim();
  if (!text) {
    alert("Tulis pesan terlebih dahulu.");
    return;
  }

  // Prepare attachments
  let photoData = null;
  if (photoInput.files && photoInput.files[0]) {
    photoData = await fileToDataURL(photoInput.files[0]);
  }

  // External audio (direct) preview
  const extAudio =
    previewAudio.src && !previewAudio.classList.contains("hidden")
      ? previewAudio.src
      : null;
  // Recorded audio
  const recorded = recordedBlobDataUrl || null;

  // YouTube id (if user loaded)
  const ytId =
    youtubePreview && youtubePreview.querySelector("iframe")
      ? parseYouTubeId(youtubeUrl.value.trim())
      : null;

  const msg = {
    id: Date.now().toString(),
    from: name,
    text,
    time: timeNow(),
    photo: photoData,
    extAudio, // direct audio URL
    recordedAudio: recorded, // recorded dataURL
    youtubeId: ytId, // YouTube video id or null
    replies: [],
  };

  messages.unshift(msg); // latest first
  saveMessages();
  renderMessages();
  // clear composer UI
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
  recordedBlobDataUrl = null;
  recordedPlay.src = "";
  recordedPlay.classList.add("hidden");
  photoInput.value = "";
  photoPreview.classList.add("hidden");
  recStatus.textContent = "Belum merekam";
});

// === Render messages ===
const tpl = document.getElementById("messageTemplate");

function renderMessages() {
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

    // photo
    const thumb = el.querySelector(".thumb");
    if (m.photo) {
      thumb.src = m.photo;
      thumb.classList.remove("hidden");
    }

    // audio
    const audioEl = el.querySelector(".audio");
    if (m.recordedAudio) {
      audioEl.src = m.recordedAudio;
      audioEl.classList.remove("hidden");
    } else if (m.extAudio) {
      audioEl.src = m.extAudio;
      audioEl.classList.remove("hidden");
    }

    // youtube embed
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

    // render replies
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

    // reply button handlers
    const replyBtn = el.querySelector(".btnReply");
    const replyBox = el.querySelector(".reply-box");
    const btnSendReply = el.querySelector(".btnSendReply");
    const btnCancelReply = el.querySelector(".btnCancelReply");
    const replyText = el.querySelector(".replyText");

    replyBtn.addEventListener("click", () => {
      replyBox.classList.toggle("hidden");
    });
    btnCancelReply.addEventListener("click", () => {
      replyBox.classList.add("hidden");
    });
    btnSendReply.addEventListener("click", () => {
      const v = replyText.value.trim();
      if (!v) return alert("Tulis balasan terlebih dahulu.");
      const replyObj = { from: "Anda", text: v, time: timeNow() };
      // find message in messages array and push reply
      const idx = messages.findIndex((mm) => mm.id === m.id);
      if (idx !== -1) {
        messages[idx].replies.push(replyObj);
        saveMessages();
        renderMessages();
      }
    });

    messagesList.appendChild(el);
  }
}

// === Init ===
function init() {
  loadMessages();
  renderMessages();
}
init();

// === Notes / Limitations (commented for developer) ===
// - This demo stores everything in localStorage (not secure, limited storage).
// - External audio requires a direct audio file URL (mp3/ogg). Streaming from YouTube will not work directly.
// - Recorded audio stored as dataURL: can grow large; for production use a server or IndexedDB.
// - Photo stored as dataURL for preview and persistence; in production upload to server or cloud storage.
// - This is a client-side demo for local/offline use and quick sharing on the same device.
