"use strict";

const WORDS = [
  { text: "MAMA", picture: "👩" },
  { text: "TATA", picture: "👨" },
  { text: "BUBU", picture: "🐞" },
  { text: "CASA", picture: "🏠" },
  { text: "MAR", picture: "🍎" },
  { text: "SOARE", picture: "☀️" },
  { text: "FLOARE", picture: "🌸" },
  { text: "MINGE", picture: "⚽" },
  { text: "PISICA", picture: "🐱" },
  { text: "CAINE", picture: "🐶" },
];

const SECRET_WORD = "BUBU";
const SURPRISE_DURATION_MS = 7000;
const NEXT_WORD_DELAY_MS = 2600;

const MASCOT_IMAGE_PATH = "img/bubu.png";

const TILE_COLORS = ["#ff6b6b", "#f08c00", "#2f9e44", "#1c7ed6", "#7048e8", "#d6336c"];
const PENTATONIC_NOTES = [523, 587, 659, 784, 880, 1047];

const HELPER_FREE = "Apasă pe taste și scrie!";
const HELPER_WORD = "Scrie cuvântul de pe ecran!";

const FALLBACK_BUBU_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <path d="M72 42 Q62 16 44 12 M128 42 Q138 16 156 12" stroke="#222" stroke-width="5" fill="none" stroke-linecap="round"/>
  <circle cx="44" cy="12" r="6" fill="#222"/><circle cx="156" cy="12" r="6" fill="#222"/>
  <ellipse cx="100" cy="128" rx="72" ry="66" fill="#e8222b"/>
  <path d="M100 80 V194" stroke="#222" stroke-width="4"/>
  <g fill="#222"><circle cx="62" cy="120" r="11"/><circle cx="138" cy="120" r="11"/>
  <circle cx="58" cy="160" r="9"/><circle cx="142" cy="160" r="9"/></g>
  <ellipse cx="100" cy="64" rx="50" ry="40" fill="#222"/>
  <circle cx="84" cy="58" r="13" fill="#fff"/><circle cx="116" cy="58" r="13" fill="#fff"/>
  <circle cx="86" cy="60" r="6" fill="#222"/><circle cx="114" cy="60" r="6" fill="#222"/>
  <circle cx="68" cy="78" r="6" fill="#ff8fa3"/><circle cx="132" cy="78" r="6" fill="#ff8fa3"/>
  <path d="M86 78 Q100 94 114 78" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/>
</svg>`;

function loadMascot(imageElement) {
  imageElement.onerror = () => {
    imageElement.onerror = null;
    imageElement.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(FALLBACK_BUBU_SVG);
  };
  imageElement.src = MASCOT_IMAGE_PATH;
}

const board = document.getElementById("board");
const helperText = document.getElementById("helperText");
const wordPicture = document.getElementById("wordPicture");
const surprise = document.getElementById("surprise");
const soundButton = document.getElementById("soundButton");
const freeModeButton = document.getElementById("freeModeButton");
const wordModeButton = document.getElementById("wordModeButton");

let mode = "free";
let typedText = "";
let wordIndex = 0;
let soundEnabled = true;
let inputLocked = false;
let surpriseTimer = null;

let audioContext = null;

function playTone(frequency, duration = 0.15, type = "sine", delay = 0) {
  if (!soundEnabled) return;
  audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
  const start = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.18, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

function playKeySound() {
  const note = PENTATONIC_NOTES[Math.floor(Math.random() * PENTATONIC_NOTES.length)];
  playTone(note, 0.18, "triangle");
}

function playWrongSound() {
  playTone(180, 0.25, "sawtooth");
}

function playCelebrationSound() {
  [523, 659, 784, 1047, 784, 1047, 1319].forEach((note, i) => playTone(note, 0.22, "triangle", i * 0.11));
}

function createTile(character, index, extraClass = "") {
  const tile = document.createElement("div");
  tile.className = "tile " + extraClass;
  tile.style.setProperty("--tile-color", TILE_COLORS[index % TILE_COLORS.length]);

  if (character === "\n") {
    tile.classList.add("line-break");
  } else if (character === " ") {
    tile.classList.add("space");
  } else {
    tile.textContent = character;
  }
  return tile;
}

function renderBoard() {
  board.replaceChildren();
  board.classList.toggle("writing", mode === "free");

  if (mode === "free") {
    [...typedText].forEach((character, index) => {
      const isNewest = index === typedText.length - 1;
      board.append(createTile(character, index, isNewest ? "new" : ""));
    });
    board.scrollTop = board.scrollHeight; // always follow the newest letter
    return;
  }

  const target = WORDS[wordIndex].text;
  [...target].forEach((character, index) => {
    const isTyped = index < typedText.length;
    const isNext = index === typedText.length;
    const classes = isTyped ? (index === typedText.length - 1 ? "new" : "") : "empty" + (isNext ? " next" : "");
    board.append(createTile(character, index, classes));
  });
}

function setMode(newMode) {
  mode = newMode;
  typedText = "";
  inputLocked = false;
  freeModeButton.classList.toggle("active", mode === "free");
  wordModeButton.classList.toggle("active", mode === "word");
  wordPicture.classList.toggle("hidden", mode !== "word");
  helperText.textContent = mode === "free" ? HELPER_FREE : HELPER_WORD;
  showWord();
}

function showWord() {
  if (mode === "word") wordPicture.textContent = WORDS[wordIndex].picture;
  renderBoard();
}

function goToNextWord() {
  wordIndex = (wordIndex + 1) % WORDS.length;
  typedText = "";
  inputLocked = false;
  showWord();
}

function handleKey(key) {
  if (inputLocked) return;

  if (key === "Backspace") {
    typedText = typedText.slice(0, -1);
    renderBoard();
    return;
  }

  if (key === "Enter" && mode === "free") {
    if (typedText.length > 0 && !typedText.endsWith("\n")) {
      typedText += "\n";
      renderBoard();
    }
    return;
  }

  if (key === " " && mode === "free") {
    if (typedText.length > 0 && !typedText.endsWith(" ") && !typedText.endsWith("\n")) {
      typedText += " ";
      renderBoard();
    }
    return;
  }

  // One printable character: letter, digit, punctuation mark or symbol
  if (!/^[\p{L}\p{N}\p{P}\p{S}]$/u.test(key)) return;

  const letter = key.toUpperCase();

  if (mode === "free") {
    typedText += letter;
    playKeySound();
    renderBoard();
    if (typedText.endsWith(SECRET_WORD)) showSurprise();
    return;
  }

  const target = WORDS[wordIndex].text;
  if (letter !== target[typedText.length]) {
    playWrongSound();
    board.classList.remove("shake");
    void board.offsetWidth; // restart the animation
    board.classList.add("shake");
    return;
  }

  typedText += letter;
  playKeySound();
  renderBoard();

  if (typedText === target) finishWord(target);
}

function finishWord(target) {
  inputLocked = true;
  if (target === SECRET_WORD) {
    showSurprise(() => goToNextWord());
    return;
  }
  playCelebrationSound();
  launchConfetti(110);
  setTimeout(goToNextWord, NEXT_WORD_DELAY_MS);
}

function showSurprise(onClose) {
  inputLocked = true;
  surprise.classList.remove("hidden");
  playCelebrationSound();
  launchConfetti(160);
  setTimeout(() => launchConfetti(120), 900);
  setTimeout(() => launchConfetti(120), 1800);

  const close = () => {
    clearTimeout(surpriseTimer);
    surprise.classList.add("hidden");
    surprise.onclick = null;
    inputLocked = false;
    if (onClose) onClose();
  };

  surprise.onclick = close;
  surpriseTimer = setTimeout(close, SURPRISE_DURATION_MS);
}

const canvas = document.getElementById("confettiCanvas");
const canvasContext = canvas.getContext("2d");
const CONFETTI_COLORS = ["#ff6b6b", "#ffd43b", "#69db7c", "#4dabf7", "#b197fc", "#f783ac"];
const CONFETTI_EMOJIS = ["🐞", "⭐", "🌸", "🎈", "💖"];
let particles = [];
let animationRunning = false;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function launchConfetti(count) {
  for (let i = 0; i < count; i++) {
    const isEmoji = Math.random() < 0.18;
    particles.push({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.4,
      speedX: (Math.random() - 0.5) * 4,
      speedY: 2 + Math.random() * 4,
      size: isEmoji ? 26 + Math.random() * 16 : 8 + Math.random() * 8,
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.25,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      emoji: isEmoji ? CONFETTI_EMOJIS[Math.floor(Math.random() * CONFETTI_EMOJIS.length)] : null,
    });
  }
  if (!animationRunning) {
    animationRunning = true;
    requestAnimationFrame(drawConfetti);
  }
}

function drawConfetti() {
  canvasContext.clearRect(0, 0, canvas.width, canvas.height);
  particles = particles.filter((particle) => particle.y < canvas.height + 40);

  particles.forEach((particle) => {
    particle.x += particle.speedX;
    particle.y += particle.speedY;
    particle.rotation += particle.spin;
    canvasContext.save();
    canvasContext.translate(particle.x, particle.y);
    canvasContext.rotate(particle.rotation);
    if (particle.emoji) {
      canvasContext.font = particle.size + "px serif";
      canvasContext.textAlign = "center";
      canvasContext.fillText(particle.emoji, 0, 0);
    } else {
      canvasContext.fillStyle = particle.color;
      canvasContext.fillRect(-particle.size / 2, -particle.size / 4, particle.size, particle.size / 2);
    }
    canvasContext.restore();
  });

  if (particles.length > 0) {
    requestAnimationFrame(drawConfetti);
  } else {
    animationRunning = false;
    canvasContext.clearRect(0, 0, canvas.width, canvas.height);
  }
}

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key === " " || event.key === "Backspace" || event.key === "Enter") event.preventDefault();
  if (event.repeat && event.key !== "Backspace") return;
  handleKey(event.key);
});

soundButton.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundButton.textContent = soundEnabled ? "🔊" : "🔇";
});
freeModeButton.addEventListener("click", () => setMode("free"));
wordModeButton.addEventListener("click", () => setMode("word"));
window.addEventListener("resize", resizeCanvas);

loadMascot(document.getElementById("mascotSmall"));
loadMascot(document.getElementById("bubuImage"));
resizeCanvas();
setMode("free");
