import { redirect } from "next/navigation";
import { PRIMARY_TOOL } from "@/lib/tools";

export default function ToolsIndexPage() {
  redirect(PRIMARY_TOOL.href);
}
