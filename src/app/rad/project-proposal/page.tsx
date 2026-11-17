"use client";

import { RadQuotationList } from "@/components/rad/RadQuotationList";
import { Lightbulb } from "lucide-react";

export default function ProjectProposalsPage() {
  return (
    <RadQuotationList
      type="PROJECT_PROPOSAL"
      title="Project Proposals"
      subtitle="Client engineering solutions, hardware bills of materials, and service investments"
      createLabel="Create Project Proposal"
      createHref="/rad/create?type=PROJECT_PROPOSAL"
      icon={Lightbulb}
      badgeText="PQV Series"
      themeColor="teal"
    />
  );
}

