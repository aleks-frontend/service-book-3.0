import { useId } from "react";
import { useTranslation } from "react-i18next";
import { useServiceLogQuery } from "@/lib/services";
import { PhotoThumbnails } from "./PhotoThumbnails";

/**
 * Every photo in a service's log, oldest first, near the top of its drawer;
 * nothing while there are none. A log that fails to load says so on the Log tab.
 */
export function ServicePhotos({ serviceId }: { serviceId: string }) {
  const { t } = useTranslation();
  const headingId = useId();
  const { data: entries } = useServiceLogQuery(serviceId);
  const photos = entries?.flatMap((entry) => entry.photos) ?? [];
  if (photos.length === 0) return null;

  return (
    <section className="space-y-2" aria-labelledby={headingId}>
      <h3 id={headingId} className="text-sm font-semibold">
        {t("Photos")}
      </h3>
      <PhotoThumbnails serviceId={serviceId} photos={photos} />
    </section>
  );
}
