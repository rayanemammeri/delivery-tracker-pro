/**
 * Modèle de données. Tous les montants sont stockés en CENTS (entiers)
 * pour éviter toute erreur d'arrondi (0,1 + 0,2 ≠ 0,3 en virgule flottante).
 * Chaque enregistrement a un identifiant UUID et un horodatage updatedAt,
 * ce qui permettra d'ajouter une synchronisation cloud plus tard.
 */
export type PaymentMethod = 'cash' | 'machine';

export interface BreakInterval {
  start: string; // ISO
  end: string | null; // null = pause en cours
}

export interface Shift {
  id: string;
  /** Journée de travail (YYYY-MM-DD) — date de début, même si la fin passe minuit. */
  date: string;
  start: string; // ISO
  end: string | null; // null = quart en cours
  breaks: BreakInterval[];
  /** Si défini, remplace le total des pauses chronométrées (saisie manuelle). */
  breakMinutes: number | null;
  /** Taux horaire en cents au moment du quart (12 $ = 1200). */
  hourlyRate: number;
  createdAt: string;
  updatedAt: string;
}

export interface Delivery {
  id: string;
  /** Journée de travail (YYYY-MM-DD). */
  date: string;
  amount: number; // cents
  method: PaymentMethod;
  /** Moment de l'enregistrement (modifiable). */
  time: string; // ISO
  createdAt: string;
  updatedAt: string;
}

export interface Payout {
  id: string;
  amount: number; // cents
  /** Date de la remise par le patron (YYYY-MM-DD). */
  date: string;
  /** Optionnel : journée de travail que cette remise vise en priorité. */
  forDate: string | null;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  hourlyRate: number; // cents
  theme: 'dark' | 'light' | 'system';
  defaultMethod: PaymentMethod;
}

export const DEFAULT_SETTINGS: Settings = {
  hourlyRate: 1200,
  theme: 'dark',
  defaultMethod: 'cash',
};
