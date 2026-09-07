"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { shopConfig } from "@/lib/config/shop";

interface ConditionsDialogProps {
  open: boolean;
  onAccept: () => void;
}

/**
 * Condiciones del pedido, centradas en pantalla.
 *
 * Solo se cierra aceptando: sin botón de cerrar, sin clic afuera y sin Escape,
 * para que nadie encargue sin haberlas leído.
 */
export function ConditionsDialog({ open, onAccept }: ConditionsDialogProps) {
  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-md gap-5 rounded-3xl [&>button]:hidden"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="space-y-2 text-left">
          <DialogTitle className="font-display text-2xl">
            Condiciones del pedido
          </DialogTitle>
          <DialogDescription>
            Antes de elegir la fecha de entrega, leé cómo tomamos los encargos.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3">
          {shopConfig.deliveryNotes.map((note) => (
            <li key={note} className="flex gap-2.5 text-sm leading-relaxed">
              <span
                aria-hidden
                className="mt-[0.45rem] size-1.5 shrink-0 rounded-full bg-primary"
              />
              <span>{note}</span>
            </li>
          ))}
        </ul>

        <div>
          <Button
            className="h-11 w-full rounded-full text-base"
            onClick={onAccept}
          >
            Acepto estas condiciones
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
