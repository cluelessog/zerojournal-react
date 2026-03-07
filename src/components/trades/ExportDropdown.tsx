import { Download, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ExportDropdownProps {
  onExportTradesCSV: () => void
  onExportPnLCSV: () => void
}

export function ExportDropdown({ onExportTradesCSV, onExportPnLCSV }: ExportDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="size-4 mr-1" />
          Export
          <ChevronDown className="size-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onExportTradesCSV}>
          Export Trades CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportPnLCSV}>
          Export P&L CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
