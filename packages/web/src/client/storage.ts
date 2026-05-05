export interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  getJSON<T>(key: string): T | null;
  setJSON<T>(key: string, value: T): void;
}

// LocalStorage-backed for MVP. The adapter shape is the seam: future encrypted
// IndexedDB lives behind the same interface so call sites don't change.
export class LocalStorageAdapter implements StorageAdapter {
  constructor(private namespace: string) {}

  private k(key: string): string {
    return `${this.namespace}:${key}`;
  }

  get(key: string): string | null {
    return localStorage.getItem(this.k(key));
  }

  set(key: string, value: string): void {
    localStorage.setItem(this.k(key), value);
  }

  remove(key: string): void {
    localStorage.removeItem(this.k(key));
  }

  getJSON<T>(key: string): T | null {
    const raw = this.get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  setJSON<T>(key: string, value: T): void {
    this.set(key, JSON.stringify(value));
  }
}

export const sessionStorage_ = new LocalStorageAdapter("zoon");
