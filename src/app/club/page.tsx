"use client";
import { useState, useEffect } from "react";
import { Bell, User, Users, Search, ChevronRight, Trophy, Info, Loader2, Map as MapIcon, Flag, Crown, Edit2, Trash2, Calendar, Clock, Activity, BarChart2, MapPin, Plus, Check, QrCode, ScanLine } from "lucide-react";
import { CrewLogo } from "@/components/CrewLogo";
import Link from "next/link";
import ClubBadge from "@/components/ClubBadge";
import { useSession } from "next-auth/react";
import FeedEvents from "@/components/FeedEvents";
import GlobalClubs from "@/components/GlobalClubs";
import Leaderboard from "@/components/Leaderboard";
import { globalCache } from "@/lib/cache";

export default function ClubTab() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState(globalCache.userData?.clubMembers?.length > 0 ? "События" : "Клубы");
  const [userData, setUserData] = useState<any>(globalCache.userData);
  const [isLoadingUser, setIsLoadingUser] = useState(!globalCache.userData);

  useEffect(() => {
    if (status === "loading") return; // Wait for session to initialize

    if (status === "authenticated" && session?.user) {
      fetch(`/api/users?userId=${(session.user as any).id}`)
        .then(async res => {
          const data = await res.json();
          if (res.status === 404) {
            import("next-auth/react").then(({ signOut }) => signOut({ callbackUrl: "/login" }));
          }
          return data;
        })
        .then(data => {
          if (data.user) {
            setUserData(data.user);
            globalCache.userData = data.user;
          }
          if (data?.user?.clubMembers && data.user.clubMembers.length > 0) {
            setActiveTab("События");
          }
          setIsLoadingUser(false);
        })
        .catch(() => setIsLoadingUser(false));
    } else {
      setIsLoadingUser(false);
    }
  }, [session, status]);

  const inClub = userData?.clubMembers?.length > 0;
  
  const tabs = inClub ? ["События", "Атлеты", "Клубы"] : ["Клубы"];

  if (isLoadingUser) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="animate-spin text-primary" size={40} /></div>;
  }

  return (
    <div className="flex flex-col min-h-[100dvh] text-foreground pb-24 pt-safe relative z-10">
      {/* Dynamic Background Glow */}
      <div className="fixed top-0 left-0 w-full h-[50vh] bg-gradient-to-b from-primary/10 to-transparent -z-10 pointer-events-none" />
      <div className="fixed top-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-primary/20 rounded-full blur-[100px] -z-10 pointer-events-none opacity-50" />

      {/* Header */}
      <div className="flex justify-between items-center px-4 pb-4">
        <div className="flex items-center gap-3">
          <Link href={inClub ? `/club/${userData?.clubMembers[0]?.clubId}` : "/club/create"}>
            <div className="w-12 h-12 rounded-[16px] bg-primary flex items-center justify-center shadow-[0_0_15px_rgba(204,255,0,0.4)]">
              <CrewLogo size={40} className="text-black" />
            </div>
          </Link>
          <div className="flex flex-col">
            <h1 className="text-2xl font-black tracking-tighter uppercase leading-none drop-shadow-sm">CREW</h1>
          </div>
        </div>
      </div>
      {/* Franchise CTA */}
      <div className="px-4 mb-4">
        <Link href={inClub ? `/club/${userData?.clubMembers[0]?.clubId}` : "/club/create"}>
          <div className="w-full bg-card/40 backdrop-blur-xl border border-white/5 rounded-[28px] p-5 flex items-center justify-between relative overflow-hidden group shadow-xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[50px] -z-10 group-hover:bg-primary/20 transition-all duration-500" />
            <div className="relative z-10">
              <h3 className="font-black uppercase tracking-tight text-lg mb-1 drop-shadow-sm">{inClub ? "Мой клуб" : "Создать клуб"}</h3>
              <p className="text-xs text-muted leading-relaxed">{inClub ? "Перейти к управлению и событиям клуба" : "Собери свою беговую банду и врывайся в топ"}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-black/40 border border-white/10 flex items-center justify-center text-primary relative z-10 group-hover:scale-110 group-hover:bg-primary/10 transition-all shadow-lg">
              <ChevronRight size={20} />
            </div>
          </div>
        </Link>
      </div>

      {/* Sub Tabs */}
      <div className="flex px-4 mt-2">
        {tabs.map((tab) => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 pb-3 text-center text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${
              activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content based on tab */}
      <div className="mt-6">
        {activeTab === "События" && <FeedEvents userData={userData} />}
        {activeTab === "Атлеты" && <Leaderboard clubId={userData?.clubMembers[0]?.clubId} />}
        {activeTab === "Клубы" && <GlobalClubs inClub={inClub} />}
      </div>
    </div>
  );
}
