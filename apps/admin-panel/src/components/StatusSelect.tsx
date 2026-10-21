import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { STATUSES, type Status } from "@servicebook/schemas";
import { useOfferServiceReport } from "@/lib/serviceReport";
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
 * Once a change to Completed saves, it offers the service report.
 */
export function StatusSelect({ serviceId, status }: StatusSelectProps) {
  const { t } = useTranslation();
  const changeStatus = useChangeStatusMutation();
  const offerServiceReport = useOfferServiceReport();
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
              if (value === shown) return;
              // Not mutate's own onSuccess: that is skipped when this badge unmounts first,
              // as it does when the saved status drops the service out of a filtered list.
              changeStatus.mutateAsync({ id: serviceId, status: value as Status }).then(
                (saved) => {
                  if (saved.status === "COMPLETED") offerServiceReport(saved);
                },
                // The mutation's onError already reports the failure.
                () => {},
              );
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
