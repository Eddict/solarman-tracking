import { useState } from 'react'
import { ChevronLeft, ChevronRight, CloudUpload, HardDriveDownload } from 'lucide-react'

import { ArchiveCalendar } from '@/features/archive/components/archive-calendar'
import {
  exportArchiveDays,
  hydrateArchiveDays,
} from '@/features/archive/server/archive-api'
import type {
  ArchiveDayState,
  ArchiveMonthSummary,
  ArchiveRun,
} from '@/features/archive/types'
import type { AppConfig } from '@/lib/config/schema'

type ArchivePanelProps = {
  config: AppConfig
  summary: ArchiveMonthSummary
  runs: ArchiveRun[]
  onStatusChange: (summary: ArchiveMonthSummary, runs: ArchiveRun[]) => void
  onMonthChange: (year: number, month: number) => Promise<void>
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export function ArchivePanel({
  config,
  summary,
  runs,
  onStatusChange,
  onMonthChange,
}: ArchivePanelProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [pendingHydrateDays, setPendingHydrateDays] = useState<string[] | null>(null)

  const actionsEnabled = config.archive.enabled && summary.s3Configured

  function toggleDay(date: string) {
    setPendingHydrateDays(null)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(date)) {
        next.delete(date)
      } else {
        next.add(date)
      }
      return next
    })
  }

  async function shiftMonth(delta: number) {
    setIsBusy(true)
    setMessage(null)

    try {
      let year = summary.year
      let nextMonth = summary.month + delta

      if (nextMonth < 1) {
        nextMonth = 12
        year -= 1
      }

      if (nextMonth > 12) {
        nextMonth = 1
        year += 1
      }

      await onMonthChange(year, nextMonth)
      setSelected(new Set())
      setPendingHydrateDays(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to change month')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleExport(days: string[]) {
    if (days.length === 0) {
      setMessage('No days to export.')
      return
    }

    if (!actionsEnabled) {
      setMessage('Enable archive and configure Cubbit credentials.')
      return
    }

    setIsBusy(true)
    setMessage(null)
    setPendingHydrateDays(null)

    try {
      const result = await exportArchiveDays({
        data: { days, year: summary.year, month: summary.month },
      })
      onStatusChange(result.summary as ArchiveMonthSummary, result.runs as ArchiveRun[])
      setSelected(new Set())
      setMessage(
        `Exported ${result.result.daysProcessed} days (${result.result.rowsAffected} samples).`,
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Export failed')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleHydrate(days: string[]) {
    const sortedDays = [...days].sort()

    if (sortedDays.length === 0) {
      setMessage('No days to restore.')
      return
    }

    if (!actionsEnabled) {
      setMessage('Enable archive and configure Cubbit credentials.')
      return
    }

    const hasLocal = summary.days.some(
      (day) => sortedDays.includes(day.date) && day.localCount > 0,
    )
    const pendingMatches =
      pendingHydrateDays !== null &&
      pendingHydrateDays.length === sortedDays.length &&
      pendingHydrateDays.every((day, index) => day === sortedDays[index])

    if (hasLocal && !pendingMatches) {
      setPendingHydrateDays(sortedDays)
      setMessage('Confirm: the selected local days will be overwritten from S3.')
      return
    }

    setIsBusy(true)
    setMessage(null)
    setPendingHydrateDays(null)

    try {
      const result = await hydrateArchiveDays({
        data: { days: sortedDays, year: summary.year, month: summary.month },
      })
      onStatusChange(result.summary as ArchiveMonthSummary, result.runs as ArchiveRun[])
      setSelected(new Set())
      setMessage(
        `Restored ${result.result.daysProcessed} days (${result.result.rowsAffected} lines).`,
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Restore failed')
    } finally {
      setIsBusy(false)
    }
  }

  function daysForMonthAction(states: ArchiveDayState[]) {
    return summary.days.filter((day) => states.includes(day.state)).map((day) => day.date)
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Archive calendar</h2>
            <p className="text-sm text-slate-500">
              Station {summary.stationId} · local vs S3 status
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => shiftMonth(-1)}
              className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 disabled:opacity-50"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="min-w-40 text-center font-medium text-slate-800">
              {MONTH_NAMES[summary.month - 1]} {summary.year}
            </div>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => shiftMonth(1)}
              className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 disabled:opacity-50"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <StatusStrip summary={summary} />

        <ArchiveCalendar
          year={summary.year}
          month={summary.month}
          days={summary.days}
          selected={selected}
          onToggle={toggleDay}
          onClearSelection={() => {
            setSelected(new Set())
            setPendingHydrateDays(null)
          }}
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={isBusy || selected.size === 0}
            onClick={() => handleExport([...selected].sort())}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 font-medium text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CloudUpload className="h-4 w-4" />
            Upload to S3
          </button>
          <button
            type="button"
            disabled={isBusy || selected.size === 0}
            onClick={() => handleHydrate([...selected].sort())}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <HardDriveDownload className="h-4 w-4" />
            {pendingHydrateDays ? 'Confirm restore' : 'Restore from S3'}
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() =>
              handleExport(daysForMonthAction(['localOnly', 'partial', 'mismatch']))
            }
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Export month
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() =>
              handleHydrate(daysForMonthAction(['s3Only', 'mismatch', 'partial']))
            }
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Restore month
          </button>
        </div>
        {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
        {!config.archive.enabled ? (
          <p className="mt-3 text-sm text-amber-700">
            Archive disabled: enable the switch in the policy above.
          </p>
        ) : null}
        {config.archive.enabled && !summary.s3Configured ? (
          <p className="mt-3 text-sm text-amber-700">
            Cubbit credentials missing (`CUBBIT_ACCESS_KEY_ID` / `CUBBIT_SECRET_ACCESS_KEY`).
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Recent operations</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-slate-500">No operations recorded.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {runs.map((run) => (
              <li
                key={run.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <div>
                  <span className="font-medium text-slate-800">
                    {run.direction === 'export' ? 'Export' : 'Hydrate'}
                  </span>
                  <span className="text-slate-500">
                    {' '}
                    {run.dayFrom} → {run.dayTo} · {run.daysCount} days · {run.rowsAffected}{' '}
                    lines
                  </span>
                  {run.errorMessage ? (
                    <div className="text-xs text-rose-600">{run.errorMessage}</div>
                  ) : null}
                </div>
                <div className="text-xs text-slate-500">
                  {run.status} · {new Date(run.createdAt).toLocaleString('it-IT')}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function StatusStrip({ summary }: { summary: ArchiveMonthSummary }) {
  return (
    <div className="mb-4 grid gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        S3:{' '}
        {!summary.s3Configured
          ? 'not configured'
          : summary.s3Reachable
            ? 'reachable'
            : `error${summary.s3Error ? ` (${summary.s3Error})` : ''}`}
      </div>
      <div>Synced: {summary.counts.synced}</div>
      <div>Local only: {summary.counts.localOnly}</div>
      <div>
        S3 only / mismatch: {summary.counts.s3Only} / {summary.counts.mismatch}
      </div>
    </div>
  )
}
