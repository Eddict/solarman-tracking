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

type ArchivePolicySectionProps = {
  config: AppConfig
}

export function ArchivePolicySection({ config: initialConfig }: ArchivePolicySectionProps) {
  const form = useSettingsForm(initialConfig)
  const { config, setConfig } = form

  return (
    <>
      <Section
        title="Archive policy"
        description="Enables day export/restore to Cubbit and indicates the suggested local hot window."
      >
        <ToggleField
          label="S3 archive enabled"
          description="Allows export and restore from Settings → Archive"
          checked={config.archive?.enabled ?? false}
          onChange={(checked) =>
            setConfig({
              ...config,
              archive: {
                enabled: checked,
                hotRetentionDays: config.archive?.hotRetentionDays ?? 90,
              },
            })
          }
        />
        <SliderField
          label="Local hot window"
          value={config.archive?.hotRetentionDays ?? 90}
          min={7}
          max={365}
          step={1}
          unit=" days"
          hint="Operational note: older days can live on S3 (automatic pruning is not active in F16)"
          onChange={(value) =>
            setConfig({
              ...config,
              archive: {
                enabled: config.archive?.enabled ?? false,
                hotRetentionDays: value,
              },
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
