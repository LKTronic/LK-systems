"use client";

import { RadQuotationList } from "@/components/rad/RadQuotationList";
import { GraduationCap } from "lucide-react";

export default function UniQuotationsPage() {
  return (
    <RadQuotationList
      type="UNI_QUOTATION"
      title="Uni Quotations"
      subtitle="University & academic project proposals with components, images, engineering charges & discount"
      createLabel="New Uni Quotation"
      savedLabel="Saved Quotations"
      createHref="/rad/create?type=UNI_QUOTATION"
      icon={GraduationCap}
      badgeText="PQV Series"
      themeColor="blue"
    />
  );
}
