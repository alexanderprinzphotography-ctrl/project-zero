import type { ProjectFieldConfig } from "@/core/projects/dynamic-fields";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/core/ui/field";

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
        const fieldId = `field_${field.key}`;

        return (
          <Field key={field.key} label={field.label} htmlFor={fieldId}>
            {field.type === "textarea" ? (
              <Textarea id={fieldId} name={fieldId} rows={3} defaultValue={value} />
            ) : (
              <Input id={fieldId} name={fieldId} type="text" defaultValue={value} />
            )}
          </Field>
        );
      })}
    </div>
  );
}
