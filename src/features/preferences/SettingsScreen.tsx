import { Search } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { usePreferences } from '@/app/providers/PreferencesProvider'
import { useSession } from '@/app/providers/SessionProvider'
import { useSpace } from '@/app/providers/SpaceProvider'
import { LANGUAGES, useLanguage, writeLanguage } from '@/shared/i18n'
import {
  type MotionPref,
  readMotionPref,
  systemReducesMotion,
  writeMotionPref,
} from '@/shared/motion/motionPref'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
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

/** Language of the system texts (category and entry names the server sends in English). This device only. */
function LanguageSetting() {
  const lang = useLanguage()
  return (
    <div className="flex flex-col gap-3 px-4 py-3" data-testid="language-setting">
      <span>Language</span>
      <SegmentedControl
        aria-label="Language"
        value={lang}
        onValueChange={writeLanguage}
        options={LANGUAGES.map((l) => ({ value: l.value, label: l.label }))}
      />
    </div>
  )
}

interface SettingsItem {
  id: string
  /** What the search matches (case-insensitive). */
  label: string
  node: ReactNode
}
interface SettingsSection {
  id: string
  title: string
  items: SettingsItem[]
}

/** Sections that have at least one row matching the search. A section with no match disappears. */
export function filterSections(sections: readonly SettingsSection[], query: string) {
  const q = query.trim().toLowerCase()
  return sections
    .map((s) => ({
      ...s,
      items: q ? s.items.filter((i) => i.label.toLowerCase().includes(q)) : s.items,
    }))
    .filter((s) => s.items.length > 0)
}

export function SettingsScreen() {
  const { logout } = useSession()
  const { preferences, update } = usePreferences()
  const { space } = useSpace()
  const [query, setQuery] = useState('')

  const sections: SettingsSection[] = [
    {
      id: 'account',
      title: 'Account',
      items: [
        {
          id: 'profile',
          label: 'Profile',
          node: <SettingsRow label="Profile" to="/settings/profile" />,
        },
        { id: 'space', label: 'Space', node: <SettingsRow label="Space" to="/settings/space" /> },
        {
          id: 'lock',
          label: 'App lock',
          node: (
            <SettingsRow
              label="App lock"
              to="/settings/security"
              value={preferences.appLockEnabled ? 'On' : 'Off'}
            />
          ),
        },
      ],
    },
    {
      id: 'money',
      title: 'Money setup',
      items: [
        {
          id: 'categories',
          label: 'Categories',
          node: (
            <SettingsRow
              label="Categories"
              to="/s/$spaceId/categories"
              params={{ spaceId: space.id }}
            />
          ),
        },
        {
          id: 'goals',
          label: 'Goals',
          node: <SettingsRow label="Goals" to="/s/$spaceId/goals" params={{ spaceId: space.id }} />,
        },
        {
          id: 'currency',
          label: 'Currency',
          node: <SettingsRow label="Currency" to="/settings/currency" />,
        },
      ],
    },
    {
      id: 'app',
      title: 'On this device',
      items: [
        {
          id: 'hide',
          label: 'Hide amounts',
          node: (
            <SettingsRow label="Hide amounts">
              <Switch
                aria-label="Hide amounts"
                checked={preferences.hideAmounts}
                onCheckedChange={(hideAmounts) => update({ hideAmounts })}
              />
            </SettingsRow>
          ),
        },
        { id: 'language', label: 'Language', node: <LanguageSetting /> },
        { id: 'motion', label: 'Animations', node: <MotionSetting /> },
        {
          id: 'keyboard',
          label: 'Keyboard',
          node: (
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
          ),
        },
      ],
    },
  ]
  const shown = filterSections(sections, query)

  return (
    <Page width="wide" gap={6}>
      <PageHeader title="Settings" />
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-label-tertiary"
        />
        <Input
          type="search"
          aria-label="Search settings"
          placeholder="Search settings"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>
      {shown.length === 0 ? (
        <p role="status" className="py-6 text-center text-sm text-label-secondary">
          No settings match "{query.trim()}".
        </p>
      ) : (
        <SettingsGrid>
          {/* One scroll: sections are headings, not collapsibles. Two columns from 1024px. */}
          {[0, 1].map((col) => (
            <SettingsCol key={col}>
              {shown
                .filter((_, i) => i % 2 === col)
                .map((section) => (
                  <section
                    key={section.id}
                    aria-labelledby={`settings-${section.id}`}
                    className="flex flex-col gap-2"
                  >
                    <h2
                      id={`settings-${section.id}`}
                      className="px-1 text-sm font-semibold tracking-wide text-label-secondary uppercase"
                    >
                      {section.title}
                    </h2>
                    <SettingsGroup>
                      {section.items.map((item) => (
                        <div key={item.id}>{item.node}</div>
                      ))}
                    </SettingsGroup>
                  </section>
                ))}
            </SettingsCol>
          ))}
        </SettingsGrid>
      )}
      <Button variant="secondary" block onClick={() => void logout()}>
        Sign out
      </Button>
      <p className="text-center text-sm text-label-tertiary">HZZT v{__APP_VERSION__}</p>
    </Page>
  )
}
