import { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';
import {
  CLASS_DAY_PRESET_OPTIONS,
  WEEKDAY_PICKER_OPTIONS,
  classDaysToWeekdaySet,
  encodeClassDaysFromWeekdays,
  formatClassDaysLabel,
} from '../lib/classSchedule';
import { Button, Modal } from './ui';

interface ClassDaysPickerProps {
  value: string;
  onChange: (pattern: string) => void;
  disabled?: boolean;
}

export function ClassDaysPicker({ value, onChange, disabled }: ClassDaysPickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Set<number>>(() => classDaysToWeekdaySet(value));

  useEffect(() => {
    if (!open) setDraft(classDaysToWeekdaySet(value));
  }, [value, open]);

  const toggleDay = (day: number) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const applyPreset = (pattern: string) => {
    setDraft(classDaysToWeekdaySet(pattern));
  };

  const handleSave = () => {
    onChange(encodeClassDaysFromWeekdays(draft));
    setOpen(false);
  };

  const summary = formatClassDaysLabel(value);

  return (
    <>
      <div className="space-y-1">
        <span className="ml-1 block text-sm font-medium text-gray-700">Class days (weekly schedule)</span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-300/70 bg-white px-4 py-2.5 text-left text-base text-gray-900 transition hover:border-gray-400/80 focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className={value ? 'font-medium text-[#800000]' : 'text-gray-600'}>{summary}</span>
          <Calendar className="h-5 w-5 shrink-0 text-[#800000]" strokeWidth={2} aria-hidden />
        </button>
        <p className="text-xs text-gray-500">
          Pick which days this subject meets each week. Attendance can only be taken on these days unless admin
          approves access.
        </p>
      </div>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Weekly class schedule">
        <p className="mb-4 text-sm text-gray-600">
          Select the days this subject is held (e.g. Thesis 1 on Monday and Friday only). Select all seven days
          for no restriction.
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          {CLASS_DAY_PRESET_OPTIONS.filter((p) => p.value).map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => applyPreset(preset.value)}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-[#800000]/40 hover:bg-[#800000]/5"
            >
              {preset.label.replace(/\s*\([^)]*\)\s*$/, '')}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setDraft(new Set(WEEKDAY_PICKER_OPTIONS.map((d) => d.value)))}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-[#800000]/40 hover:bg-[#800000]/5"
          >
            Every day
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {WEEKDAY_PICKER_OPTIONS.map((day) => {
            const selected = draft.has(day.value);
            return (
              <button
                key={day.value}
                type="button"
                onClick={() => toggleDay(day.value)}
                className={`rounded-xl border px-3 py-3 text-center transition ${
                  selected
                    ? 'border-[#800000] bg-[#800000]/10 text-[#800000] ring-2 ring-[#800000]/30'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                }`}
                aria-pressed={selected}
              >
                <span className="block text-lg font-bold">{day.short}</span>
                <span className="block text-xs">{day.label}</span>
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-sm text-gray-600">
          Selected:{' '}
          <span className="font-semibold text-[#800000]">
            {formatClassDaysLabel(encodeClassDaysFromWeekdays(draft))}
          </span>
        </p>

        <div className="mt-6 flex gap-3">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" className="flex-1" onClick={handleSave}>
            Apply schedule
          </Button>
        </div>
      </Modal>
    </>
  );
}
