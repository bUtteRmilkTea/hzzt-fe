import { usePreferences } from '@/app/providers/PreferencesProvider'
import { useSpace } from '@/app/providers/SpaceProvider'
import { Page } from '@/shared/ui/Page'
import { PageHeader } from '@/shared/ui/PageHeader'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'
import { SettingsGroup, SettingsRow } from '@/shared/ui/SettingsRow'
import { Switch } from '@/shared/ui/Switch'

export function SettingsScreen() {
  const { preferences, update } = usePreferences()
  const { space } = useSpace()
  return (
    <Page width="form" gap={6}>
      <PageHeader title="Settings" />
      <SettingsGroup>
        <SettingsRow label="Profile" to="/settings/profile" />
        <SettingsRow label="Space" to="/settings/space" />
        <SettingsRow
          label="Categories"
          to="/s/$spaceId/categories"
          params={{ spaceId: space.id }}
        />
        <SettingsRow label="Goals" to="/s/$spaceId/goals" params={{ spaceId: space.id }} />
        <SettingsRow label="Currency" to="/settings/currency" />
      </SettingsGroup>
      <SettingsGroup>
        <SettingsRow
          label="App lock"
          to="/settings/security"
          value={preferences.appLockEnabled ? 'On' : 'Off'}
        />
        <SettingsRow label="Hide amounts">
          <Switch
            aria-label="Hide amounts"
            checked={preferences.hideAmounts}
            onCheckedChange={(hideAmounts) => update({ hideAmounts })}
          />
        </SettingsRow>
        <div className="flex flex-col gap-3 px-4 py-3">
          <span>Keyboard</span>
          <SegmentedControl
            aria-label="Keyboard type"
            value={preferences.keyboardType}
            onValueChange={(keyboardType) => update({ keyboardType })}
            options={[
              { value: 'MINI_CALCULATOR', label: 'Mini calculator' },
              { value: 'STANDARD_NUMERIC', label: 'Standard' },
            ]}
          />
        </div>
      </SettingsGroup>
      <p className="text-center text-sm text-label-tertiary">HZZT v{__APP_VERSION__}</p>
    </Page>
  )
}
