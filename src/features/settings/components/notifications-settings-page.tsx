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

type NotificationsSettingsPageProps = {
  config: AppConfig
}

export function NotificationsSettingsPage({
  config: initialConfig,
}: NotificationsSettingsPageProps) {
  const form = useSettingsForm(initialConfig)
  const { config, setConfig } = form

  return (
    <div className="flex flex-col gap-6">
      <Section
        title="Telegram"
        description="Enables sending notifications through the Telegram bot."
      >
        <ToggleField
          label="Notifications active"
          description="Master switch for all Telegram alerts"
          checked={config.telegram.enabled}
          onChange={(checked) =>
            setConfig({
              ...config,
              telegram: { ...config.telegram, enabled: checked },
            })
          }
        />
      </Section>

      <Section
        title="Battery alerts"
        description="SOC thresholds and battery warning frequency."
      >
        <SliderField
          label="Low SOC"
          value={config.battery.socLow}
          min={0}
          max={100}
          step={1}
          unit=" %"
          accent="emerald"
          hint="Alert when charge falls below this threshold"
          onChange={(value) =>
            setConfig({
              ...config,
              battery: { ...config.battery, socLow: value },
            })
          }
        />
        <SliderField
          label="High SOC"
          value={config.battery.socHigh}
          min={0}
          max={100}
          step={1}
          unit=" %"
          accent="emerald"
          hint="Alert when charge exceeds this threshold"
          onChange={(value) =>
            setConfig({
              ...config,
              battery: { ...config.battery, socHigh: value },
            })
          }
        />
        <SliderField
          label="Alert cooldown"
          value={config.battery.alertCooldownHours}
          min={0}
          max={48}
          step={1}
          unit=" ore"
          hint="Minimum interval between two notifications of the same type"
          onChange={(value) =>
            setConfig({
              ...config,
              battery: { ...config.battery, alertCooldownHours: value },
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
    </div>
  )
}
