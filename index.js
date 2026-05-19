// Difficulty
const DIFFICULTIES = {
  easy:   { pairs: 3,  time: 60  },
  medium: { pairs: 6,  time: 90  },
  hard:   { pairs: 10, time: 120 },
};

// State
let difficulty     = 'easy';
let allPokemon     = [];
let cards          = [];
let firstCard      = null;
let secondCard     = null;
let lockBoard      = false;
let gameActive     = false;
let clicks         = 0;
let pairsMatched   = 0;
let totalPairs     = 0;
let timerInterval  = null;
let timeLeft       = 0;
let powerupUsed    = false;
let powerupAvailable = false;

// DOM
let $grid, $loading, $timerEl, $timerBox;
let messageModal;

$(document).ready(async function () {

  $grid     = $('#game_grid');
  $loading  = $('#loading');
  $timerEl  = $('#timer');
  $timerBox = $('.timer-box');

  // Bootstrap modal (REPLACES old overlay system)
  messageModal = new bootstrap.Modal(document.getElementById('messageModal'));

  updateStatus();
  await fetchAllPokemon();

  // Difficulty buttons
  $('.diff-btn').on('click', function () {
    $('.diff-btn').removeClass('active');
    $(this).addClass('active');
    difficulty = $(this).data('diff');
  });

  // Start
  $('#start-btn').on('click', startGame);

  // Reset
  $('#reset-btn').on('click', resetGame);

  // Play again (Bootstrap modal)
  $('#message-play-again').on('click', function () {
    messageModal.hide();
    startGame();
  });

  // Theme toggle
  $('#theme-checkbox').on('change', function () {
    $('body')
      .toggleClass('dark', this.checked)
      .toggleClass('light', !this.checked);
  });

  // Power-up
  $('#powerup-btn').on('click', activatePowerup);
  $('#powerup-btn').prop('disabled', true);
});


// =========================
// API
// =========================
async function fetchAllPokemon() {
  try {
    const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1025');
    const data = await res.json();
    allPokemon = data.results;
  } catch (e) {
    console.error('Failed to load Pokémon list:', e);
  }
}

async function fetchPokemonDetails(url) {
  const res = await fetch(url);
  const data = await res.json();

  const img =
    data.sprites?.other?.['official-artwork']?.front_default ||
    data.sprites?.front_default ||
    '';

  return { name: data.name, img };
}


// =========================
// START GAME
// =========================
async function startGame() {
  clearInterval(timerInterval);
  resetState();

  const { pairs, time } = DIFFICULTIES[difficulty];
  totalPairs  = pairs;
  timeLeft    = time;
  powerupUsed = false;
  powerupAvailable = true;

  $('#powerup-btn').prop('disabled', false);

  updateStatus();
  $grid.empty();
  $loading.removeClass('hidden');

  const shuffled = [...allPokemon].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, pairs);

  const details = await Promise.all(
    selected.map(p => fetchPokemonDetails(p.url))
  );

  $loading.addClass('hidden');

  let cardData = [];
  details.forEach(p => {
    cardData.push({ ...p });
    cardData.push({ ...p });
  });

  cardData = cardData.sort(() => Math.random() - 0.5);

  cards = [];

  cardData.forEach(p => {
    const $card = $(`
      <div class="card">
        <div class="back_face">
          <img src="back.webp" alt="Card Back">
        </div>
        <div class="front_face">
          <img src="${p.img}" alt="${p.name}">
          <span class="poke-name">${p.name}</span>
        </div>
      </div>
    `);

    $card.data('pokemon', p.name);
    $card.on('click', onCardClick);

    $grid.append($card);
    cards.push($card);
  });

  gameActive = true;
  startTimer();
}


// =========================
// RESET
// =========================
function resetGame() {
  clearInterval(timerInterval);
  resetState();

  $grid.empty();
  $('#powerup-btn').prop('disabled', true);
  updateStatus();
}

function resetState() {
  cards = [];
  firstCard = null;
  secondCard = null;
  lockBoard = false;
  gameActive = false;

  clicks = 0;
  pairsMatched = 0;
  totalPairs = 0;
  timeLeft = 0;

  $timerEl.text('--');
  $timerBox.removeClass('warning');
}


// =========================
// CARD LOGIC
// =========================
function onCardClick() {
  const $card = $(this);

  if (!gameActive) return;
  if (lockBoard) return;
  if ($card.hasClass('flip')) return;
  if ($card.hasClass('matched')) return;

  $card.addClass('flip');
  clicks++;
  updateStatus();

  if (!firstCard) {
    firstCard = $card;
    return;
  }

  secondCard = $card;
  lockBoard = true;

  if (
    firstCard.data('pokemon') === secondCard.data('pokemon') &&
    firstCard[0] !== secondCard[0]
  ) {
    firstCard.addClass('matched').off('click');
    secondCard.addClass('matched').off('click');

    pairsMatched++;
    updateStatus();
    resetPick();

    if (pairsMatched === totalPairs) {
      setTimeout(winGame, 400);
    }

  } else {
    setTimeout(() => {
      firstCard.removeClass('flip');
      secondCard.removeClass('flip');
      resetPick();
    }, 1000);
  }
}

function resetPick() {
  firstCard = null;
  secondCard = null;
  lockBoard = false;
}


// =========================
// TIMER
// =========================
function startTimer() {
  $timerEl.text(formatTime(timeLeft));

  timerInterval = setInterval(() => {
    timeLeft--;
    $timerEl.text(formatTime(timeLeft));

    if (timeLeft <= 10) $timerBox.addClass('warning');

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      if (pairsMatched < totalPairs) loseGame();
    }
  }, 1000);
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}


// =========================
// WIN / LOSE (BOOTSTRAP MODAL FIXED)
// =========================
function winGame() {
  gameActive = false;
  clearInterval(timerInterval);
  lockBoard = true;

  $('#powerup-btn').prop('disabled', true);

  $('#message-title').text('YOU WIN!');
  $('#message-body').html(
    `You matched <strong>${totalPairs}</strong> pairs in <strong>${clicks}</strong> clicks!`
  );

  messageModal.show();
}

function loseGame() {
  gameActive = false;
  lockBoard = true;

  $('#powerup-btn').prop('disabled', true);

  cards.forEach($c => {
    if (!$c.hasClass('matched')) {
      $c.off('click');
    }
  });

  $('#message-title').text('GAME OVER');
  $('#message-body').html(
    `Time's up! You matched <strong>${pairsMatched}</strong> of <strong>${totalPairs}</strong> pairs.`
  );

  messageModal.show();
}


// =========================
// STATUS
// =========================
function updateStatus() {
  $('#clicks').text(clicks);
  $('#pairs-matched').text(pairsMatched);
  $('#pairs-left').text(Math.max(0, totalPairs - pairsMatched));
  $('#total-pairs').text(totalPairs);
}


// =========================
// POWERUP
// =========================
function activatePowerup() {
  if (!gameActive || !powerupAvailable) return;

  powerupAvailable = false;
  powerupUsed = true;

  $('#powerup-btn').prop('disabled', true);
  lockBoard = true;

  // flip all non-matched cards
  cards.forEach($c => {
    if (!$c.hasClass('matched')) {
      $c.addClass('flip');
    }
  });

  setTimeout(() => {
    cards.forEach($c => {
      if (!$c.hasClass('matched')) {
        $c.removeClass('flip');
      }
    });

    lockBoard = false;
  }, 2000);
}