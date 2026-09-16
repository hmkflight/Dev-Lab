/** Foreground request activity only; background refreshes should stay quiet. */
let pending = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());
export const requestActivity = {
  getSnapshot: () => pending,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};
export function beginRequest() {
  pending += 1;
  emit();
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    pending -= 1;
    emit();
  };
}
