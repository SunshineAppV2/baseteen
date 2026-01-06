import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8">
      <div className="space-y-4">
        <h1 className="text-5xl font-extrabold tracking-tight text-text-primary">
          <span className="text-primary">Baseteen</span>
        </h1>
        <p className="text-xl text-text-secondary max-w-2xl">
          Ministério do Adolescente
        </p>
      </div>

      <div className="flex gap-4">
        <Link
          href="/login"
          className="bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 transition-all hover:scale-105"
        >
          Acessar Painel <ArrowRight size={20} />
        </Link>
      </div>
    </div>
  );
}
