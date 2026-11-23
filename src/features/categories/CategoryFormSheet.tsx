import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { useSpace } from '@/app/providers/SpaceProvider'
import { applyServerError } from '@/features/auth/useServerErrors'
import type { CategoryDTO, CategoryType } from '@/shared/api/categories'
import { api } from '@/shared/api/client'
import { AppError, errorMessage, toAppError } from '@/shared/api/errors'
import { Decimal, parseInput } from '@/shared/money'
import { Button } from '@/shared/ui/Button'
import { Chip } from '@/shared/ui/Chip'
import { ColorPicker } from '@/shared/ui/ColorPicker'
import { defaultCategoryIcon } from '@/shared/ui/categoryIcons'
import { EmojiPicker } from '@/shared/ui/EmojiPicker'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { MoneyInput } from '@/shared/ui/MoneyInput'
import { PALETTE } from '@/shared/ui/palette'
import { SheetShell } from '@/shared/ui/SheetShell'
import { useToast } from '@/shared/ui/Toast'
import { useInvalidateCategories, useSuggestions } from './hooks'

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(120, 'Use at most 120 characters'),
  icon: z.string().min(1, 'Choose an icon'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #4480EE'),
  budget: z
    .string()
    .refine(
      (v) => v === '' || (/^\d+(\.\d+)?$/.test(v) && new Decimal(v).greaterThan(0)),
      'Enter an amount greater than zero',
    ),
})
type Values = z.infer<typeof schema>

interface CategoryFormSheetProps {
  /** Type of a new category, or the fixed type of the one being edited. */
  type: CategoryType
  /** Present when editing. */
  category?: CategoryDTO
  onClose: () => void
}

export function CategoryFormSheet({ type, category, onClose }: CategoryFormSheetProps) {
  const { space } = useSpace()
  const toast = useToast()
  const invalidate = useInvalidateCategories(space.id)
  const suggestions = useSuggestions(type)
  const editing = Boolean(category)
  // Only expense categories have a budget, so BUDGET_NOT_ALLOWED can't be triggered from here.
  const hasBudget = type === 'EXPENSE'
  const [formError, setFormError] = useState<string | null>(null)
  // The default icon follows the name until the user picks one themselves.
  const [iconTouched, setIconTouched] = useState(false)
  // A category with the same meaning exists (Gaji and Salary): ask before creating a twin.
  const [similar, setSimilar] = useState<{ name: string; values: Values } | null>(null)

  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: category?.name ?? '',
      icon: category?.icon ?? '🏷️',
      color: category?.color ?? PALETTE[0],
      budget: category?.budgetAmount ?? '',
    },
  })

  const nameValue = useWatch({ control, name: 'name' })
  useEffect(() => {
    if (!editing && !iconTouched) setValue('icon', defaultCategoryIcon(nameValue ?? ''))
  }, [nameValue, editing, iconTouched, setValue])

  const save = useMutation({
    mutationFn: async ({ v, force }: { v: Values; force?: boolean }) => {
      const query = force ? { force: true } : {}
      const budget = hasBudget && v.budget ? parseInput(v.budget, space.baseCurrency) : null
      if (!category) {
        return (
          await api.POST('/spaces/{spaceId}/categories', {
            params: { path: { spaceId: space.id }, query },
            body: {
              type,
              name: v.name,
              icon: v.icon,
              color: v.color,
              ...(budget ? { budgetAmount: budget } : {}),
            },
          })
        ).data
      }
      // `budgetAmount: null` clears a budget (backend contract); the generated type only allows a string.
      const clearing = hasBudget && !budget && Boolean(category.budgetAmount)
      const budgetField = hasBudget
        ? budget
          ? { budgetAmount: budget }
          : clearing
            ? { budgetAmount: null as unknown as string }
            : {}
        : {}
      return (
        await api.PATCH('/spaces/{spaceId}/categories/{id}', {
          params: { path: { spaceId: space.id, id: category.id as string }, query },
          body: { name: v.name, icon: v.icon, color: v.color, ...budgetField },
        })
      ).data
    },
    meta: { silent: true },
    onSuccess: async () => {
      await invalidate()
      toast.show(editing ? 'Category saved' : 'Category added', 'success')
      onClose()
    },
    onError: (err, vars) => {
      const e = toAppError(err)
      if (e.code === 'CATEGORY_EXISTS_SIMILAR') {
        const existing = e.details.existingName
        setSimilar({ name: typeof existing === 'string' ? existing : 'one', values: vars.v })
        return
      }
      if (e.code === 'CATEGORY_NAME_TAKEN') {
        // A duplicate name belongs on the name field, not in a banner.
        setError('name', {
          type: 'server',
          message: errorMessage(new AppError({ code: e.code, message: '', status: e.status })),
        })
        return
      }
      setFormError(applyServerError(err, setError, ['name', 'icon', 'color']))
    },
  })

  const names = (suggestions.data ?? []).filter(Boolean)

  return (
    <SheetShell
      open
      onOpenChange={(o) => !o && onClose()}
      title={
        editing ? 'Edit category' : `New ${type === 'EXPENSE' ? 'expense' : 'income'} category`
      }
      footer={
        <Button
          block
          disabled={save.isPending}
          onClick={handleSubmit((v) => {
            setFormError(null)
            setSimilar(null)
            save.mutate({ v })
          })}
        >
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      }
    >
      <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
        {formError ? (
          <p role="alert" className="text-sm text-negative">
            {formError}
          </p>
        ) : null}

        {similar ? (
          <div
            role="alert"
            data-testid="similar-category"
            className="flex flex-col gap-3 rounded-lg border border-warning px-4 py-3 text-sm"
          >
            <p>
              A category with the same meaning already exists: <strong>{similar.name}</strong>.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  toast.show(`Using ${similar.name}`, 'success')
                  onClose()
                }}
              >
                Use existing
              </Button>
              <Button
                size="sm"
                disabled={save.isPending}
                onClick={() => {
                  setSimilar(null)
                  save.mutate({ v: similar.values, force: true })
                }}
              >
                Create anyway
              </Button>
            </div>
          </div>
        ) : null}

        {!editing && names.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-label-secondary">Suggestions</p>
            <div className="flex flex-wrap gap-2">
              {names.map((n) => (
                <Chip key={n} onClick={() => setValue('name', n, { shouldValidate: true })}>
                  {n}
                </Chip>
              ))}
            </div>
          </div>
        ) : null}

        <Field label="Name" error={errors.name?.message}>
          <Input maxLength={120} {...register('name')} />
        </Field>

        <Controller
          control={control}
          name="icon"
          render={({ field }) => (
            <EmojiPicker
              label="Icon"
              value={field.value}
              onChange={(v) => {
                setIconTouched(true)
                field.onChange(v)
              }}
            />
          )}
        />
        <Controller
          control={control}
          name="color"
          render={({ field }) => (
            <ColorPicker label="Colour" value={field.value} onChange={field.onChange} />
          )}
        />

        {hasBudget ? (
          <Controller
            control={control}
            name="budget"
            render={({ field }) => (
              <Field
                label="Monthly budget (optional)"
                hint={`In ${space.baseCurrency}. Leave empty for no budget.`}
                error={errors.budget?.message}
              >
                <MoneyInput
                  value={field.value}
                  onChange={field.onChange}
                  currency={space.baseCurrency}
                />
              </Field>
            )}
          />
        ) : null}
      </form>
    </SheetShell>
  )
}
