import { X } from 'lucide-react'
import { SurveyStationsTable } from '@/components/trajectory/SurveyStationsTable'
import type { SurveyRow } from '@/components/trajectory/survey-columns'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  kop: number | null
  rows: SurveyRow[]
  onDeleteRow?: (index: number) => void
}

export function SurveyDrawer({ open, onOpenChange, kop, rows, onDeleteRow }: Props) {
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      swipeDirection="right"
      modal={false}
      disablePointerDismissal
    >
      <DrawerContent className="[--drawer-inset:1rem] data-[swipe-axis=x]:h-auto data-[swipe-axis=x]:sm:[--drawer-content-width:32rem]">
        <DrawerHeader className="relative">
          <DrawerClose
            render={(props) => (
              <Button
                {...props}
                type="button"
                variant="outline"
                size="icon"
                className="absolute top-3 right-3 size-8"
                aria-label="Close survey table"
              >
                <X className="size-4" />
              </Button>
            )}
          />
          <DrawerTitle>Survey Stations</DrawerTitle>
          <DrawerDescription>
            Summary of trajectory survey data.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-4">
          <SurveyStationsTable rows={rows} kop={kop} onDelete={onDeleteRow} />
        </div>
      </DrawerContent>
    </Drawer>
  )
}
