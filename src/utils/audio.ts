// All sound effects are sourced from Kenney's Sound Pack (CC0 / Public Domain)
// https://kenney.nl  |  Hosted at https://gamesounds.xyz
//
// NOTE: gamesounds.xyz serves .ogg files.
// OGG is natively supported in Chrome, Firefox and Edge.
// Safari does not support OGG — sounds will silently fail on Safari/iOS.
// If full Safari support is needed, host MP3 equivalents on GCS and swap the URLs.

const BASE = 'https://gamesounds.xyz/Kenney%27s%20Sound%20Pack';

export const MUSIC_TRACKS: Record<string, string> = {
  'music-default':
    'https://storage.googleapis.com/secretchancellor/Shadows%20in%20the%20Marble%20Hall.mp3',
  'music-parliament':
    'https://storage.googleapis.com/secretchancellor/Shadows%20Over%20Parliament.mp3',
  'music-fog': 'https://storage.googleapis.com/secretchancellor/Fog%20in%20the%20Alley.mp3',
  'music-tense': 'https://storage.googleapis.com/secretchancellor/Final%20Countdown.mp3',
  'music-victory':
    'https://storage.googleapis.com/secretchancellor/Triumph%20of%20the%20New%20Age.mp3',
  'music-credits':
    'https://storage.googleapis.com/secretchancellor/Shadows%20in%20the%20Marble%20Hall%20(Vocal%20version).mp3',
  'music-pass-0': 'https://storage.googleapis.com/secretchancellor/Static%20Noise.mp3',
  'music-s1-prem-15': 'https://storage.googleapis.com/secretchancellor/Obsidian%20Requiem.mp3',
};

export const SOUND_PACKS: Record<string, Record<string, string>> = {
  // ─── Default ──────────────────────────────────────────────────────────────
  // Clean, cinematic UI sounds — Kenney Interface Sounds & RPG Audio
  default: {
    // Crisp UI click for every button press
    click: `${BASE}/Interface%20Sounds/click_001.ogg`,
    // Sharp blade — thematically fits the assassination executive action
    death: `${BASE}/RPG%20Audio/knifeSlice.ogg`,
    // Rising confirmation tone — government elected
    election_passed: `${BASE}/Interface%20Sounds/confirmation_001.ogg`,
    // Clear error / rejection sting — election failed
    election_failed: `${BASE}/Interface%20Sounds/error_001.ogg`,
    // Longest, most triumphant confirmation — game won
    victory: `${BASE}/Interface%20Sounds/confirmation_004.ogg`,
    // Heavy closing sound — the weight of a loss
    defeat: `${BASE}/Interface%20Sounds/close_004.ogg`,
    // Team-specific win sounds
    win_civil: 'https://storage.googleapis.com/secretchancellor/CivilWin.mp3',
    win_state: 'https://storage.googleapis.com/secretchancellor/StateWin.mp3',
    // Directive reveal sounds
    reveal_civil: 'https://storage.googleapis.com/secretchancellor/CivilDirective.mp3',
    reveal_state: 'https://storage.googleapis.com/secretchancellor/StateDirective.mp3',
    // Immersive UI & Action sounds
    hover: `${BASE}/Interface%20Sounds/drop_002.ogg`,
    stamp_aye: `${BASE}/Interface%20Sounds/confirmation_002.ogg`,
    stamp_nay: `${BASE}/Interface%20Sounds/error_002.ogg`,
    paper_slide: `${BASE}/RPG%20Audio/cloth1.ogg`,
    gavel: `${BASE}/Impact%20Sounds/impactPlate_heavy_004.ogg`,
    modal_open: `${BASE}/Interface%20Sounds/maximize_002.ogg`,
    modal_close: `${BASE}/Interface%20Sounds/minimize_002.ogg`,
    searching: `${BASE}/Interface%20Sounds/back_001.ogg`,
  },

  // ─── Retro ────────────────────────────────────────────────────────────────
  // 8-bit / arcade sounds — Kenney Retro Sounds 1 & 2
  'sound-retro': {
    // Short retro laser pew — snappy arcade click
    click: `${BASE}/Retro%20Sounds%201/laser1.ogg`,
    // Retro hit effect — enemy eliminated
    death: `${BASE}/Retro%20Sounds%202/hit1.ogg`,
    // Classic coin collect — government approved, reward earned
    election_passed: `${BASE}/Retro%20Sounds%202/coin1.ogg`,
    // Retro descending lose jingle — vote failed
    election_failed: `${BASE}/Retro%20Sounds%201/lose1.ogg`,
    // Retro power-up / item pickup — you won!
    victory: `${BASE}/Retro%20Sounds%201/pickup3.ogg`,
    // Classic retro game-over fanfare — defeat
    defeat: `${BASE}/Retro%20Sounds%202/gameover1.ogg`,
    // Team-specific win sounds
    win_civil: `${BASE}/Retro%20Sounds%201/pickup3.ogg`,
    win_state: `${BASE}/Retro%20Sounds%201/pickup2.ogg`,
    reveal_civil: `${BASE}/Retro%20Sounds%201/laser6.ogg`,
    reveal_state: `${BASE}/Retro%20Sounds%201/laser7.ogg`,
    // Missing UI sounds fallback or thematic retro equivalents
    hover: `${BASE}/Retro%20Sounds%201/laser2.ogg`,
    stamp_aye: `${BASE}/Retro%20Sounds%201/pickup1.ogg`,
    stamp_nay: `${BASE}/Retro%20Sounds%201/lose2.ogg`,
    paper_slide: `${BASE}/Retro%20Sounds%201/laser3.ogg`,
    gavel: `${BASE}/Retro%20Sounds%201/laser4.ogg`,
    modal_open: `${BASE}/Retro%20Sounds%202/coin2.ogg`,
    modal_close: `${BASE}/Retro%20Sounds%202/coin3.ogg`,
    searching: `${BASE}/Retro%20Sounds%202/coin4.ogg`,
  },

  // ─── Industrial ───────────────────────────────────────────────────────────
  // Heavy mechanical impacts — Kenney Impact Sounds & Interface Sounds
  'sound-industrial': {
    // Hard dry tap — like a gavel stamp on a desk
    click: `${BASE}/Impact%20Sounds/impactGeneric_light_000.ogg`,
    // Deep resonant bell toll — a death knell
    death: `${BASE}/Impact%20Sounds/impactBell_heavy_000.ogg`,
    // Bright glass chime — approval granted
    election_passed: `${BASE}/Impact%20Sounds/impactGlass_light_000.ogg`,
    // Heavy glass smash — motion violently rejected
    election_failed: `${BASE}/Impact%20Sounds/impactGlass_heavy_000.ogg`,
    // Rising industrial sweep — triumphant machinery
    victory: `${BASE}/Interface%20Sounds/maximize_001.ogg`,
    // Lowest, heaviest bell — the final toll of defeat
    defeat: `${BASE}/Impact%20Sounds/impactBell_heavy_004.ogg`,
    // Team-specific win sounds
    win_civil: `${BASE}/Interface%20Sounds/maximize_001.ogg`,
    win_state: `${BASE}/Interface%20Sounds/maximize_002.ogg`,
    reveal_civil: `${BASE}/Interface%20Sounds/maximize_004.ogg`,
    reveal_state: `${BASE}/Interface%20Sounds/maximize_005.ogg`,
    // Missing UI sounds fallback or thematic industrial equivalents
    hover: `${BASE}/Impact%20Sounds/impactGeneric_light_001.ogg`,
    stamp_aye: `${BASE}/Impact%20Sounds/impactGeneric_heavy_000.ogg`,
    stamp_nay: `${BASE}/Impact%20Sounds/impactGeneric_heavy_001.ogg`,
    paper_slide: `${BASE}/Impact%20Sounds/impactGeneric_light_004.ogg`,
    gavel: `${BASE}/Impact%20Sounds/impactMetal_heavy_000.ogg`,
    modal_open: `${BASE}/Interface%20Sounds/maximize_003.ogg`,
    modal_close: `${BASE}/Interface%20Sounds/minimize_003.ogg`,
    searching: `${BASE}/Impact%20Sounds/impactGeneric_light_002.ogg`,
  },
};


