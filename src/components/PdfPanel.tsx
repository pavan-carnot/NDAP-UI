"use client";

import { useRef, useState, useEffect } from "react";
import { Viewer, Worker, SpecialZoomLevel } from "@react-pdf-viewer/core";
import "@react-pdf-viewer/core/lib/styles/index.css";

const WORKER_URL = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;
const HIGHLIGHT_DURATION = 7000;

interface PdfPanelProps {
  url: string;
  page: number;
  filename: string;
  onClose: () => void;
}

export default function PdfPanel({ url, page, filename, onClose }: PdfPanelProps) {
  const [highlightedPage, setHighlightedPage] = useState<number | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track current page in a ref so onDocumentLoad closure always reads latest value
  const pageRef = useRef(page);

  useEffect(() => {
    pageRef.current = page;
    // Clear stale highlight while new page/file loads
    setHighlightedPage(null);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
  }, [url, page]);

  function handleDocumentLoad() {
    setHighlightedPage(pageRef.current);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightedPage(null), HIGHLIGHT_DURATION);
  }

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50 flex-shrink-0">
        <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
        <span className="text-xs font-medium text-gray-700 truncate flex-1" title={filename}>{filename}</span>
        <button onClick={onClose} className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Info bar */}
      <div className="flex items-center justify-center px-3 py-1 border-b border-gray-100 bg-gray-50 flex-shrink-0">
        <span className="text-[10px] text-gray-400">citing page {page}</span>
      </div>

      {/* Worker stays mounted — keeps parsed PDF cached across page navigations */}
      <div className="flex-1" style={{ overflow: "hidden" }}>
        <Worker workerUrl={WORKER_URL}>
          {/* key on url+page: Viewer remounts per citation, Worker does not */}
          <Viewer
            key={`${url}::${page}`}
            fileUrl={url}
            initialPage={page - 1}
            defaultScale={SpecialZoomLevel.PageWidth}
            onDocumentLoad={handleDocumentLoad}
            renderPage={(props) => (
              <>
                {props.canvasLayer.children}
                {props.textLayer.children}
                {props.annotationLayer.children}
                {highlightedPage === props.pageIndex + 1 && (
                  <div className="pdf-page-highlight-overlay" />
                )}
              </>
            )}
          />
        </Worker>
      </div>
    </div>
  );
}
