"use client";

import { RadQuotationList } from "@/components/rad/RadQuotationList";
import { Cpu } from "lucide-react";

export default function PcbQuotationsPage() {
  return (
    <RadQuotationList
      type="PCB"
      title="PCB Fabrication Plans"
      subtitle="PCB prototype manufacturing plans, layer parameters, and fabrication costs"
      createLabel="New PCB Plan"
      savedLabel="Saved Plans"
      createHref="/rad/create?type=PCB"
      icon={Cpu}
      badgeText="QV Series"
      themeColor="emerald"
    />
  );
}

