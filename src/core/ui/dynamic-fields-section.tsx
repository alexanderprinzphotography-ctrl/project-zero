import type { ProjectFieldConfig } from "@/core/projects/dynamic-fields";

const fieldClass =
  "rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

/**
 * Rendert eine konfigurationsgetriebene Feldliste (siehe ProjectFieldConfig).
 * Kennt keine konkreten Feldnamen - branchenspezifische Konfiguration kommt
 * von aussen (z. B. aus src/modules/handwerk). Werte werden unter dem
 * Formularfeldnamen `field_<key>` uebermittelt und landen in metadata.
 */
export function DynamicFieldsSection({
  fields,
  values,
}: {
  fields: ProjectFieldConfig[];
  values: Record<string, unknown>;
}) {
  if (fields.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {fields.map((field) => {
        const rawValue = values[field.key];
        const value = typeof rawValue === "string" ? rawValue : "";

        return (
          <div key={field.key} className="flex flex-col gap-1.5">
            <label htmlFor={`field_${field.key}`} className="text-sm font-medium">
              {field.label}
            </label>
            {field.type === "textarea" ? (
              <textarea
                id={`field_${field.key}`}
                name={`field_${field.key}`}
                rows={3}
                defaultValue={value}
                className={fieldClass}
              />
            ) : (
              <input
                id={`field_${field.key}`}
                name={`field_${field.key}`}
                type="text"
                defaultValue={value}
                className={fieldClass}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
