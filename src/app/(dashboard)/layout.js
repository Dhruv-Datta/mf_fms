import Navbar from "@/components/Navbar";
import { CacheProvider } from "@/lib/CacheContext";
import AuthGate from "@/components/AuthGate";

export default function DashboardLayout({ children }) {
  return (
    <AuthGate>
      <CacheProvider>
        <div className="min-h-screen relative overflow-hidden bg-white">
          {/* Ambient background glows */}
          <div className="fixed inset-0 pointer-events-none">
            <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] bg-emerald-200/20 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-15%] right-[-5%] w-[450px] h-[450px] bg-teal-200/15 rounded-full blur-[100px]" />
            <div className="absolute top-[30%] right-[10%] w-[300px] h-[300px] bg-cyan-200/10 rounded-full blur-[90px]" />
          </div>
          <div className="relative z-10">
            <Navbar />
            <main className="pt-20">
              {children}
            </main>
          </div>
        </div>
      </CacheProvider>
    </AuthGate>
  );
}
