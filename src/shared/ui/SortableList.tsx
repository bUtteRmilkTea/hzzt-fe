import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  type DropAnimation,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  rectSortingStrategy,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { type CSSProperties, type ReactNode, useRef, useState } from 'react'
import { cn } from './cn'

/** Reduced motion wins, unless the user chose "Always play" in Settings (same rule as the CSS). */
const motionReduced = () => {
  try {
    return (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
      document.documentElement.getAttribute('data-motion') !== 'on'
    )
  } catch {
    return false
  }
}

const DROP: DropAnimation = {
  duration: 220,
  easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
}

interface SortableListProps {
  /** Item ids in their current order. */
  ids: readonly string[]
  /** Called on drop with the old and the new index. */
  onReorder: (from: number, to: number) => void
  /** `grid` for cards in rows and columns, `list` for one column. */
  layout?: 'grid' | 'list'
  /** The lifted copy that follows the pointer. It should look like the item. */
  renderOverlay: (id: string) => ReactNode
  className?: string
  children: ReactNode
}

/**
 * Drag-and-drop reordering where the whole item is the handle. Mouse drags after 4px; touch needs
 * a 200ms press and hold, so a normal swipe still scrolls the page. A lifted copy follows the
 * pointer (scaled, shadowed), the others slide out of the way, and the drop settles. Keyboard
 * users reorder with buttons the caller renders. A click that follows a drop is swallowed, so
 * dropping a link never opens it.
 */
export function SortableList({
  ids,
  onReorder,
  layout = 'list',
  renderOverlay,
  className,
  children,
}: SortableListProps) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )
  const [activeId, setActiveId] = useState<string | null>(null)
  const swallow = useRef(false)
  const done = () => {
    setActiveId(null)
    swallow.current = true
    setTimeout(() => {
      swallow.current = false
    }, 200)
  }
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    done()
    if (!over || active.id === over.id) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from >= 0 && to >= 0) onReorder(from, to)
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={({ active }: DragStartEvent) => setActiveId(String(active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={done}
    >
      <SortableContext
        items={[...ids]}
        strategy={layout === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}
      >
        <ul
          className={className}
          onClickCapture={(e) => {
            if (swallow.current) {
              e.preventDefault()
              e.stopPropagation()
            }
          }}
        >
          {children}
        </ul>
      </SortableContext>
      <DragOverlay dropAnimation={motionReduced() ? null : DROP}>
        {activeId ? (
          <div
            data-testid="drag-overlay"
            className={cn(
              'cursor-grabbing rounded-lg shadow-sheet',
              !motionReduced() && 'scale-[1.03] rotate-[0.5deg]',
            )}
          >
            {renderOverlay(activeId)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

interface SortableItemProps {
  id: string
  className?: string
  'data-testid'?: string
  style?: CSSProperties
  children: ReactNode
}

/** One `<li>` that drags from anywhere. Its slot dims while the lifted copy is in the air. */
export function SortableItem({ id, className, children, style, ...rest }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })
  // dnd-kit's `role="button"` and tab stop would hide the card's own link, so only keep the rest.
  const { role: _role, tabIndex: _tab, ...aria } = attributes
  return (
    <li
      ref={setNodeRef}
      data-testid={rest['data-testid']}
      data-dragging={isDragging || undefined}
      {...aria}
      {...listeners}
      style={{
        ...style,
        transform: CSS.Transform.toString(transform),
        transition: motionReduced() ? undefined : transition,
        touchAction: 'manipulation',
      }}
      className={cn(
        'relative cursor-grab select-none [-webkit-user-drag:none] active:cursor-grabbing',
        isDragging && 'opacity-40',
        className,
      )}
    >
      {children}
    </li>
  )
}
