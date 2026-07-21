export default function Footer() {
  return (
    <footer className="bg-[#1a1a1a] text-white mt-auto">
      <div className="max-w-screen-xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-[#F47920]/20 rounded flex items-center justify-center text-xs font-bold text-[#F47920]">I</div>
              <span className="font-semibold text-sm">IHFC</span>
            </div>
            <p className="text-white/60 text-xs leading-relaxed">
              Technology Innovation Hub of IIT Delhi — Context-aware conversational AI
              with multi-domain expertise integration. Powered by IHFC.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-[#F47920] mb-3">
              Platform
            </h4>
            <ul className="space-y-1.5 text-xs text-white/60">
              <li>Knowledge Agent</li>
              <li>Spatial Analytics</li>
              <li>Admin Dashboard</li>
              <li>API Documentation</li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-[#F47920] mb-3">
              IHFC
            </h4>
            <ul className="space-y-1.5 text-xs text-white/60">
              <li>carnotresearch.com</li>
              <li>iknow.carnotresearch.com</li>
              <li>playground.carnotresearch.com</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-6 pt-5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-white/40 text-[11px]">
            © 2024 IHFC. All rights reserved.
          </p>
          <p className="text-white/40 text-[11px]">
            IHFC — Powered by IHFC
          </p>
        </div>
      </div>
    </footer>
  );
}
