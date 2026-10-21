/** localStorage can be unavailable (private mode, blocked site data); settings then last for the visit only. */
export const stored = {
  get: (key: string): string | undefined => { try { return localStorage.getItem(`retarget3mf.${key}`) ?? undefined; } catch { return undefined; } },
  set: (key: string, value: string): void => { try { localStorage.setItem(`retarget3mf.${key}`, value); } catch { /* not persisted */ } },
};
