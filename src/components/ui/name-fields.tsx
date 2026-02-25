"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type NameFieldsValue = {
  academic_title: string | null
  first_name: string
  middle_name: string | null
  last_name: string
}

export type NameFieldsProps = {
  value: NameFieldsValue
  onChange: (value: NameFieldsValue) => void
  required?: boolean
}

export function composeFullName(value: NameFieldsValue): string {
  const parts = [
    value.academic_title,
    value.first_name,
    value.middle_name,
    value.last_name,
  ]
    .map((part) => (part ?? "").trim())
    .filter((part) => part.length > 0)

  return parts.join(" ")
}

export function NameFields({ value, onChange, required = false }: NameFieldsProps) {
  const composedName = composeFullName(value)

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="academic_title">Akademischer Titel</Label>
        <select
          id="academic_title"
          value={value.academic_title ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              academic_title: e.target.value || null,
            })
          }
          className="flex h-14 w-full rounded-md border-2 border-warmgray-400 bg-white px-5 py-4 text-lg transition-colors placeholder:text-warmgray-600 focus-visible:outline-none focus-visible:border-sage-500 focus-visible:ring-[3px] focus-visible:ring-sage-100 disabled:cursor-not-allowed disabled:opacity-50 text-gray-900"
        >
          <option value="">—</option>
          <option value="Dr.">Dr.</option>
          <option value="Dr. med.">Dr. med.</option>
          <option value="Dr. jur.">Dr. jur.</option>
          <option value="Prof.">Prof.</option>
          <option value="Prof. Dr.">Prof. Dr.</option>
          <option value="Dipl.-Ing.">Dipl.-Ing.</option>
          <option value="M.Sc.">M.Sc.</option>
          <option value="B.Sc.">B.Sc.</option>
          <option value="MBA">MBA</option>
        </select>
      </div>

      <div className="flex gap-3">
        <div className="space-y-2 flex-1">
          <Label htmlFor="first_name">Vorname</Label>
          <Input
            id="first_name"
            value={value.first_name}
            onChange={(e) =>
              onChange({
                ...value,
                first_name: e.target.value,
              })
            }
            required={required}
          />
        </div>
        <div className="space-y-2 flex-1">
          <Label htmlFor="middle_name">Zweiter Vorname (optional)</Label>
          <Input
            id="middle_name"
            value={value.middle_name ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                middle_name: e.target.value || null,
              })
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="last_name">Nachname</Label>
        <Input
          id="last_name"
          value={value.last_name}
          onChange={(e) =>
            onChange({
              ...value,
              last_name: e.target.value,
            })
          }
          required={required}
        />
      </div>

      <p className="text-sm text-warmgray-600">
        {composedName ? `Anzeigename: ${composedName}` : "Anzeigename: —"}
      </p>
    </div>
  )
}
