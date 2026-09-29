"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type JoinableTeam = { id: string; name: string; memberCount: number };

export function TeamSetup() {
 const [name,setName]=useState(""); const [teams,setTeams]=useState<JoinableTeam[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState(""); const [busy,setBusy]=useState(false); const router=useRouter();
 useEffect(()=>{ let active=true; void fetch("/api/teams").then(async response=>{ const data=await response.json(); if(!response.ok) throw new Error(data.error); if(active) setTeams(data.teams); }).catch(caught=>{ if(active) setError(caught instanceof Error?caught.message:"Unable to list teams."); }).finally(()=>{ if(active) setLoading(false); }); return ()=>{active=false;}; },[]);
 async function run(body: { action: "create"; name: string } | { action: "join"; teamId: string }) { setBusy(true);setError(""); try { const r=await fetch("/api/teams", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}); const d=await r.json(); if(!r.ok) throw new Error(d.error); router.push(`/teams/${d.teamId}`); router.refresh(); } catch(e){setError(e instanceof Error?e.message:"Unable to continue.");} finally{setBusy(false);} }
 return <section className="authPanel panel"><div className="authIntro"><p className="eyebrow">Team setup</p><h1>Start or join a team.</h1><p>Choose an open bakery team or create one. Teams need 3–6 members before the project deadline.</p></div><div className="authCard"><form onSubmit={(e)=>{e.preventDefault();void run({action:"create",name});}}><label>New team name<input required minLength={3} maxLength={80} value={name} onChange={e=>setName(e.target.value)} /></label><button className="primary" disabled={busy}>{busy?"Creating…":"Create team"}</button></form><div className="teamDirectory"><h2>Join an open team</h2>{loading?<p className="mutedCopy">Loading teams…</p>:teams.length?teams.map(team=><div className="teamDirectoryRow" key={team.id}><span><strong>{team.name}</strong><small>{team.memberCount}/6 members</small></span><button className="secondary" disabled={busy} onClick={()=>void run({action:"join",teamId:team.id})}>Join team</button></div>):<p className="mutedCopy">No open teams yet. Create the first one.</p>}</div>{error&&<p className="error">{error}</p>}</div></section>;
}
