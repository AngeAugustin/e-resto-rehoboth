"use client";

import { useParams } from "next/navigation";
import SaleWizard from "@/components/sales/SaleWizard";

export default function EditSalePage() {
  const { id } = useParams<{ id: string }>();
  return <SaleWizard mode="edit" editSaleId={id} />;
}
