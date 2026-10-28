import { FileSpreadsheet, FileText, Presentation } from "lucide-react";

export default function FileIcon({ filename }: { filename: string }) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["xlsx", "xls", "csv"].includes(ext)) return <FileSpreadsheet className="w-3.5 h-3.5 flex-shrink-0 text-green-700" />;
  if (["pptx", "ppt"].includes(ext)) return <Presentation className="w-3.5 h-3.5 flex-shrink-0 text-orange-600" />;
  if (ext === "pdf") return <FileText className="w-3.5 h-3.5 flex-shrink-0 text-red-700" />;
  return <FileText className="w-3.5 h-3.5 flex-shrink-0 text-blue-700" />;
}
