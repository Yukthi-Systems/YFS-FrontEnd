import type { InternalSharePermissions } from "../../types/file";
import { Checkbox } from "./Checkbox";

export const PERMISSION_FIELDS: { key: keyof InternalSharePermissions; label: string; hint: string }[] = [
  { key: "can_preview", label: "Preview", hint: "Open and view contents" },
  { key: "can_download", label: "Download", hint: "Save a copy locally" },
  { key: "can_create", label: "Create", hint: "Add new files here" },
  { key: "can_update", label: "Edit", hint: "Rename and change files" },
  { key: "can_delete", label: "Delete", hint: "Remove files" },
];

export const permsOf = (s: InternalSharePermissions): InternalSharePermissions => ({
  can_preview: s.can_preview,
  can_download: s.can_download,
  can_create: s.can_create,
  can_update: s.can_update,
  can_delete: s.can_delete,
});

export const permsEqual = (a: InternalSharePermissions, b: InternalSharePermissions) =>
  PERMISSION_FIELDS.every(({ key }) => a[key] === b[key]);

export function PermissionPicker({
  value,
  disabled,
  onChange,
}: {
  value: InternalSharePermissions;
  disabled?: boolean;
  onChange: (next: InternalSharePermissions) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-2 min-[420px]:grid-cols-3">
      {PERMISSION_FIELDS.map(({ key, label, hint }) => (
        <Checkbox
          key={key}
          checked={value[key]}
          disabled={disabled}
          title={hint}
          label={label}
          onChange={(next) => onChange({ ...value, [key]: next })}
        />
      ))}
    </div>
  );
}
