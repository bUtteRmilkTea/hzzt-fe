import { useState } from 'react'
import { usePreferences } from '@/app/providers/PreferencesProvider'
import { useSession } from '@/app/providers/SessionProvider'
import { useSpace } from '@/app/providers/SpaceProvider'
import {
  type MotionPref,
  readMotionPref,
  systemReducesMotion,
  writeMotionPref,
} from '@/shared/motion/motionPref'
import { Button } from '@/shared/ui/Button'
import { Page } from '@/shared/ui/Page'
import { PageHeader } from '@/shared/ui/PageHeader'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'
import { SettingsCol, SettingsGrid } from '@/shared/ui/SettingsGrid'
import { SettingsGroup, SettingsRow } from '@/shared/ui/SettingsRow'
import { Switch } from '@/shared/ui/Switch'

/** Shows whether the OS is silencing animations, and lets the user play them anyway (this device only). */
function MotionSetting() {
  const [pref, setPref] = useState<MotionPref>(readMotionPref)
  const osReduces = systemReducesMotion()
  return (
    <div className="flex flex-col gap-3 px-4 py-3" data-testid="motion-setting">
      <span>Animations</span>
      <SegmentedControl
        aria-label="Animations"
        value={pref}
        onValueChange={(v) => {
          setPref(v)
          writeMotionPref(v)
        }}
        options={[
          { value: 'system', label: 'Follow system' },
          { value: 'on', label: 'Always play' },
        ]}
      />
      <p className="text-sm text-label-secondary" data-testid="motion-status">
        {osReduces
          ? pref === 'on'
            ? 'Your system asks for reduced motion, but animations are playing because you chose Always play.'
            : 'Your system asks for reduced motion, so animations are off. Choose Always play to see them.'
          : 'Animations are on.'}
      </p>
    </div>
  )
}

export function SettingsScreen() {
  const { logout } = useSession()
  const { preferences, update } = usePreferences()
  const { space } = useSpace()
  return (
    <Page width="wide" gap={6}>
      <PageHeader title="Settings" />
      <SettingsGrid>
        <SettingsCol>
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
        </SettingsCol>
        <SettingsCol>
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
            <MotionSetting />
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
          <Button variant="secondary" block onClick={() => void logout()}>
            Sign out
          </Button>
        </SettingsCol>
      </SettingsGrid>
      <p className="text-center text-sm text-label-tertiary">HZZT v{__APP_VERSION__}</p>
    </Page>
  )
}
