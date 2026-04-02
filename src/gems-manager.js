const STORAGE_KEY = 'redxax_gems';
const DEFAULT_GEMS = 500; // Gemas iniciales para nuevos usuarios

export const gemsManager = {
  getGems() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      localStorage.setItem(STORAGE_KEY, DEFAULT_GEMS);
      return DEFAULT_GEMS;
    }
    return parseInt(stored, 10);
  },

  setGems(amount) {
    const value = Math.max(0, amount); // Nunca negativo
    localStorage.setItem(STORAGE_KEY, value);
    return value;
  },

  hasEnough(cost) {
    return this.getGems() >= cost;
  }
};