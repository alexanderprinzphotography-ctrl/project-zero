export type ProjectFieldType = "text" | "textarea";

/**
 * Vertrag zwischen Core (generisches Rendering) und Branchenmodulen
 * (konkrete Feldliste). Core kennt keine Feldnamen einer Branche - nur diesen
 * Typ. Werte landen in projects.metadata, nie als feste Spalten.
 */
export type ProjectFieldConfig = {
  key: string;
  label: string;
  type: ProjectFieldType;
};
