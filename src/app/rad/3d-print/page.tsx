"use client";

import { RadQuotationList } from "@/components/rad/RadQuotationList";
import { Printer } from "lucide-react";

export default function ThreeDPrintQuotationsPage() {
  return (
    <RadQuotationList
      type="THREE_D_PRINT"
      title="3D Print Quotations"
      subtitle="Rapid 3D prototyping estimates, infill parameters, and material quotations"
      createLabel="Create 3D Print Quote"
      createHref="/rad/create?type=THREE_D_PRINT"
      icon={Printer}
      badgeText="3DQ Series"
      themeColor="amber"
    />
  );
}

