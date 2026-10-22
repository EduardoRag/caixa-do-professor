import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { competenceLabel, shiftCompetence } from "@/lib/finance";

export function CompetencePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" size="icon" aria-label="Mês anterior" onClick={() => onChange(shiftCompetence(value, -1))}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-36 text-center font-display font-semibold capitalize">{competenceLabel(value)}</span>
      <Button variant="secondary" size="icon" aria-label="Próximo mês" onClick={() => onChange(shiftCompetence(value, 1))}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

