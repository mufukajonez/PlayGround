import { createWorld } from './world.js';
import { AudioEngine } from './audio.js';
import {
  SIBLINGS,
  ROUNDS,
  TRUTHS,
  DARES,
  DAD_SUCCESS,
  DAD_PERFECT,
  DAD_FAIL,
  SLAP_QUIPS,
  DARE_TAUNTS,
  byId,
  shuffle,
  randOf
} from './data.js';

const $ = (sel) => document.querySelector(sel);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const world = createWorld($('#world'));
const audio = new AudioEngine();

const state = {
  playerId: null,
  round: 1,
  current: null,
  order: [],
  scores: {},
  slaps: {},
  running: false,
  promptBags: { truth: [], dare: [] }
};

let selectedId = null;
let choiceResolver = null;
let bannerTimer = 0;
let toastTimer = 0;
let turnCardTimer = 0;
let lastTapAt = 0;

// ------------------------------------------------------------------ helpers
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }
function activeScreen(el) { return !el.classList.contains('hidden'); }

function restartAnimation(el, className = '') {
  if (!el) return;
  if (className) el.classList.remove(className);
  void el.offsetWidth;
  if (className) el.classList.add(className);
}

function setSoundIcon() {
  const btn = $('#soundBtn');
  if (btn) btn.textContent = audio.enabled ? '🔊' : '🔇';
}

function showToast(html, ms = 2400) {
  const el = $('#toast');
  clearTimeout(toastTimer);
  el.innerHTML = html;
  el.classList.remove('hidden');
  restartAnimation(el);
  toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
}

function showBanner(kicker, name, ms = 1500) {
  const el = $('#turnBanner');
  $('#turnBannerKicker').textContent = kicker;
  $('#turnBannerName').textContent = name;
  clearTimeout(bannerTimer);
  el.classList.remove('hidden');
  restartAnimation(el);
  bannerTimer = setTimeout(() => el.classList.add('hidden'), ms);
}

function showTurnCard(kicker, title, sub, ms = 1500) {
  const el = $('#turnCard');
  $('#turnCardKicker').textContent = kicker;
  $('#turnCardTitle').textContent = title;
  $('#turnCardSub').textContent = sub;
  clearTimeout(turnCardTimer);
  el.classList.remove('hidden');
  restartAnimation(el);
  turnCardTimer = setTimeout(() => el.classList.add('hidden'), ms);
}

function hideTurnCard() {
  clearTimeout(turnCardTimer);
  $('#turnCard').classList.add('hidden');
}

function showScorePop(delta) {
  const el = document.createElement('div');
  el.className = 'score-pop' + (delta < 0 ? ' bad' : '');
  el.textContent = `${delta > 0 ? '+' : ''}${delta}`;
  el.style.left = `${44 + Math.random() * 12}%`;
  $('#scorePops').appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

function spawnConfetti(count = 46) {
  const colors = ['#ffd23f', '#ff2f87', '#14b8a6', '#9b6bff', '#ff7a2a', '#fff6e5'];
  const root = $('#game-root');
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('i');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.width = `${6 + Math.random() * 8}px`;
    piece.style.height = `${10 + Math.random() * 12}px`;
    piece.style.animationDuration = `${2.4 + Math.random() * 2.2}s`;
    piece.style.animationDelay = `${Math.random() * 0.7}s`;
    piece.style.setProperty('--drift', `${-90 + Math.random() * 180}px`);
    piece.style.setProperty('--spin', `${360 + Math.random() * 900}deg`);
    root.appendChild(piece);
    setTimeout(() => piece.remove(), 5600);
  }
}

function clearConfetti() {
  document.querySelectorAll('.confetti-piece').forEach((el) => el.remove());
}

function playSlapFX() {
  const fx = $('#slapFX');
  $('#slapSub').textContent = randOf(SLAP_QUIPS).toUpperCase();
  fx.classList.remove('hidden');
  fx.querySelectorAll('.slap-word, .slap-hand, .slap-sub').forEach((el) => {
    const anim = el.style.animation;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = anim || '';
  });
  const flash = $('#flash');
  flash.classList.remove('on');
  void flash.offsetWidth;
  flash.classList.add('on');
  audio.slap();
  setTimeout(() => fx.classList.add('hidden'), 1450);
}

// ------------------------------------------------------------------ scoreboard
function buildScoreboard() {
  $('#scoreboard').innerHTML = SIBLINGS.map(
    (s) => `
      <div class="score-chip" id="chip-${s.id}" style="--c:${s.color}">
        <div class="nm"><i class="dot"></i><span>${s.name}</span></div>
        <div class="row">
          <span class="pts" id="pts-${s.id}">${state.scores[s.id]}</span>
          <span class="slaps" id="slaps-${s.id}">0 SMACKS</span>
        </div>
        <div class="bar"><i id="bar-${s.id}"></i></div>
      </div>`
  ).join('');
}

function updateHUD(bumpId = null) {
  SIBLINGS.forEach((s) => {
    const chip = $(`#chip-${s.id}`);
    if (!chip) return;
    chip.classList.toggle('active', state.current === s.id);
    $(`#pts-${s.id}`).textContent = state.scores[s.id];
    const n = state.slaps[s.id] || 0;
    $(`#slaps-${s.id}`).textContent = `${n} SMACK${n === 1 ? '' : 'S'}`;
    $(`#bar-${s.id}`).style.width = `${Math.max(2, state.scores[s.id])}%`;
    if (bumpId === s.id) {
      chip.classList.remove('bump');
      void chip.offsetWidth;
      chip.classList.add('bump');
      setTimeout(() => chip.classList.remove('bump'), 500);
    }
  });
}

// ------------------------------------------------------------------ setup screens
function buildCharacterCards() {
  const grid = $('#characterGrid');
  grid.innerHTML = SIBLINGS.map(
    (s) => `
      <button class="char-card" type="button" data-id="${s.id}" style="--c:${s.color}; --c2:${s.color2}" aria-pressed="false">
        <span class="avatar">${s.name[0]}</span>
        <span class="char-name">${s.name}</span>
        <span class="char-tag">${s.tag}</span>
        <span class="char-blurb">${s.blurb}</span>
        <span class="char-perk"><b>${s.perk}</b><span>${s.perkDesc}</span></span>
      </button>`
  ).join('');
  grid.querySelectorAll('.char-card').forEach((card) => {
    card.addEventListener('click', () => selectSibling(card.dataset.id));
  });
}

function selectSibling(id) {
  selectedId = id;
  document.querySelectorAll('.char-card').forEach((card) => {
    const on = card.dataset.id === id;
    card.classList.toggle('selected', on);
    card.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  const btn = $('#startGameBtn');
  btn.disabled = false;
  btn.textContent = `PLAY AS ${byId(id).name.toUpperCase()} →`;
  audio.click();
}

function resetSelection() {
  selectedId = null;
  document.querySelectorAll('.char-card').forEach((card) => {
    card.classList.remove('selected');
    card.setAttribute('aria-pressed', 'false');
  });
  const btn = $('#startGameBtn');
  btn.disabled = true;
  btn.textContent = 'CHOOSE A SIBLING';
}

function openHelp() {
  audio.click();
  show($('#helpScreen'));
}

function closeHelp() {
  audio.click();
  hide($('#helpScreen'));
}

// ------------------------------------------------------------------ prompts
function nextPrompt(kind) {
  const bag = state.promptBags[kind];
  if (!bag.length) bag.push(...shuffle(kind === 'truth' ? TRUTHS : DARES));
  return bag.pop();
}

// ------------------------------------------------------------------ choice
function askChoice(round) {
  return new Promise((resolve) => {
    const sib = byId(state.playerId);
    $('#choiceRound').textContent = `ROUND ${round} · ${ROUNDS[round - 1].name}`;
    $('#choiceName').textContent = sib.name;
    choiceResolver = (choice) => {
      choiceResolver = null;
      hide($('#choiceScreen'));
      resolve(choice);
    };
    show($('#choiceScreen'));
    restartAnimation($('#choiceScreen').querySelector('.panel'));
    audio.card();
  });
}

function makeChoice(choice) {
  if (!choiceResolver) return;
  audio.click();
  choiceResolver(choice);
}

// ------------------------------------------------------------------ challenge shell
async function runCountdown() {
  const el = $('#challengeCountdown');
  el.classList.remove('hidden');
  for (const label of ['3', '2', '1', 'GO!']) {
    el.textContent = label;
    audio.countdown(label === 'GO!');
    restartAnimation(el);
    await wait(label === 'GO!' ? 300 : 380);
  }
  el.classList.add('hidden');
}

function showVerdict(label, bad = false) {
  const el = $('#challengeVerdict');
  el.textContent = label;
  el.classList.toggle('bad', bad);
  el.classList.remove('hidden');
  restartAnimation(el);
}

async function runChallenge(kind, round) {
  const sib = byId(state.playerId);
  const prompt = nextPrompt(kind);
  $('#challengeType').textContent = kind === 'truth' ? `${sib.name.toUpperCase()} · LIE DETECTOR` : `${sib.name.toUpperCase()} · DARE-O-METER`;
  $('#challengeRound').textContent = `ROUND ${round}`;
  $('#challengePrompt').textContent = prompt;
  $('#truthGame').classList.toggle('hidden', kind !== 'truth');
  $('#dareGame').classList.toggle('hidden', kind !== 'dare');
  $('#challengeVerdict').classList.add('hidden');
  show($('#challengeScreen'));
  restartAnimation($('#challengeScreen').querySelector('.panel'));
  await wait(420);
  await runCountdown();

  let outcome;
  if (kind === 'truth') outcome = await playTruth(round, sib);
  else outcome = await playDare(round, sib);

  hide($('#challengeScreen'));
  await wait(160);
  return outcome;
}

// ------------------------------------------------------------------ truth minigame
function playTruth(round, sib) {
  return new Promise((resolve) => {
    const targetW = Math.min(0.34, Math.max(0.13, 0.24 - (round - 1) * 0.018 + (sib.easyMode ? 0.07 : 0)));
    const center = targetW / 2 + 0.07 + Math.random() * (1 - targetW - 0.14);
    const targetEl = $('#truthTarget');
    const needle = $('#truthNeedle');
    const needleState = $('#needleState');
    const patienceFill = $('#patienceFill');
    const stopBtn = $('#truthStop');
    targetEl.style.left = `${(center - targetW / 2) * 100}%`;
    targetEl.style.width = `${targetW * 100}%`;
    targetEl.classList.remove('hit');
    needleState.textContent = 'STEADY…';
    patienceFill.style.width = '100%';
    stopBtn.disabled = false;

    const speed = 0.63 + round * 0.1;
    const patienceMax = 7;
    const start = performance.now();
    let done = false;
    let raf = 0;

    const needlePos = (now) => 0.5 + 0.5 * Math.sin(((now - start) / 1000) * Math.PI * 2 * speed - Math.PI / 2);
    const paint = (p) => {
      needle.style.left = `${p * 100}%`;
    };
    paint(0);

    function onKey(e) {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        stop();
      }
    }

    function finish(outcome, label) {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      stopBtn.disabled = true;
      stopBtn.removeEventListener('pointerdown', stop);
      document.removeEventListener('keydown', onKey);
      needleState.textContent = label;
      if (outcome !== 'fail') targetEl.classList.add('hit');
      showVerdict(label, outcome === 'fail');
      if (outcome === 'fail') audio.fail();
      setTimeout(() => resolve(outcome), 900);
    }

    function stop() {
      if (done) return;
      const p = needlePos(performance.now());
      const dist = Math.abs(p - center);
      if (dist <= targetW * 0.09) finish('perfect', 'PERFECT!');
      else if (dist <= targetW * 0.5) finish('pass', 'HONEST!');
      else finish('fail', 'CAUGHT LYING!');
    }

    function frame(now) {
      if (done) return;
      const t = (now - start) / 1000;
      paint(needlePos(now));
      const left = Math.max(0, 1 - t / patienceMax);
      patienceFill.style.width = `${left * 100}%`;
      if (t >= patienceMax) {
        finish('fail', 'DAD LOST PATIENCE');
        return;
      }
      raf = requestAnimationFrame(frame);
    }

    stopBtn.addEventListener('pointerdown', stop, { passive: true });
    document.addEventListener('keydown', onKey);
    raf = requestAnimationFrame(frame);
  });
}

// ------------------------------------------------------------------ dare minigame
function playDare(round, sib) {
  return new Promise((resolve) => {
    const need = 16 + (round - 1) * 2 - (sib.easyMode ? 3 : 0);
    const perfect = need + 9;
    const duration = 5.2;
    const mash = $('#mashBtn');
    const fill = $('#dareFill');
    const count = $('#tapCount');
    const timerFill = $('#dareTimerFill');
    const hint = $('#dareHint');
    let taps = 0;
    let done = false;
    let started = false;
    let t0 = 0;
    let raf = 0;
    let lastGesture = 0;

    hint.textContent = 'MASH! The harder you tap, the more nerve you show.';
    fill.style.width = '0%';
    timerFill.style.width = '100%';
    count.textContent = `0 / ${need} TAPS`;
    mash.classList.remove('go');
    mash.classList.add('go');

    const paint = () => {
      fill.style.width = `${Math.min(100, (taps / perfect) * 100)}%`;
      count.textContent = `${taps} / ${need} TAPS`;
    };

    function onKey(e) {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        tap(null);
      }
    }

    function finish(outcome, label) {
      if (done) return;
      done = true;
      started = false;
      cancelAnimationFrame(raf);
      mash.removeEventListener('pointerdown', tap);
      document.removeEventListener('keydown', onKey);
      mash.classList.remove('go');
      if (outcome === 'fail') {
        timerFill.style.width = '0%';
        audio.fail();
      }
      showVerdict(label, outcome === 'fail');
      setTimeout(() => resolve(outcome), 900);
    }

    function tap(e) {
      if (!started || done) return;
      if (e && e.cancelable) e.preventDefault();
      const now = performance.now();
      if (now - lastGesture < 36) return;
      lastGesture = now;
      taps++;
      audio.tick();
      if (taps % 5 === 0 && navigator.vibrate) {
        try { navigator.vibrate(9); } catch { /* no worries */ }
      }
      if (taps === need) {
        hint.textContent = 'THAT’S THE PASS LINE. KEEP MASHING FOR PERFECT!';
      }
      if (taps >= perfect) {
        finish('perfect', 'LEGENDARY!');
        return;
      }
      paint();
    }

    function frame(now) {
      if (done) return;
      const elapsed = (now - t0) / 1000;
      const left = Math.max(0, 1 - elapsed / duration);
      timerFill.style.width = `${left * 100}%`;
      if (elapsed >= duration) {
        if (taps >= need) finish('pass', 'SURVIVED!');
        else finish('fail', 'NOT EVEN CLOSE!');
        return;
      }
      raf = requestAnimationFrame(frame);
    }

    mash.addEventListener('pointerdown', tap, { passive: false });
    document.addEventListener('keydown', onKey);
    started = true;
    t0 = performance.now();
    raf = requestAnimationFrame(frame);
  });
}

// ------------------------------------------------------------------ scoring
function applyOutcome(id, outcome, isPlayer) {
  const sib = byId(id);
  let delta;
  if (outcome === 'fail') {
    state.slaps[id] = (state.slaps[id] || 0) + 1;
    delta = -(isPlayer ? 7 : 6) + (sib.failShield || 0);
  } else if (outcome === 'perfect') {
    delta = (isPlayer ? 20 : 13) + (sib.perfectBonus || 0);
  } else {
    delta = isPlayer ? 13 : 8;
  }
  state.scores[id] = Math.max(0, Math.min(100, state.scores[id] + delta));
  updateHUD(id);
  return delta;
}

// ------------------------------------------------------------------ turns
async function playerTurn(id, round) {
  const sib = byId(id);
  await wait(180);
  showBanner('YOUR TURN', sib.name.toUpperCase(), 2200);
  await wait(260);
  hide($('#turnBanner'));
  const choice = await askChoice(round);
  const outcome = await runChallenge(choice, round);
  const delta = applyOutcome(id, outcome, true);

  if (outcome === 'fail') {
    const slapDone = world.slap(id);
    setTimeout(() => {
      playSlapFX();
      showScorePop(delta);
    }, 470);
    await slapDone;
    await wait(380);
  } else {
    world.celebrate(id, outcome === 'perfect');
    audio.success(outcome === 'perfect');
    showScorePop(delta);
    await wait(820);
  }

  await showResult(id, choice, outcome, delta);
}

async function showResult(id, choice, outcome, delta) {
  const sib = byId(id);
  const stamp = $('#resultStamp');
  stamp.className = 'stamp';
  let quote;
  let headline;
  if (outcome === 'fail') {
    stamp.classList.add('fail');
    stamp.textContent = 'SMACKED';
    headline = 'Dad has located the Slipper of Justice.';
    quote = randOf(DAD_FAIL);
  } else if (outcome === 'perfect') {
    stamp.classList.add('perfect');
    stamp.textContent = 'PERFECT';
    headline = 'Dad is putting this on the fridge.';
    quote = randOf(DAD_PERFECT);
  } else {
    stamp.textContent = 'APPROVED';
    headline = 'Dad gives you one (1) nod of respect.';
    quote = randOf(DAD_SUCCESS);
  }
  restartAnimation(stamp);
  $('#resultDelta').textContent = `${delta > 0 ? '+' : ''}${delta}`;
  $('#resultHeadline').textContent = headline;
  $('#resultQuote').textContent = `“${quote}”`;
  $('#resultMeta').textContent = `DAD-O-METER: ${state.scores[id]}`;
  $('#resultSlaps').textContent = `SMACKS: ${state.slaps[id]}`;
  $('#nextBtn').textContent = 'NEXT SIBLING';
  show($('#resultScreen'));
  restartAnimation($('#resultScreen').querySelector('.panel'));
  audio.card();
  await waitForButton($('#nextBtn'));
  hide($('#resultScreen'));
}

function waitForButton(btn) {
  return new Promise((resolve) => {
    const handler = () => {
      btn.removeEventListener('click', handler);
      audio.click();
      resolve();
    };
    btn.addEventListener('click', handler);
  });
}

async function aiTurn(id, round) {
  const sib = byId(id);
  await wait(180);
  showBanner('NOW PLAYING', sib.name.toUpperCase(), 1600);
  const prefTruth = sib.choice === 'truth' ? 0.66 : 0.4;
  const choice = Math.random() < prefTruth ? 'truth' : 'dare';
  const prompt = nextPrompt(choice);
  await wait(260);
  showTurnCard(`${sib.name.toUpperCase()} PICKS`, choice.toUpperCase(), `“${prompt}”`, 1500);
  audio.card();
  await wait(1450);
  hideTurnCard();
  await wait(240);

  let perfectChance = 0.15;
  let passChance = 0.45;
  if (sib.id === 'brad') perfectChance += 0.05;
  if (sib.id === 'stacy') passChance += 0.08;
  if (sib.id === 'tad') passChance += 0.03;
  const roll = Math.random();
  const outcome = roll < perfectChance ? 'perfect' : roll < perfectChance + passChance ? 'pass' : 'fail';

  if (outcome === 'fail') {
    const slapDone = world.slap(id);
    setTimeout(() => {
      playSlapFX();
    }, 470);
    await slapDone;
    const delta = applyOutcome(id, outcome, false);
    setTimeout(() => showScorePop(delta), 120);
    showToast(`<b>${sib.name}</b> failed. The Slipper of Justice has spoken. ${delta} approval.`, 2700);
    await wait(1350);
  } else {
    world.celebrate(id, outcome === 'perfect');
    audio.success(outcome === 'perfect');
    const delta = applyOutcome(id, outcome, false);
    showScorePop(delta);
    showToast(`<b>${sib.name}</b> ${outcome === 'perfect' ? 'nailed it' : 'survived'}! +${delta} approval.`, 2300);
    await wait(1200);
  }
  hide($('#turnBanner'));
  await wait(220);
}

// ------------------------------------------------------------------ round / game flow
function makeOrder(round) {
  const others = SIBLINGS.filter((s) => s.id !== state.playerId).map((s) => s.id);
  const shift = (round - 1) % others.length;
  const rotated = others.slice(shift).concat(others.slice(0, shift));
  return [state.playerId, ...rotated];
}

async function showRoundBanner(round) {
  const rd = ROUNDS[round - 1];
  $('#rbRound').textContent = `ROUND ${round}`;
  $('#rbName').textContent = rd.name;
  $('#rbLine').textContent = rd.line;
  const el = $('#roundBanner');
  show(el);
  restartAnimation(el);
  audio.roundStart();
  await wait(1580);
  hide(el);
  const roundLines = [
    'Dad has finished his coffee.',
    'The pie is still on the counter. Nobody has earned it.',
    'Dad just loosened his belt. That is not a good sign.',
    'One round left. Someone is leaving this room a favorite.'
  ];
  showToast(`<b>ROUND ${rd.num}:</b> ${roundLines[rd.num - 1]}`, 1800);
}

async function gameLoop() {
  for (let round = 1; round <= ROUNDS.length; round++) {
    if (!state.running) return;
    state.round = round;
    $('#roundLabel').textContent = `${round} / ${ROUNDS.length}`;
    await showRoundBanner(round);
    state.order = makeOrder(round);
    for (const id of state.order) {
      if (!state.running) return;
      state.current = id;
      updateHUD();
      world.setActive(id);
      const isPlayer = id === state.playerId;
      world.setFocus(id, isPlayer ? 850 : 600);
      await wait(isPlayer ? 700 : 520);
      if (isPlayer) await playerTurn(id, round);
      else await aiTurn(id, round);
      state.current = null;
      updateHUD();
      await wait(220);
    }
    if (round < ROUNDS.length) {
      const comments = [
        'End of round 1. Dad refills his coffee. The tension thickens.',
        'End of round 2. Someone just stepped on the dog. Nobody will confess.',
        'End of round 3. Dad is doing that thing with his eyebrow.'
      ];
      showToast(comments[round - 1], 2200);
      await wait(900);
    }
  }
  await endGame();
}

function startGame(id) {
  state.playerId = id;
  state.round = 1;
  state.current = null;
  state.order = [];
  state.running = true;
  state.promptBags = { truth: [], dare: [] };
  state.scores = {};
  state.slaps = {};
  SIBLINGS.forEach((s) => {
    state.scores[s.id] = Math.min(100, 30 + (s.startBonus || 0));
    state.slaps[s.id] = 0;
  });

  hide($('#titleScreen'));
  hide($('#selectScreen'));
  hide($('#choiceScreen'));
  hide($('#challengeScreen'));
  hide($('#resultScreen'));
  hide($('#endScreen'));
  hide($('#turnCard'));
  hide($('#turnBanner'));
  hide($('#toast'));
  hide($('#slapFX'));
  clearConfetti();
  show($('#hud'));
  $('#roundLabel').textContent = `1 / ${ROUNDS.length}`;
  buildScoreboard();
  updateHUD();

  world.reset();
  world.setAll(700);
  audio.init();
  audio.startMusic();
  setSoundIcon();

  gameLoop().catch((err) => {
    console.error(err);
    showToast('Dad broke the game. Typical.', 4000);
  });
}

// ------------------------------------------------------------------ end
async function endGame() {
  state.running = false;
  state.current = null;
  updateHUD();
  hide($('#turnCard'));
  hide($('#turnBanner'));
  hide($('#toast'));
  await wait(500);

  const ranking = SIBLINGS.slice().sort((a, b) => {
    const diff = state.scores[b.id] - state.scores[a.id];
    if (diff !== 0) return diff;
    return state.slaps[a.id] - state.slaps[b.id];
  });
  const winner = ranking[0];
  const playerRank = ranking.findIndex((s) => s.id === state.playerId) + 1;
  const playerWon = winner.id === state.playerId;

  hide($('#hud'));
  const end = $('#endScreen');
  hide(end);
  show(end);

  $('#endTitle').innerHTML = playerWon
    ? 'YOU ARE THE<br />GOLDEN CHILD'
    : `${winner.name.toUpperCase()} IS THE<br />GOLDEN CHILD`;
  $('#endSub').textContent = playerWon
    ? 'Dad nods once. That’s basically a hug.'
    : `You finished #${playerRank}. Dad is already rewriting the will.`;

  const medals = ['🥇', '🥈', '🥉', '🫠'];
  $('#ranking').innerHTML = ranking
    .map((s, i) => {
      const you = s.id === state.playerId;
      return `<div class="rank-row ${i === 0 ? 'winner' : ''} ${you ? 'you' : ''}">
        <span class="rank-medal">${medals[i]}</span>
        <span class="rank-name">${s.name}${you ? ' <small>YOU</small>' : `<small>${s.tag}</small>`}</span>
        <span class="rank-score">${state.scores[s.id]}</span>
        <span class="rank-slaps">${state.slaps[s.id]} SMACK${state.slaps[s.id] === 1 ? '' : 'S'}</span>
      </div>`;
    })
    .join('');

  world.setEnd(winner.id);
  world.endCelebrate(winner.id);
  audio.success(true);
  if (playerWon) spawnConfetti(56);
  setTimeout(() => spawnConfetti(26), 1400);
  restartAnimation($('#endTitle'));
}

// ------------------------------------------------------------------ reset / menu
function goMenu() {
  clearConfetti();
  hide($('#endScreen'));
  hide($('#hud'));
  hide($('#resultScreen'));
  hide($('#choiceScreen'));
  hide($('#challengeScreen'));
  hide($('#turnCard'));
  hide($('#turnBanner'));
  hide($('#toast'));
  hide($('#slapFX'));
  state.running = false;
  world.reset();
  world.setAll(900);
  show($('#titleScreen'));
  audio.click();
}

// ------------------------------------------------------------------ events
$('#enterBtn').addEventListener('click', () => {
  audio.init();
  audio.startMusic();
  setSoundIcon();
  audio.click();
  hide($('#titleScreen'));
  show($('#selectScreen'));
  world.setAll(850);
});

$('#titleHelpBtn').addEventListener('click', openHelp);
$('#helpBtn').addEventListener('click', openHelp);
$('#helpCloseBtn').addEventListener('click', closeHelp);
$('#helpScreen').addEventListener('click', (e) => {
  if (e.target === $('#helpScreen')) closeHelp();
});

$('#backTitleBtn').addEventListener('click', () => {
  audio.click();
  hide($('#selectScreen'));
  show($('#titleScreen'));
  world.setAll(800);
});

$('#startGameBtn').addEventListener('click', () => {
  if (!selectedId) return;
  audio.click();
  startGame(selectedId);
});

$('#soundBtn').addEventListener('click', () => {
  audio.init();
  const on = audio.toggle();
  setSoundIcon();
  showToast(on ? '<b>SOUND ON.</b> Maximum 90s activated.' : '<b>MUTED.</b> Dad is disappointed.', 1600);
  if (on) {
    audio.startMusic();
    audio.click();
  }
});

$('#replayBtn').addEventListener('click', () => {
  audio.click();
  hide($('#endScreen'));
  clearConfetti();
  if (state.playerId) startGame(state.playerId);
});

$('#menuBtn').addEventListener('click', () => {
  goMenu();
});

document.querySelectorAll('.choice-card').forEach((card) => {
  card.addEventListener('click', () => makeChoice(card.dataset.choice));
});

$('#nextBtn').addEventListener('click', () => {}); // waitForButton attaches its own handler

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && activeScreen($('#helpScreen'))) closeHelp();
  if (!activeScreen($('#choiceScreen'))) return;
  if (e.key.toLowerCase() === 't') makeChoice('truth');
  if (e.key.toLowerCase() === 'd') makeChoice('dare');
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  if (activeScreen($('#resultScreen'))) $('#nextBtn').click();
  if (activeScreen($('#endScreen'))) $('#replayBtn').click();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (bannerTimer) clearTimeout(bannerTimer);
    if (toastTimer) clearTimeout(toastTimer);
    if (turnCardTimer) clearTimeout(turnCardTimer);
  }
});

buildCharacterCards();
setSoundIcon();

// Kick the title camera into a gentle establishing shot.
world.setAll(0);
