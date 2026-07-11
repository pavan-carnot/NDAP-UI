export default function Footer() {
  return (
    <footer className="bg-[#1a6fa8] text-white mt-auto">
      <div className="max-w-screen-xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-white/20 rounded flex items-center justify-center text-xs font-bold text-white">i</div>
              <span className="font-semibold text-sm">icarKno<sup className="text-[9px]">TM</sup></span>
            </div>
            <p className="text-blue-100 text-xs leading-relaxed">
              Context-aware conversational AI with multi-domain expertise integration.
              Powered by Carnot Research — deep-tech AI for high-stakes sectors.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-blue-200 mb-3">
              Platform
            </h4>
            <ul className="space-y-1.5 text-xs text-blue-100">
              <li>Knowledge Agent</li>
              <li>Spatial Analytics</li>
              <li>Admin Dashboard</li>
              <li>API Documentation</li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-blue-200 mb-3">
              Carnot Research
            </h4>
            <ul className="space-y-1.5 text-xs text-blue-100">
              <li>carnotresearch.com</li>
              <li>iknow.carnotresearch.com</li>
              <li>playground.carnotresearch.com</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-6 pt-5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-blue-200 text-[11px]">
            © 2024 Carnot Research. All rights reserved.
          </p>
          <p className="text-blue-300 text-[11px]">
            icarKno — Powered by Carnot Research<sup className="text-[8px]">TM</sup>
          </p>
        </div>
      </div>
    </footer>
  );
}
