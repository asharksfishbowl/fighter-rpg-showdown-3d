export type InputState = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  light: boolean;
  heavy: boolean;
  special: boolean;
};

const pressed = new Set<string>();

const KEYMAP: Record<string, keyof InputState> = {
  a: "left",
  arrowleft: "left",
  d: "right",
  arrowright: "right",
  w: "up",
  arrowup: "up",
  " ": "up",
  s: "down",
  arrowdown: "down",
  j: "light",
  k: "heavy",
  l: "special",
};

export function bindInput(): () => void {
  const onDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (KEYMAP[k]) {
      e.preventDefault();
      pressed.add(k);
    }
  };
  const onUp = (e: KeyboardEvent) => {
    pressed.delete(e.key.toLowerCase());
  };
  window.addEventListener("keydown", onDown);
  window.addEventListener("keyup", onUp);
  return () => {
    window.removeEventListener("keydown", onDown);
    window.removeEventListener("keyup", onUp);
    pressed.clear();
  };
}

export function readInput(): InputState {
  const state: InputState = {
    left: false,
    right: false,
    up: false,
    down: false,
    light: false,
    heavy: false,
    special: false,
  };
  for (const k of pressed) {
    const action = KEYMAP[k];
    if (action) state[action] = true;
  }
  return state;
}

/** Consume one-shot attack keys so holds don't spam forever. */
export function consumeAttack(keys: Array<"j" | "k" | "l">): void {
  for (const k of keys) pressed.delete(k);
}
