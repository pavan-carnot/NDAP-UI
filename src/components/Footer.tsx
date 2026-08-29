export default function Footer() {
  return (
    <footer style={{ background: "#5C0A3E" }} className="text-white mt-auto">
      <div className="max-w-screen-xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold" style={{ background: "rgba(201,162,39,0.2)", color: "#C9A227" }}>I</div>
              <span className="font-semibold text-sm tracking-wide">Integrated Defence Staff</span>
            </div>
            <p className="text-white/60 text-xs leading-relaxed">
              Ministry of Defence, Government of India — Context-aware conversational AI
              with multi-domain defence expertise. Authorised access only.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#C9A227" }}>
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
            <h4 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#C9A227" }}>
              IDS
            </h4>
            <ul className="space-y-1.5 text-xs text-white/60">
              <li>ids.nic.in</li>
              <li>mod.gov.in</li>
              <li>carnotresearch.com</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-6 pt-5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-white/40 text-[11px]">
            © 2024 Integrated Defence Staff. All rights reserved.
          </p>
          <p className="text-white/40 text-[11px]">
            IDS — Ministry of Defence, Government of India
          </p>
        </div>
      </div>
    </footer>
  );
}
