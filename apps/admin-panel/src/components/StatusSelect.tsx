import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { STATUSES, type Status } from "@servicebook/schemas";
import { useChangeStatusMutation } from "@/lib/services";
import { STATUS_LABELS } from "@/lib/statuses";
import { StatusBadge } from "./StatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

type StatusSelectProps = {
  serviceId: string;
  status: Status;
};

/**
 * A service's status badge that opens a menu of the statuses; picking one
 * saves it at once. While it saves, the badge already shows the new status.
 */
export function StatusSelect({ serviceId, status }: StatusSelectProps) {
  const { t } = useTranslation();
  const changeStatus = useChangeStatusMutation();
  const shown = changeStatus.isPending ? changeStatus.variables.status : status;

  return (
    // Rows and cards open the service on click; choosing a status must not.
    <span className="inline-flex" onClick={(event) => event.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex items-center gap-0.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={`${t(STATUS_LABELS[shown])} – ${t("Change status")}`}
        >
          <StatusBadge status={shown} className="pr-1.5">
            <ChevronDown className="ml-0.5 h-3 w-3" aria-hidden />
          </StatusBadge>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup
            value={shown}
            onValueChange={(value) => {
              if (value !== shown) changeStatus.mutate({ id: serviceId, status: value as Status });
            }}
          >
            {STATUSES.map((option) => (
              <DropdownMenuRadioItem key={option} value={option}>
                <StatusBadge status={option} />
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
