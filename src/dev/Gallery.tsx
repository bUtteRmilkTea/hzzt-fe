import { useState } from 'react'
import { useTheme } from '@/app/providers/ThemeProvider'
import { LineChart } from '@/shared/charts'
import { Amount } from '@/shared/ui/Amount'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Chip } from '@/shared/ui/Chip'
import { Collapsible } from '@/shared/ui/Collapsible'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { MoneyInput } from '@/shared/ui/MoneyInput'
import { usePrivacy } from '@/shared/ui/privacy'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'
import { Select } from '@/shared/ui/Select'
import { SheetShell } from '@/shared/ui/SheetShell'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Switch } from '@/shared/ui/Switch'
import { useToast } from '@/shared/ui/Toast'
import { TwoColumn } from '@/shared/ui/TwoColumn'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = `g-${title.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-sm font-semibold tracking-wide text-label-secondary uppercase">
        {title}
      </h2>
      {children}
    </section>
  )
}

export function Gallery() {
  const { theme, setTheme } = useTheme()
  const { hideAmounts, setHideAmounts } = usePrivacy()
  const toast = useToast()
  const [sheet, setSheet] = useState(false)
  const [seg, setSeg] = useState<'expense' | 'income' | 'transfer'>('expense')
  const [chip, setChip] = useState(false)
  const [on, setOn] = useState(true)
  const [calc, setCalc] = useState('')
  const [num, setNum] = useState('')
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <h1 className="text-xl font-semibold">Component gallery</h1>

      <Section title="Theme">
        <SegmentedControl
          aria-label="Theme"
          value={theme}
          onValueChange={setTheme}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Amounts">
        <Card className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span>Hide amounts</span>
            <Switch
              aria-label="Hide amounts"
              checked={hideAmounts}
              onCheckedChange={setHideAmounts}
            />
          </div>
          <div className="text-2xl font-semibold">
            <Amount value="1234567.5" currency="IDR" animate />
          </div>
          <Amount value="-42.1" currency="USD" tone="auto" signDisplay="always" />
          <Amount value="1250.005" currency="USD" tone="auto" signDisplay="always" />
          <Amount value="19.99" currency="USD" tone="expense" signDisplay="always" />
          <Amount value="1500000" currency="JPY" />
          <Amount value="0.123456" currency="KWD" />
        </Card>
      </Section>

      <Section title="Trend charts">
        <Card className="flex flex-col gap-4">
          <LineChart
            label="Up trend"
            currency="USD"
            data={[
              { date: '2026-11-01', value: '100' },
              { date: '2026-11-02', value: '120' },
              { date: '2026-11-03', value: '150' },
            ]}
          />
          <LineChart
            label="Down trend"
            currency="USD"
            data={[
              { date: '2026-11-01', value: '150' },
              { date: '2026-11-02', value: '120' },
              { date: '2026-11-03', value: '100' },
            ]}
          />
        </Card>
      </Section>

      <Section title="Form controls">
        <Field label="Name" hint="Shown on your cards">
          <Input placeholder="Wallet name" />
        </Field>
        <Field label="With error" error="This field is required">
          <Input defaultValue="" />
        </Field>
        <Field label="Currency">
          <Select defaultValue="IDR">
            <option value="IDR">IDR</option>
            <option value="USD">USD</option>
          </Select>
        </Field>
        <div className="flex items-center justify-between">
          <span>Notifications</span>
          <Switch aria-label="Notifications" checked={on} onCheckedChange={setOn} />
        </div>
        <SegmentedControl
          aria-label="Transaction type"
          value={seg}
          onValueChange={setSeg}
          options={[
            { value: 'expense', label: 'Expense' },
            { value: 'income', label: 'Income' },
            { value: 'transfer', label: 'Transfer' },
          ]}
        />
        <div className="flex gap-2">
          <Chip selected={chip} onClick={() => setChip((c) => !c)}>
            Food
          </Chip>
          <Chip>Transport</Chip>
        </div>
      </Section>

      <Section title="Money input">
        <Field label="Amount (calculator)">
          <MoneyInput value={calc} onChange={setCalc} currency="USD" />
        </Field>
        <p data-testid="calc-value" className="tabular text-sm text-label-secondary">
          Value: {calc || '—'}
        </p>
        <Field label="Amount (numeric)">
          <MoneyInput mode="numeric" value={num} onChange={setNum} currency="IDR" />
        </Field>
      </Section>

      <Section title="States">
        <Card className="flex flex-col gap-2">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-8 w-3/4" />
        </Card>
        <EmptyState
          title="No goals yet"
          description="Set a target and track your progress."
          action={<Button>Add goal</Button>}
        />
      </Section>

      <Section title="Overlays">
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setSheet(true)}>Open sheet</Button>
          <Button variant="secondary" onClick={() => toast.show('Saved', 'success')}>
            Show toast
          </Button>
          <Button variant="secondary" onClick={() => toast.show('Something failed', 'error')}>
            Show error toast
          </Button>
        </div>
      </Section>

      <Section title="Two columns">
        <TwoColumn
          data-testid="two-column"
          left={
            <Card data-testid="col-left-card">
              <h3 className="font-semibold">Cash</h3>
              <Amount value="1250.5" currency="USD" />
            </Card>
          }
          right={
            <Card>
              <h3 className="font-semibold">Investments</h3>
              <Button
                variant="secondary"
                aria-expanded={expanded}
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? 'Collapse' : 'Expand'}
              </Button>
              <Collapsible open={expanded} data-testid="collapsible">
                <ul className="flex flex-col gap-2 pt-2">
                  {['Bybit', 'Ajaib', 'Stockbit', 'Binance', 'Pluang'].map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </Collapsible>
            </Card>
          }
        />
      </Section>

      <SheetShell
        open={sheet}
        onOpenChange={setSheet}
        title="Example sheet"
        description="Drag the grabber to dismiss on touch."
        footer={
          <Button block onClick={() => setSheet(false)}>
            Confirm
          </Button>
        }
      >
        <Field label="Note">
          <Input placeholder="Optional" />
        </Field>
      </SheetShell>
    </div>
  )
}
