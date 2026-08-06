import { CHART_SERIES } from '@/features/energy/chart-series'
import type { AppConfig } from '@/lib/config/schema'
import { useSettingsForm } from '@/features/settings/hooks/use-settings-form'
import {
  Section,
  SelectField,
  ToggleField,
  toggleVisibleSeries,
} from '@/features/settings/components/settings-fields'
import {
  SettingsMessage,
  SettingsSaveBar,
} from '@/features/settings/components/settings-save-bar'

const DASHBOARD_RANGE_OPTIONS = [
  { label: '24 ore', value: 24 },
  { label: '7 days', value: 24 * 7 },
  { label: '30 days', value: 24 * 30 },
  { label: '90 days', value: 24 * 90 },
]

type DashboardSettingsPageProps = {
  config: AppConfig
}

export function DashboardSettingsPage({
  config: initialConfig,
}: DashboardSettingsPageProps) {
  const form = useSettingsForm(initialConfig)
  const { config, setConfig } = form

  return (
    <div className="flex flex-col gap-6">
      <Section
        title="Time range"
        description="Default period shown when the dashboard opens."
      >
        <SelectField
          label="Default range"
          value={config.dashboard.defaultRangeHours}
          options={DASHBOARD_RANGE_OPTIONS}
          onChange={(value) =>
            setConfig({
              ...config,
              dashboard: { ...config.dashboard, defaultRangeHours: value },
            })
          }
        />
      </Section>

      <Section
        title="Energy chart"
        description="Default appearance and series shown in the main chart."
      >
        <ToggleField
          label="Normalize and smooth curves"
          description="Normalized view (0–100%) with moving average"
          checked={config.chart.smooth}
          onChange={(checked) =>
            setConfig({
              ...config,
              chart: { ...config.chart, smooth: checked },
            })
          }
        />
        <div className="flex flex-col gap-3">
          <span className="text-sm text-slate-600">Visible series by default</span>
          {CHART_SERIES.map((series) => (
            <ToggleField
              key={series.key}
              label={series.name}
              checked={config.chart.visibleSeries.includes(series.key)}
              onChange={(checked) =>
                setConfig({
                  ...config,
                  chart: {
                    ...config.chart,
                    visibleSeries: toggleVisibleSeries(
                      config.chart.visibleSeries,
                      series.key,
                      checked,
                    ),
                  },
                })
              }
            />
          ))}
        </div>
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
