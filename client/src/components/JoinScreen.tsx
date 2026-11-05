import { useState, FormEvent } from "react";
import { ArrowRight, Users, Pencil, Layers, Lock } from "lucide-react";

interface JoinScreenProps {
  onJoin: (
    userName: string,
    roomId: string,
    opts: { enterPin?: string; setPin?: string }
  ) => void;
  joinError?: string;
}

function randomRoomId() {
  return Math.random().toString(36).slice(2, 10);
}

export function JoinScreen({ onJoin, joinError }: JoinScreenProps) {
  const params = new URLSearchParams(window.location.search);
  const [userName, setUserName] = useState(
    localStorage.getItem("collab_name") ?? ""
  );
  const [roomId, setRoomId] = useState(params.get("room") ?? randomRoomId());
  const [enterPin, setEnterPin] = useState("");
  const [setRoomPin, setSetRoomPin] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const name = userName.trim() || "Misafir";
    const room = roomId.trim() || randomRoomId();
    localStorage.setItem("collab_name", name);
    onJoin(name, room, {
      enterPin: enterPin.trim() || undefined,
      setPin: setRoomPin.trim() || undefined,
    });
  };

  return (
    <div className="flex h-full w-full">
      <div className="relative hidden w-[48%] flex-col justify-between overflow-hidden bg-ink p-12 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 80%, #0d9488 0%, transparent 50%),
              radial-gradient(circle at 80% 20%, #0f766e 0%, transparent 40%)`,
          }}
        />
        <div className="relative">
          <p className="font-display text-5xl font-semibold leading-tight text-stone-100">
            Birlikte
            <br />
            <span className="text-brand-light">çizin.</span>
          </p>
          <p className="mt-4 max-w-sm text-lg text-stone-400">
            Gerçek zamanlı beyaz tahta — ekip toplantıları, dersler ve fikir
            haritaları için.
          </p>
        </div>
        <ul className="relative space-y-4">
          {[
            { icon: Users, text: "Aynı odada sınırsız katılımcı" },
            { icon: Pencil, text: "Kalem, şekil ve metin araçları" },
            { icon: Layers, text: "Anlık senkron ve canlı imleçler" },
          ].map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-stone-400">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
                <Icon size={18} className="text-brand-light" />
              </span>
              {text}
            </li>
          ))}
        </ul>
        <p className="relative text-sm text-stone-600">Draw Whiteboard</p>
      </div>

      <div className="flex flex-1 flex-col justify-center bg-paper px-8 py-12 sm:px-16">
        <div className="mx-auto w-full max-w-sm">
          <p className="font-display text-3xl font-semibold text-ink lg:hidden">
            Draw Whiteboard
          </p>
          <p className="mt-2 text-stone-600 lg:mt-0">Odaya katılın</p>

          {joinError && (
            <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {joinError}
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-10 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink">
                Adınız
              </span>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Adınızı yazın"
                maxLength={24}
                className="w-full rounded-xl border border-paper-line bg-white px-4 py-3.5 text-ink shadow-sm placeholder:text-stone-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink">
                Oda kodu
              </span>
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="ör. tasarım-2024"
                maxLength={64}
                className="w-full rounded-xl border border-paper-line bg-white px-4 py-3.5 font-mono text-ink shadow-sm placeholder:text-stone-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
              />
            </label>

            <label className="block">
              <span className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
                <Lock size={14} />
                Odayı koru — şifre belirle
              </span>
              <span className="mb-2 block text-xs text-stone-500">
                İlk girişte doldurursanız oda kilitlenir. Sonraki her girişte
                bu şifre zorunludur.
              </span>
              <input
                type="password"
                value={setRoomPin}
                onChange={(e) => setSetRoomPin(e.target.value)}
                placeholder="Yeni oda için şifre (opsiyonel)"
                autoComplete="new-password"
                className="w-full rounded-xl border border-paper-line bg-white px-4 py-3.5 text-ink shadow-sm placeholder:text-stone-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink">
                Odaya giriş şifresi
              </span>
              <span className="mb-2 block text-xs text-stone-500">
                Korumalı bir odaya katılıyorsanız şifreyi girin.
              </span>
              <input
                type="password"
                value={enterPin}
                onChange={(e) => setEnterPin(e.target.value)}
                placeholder="Korumalı oda şifresi"
                autoComplete="current-password"
                className="w-full rounded-xl border border-paper-line bg-white px-4 py-3.5 text-ink shadow-sm placeholder:text-stone-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
              />
            </label>

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-4 font-semibold text-white shadow-lg shadow-brand/25 transition hover:bg-brand-dark active:scale-[0.99]"
            >
              Tahtaya gir
              <ArrowRight size={18} />
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-stone-500">
            Davet linkinde yalnızca oda kodu paylaşılır — şifreyi ayrıca iletin.
          </p>
        </div>
      </div>
    </div>
  );
}
