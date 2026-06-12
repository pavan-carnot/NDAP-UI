export default function Footer() {
  return (
    <footer className="bg-ndap-navyDark text-white mt-auto">
      {/* tricolor strip */}
      <div className="flex w-full h-[3px]">
        <div className="flex-1 bg-ndap-saffron" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-green-500" />
      </div>

      <div className="max-w-screen-xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-ndap-saffron rounded flex items-center justify-center text-xs font-bold text-white">N</div>
              <span className="font-semibold text-sm">NDAP</span>
            </div>
            <p className="text-blue-200 text-xs leading-relaxed">
              National Data and Analytics Platform — an initiative of NITI Aayog,
              Government of India, empowering citizens with open data access and
              AI-driven insights.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-blue-300 mb-3">
              Platform
            </h4>
            <ul className="space-y-1.5 text-xs text-blue-200">
              <li>Chat Assistant</li>
              <li>Dataset Explorer</li>
              <li>Admin Dashboard</li>
              <li>API Documentation</li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-blue-300 mb-3">
              Government Links
            </h4>
            <ul className="space-y-1.5 text-xs text-blue-200">
              <li>India.gov.in</li>
              <li>NITI Aayog</li>
              <li>data.gov.in</li>
              <li>Digital India</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-6 pt-5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-blue-300 text-[11px]">
            © 2024 NITI Aayog, Government of India. All rights reserved.
          </p>
          <p className="text-blue-400 text-[11px]">
            Content on this site is published by NITI Aayog — GovData Analyst POC
          </p>
        </div>
      </div>
    </footer>
  );
}
