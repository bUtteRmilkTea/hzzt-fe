import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { cn } from './cn'

interface SortableListProps {
  /** Item ids in their current order. */
  ids: readonly string[]
  /** Called on drop (or a keyboard move) with the old and the new index. */
  onReorder: (from: number, to: number) => void
  /** `grid` for cards in rows and columns, `list` for one column. */
  layout?: 'grid' | 'list'
  className?: string
  children: ReactNode
}

/**
 * Drag-and-drop reordering. Items drag only by their grip handle (see `SortableItem`), so links
 * and buttons inside an item keep working. Pointer (mouse and touch), and keyboard
 * (Space to lift, arrows to move, Space to drop) are supported, with dnd-kit's live announcements.
 */
export function SortableList({
  ids,
  onReorder,
  layout = 'list',
  className,
  children,
}: SortableListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from >= 0 && to >= 0) onReorder(from, to)
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext
        items={[...ids]}
        strategy={layout === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}
      >
        <ul className={className}>{children}</ul>
      </SortableContext>
    </DndContext>
  )
}

const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

interface SortableItemProps {
  id: string
  /** Accessible name of the handle, e.g. "Reorder BCA". */
  label: string
  className?: string
  'data-testid'?: string
  style?: CSSProperties
  children: ReactNode
}

/** One draggable `<li>` with a grip handle at its top left. */
export function SortableItem({
  id,
  label,
  className,
  children,
  style,
  ...rest
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })
  return (
    <li
      ref={setNodeRef}
      data-testid={rest['data-testid']}
      data-dragging={isDragging || undefined}
      style={{
        ...style,
        transform: CSS.Transform.toString(transform),
        transition: reducedMotion() ? undefined : transition,
      }}
      className={cn('relative', isDragging && 'z-10 opacity-90 shadow-sheet', className)}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        aria-label={label}
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 z-10 inline-flex size-9 touch-none cursor-grab items-center justify-center rounded-full bg-surface-1/80 text-label-secondary shadow-card active:cursor-grabbing"
      >
        <GripVertical aria-hidden className="size-5" />
      </button>
      {children}
    </li>
  )
}
