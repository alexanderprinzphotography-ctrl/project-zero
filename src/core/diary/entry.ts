export type DiaryCategory =
  | "fortschritt"
  | "mangel"
  | "lieferung"
  | "wetter"
  | "personal"
  | "sonstiges";

export const DIARY_CATEGORIES: DiaryCategory[] = [
  "fortschritt",
  "mangel",
  "lieferung",
  "wetter",
  "personal",
  "sonstiges",
];

export function diaryCategoryLabel(category: DiaryCategory | null): string | null {
  switch (category) {
    case "fortschritt":
      return "Fortschritt";
    case "mangel":
      return "Mangel";
    case "lieferung":
      return "Lieferung";
    case "wetter":
      return "Wetter";
    case "personal":
      return "Personal";
    case "sonstiges":
      return "Sonstiges";
    default:
      return null;
  }
}

export type DiaryPhoto = {
  id: string;
  storage_path: string;
  signedUrl: string | null;
};

export type DiaryEntry = {
  id: string;
  seq: number;
  created_at: string;
  category: DiaryCategory | null;
  text: string | null;
  corrects_entry_id: string | null;
  authorName: string;
  photos: DiaryPhoto[];
};
