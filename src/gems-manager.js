const STORAGE_KEY = 'redxax_gems';
const DEFAULT_GEMS = 500;

const isLocalStorageAvailable = () => {
  try {
    localStorage.setItem('__test__', '1');
    localStorage.removeItem('__test__');
    return true;
  } catch {
    return false;
  }
};

export const gemsManager = {
  getGems() {
    if (!isLocalStorageAvailable()) return DEFAULT_GEMS;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === null) {
        localStorage.setItem(STORAGE_KEY, DEFAULT_GEMS);
        return DEFAULT_GEMS;
      }
      const parsed = parseInt(stored, 10);
      return isNaN(parsed) ? DEFAULT_GEMS : parsed;
    } catch {
      return DEFAULT_GEMS;
    }
  },

  setGems(amount) {
    const value = Math.max(0, amount);
    try {
      if (isLocalStorageAvailable()) {
        localStorage.setItem(STORAGE_KEY, String(value));
      }
    } catch {
      // Si falla el guardado, igual devolvemos el valor
    }
    return value;
  },

  hasEnough(cost) {
    return this.getGems() >= cost;
  }
};