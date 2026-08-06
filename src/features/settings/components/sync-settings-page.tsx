import type { AppConfig } from '@/lib/config/schema'
import type { BackfillMonthSummary } from '@/features/backfill/types'
import { BackfillCoveragePanel } from '@/features/backfill/components/backfill-coverage-panel'
import { useSettingsForm } from '@/features/settings/hooks/use-settings-form'
import {
  Section,
  SelectField,
  SliderField,
  ToggleField,
} from '@/features/settings/components/settings-fields'
import {
  SettingsMessage,
  SettingsSaveBar,
} from '@/features/settings/components/settings-save-bar'

const SYNC_INTERVAL_OPTIONS = [
  { label: '1 minuto', value: 60_000 },
  { label: '5 minuti', value: 300_000 },
  { label: '10 minuti', value: 600_000 },
  { label: '15 minuti', value: 900_000 },
  { label: '30 minuti', value: 1_800_000 },
  { label: '60 minuti', value: 3_600_000 },
]

type SyncSettingsPageProps = {
  config: AppConfig
  backfillSummary: BackfillMonthSummary
}

export function SyncSettingsPage({
  config: initialConfig,
  backfillSummary,
}: SyncSettingsPageProps) {
  const form = useSettingsForm(initialConfig)
  const { config, setConfig } = form

  return (
    <div className="flex flex-col gap-6">
      <Section
        title="Solarman synchronization"
        description="Frequency of the worker that downloads data from the inverter."
      >
        <SelectField
          label="Sync interval"
          value={config.sync.intervalMs}
          options={SYNC_INTERVAL_OPTIONS}
          hint="The Solarman data granularity is 5 minutes"
          onChange={(value) =>
            setConfig({
              ...config,
              sync: { ...config.sync, intervalMs: value },
            })
          }
        />
        <ToggleField
          label="Include realtime data"
          description="Adds the instant snapshot to each sync"
          checked={config.sync.includeRealtime}
          onChange={(checked) =>
            setConfig({
              ...config,
              sync: { ...config.sync, includeRealtime: checked },
            })
          }
        />
      </Section>

      <Section
        title="Historical backfill"
        description="Parameters for the initial load and recovery of past data."
      >
        <SliderField
          label="Empty days before stopping"
          value={config.backfill.maxConsecutiveEmptyDays}
          min={1}
          max={90}
          step={1}
          unit=" days"
          hint="The full backfill stops after this sequence of days without data"
          onChange={(value) =>
            setConfig({
              ...config,
              backfill: { ...config.backfill, maxConsecutiveEmptyDays: value },
            })
          }
        />
      </Section>

      <SettingsSaveBar
        isDirty={form.isDirty}
        isSaving={form.isSaving}
        onSave={form.handleSave}
        onReset={form.handleReset}
        onExport={form.handleExport}
      />
      <SettingsMessage message={form.message} />

      <BackfillCoveragePanel summary={backfillSummary} />
    </div>
  )
}
