import type { AppConfig } from '@/lib/config/schema'
import { useSettingsForm } from '@/features/settings/hooks/use-settings-form'
import {
  Section,
  SliderField,
  ToggleField,
} from '@/features/settings/components/settings-fields'
import {
  SettingsMessage,
  SettingsSaveBar,
} from '@/features/settings/components/settings-save-bar'

type BackupPolicySectionProps = {
  config: AppConfig
}

export function BackupPolicySection({ config: initialConfig }: BackupPolicySectionProps) {
  const form = useSettingsForm(initialConfig)
  const { config, setConfig } = form

  return (
    <>
      <Section
        title="Backup policy"
        description="Thresholds for automatic monitoring of backup regularity."
      >
        <SliderField
          label="Missing backup threshold"
          value={config.backup.maxAgeHours}
          min={1}
          max={168}
          step={1}
          unit=" hours"
          hint="Report a problem if the last successful backup is older than this threshold"
          onChange={(value) =>
            setConfig({
              ...config,
              backup: { ...config.backup, maxAgeHours: value },
            })
          }
        />
        <ToggleField
          label="Missing backup Telegram alert"
          description="Requires active Telegram notifications"
          checked={config.backup.alertOnMissing}
          onChange={(checked) =>
            setConfig({
              ...config,
              backup: { ...config.backup, alertOnMissing: checked },
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
    </>
  )
}
