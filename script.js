const inputText = document.getElementById("inputText");
const speed = document.getElementById("speed");
const speedValue = document.getElementById("speedValue");
const fontSize = document.getElementById("fontSize");

const applyBtn = document.getElementById("apply");
const playBtn = document.getElementById("play");
const pauseBtn = document.getElementById("pause");
const resetBtn = document.getElementById("reset");

const viewport = document.getElementById("viewport");
const tickerText = document.getElementById("tickerText");

const fullscreenBtn = document.getElementById("fullscreen");
const ticker = document.getElementById("ticker");

const state = {
    playing: false,
    speedPxPerSec: Number(speed.value),
    x: 0,
    lastTs: 0,
    viewportW: 0,
    textW: 0,
};

function setFontSize(px) {
    const size = Math.max(14, Math.min(700, Number(px) || 90));
    tickerText.style.fontSize = `${size}px`;
}

function setText(text) {
    const t = (text || "").trim();
    tickerText.textContent = t.length
        ? t
        : "Введите текст и нажмите «Применить текст»";
}

function measure() {
    // важно: сначала сбросить трансформацию, чтобы размеры были корректнее
    tickerText.style.transform = "translateX(0) translateY(-50%)";
    state.viewportW = viewport.clientWidth;
    state.textW = tickerText.scrollWidth; // ширина содержимого (одной строки)
}

function setX(x) {
    state.x = x;
    tickerText.style.transform = `translateX(${state.x}px) translateY(-50%)`;
}

function resetPosition() {
    measure();
    // старт справа (за пределами видимой области)
    setX(state.viewportW);
}

function tick(ts) {
    if (!state.playing) return;

    const dt = (ts - state.lastTs) / 1000;
    state.lastTs = ts;

    // движение справа -> налево
    const dx = state.speedPxPerSec * dt;
    let nextX = state.x - dx;

    // если текст полностью ушёл влево — вернуть вправо
    if (nextX < -state.textW) {
        nextX = state.viewportW;
    }

    setX(nextX);
    requestAnimationFrame(tick);
}

// --- UI handlers ---
speed.addEventListener("input", () => {
    state.speedPxPerSec = Number(speed.value);
    speedValue.textContent = String(speed.value);
});

fontSize.addEventListener("input", () => {
    setFontSize(fontSize.value);
    // чтобы не “прыгало”, просто пересчитаем размеры и аккуратно поправим позицию
    const oldTextW = state.textW;
    measure();
    // если ширина изменилась, оставим относительное положение примерно тем же
    if (oldTextW > 0) {
        // ничего не делаем сверх — визуально обычно ок
    }
});

applyBtn.addEventListener("click", () => {
    setText(inputText.value);
    resetPosition();
});

playBtn.addEventListener("click", () => {
    if (!state.playing) {
        // перед стартом обновим текст/размеры
        if (!tickerText.textContent) setText(inputText.value);
        measure();

        // если позиция не выставлена — стартуем справа
        if (Number.isNaN(state.x) || state.x === 0) {
            setX(state.viewportW);
        }

        state.playing = true;
        state.lastTs = performance.now();
        requestAnimationFrame(tick);
    }
});

pauseBtn.addEventListener("click", () => {
    state.playing = false;
});

resetBtn.addEventListener("click", () => {
    state.playing = false;
    resetPosition();
});

// ресайз окна — пересчитать и вернуть корректный старт
window.addEventListener("resize", () => {
    const wasPlaying = state.playing;
    state.playing = false;
    resetPosition();
    if (wasPlaying) {
        state.playing = true;
        state.lastTs = performance.now();
        requestAnimationFrame(tick);
    }
});

// --- Fullscreen (native + fallback) ---
let pseudoFs = false;

function hasNativeFs() {
    return !!(
        ticker &&
        (ticker.requestFullscreen ||
            ticker.webkitRequestFullscreen ||
            ticker.msRequestFullscreen)
    );
}

function isNativeFsNow() {
    return !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement
    );
}

async function nativeEnter() {
    if (ticker.requestFullscreen) return ticker.requestFullscreen();
    if (ticker.webkitRequestFullscreen) return ticker.webkitRequestFullscreen(); // Safari
    if (ticker.msRequestFullscreen) return ticker.msRequestFullscreen(); // old Edge
    throw new Error("Fullscreen API not supported");
}

async function nativeExit() {
    if (document.exitFullscreen) return document.exitFullscreen();
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
    if (document.msExitFullscreen) return document.msExitFullscreen();
}

function syncAfterFsChange(isFs) {
    document.body.classList.toggle("fs", isFs);
    fullscreenBtn.textContent = isFs ? "⤢ Exit fullscreen" : "⛶ Fullscreen";

    resetPosition();
    if (state.playing) {
        state.lastTs = performance.now();
        requestAnimationFrame(tick);
    }
}

function pseudoEnter() {
    pseudoFs = true;
    document.documentElement.style.overflow = "hidden";
    syncAfterFsChange(true);
}

function pseudoExit() {
    pseudoFs = false;
    document.documentElement.style.overflow = "";
    syncAfterFsChange(false);
}

async function toggleFullscreen() {
    // если включен псевдо-режим — выключаем
    if (pseudoFs) return pseudoExit();

    // если мы уже в нативном fullscreen — выходим
    if (isNativeFsNow()) {
        try {
            await nativeExit();
        } catch (e) {
            console.warn(e);
        }
        // класс снимется через fullscreenchange
        return;
    }

    // пробуем нативный fullscreen, если доступен
    if (hasNativeFs()) {
        try {
            await nativeEnter();
            // на всякий случай сразу обновим UI (а потом подтвердится fullscreenchange)
            syncAfterFsChange(true);
            return;
        } catch (e) {
            console.warn("Native fullscreen failed, fallback to pseudo:", e);
        }
    }

    // fallback
    pseudoEnter();
}

if (fullscreenBtn && ticker) {
    fullscreenBtn.addEventListener("click", toggleFullscreen);
    ticker.addEventListener("dblclick", toggleFullscreen);
}

document.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k === "f") toggleFullscreen();
    if (e.key === "Escape" && pseudoFs) pseudoExit();
});

// нативные события (выход по Esc и т.п.)
document.addEventListener("fullscreenchange", () => {
    if (!pseudoFs) syncAfterFsChange(!!document.fullscreenElement);
});
document.addEventListener("webkitfullscreenchange", () => {
    if (!pseudoFs) syncAfterFsChange(!!document.webkitFullscreenElement);
});

fullscreenBtn.addEventListener("click", toggleFullscreen);

// двойной клик по самой строке — тоже fullscreen
ticker.addEventListener("dblclick", toggleFullscreen);

// клавиша F — fullscreen
document.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "f") toggleFullscreen();
});

// когда вошли/вышли из fullscreen — меняем UI и пересчитываем размеры
document.addEventListener("fullscreenchange", () => {
    const isFs = !!document.fullscreenElement;
    document.body.classList.toggle("fs", isFs);
    fullscreenBtn.textContent = isFs ? "⤢ Exit fullscreen" : "⛶ Fullscreen";

    // важно: после смены режима пересчитать ширину и стартовую позицию
    resetPosition();

    // если было на паузе — оставляем как есть, если играло — продолжит
    if (state.playing) {
        state.lastTs = performance.now();
        requestAnimationFrame(tick);
    }
});

// --- init ---
setFontSize(fontSize.value);
setText(inputText.value);
resetPosition();
speedValue.textContent = String(speed.value);
